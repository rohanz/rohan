// Shared DOM and interactions for the BQST article: the DSP lab (EQ, transfer,
// harmonics and aliasing charts with their drive knobs) and the drum-loop A/B
// demo. Each theme supplies its palette, canvas sizing policy and DPR; chart
// drawing stays in `bqst-render.ts` and playback in `../audio/bqst-engine.ts`.

import type { VisualPalette } from './palette';
import { withAlpha } from './color';
import {
  drawEq, drawTransfer, drawHarmonics, drawAliasing, bqstKnobTicks, legendForBqstVisual,
  BQST_EQ_HEIGHT, BQST_TRANSFER_HEIGHT, BQST_HARMONICS_HEIGHT, BQST_ALIASING_HEIGHT,
} from './bqst-render';
import type { SizeCanvas } from './quantlab-dom';
import { BqstEngine } from '../audio/bqst-engine';
import { hasWebAudio, sharedAudioContext } from '../audio/shared-context';
import type { BqstVersion } from '../audio/bqst-transport';
import type { WavWaveform } from '../audio/bqst-wav';

export interface BqstLabOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  sizeCanvas: SizeCanvas;
}

export interface BqstAudioDemoOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  /** Backing-store scale for the waveform canvas (blueprint floors it at 2). */
  dpr: () => number;
  /** Slide a separate playhead line over the progress fill (transit, classic). */
  playhead?: boolean;
}

type LabType = 'eq' | 'transfer' | 'harmonics' | 'aliasing';
type DriveType = 'transfer' | 'harmonics';

const LAB_SLOTS: Array<{ id: string; type: LabType; title: string; meta: string; label: string }> = [
  { id: 'bqst-eq-visual', type: 'eq', title: 'baxandall-style eq curves', meta: 'q 0.38 · all stepped shelf positions · +/-6 db', label: 'BQST low and high shelf frequency response' },
  { id: 'bqst-transfer-visual', type: 'transfer', title: 'saturation transfer curve', meta: 'static input sweep · follows the drive control', label: 'BQST Cream and Grit saturation transfer curves' },
  { id: 'bqst-harmonics-visual', type: 'harmonics', title: 'harmonic fingerprint', meta: '1 khz sine · follows the drive control above', label: 'BQST Cream and Grit harmonic profile' },
  { id: 'bqst-oversampling-visual', type: 'aliasing', title: 'why oversampling matters', meta: '6 khz tone · harmonic foldback at 44.1 khz', label: 'BQST oversampling and aliasing visualization' },
];

const HEIGHTS: Record<LabType, number> = {
  eq: BQST_EQ_HEIGHT,
  transfer: BQST_TRANSFER_HEIGHT,
  harmonics: BQST_HARMONICS_HEIGHT,
  aliasing: BQST_ALIASING_HEIGHT,
};

// ============================================================
// BQST DSP LAB
// ============================================================
/** Mount the four DSP charts found under `root`; returns cleanup. */
export function initBqstDspLab({ root, palette, sizeCanvas }: BqstLabOptions): () => void {
  const slots = LAB_SLOTS
    .map((d) => ({ ...d, node: root.querySelector<HTMLElement>(`#${d.id}`), canvas: null as HTMLCanvasElement | null }))
    .filter((s): s is typeof s & { node: HTMLElement } => !!s.node);
  if (slots.length === 0) return () => {};

  slots.forEach((slot) => {
    slot.node.innerHTML = `
      <div class="bqst-lab" data-bqst-visual="${slot.type}">
        <div class="bqst-lab-header">
          <span class="bqst-lab-kicker">${slot.title}</span>
          <span class="bqst-lab-meta">${slot.meta}</span>
        </div>
        ${
          slot.type === 'transfer' || slot.type === 'harmonics'
            ? `<div class="bqst-interactive-row">
                <div class="bqst-drive-control" data-bqst-drive="${slot.type}">
                  <div class="bqst-drive-module">
                    <div class="bqst-knob-stage" role="slider" tabindex="0" aria-label="BQST saturation drive" aria-valuemin="0" aria-valuemax="18" aria-valuenow="0" aria-valuetext="0.0 dB">
                      <div class="bqst-knob-ticks" aria-hidden="true">${bqstKnobTicks()}</div>
                      <div class="bqst-mini-knob" aria-hidden="true"><span></span></div>
                    </div>
                    <label><span>drive</span><strong>0.0 dB</strong></label>
                  </div>
                  <input type="range" min="0" max="18" value="0" step="0.1" aria-label="BQST saturation drive">
                </div>
                <canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>
              </div>`
            : `<canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>`
        }
        <div class="bqst-legend">${legendForBqstVisual(slot.type, palette())}</div>
      </div>`;
    slot.canvas = slot.node.querySelector<HTMLCanvasElement>('.bqst-visual-canvas');
  });

  const driveState: Record<DriveType, number> = { transfer: 0, harmonics: 0 };
  const driveControls = Array.from(root.querySelectorAll<HTMLElement>('.bqst-drive-control')).map((node) => ({
    type: node.dataset.bqstDrive as DriveType,
    input: node.querySelector('input') as HTMLInputElement,
    value: node.querySelector('strong') as HTMLElement,
    stage: node.querySelector('.bqst-knob-stage') as HTMLElement,
    knob: node.querySelector('.bqst-mini-knob') as HTMLElement,
  }));
  type DriveControl = (typeof driveControls)[number];

  function resizeCanvas(canvas: HTMLCanvasElement, height: number) {
    const rect = canvas.getBoundingClientRect();
    canvas.style.height = `${height}px`;
    return sizeCanvas(canvas, Math.max(rect.width, 280), height);
  }
  const driveDbFor = (type: DriveType) => driveState[type] ?? 0;
  const drive01For = (type: DriveType) => Math.max(0, Math.min(1, driveDbFor(type) / 18));

  function updateDriveControl(control: DriveControl | undefined) {
    if (!control) return;
    const driveDb = driveDbFor(control.type);
    const drive01 = drive01For(control.type);
    if (control.value) control.value.textContent = `${driveDb.toFixed(1)} dB`;
    if (control.knob) control.knob.style.setProperty('--bqst-knob-angle', `${-135 + drive01 * 270}deg`);
    if (control.input) control.input.value = String(driveDb);
    if (control.stage) {
      control.stage.setAttribute('aria-valuenow', driveDb.toFixed(1));
      control.stage.setAttribute('aria-valuetext', `${driveDb.toFixed(1)} dB`);
    }
  }
  // Drive is continuous (display rounds to 0.1 dB). Rounding the state made a
  // drag move in uneven 1- and 2-step jumps. The knob and its canvas update
  // together in the next frame, so the curve never trails the knob.
  const dirtyDrive = new Set<DriveType>();
  function setDriveValue(type: DriveType, value: number) {
    driveState[type] = Math.max(0, Math.min(18, value));
    dirtyDrive.add(type);
    requestBqstDraw();
  }

  // Sized contexts are cached: a drive change redraws its own canvas in place,
  // and only a full pass (first paint, resize, theme) re-measures and re-sizes.
  const sized = new Map<HTMLCanvasElement, { ctx: CanvasRenderingContext2D; w: number }>();
  function drawSlot(slot: (typeof slots)[number], resize: boolean) {
    if (!slot.canvas) return;
    let entry = sized.get(slot.canvas);
    if (resize || !entry) {
      const ctx = resizeCanvas(slot.canvas, HEIGHTS[slot.type]);
      // the raw layout width, not the 280 sizing floor: the captions switch on it
      entry = { ctx, w: slot.canvas.getBoundingClientRect().width };
      sized.set(slot.canvas, entry);
    }
    const { ctx } = entry;
    const opts = { w: entry.w, palette: palette() };
    if (!resize) ctx.clearRect(0, 0, slot.canvas.width, slot.canvas.height);
    if (slot.type === 'eq') drawEq(ctx, opts);
    else if (slot.type === 'transfer') drawTransfer(ctx, opts, driveDbFor('transfer'));
    else if (slot.type === 'harmonics') drawHarmonics(ctx, opts, driveDbFor('harmonics'));
    else drawAliasing(ctx, opts);
  }
  const drawAll = () => slots.forEach((slot) => drawSlot(slot, true));

  driveControls.forEach(updateDriveControl);
  const driveListeners: Array<{ control: DriveControl; onInput: () => void; onPointerDown: (e: PointerEvent) => void; onKeyDown: (e: KeyboardEvent) => void }> = [];
  let activeKnobControl: DriveControl | null = null;
  let knobDragStartY = 0;
  let knobDragStartValue = 0;
  const onKnobPointerMove = (event: PointerEvent) => {
    if (!activeKnobControl) return;
    event.preventDefault();
    const pixelsPerDb = event.shiftKey ? 18 : 7;
    setDriveValue(activeKnobControl.type, knobDragStartValue + (knobDragStartY - event.clientY) / pixelsPerDb);
  };
  const onKnobPointerUp = (event: PointerEvent) => {
    if (!activeKnobControl) return;
    activeKnobControl.stage.releasePointerCapture?.(event.pointerId);
    activeKnobControl.stage.classList.remove('is-dragging');
    activeKnobControl = null;
    window.removeEventListener('pointermove', onKnobPointerMove);
    window.removeEventListener('pointerup', onKnobPointerUp);
  };
  const onKnobPointerDown = (event: PointerEvent, control: DriveControl) => {
    if (!control.stage) return;
    activeKnobControl = control;
    knobDragStartY = event.clientY;
    knobDragStartValue = driveDbFor(control.type);
    // Mark this focus as pointer-initiated BEFORE the programmatic focus():
    // .focus() inherits the browser's current input modality, and right after
    // page load that modality is still "keyboard" — so the very first knob grab
    // matched :focus-visible and flashed the red keyboard ring (and never again
    // once pointer modality was established). The class scopes the ring in CSS
    // to true keyboard focus only; it clears on blur so Tab still shows it.
    control.stage.classList.add('pointer-grab');
    control.stage.focus();
    control.stage.setPointerCapture?.(event.pointerId);
    control.stage.classList.add('is-dragging');
    window.addEventListener('pointermove', onKnobPointerMove);
    window.addEventListener('pointerup', onKnobPointerUp);
  };
  const onKnobKeyDown = (event: KeyboardEvent, control: DriveControl) => {
    const fine = event.shiftKey ? 0.1 : 0.5;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); setDriveValue(control.type, driveDbFor(control.type) + fine); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); setDriveValue(control.type, driveDbFor(control.type) - fine); }
    else if (event.key === 'Home') { event.preventDefault(); setDriveValue(control.type, 0); }
    else if (event.key === 'End') { event.preventDefault(); setDriveValue(control.type, 18); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDriveValue(control.type, 0); }
  };
  driveControls.forEach((control) => {
    const onInput = () => setDriveValue(control.type, Number(control.input.value));
    const onPointerDown = (event: PointerEvent) => onKnobPointerDown(event, control);
    const onKeyDown = (event: KeyboardEvent) => onKnobKeyDown(event, control);
    if (control.input) control.input.addEventListener('input', onInput);
    if (control.stage) {
      control.stage.addEventListener('pointerdown', onPointerDown);
      control.stage.addEventListener('keydown', onKeyDown);
      // Clear the pointer-focus mark when focus leaves, so a subsequent Tab
      // focus (true keyboard) gets the visible ring again.
      control.stage.addEventListener('blur', () => control.stage.classList.remove('pointer-grab'));
    }
    driveListeners.push({ control, onInput, onPointerDown, onKeyDown });
  });

  let isActive = true;
  // Coalesce redraws: knob drags fire many state changes per frame; queueing a
  // rAF for each would redraw all four canvases several times per frame.
  let bqstDrawId: number | null = null;
  let fullRedraw = true; // first paint, resize, fonts and theme changes re-size every canvas
  function requestBqstDraw() {
    if (bqstDrawId !== null) return; // one already queued for this frame
    bqstDrawId = requestAnimationFrame(() => {
      bqstDrawId = null;
      if (!isActive) return;
      if (fullRedraw) { fullRedraw = false; dirtyDrive.clear(); driveControls.forEach(updateDriveControl); drawAll(); return; }
      dirtyDrive.forEach((type) => {
        updateDriveControl(driveControls.find((c) => c.type === type));
        slots.filter((slot) => slot.type === type).forEach((slot) => drawSlot(slot, false));
      });
      dirtyDrive.clear();
    });
  }
  requestBqstDraw();
  document.fonts?.ready.then(() => { fullRedraw = true; requestBqstDraw(); }).catch(() => {});
  let resizeTimer: number | undefined;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { fullRedraw = true; requestBqstDraw(); }, 150); };
  window.addEventListener('resize', onResize);

  return () => {
    isActive = false;
    if (bqstDrawId !== null) cancelAnimationFrame(bqstDrawId);
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    driveListeners.forEach(({ control, onInput, onPointerDown, onKeyDown }) => {
      if (control.input) control.input.removeEventListener('input', onInput);
      if (control.stage) {
        control.stage.removeEventListener('pointerdown', onPointerDown);
        control.stage.removeEventListener('keydown', onKeyDown);
      }
    });
    window.removeEventListener('pointermove', onKnobPointerMove);
    window.removeEventListener('pointerup', onKnobPointerUp);
  };
}

// ============================================================
// BQST A/B AUDIO DEMO
// ============================================================
/** Mount the drum-loop A/B player into `#bqst-audio-demo`; returns cleanup. */
export function initBqstAudioDemo(options: BqstAudioDemoOptions): () => void {
  const placeholder = options.root.querySelector<HTMLElement>('#bqst-audio-demo');
  if (!placeholder) return () => {};
  const abs = (u?: string) => (u && !/^(https?:)?\//.test(u) ? `/${u}` : u);
  const cleanUrl = abs(placeholder.dataset.clean);
  const processedUrl = abs(placeholder.dataset.processed);
  const bpm = Number.parseFloat(placeholder.dataset.bpm || '90');
  if (!cleanUrl || !processedUrl || !hasWebAudio()) return () => {};

  const PLAY = '<span aria-hidden="true">▶</span>';
  const PAUSE = '<span aria-hidden="true">❚❚</span>';

  placeholder.innerHTML = `
    <div class="bqst-audio-demo">
      <div class="bqst-audio-demo-header">
        <span class="bqst-lab-kicker">drum loop a/b test</span>
      </div>
      <div class="bqst-audio-demo-body">
        <div class="bqst-audio-main">
          <div class="bqst-audio-controls">
            <button class="bqst-audio-play" type="button" aria-label="Play BQST audio demo" aria-pressed="false">${PLAY}</button>
            <div class="bqst-audio-toggle" role="group" aria-label="Choose audio demo version">
              <button type="button" class="is-active" data-version="clean" aria-pressed="true">clean</button>
              <button type="button" data-version="processed" aria-pressed="false">bqst</button>
            </div>
          </div>
          <div class="bqst-audio-wave" aria-hidden="true"><canvas></canvas><span></span><i></i>${options.playhead ? '<b class="bqst-audio-head"></b>' : ''}</div>
        </div>
      </div>
    </div>`;

  const root = placeholder.querySelector('.bqst-audio-demo') as HTMLElement;
  const playButton = root.querySelector('.bqst-audio-play') as HTMLButtonElement;
  const versionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.bqst-audio-toggle button'));
  const waveCanvas = root.querySelector('.bqst-audio-wave canvas') as HTMLCanvasElement;
  const waveCtx = waveCanvas.getContext('2d')!;
  const progress = root.querySelector('.bqst-audio-wave i') as HTMLElement;
  const playhead = root.querySelector<HTMLElement>('.bqst-audio-head');

  root.classList.add('is-ready');

  // -- waveform drawing (colours from the palette; only the audio engine
  // below knows about playback) --
  let cleanWaveform: WavWaveform | null = null;
  let processedWaveform: WavWaveform | null = null;
  let previousWaveVersion: BqstVersion | null = null;
  let waveFadeId: number | null = null;
  let waveFadeStart = 0;

  const waveformForVersion = (version: BqstVersion) => (version === 'clean' ? cleanWaveform : processedWaveform);

  // The processed take in its own colour, the clean one in the reference grey.
  function waveColors(version: BqstVersion, alpha: number) {
    const { bqst } = options.palette();
    const tone = withAlpha(version === 'processed' ? bqst.waveProcessed : bqst.seriesReference);
    return version === 'processed'
      ? { line: tone(0.8 * alpha), fill: tone(0.14 * alpha) }
      : { line: tone(0.72 * alpha), fill: tone(0.13 * alpha) };
  }

  // One vertical min/max stroke per device pixel column, then the centre band.
  function strokeColumns(columns: (x: number) => { min: number; max: number }, version: BqstVersion, alpha: number) {
    const width = waveCanvas.width;
    const height = waveCanvas.height;
    const dpr = options.dpr();
    const { line, fill } = waveColors(version, alpha);
    const center = height * 0.5;
    const amp = height * 0.42;
    waveCtx.beginPath();
    for (let x = 0; x < width; x++) {
      const { min, max } = columns(x);
      waveCtx.moveTo(x + 0.5, center - max * amp);
      waveCtx.lineTo(x + 0.5, center - min * amp);
    }
    waveCtx.strokeStyle = line;
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.stroke();
    waveCtx.fillStyle = fill;
    waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
  }

  // Before decode finishes: the peaks parsed straight from the WAV header pass.
  function drawWaveformData(waveform: WavWaveform | null, version: BqstVersion, alpha = 1) {
    if (!waveform?.peaks?.length) return;
    const { peaks } = waveform;
    const width = waveCanvas.width;
    strokeColumns((x) => peaks[Math.min(peaks.length - 1, Math.floor((x / width) * peaks.length))], version, alpha);
  }

  function drawBufferWaveform(buffer: AudioBuffer, version: BqstVersion, alpha = 1) {
    const dataL = buffer.getChannelData(0);
    const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;
    const step = Math.max(1, Math.floor(buffer.length / waveCanvas.width));
    strokeColumns((x) => {
      let min = 1, max = -1;
      const start = x * step;
      const end = Math.min(buffer.length, start + step);
      for (let i = start; i < end; i++) {
        const sample = (dataL[i] + dataR[i]) * 0.5;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      return { min, max };
    }, version, alpha);
  }

  function drawWaveform(blend = 1) {
    const rect = waveCanvas.getBoundingClientRect();
    const dpr = options.dpr();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (waveCanvas.width !== width || waveCanvas.height !== height) {
      waveCanvas.width = width;
      waveCanvas.height = height;
    }
    waveCtx.clearRect(0, 0, width, height);
    const activeVersion = engine.version;
    const buffer = engine.getBuffer(activeVersion);
    const waveform = waveformForVersion(activeVersion);
    const duration = buffer?.duration || waveform?.duration || 0;
    const palette = options.palette();
    const gridCol = palette.ink(0.10);
    const subGridCol = palette.ink(0.055);
    const barCol = withAlpha(palette.bqst.seriesPrimary)(0.24);
    const center = height * 0.5;
    if (duration > 0 && Number.isFinite(bpm) && bpm > 0) {
      const beatSeconds = 60 / bpm;
      const divisionSeconds = beatSeconds / 4;
      const divisions = Math.floor(duration / divisionSeconds + 0.001);
      for (let division = 0; division <= divisions; division++) {
        const x = Math.round((division * divisionSeconds / duration) * width) + 0.5;
        const isBar = division % 16 === 0;
        const isBeat = division % 4 === 0;
        waveCtx.strokeStyle = isBar ? barCol : isBeat ? gridCol : subGridCol;
        waveCtx.lineWidth = isBar ? Math.max(1.5, dpr * 1.25) : Math.max(1, dpr * (isBeat ? 0.8 : 0.55));
        waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, height); waveCtx.stroke();
      }
    }
    waveCtx.strokeStyle = palette.ink(0.18);
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.beginPath(); waveCtx.moveTo(0, center); waveCtx.lineTo(width, center); waveCtx.stroke();
    if (previousWaveVersion && blend < 1) {
      const previousBuffer = engine.getBuffer(previousWaveVersion);
      if (previousBuffer) drawBufferWaveform(previousBuffer, previousWaveVersion, 1 - blend);
      else drawWaveformData(waveformForVersion(previousWaveVersion), previousWaveVersion, 1 - blend);
    }
    if (buffer) drawBufferWaveform(buffer, activeVersion, blend);
    else drawWaveformData(waveform, activeVersion, blend);
  }

  function animateWaveformChange(fromVersion: BqstVersion) {
    if (waveFadeId) cancelAnimationFrame(waveFadeId);
    previousWaveVersion = fromVersion;
    waveFadeStart = performance.now();
    const duration = 180;
    const step = (now: number) => {
      const t = Math.min(1, (now - waveFadeStart) / duration);
      const eased = t * t * (3 - 2 * t);
      drawWaveform(eased);
      if (t < 1) waveFadeId = requestAnimationFrame(step);
      else { previousWaveVersion = null; waveFadeId = null; drawWaveform(1); }
    };
    waveFadeId = requestAnimationFrame(step);
  }

  function setActiveButton() {
    versionButtons.forEach((button) => {
      const isActive = button.dataset.version === engine.version;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  // NOTE: the initial drawWaveform() runs AFTER the engine is constructed —
  // drawWaveform reads engine state, and `const engine` is TDZ until its
  // initializer completes. Calling it earlier threw "Cannot access 'engine'
  // before initialization" and killed the whole widget init.

  // -- engine ---------------------------------------------------------
  const engine = new BqstEngine({
    cleanUrl,
    processedUrl,
    getAudioContext: sharedAudioContext,
    mediaSession: {
      title: 'BQST A/B demo',
      artist: 'rohan.jk',
      album: 'projects',
      artworkSrc: '/assets/images/projects/bqst/banner.webp',
    },
    onRawWaveform(version, waveform) {
      if (version === 'clean') cleanWaveform = waveform;
      else processedWaveform = waveform;
      drawWaveform();
    },
    onReady() {
      root.classList.remove('is-error'); // a retry succeeded — clear the failure badge
      playButton.removeAttribute('aria-busy');
      drawWaveform();
    },
    onLoadError() {
      root.classList.add('is-error');
      playButton.removeAttribute('aria-busy');
    },
    onPlayStateChange(isPlaying) {
      playButton.classList.toggle('playing', isPlaying);
      playButton.setAttribute('aria-pressed', String(isPlaying));
      playButton.innerHTML = isPlaying ? PAUSE : PLAY;
      if (isPlaying) playButton.removeAttribute('aria-busy');
    },
    onVersionChange(_version, previous) {
      setActiveButton();
      animateWaveformChange(previous);
    },
    onProgress(ratio) {
      // Transforms only, no layout: the translucent fill stretches (a flat
      // colour has nothing to distort). Where the theme draws a playhead it is
      // its own fixed-width line that slides: as one element, the line was a
      // border stretched with the fill, so it rendered hairline-thin and
      // shimmered near the start. Its travel is in container-query width units
      // (see the theme CSS).
      progress.style.transform = `scaleX(${ratio})`;
      if (playhead) {
        playhead.style.transform = `translateX(calc(${ratio} * 100cqw))`;
        playhead.style.visibility = ratio > 0 ? 'visible' : 'hidden';
      }
    },
  });

  drawWaveform();

  const onPlayClick = () => {
    if (engine.isPlaying) engine.pause();
    else {
      playButton.setAttribute('aria-busy', String(!engine.isReady));
      void engine.start();
    }
  };
  playButton.addEventListener('click', onPlayClick);
  const onPointerPrime = () => engine.primeUnlock();
  playButton.addEventListener('pointerdown', onPointerPrime, { passive: true });
  playButton.addEventListener('touchstart', onPointerPrime, { passive: true });
  const versionHandlers = versionButtons.map((button) => {
    const handler = () => engine.crossfadeTo(button.dataset.version as BqstVersion);
    button.addEventListener('click', handler);
    return { button, handler };
  });
  const onResize = () => drawWaveform();
  window.addEventListener('resize', onResize);

  return () => {
    if (waveFadeId) cancelAnimationFrame(waveFadeId);
    window.removeEventListener('resize', onResize);
    playButton.removeEventListener('click', onPlayClick);
    playButton.removeEventListener('pointerdown', onPointerPrime);
    playButton.removeEventListener('touchstart', onPointerPrime);
    versionHandlers.forEach(({ button, handler }) => button.removeEventListener('click', handler));
    engine.dispose();
  };
}
