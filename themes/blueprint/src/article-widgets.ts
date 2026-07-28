import { asset } from './base.js';
// Interactive project-detail widgets ported from the original vanilla-JS site
// (main.js). One module; each init runs only if its mount point exists.
// Light theme only — the original's isLightTheme branching is collapsed to the
// light branch, with the blueprint article-reader palette swapped in.
//
// The BQST lab's DSP maths, the quantlab maths, and every chart renderer now
// live in `src/lib/visuals/` at the repo root, shared with the classic and
// transit forks and driven by a palette object. `blueprintPalette` is this
// theme's mapping; the role tokens are documented in that folder's
// `palette.ts`. That file is also where this theme's old `BLUE`/`PINK`/`TEAL`
// constants — all three of which held the same chrome grey, and none of which
// was blue — got replaced by names describing what they draw.
import { createGlossaryTooltip } from '../../../src/lib/chrome/glossary';
import { sizeCanvasWithDpr, blueprintDpr } from '../../../src/lib/visuals/canvas';
import { blueprintPalette as PALETTE } from '../../../src/lib/visuals/themes';
import { lcmDetectChord, lcmName, lcmPc, LCM_BLACK, LCM_KEY_OFFSETS } from '../../../src/lib/chord-engine';
import {
  drawEq, drawTransfer, drawHarmonics, drawAliasing, bqstKnobTicks, legendForBqstVisual,
  BQST_EQ_HEIGHT, BQST_TRANSFER_HEIGHT, BQST_HARMONICS_HEIGHT, BQST_ALIASING_HEIGHT,
} from '../../../src/lib/visuals/bqst-render';
import {
  survival, deriveGateMarks, trimJudgePairs, QUANT_BLOCKS, fitLadders,
  beeswarmLevels, lookaheadSeries, qlfNearestIndex, qlfMoney, createRiskEngine,
  DEFAULT_RISK_LIMITS,
} from '../../../src/lib/visuals/quant';
import {
  drawCompound, drawRoster, drawQuant, compoundCursorP,
  COMPOUND_CROSS_N, COMPOUND_HEIGHT, COMPOUND_N_CLAIMS, ROSTER_HEIGHT, ROSTER_PAD, QUANT_HEIGHT,
} from '../../../src/lib/visuals/qla-render';
import {
  drawLookahead, drawKalman, drawSurvivorship,
  LOOKAHEAD_HEIGHT, LOOKAHEAD_PAD, KALMAN_HEIGHT, KALMAN_PAD,
  SURVIVORSHIP_HEIGHT, SURVIVORSHIP_PAD,
} from '../../../src/lib/visuals/qlf-render';
import { BqstEngine } from '../../../src/lib/audio/bqst-engine';
import type { BqstVersion } from '../../../src/lib/audio/bqst-transport';
import type { WavWaveform } from '../../../src/lib/audio/bqst-wav';

// ---- palette (this site) ----
// Only the audio widgets still read raw values; the charts go through PALETTE.
const RED_RGB = '199,75,80';
const MUTED_RGB = '116,117,124';
const PINK_RGB = '228,136,173'; // bqst processed waveform — original pink
const INK_RGB = '31,42,86';

// ---- shared helpers ----
function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  // blueprint floors the backing store at 2x: these canvases sit beside 2x
  // canvas TEXTURES in the 3D scene and read soft at 1x (see its AGENTS.md).
  return sizeCanvasWithDpr(canvas, w, h, blueprintDpr());
}

function dbToFrac(db: number): number {
  const c = Math.max(-40, Math.min(0, db));
  return c <= -10 ? ((c + 40) / 30) * 0.7 : 0.7 + ((c + 10) / 10) * 0.3;
}

// One shared AudioContext across the audio widgets (browsers cap open contexts).
let sharedAudioContext: AudioContext | null = null;
function getAC(): AudioContext {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

const cleanups: Array<() => void> = [];

// ============================================================
// BQST DSP LAB
// ============================================================
function initBqstDspLab() {
  const defs = [
    { id: 'bqst-eq-visual', type: 'eq', title: 'baxandall-style eq curves', meta: 'q 0.38 · all stepped shelf positions · +/-6 db', label: 'BQST low and high shelf frequency response' },
    { id: 'bqst-transfer-visual', type: 'transfer', title: 'saturation transfer curve', meta: 'static input sweep · follows the drive control', label: 'BQST Cream and Grit saturation transfer curves' },
    { id: 'bqst-harmonics-visual', type: 'harmonics', title: 'harmonic fingerprint', meta: '1 khz sine · follows the drive control above', label: 'BQST Cream and Grit harmonic profile' },
    { id: 'bqst-oversampling-visual', type: 'aliasing', title: 'why oversampling matters', meta: '6 khz tone · harmonic foldback at 44.1 khz', label: 'BQST oversampling and aliasing visualization' },
  ];
  const slots = defs
    .map((d) => ({ ...d, node: document.getElementById(d.id) as HTMLElement | null }))
    .filter((s): s is typeof s & { node: HTMLElement } => !!s.node) as Array<
    (typeof defs)[number] & { node: HTMLElement; canvas?: HTMLCanvasElement }
  >;
  if (slots.length === 0) return;

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
        <div class="bqst-legend">${legendForBqstVisual(slot.type, PALETTE)}</div>
      </div>`;
    slot.canvas = slot.node.querySelector('.bqst-visual-canvas') as HTMLCanvasElement;
  });

  const driveState: Record<string, number> = { transfer: 0, harmonics: 0 };
  const driveControls = Array.from(document.querySelectorAll<HTMLElement>('.bqst-drive-control')).map((node) => ({
    type: node.dataset.bqstDrive as string,
    input: node.querySelector('input') as HTMLInputElement,
    value: node.querySelector('strong') as HTMLElement,
    stage: node.querySelector('.bqst-knob-stage') as HTMLElement,
    knob: node.querySelector('.bqst-mini-knob') as HTMLElement,
  }));

  function resizeCanvas(canvas: HTMLCanvasElement, height: number) {
    const rect = canvas.getBoundingClientRect();
    canvas.style.height = `${height}px`;
    return sizeCanvas(canvas, Math.max(rect.width, 280), height);
  }
  const driveDbFor = (type: string) => driveState[type] ?? 0;
  const drive01For = (type: string) => Math.max(0, Math.min(1, driveDbFor(type) / 18));

  let requestBqstDraw = () => {};

  function updateDriveControl(control: (typeof driveControls)[number] | undefined) {
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
  function setDriveValue(type: string, value: number) {
    driveState[type] = Math.max(0, Math.min(18, Math.round(value * 10) / 10));
    updateDriveControl(driveControls.find((c) => c.type === type));
    requestBqstDraw();
  }

  const HEIGHTS: Record<string, number> = {
    eq: BQST_EQ_HEIGHT,
    transfer: BQST_TRANSFER_HEIGHT,
    harmonics: BQST_HARMONICS_HEIGHT,
    aliasing: BQST_ALIASING_HEIGHT,
  };

  function drawAll() {
    slots.forEach((slot) => {
      if (!slot.canvas) return;
      const ctx = resizeCanvas(slot.canvas, HEIGHTS[slot.type]);
      // the raw layout width, not the 280 sizing floor: the captions switch on it
      const opts = { w: slot.canvas.getBoundingClientRect().width, palette: PALETTE };
      if (slot.type === 'eq') drawEq(ctx, opts);
      else if (slot.type === 'transfer') drawTransfer(ctx, opts, driveDbFor('transfer'));
      else if (slot.type === 'harmonics') drawHarmonics(ctx, opts, driveDbFor('harmonics'));
      else if (slot.type === 'aliasing') drawAliasing(ctx, opts);
    });
  }

  driveControls.forEach(updateDriveControl);
  const driveListeners: Array<{ control: (typeof driveControls)[number]; onInput: () => void; onPointerDown: (e: PointerEvent) => void; onKeyDown: (e: KeyboardEvent) => void }> = [];
  let activeKnobControl: (typeof driveControls)[number] | null = null;
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
  const onKnobPointerDown = (event: PointerEvent, control: (typeof driveControls)[number]) => {
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
  const onKnobKeyDown = (event: KeyboardEvent, control: (typeof driveControls)[number]) => {
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
  requestBqstDraw = () => {
    if (bqstDrawId !== null) return; // one already queued for this frame
    bqstDrawId = requestAnimationFrame(() => {
      bqstDrawId = null;
      if (isActive) drawAll();
    });
  };
  requestBqstDraw();
  if ((document as any).fonts?.ready) {
    (document as any).fonts.ready.then(() => requestBqstDraw()).catch(() => {});
  }
  let resizeTimer: number;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(requestBqstDraw, 150); };
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
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
  });
}

// ============================================================
// BQST A/B AUDIO DEMO
// ============================================================
function initBqstAudioDemo() {
  const placeholder = document.getElementById('bqst-audio-demo') as HTMLElement | null;
  if (!placeholder) return;
  const abs = (u?: string) => (u && !/^(https?:)?\//.test(u) ? `/${u}` : u);
  const cleanUrl = abs(placeholder.dataset.clean);
  const processedUrl = abs(placeholder.dataset.processed);
  const settings = placeholder.dataset.settings || 'matched clean/processed drum loop';
  const bpm = Number.parseFloat(placeholder.dataset.bpm || '90');
  if (!cleanUrl || !processedUrl) return;
  // Re-bind as plain `string` past the guard: the engine option object below
  // is built once, so TS's narrowing of cleanUrl/processedUrl doesn't need to
  // reach into any nested closures.
  const cleanSrc: string = cleanUrl;
  const processedSrc: string = processedUrl;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;

  const PLAY = '<span aria-hidden="true">▶</span>';
  const PAUSE = '<span aria-hidden="true">❚❚</span>';

  placeholder.innerHTML = `
    <div class="bqst-audio-demo">
      <div class="bqst-audio-demo-header">
        <span class="bqst-lab-kicker">drum loop a/b test</span>
        <span class="bqst-lab-meta">${settings}</span>
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
          <div class="bqst-audio-wave" aria-hidden="true"><canvas></canvas><span></span><i></i></div>
        </div>
      </div>
    </div>`;

  const root = placeholder.querySelector('.bqst-audio-demo') as HTMLElement;
  const playButton = root.querySelector('.bqst-audio-play') as HTMLButtonElement;
  const versionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.bqst-audio-toggle button'));
  const waveCanvas = root.querySelector('.bqst-audio-wave canvas') as HTMLCanvasElement;
  const waveCtx = waveCanvas.getContext('2d')!;
  const progress = root.querySelector('.bqst-audio-wave i') as HTMLElement;

  root.classList.add('is-ready');

  // -- waveform drawing (theme-local — colours/BPM grid/DPR floor are
  // blueprint's own; canvas rendering is never shared, only the audio engine
  // below is). BqstEngine owns the `disposed` guard around its async
  // fetch/decode chain internally now (was blueprint-only before this move —
  // every theme gets it).
  let cleanWaveform: WavWaveform | null = null;
  let processedWaveform: WavWaveform | null = null;
  let previousWaveVersion: BqstVersion | null = null;
  let waveFadeId: number | null = null;
  let waveFadeStart = 0;

  function waveformForVersion(version: BqstVersion) {
    return version === 'clean' ? cleanWaveform : processedWaveform;
  }

  function drawWaveformData(waveform: WavWaveform | null, version: BqstVersion, alpha = 1) {
    if (!waveform?.peaks?.length) return;
    const width = waveCanvas.width;
    const height = waveCanvas.height;
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    const isProcessed = version === 'processed';
    const lineColor = isProcessed ? `rgba(${PINK_RGB},${0.8 * alpha})` : `rgba(${MUTED_RGB},${0.72 * alpha})`;
    const fillColor = isProcessed ? `rgba(${PINK_RGB},${0.14 * alpha})` : `rgba(${MUTED_RGB},${0.13 * alpha})`;
    const center = height * 0.5;
    const amp = height * 0.42;
    waveCtx.beginPath();
    for (let x = 0; x < width; x++) {
      const peak = waveform.peaks[Math.min(waveform.peaks.length - 1, Math.floor((x / width) * waveform.peaks.length))];
      waveCtx.moveTo(x + 0.5, center - peak.max * amp);
      waveCtx.lineTo(x + 0.5, center - peak.min * amp);
    }
    waveCtx.strokeStyle = lineColor;
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.stroke();
    waveCtx.fillStyle = fillColor;
    waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
  }

  function drawBufferWaveform(buffer: AudioBuffer, version: BqstVersion, alpha = 1) {
    if (!buffer) return;
    const width = waveCanvas.width;
    const height = waveCanvas.height;
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    const isProcessed = version === 'processed';
    const lineColor = isProcessed ? `rgba(${PINK_RGB},${0.8 * alpha})` : `rgba(${MUTED_RGB},${0.72 * alpha})`;
    const fillColor = isProcessed ? `rgba(${PINK_RGB},${0.14 * alpha})` : `rgba(${MUTED_RGB},${0.13 * alpha})`;
    const center = height * 0.5;
    const dataL = buffer.getChannelData(0);
    const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;
    const step = Math.max(1, Math.floor(buffer.length / width));
    const amp = height * 0.42;
    waveCtx.beginPath();
    for (let x = 0; x < width; x++) {
      let min = 1, max = -1;
      const start = x * step;
      const end = Math.min(buffer.length, start + step);
      for (let i = start; i < end; i++) {
        const sample = (dataL[i] + dataR[i]) * 0.5;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      waveCtx.moveTo(x + 0.5, center - max * amp);
      waveCtx.lineTo(x + 0.5, center - min * amp);
    }
    waveCtx.strokeStyle = lineColor;
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.stroke();
    waveCtx.fillStyle = fillColor;
    waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
  }

  function drawWaveform(blend = 1) {
    const rect = waveCanvas.getBoundingClientRect();
    const dpr = Math.max(2, window.devicePixelRatio || 1);
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
    const gridCol = `rgba(${INK_RGB},0.10)`;
    const subGridCol = `rgba(${INK_RGB},0.055)`;
    const barCol = `rgba(${RED_RGB},0.24)`;
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
    waveCtx.strokeStyle = `rgba(${INK_RGB},0.18)`;
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
    cleanUrl: cleanSrc,
    processedUrl: processedSrc,
    getAudioContext: () => (window.AudioContext || (window as any).webkitAudioContext ? getAC() : null),
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
    onVersionChange(version, previous) {
      setActiveButton();
      animateWaveformChange(previous);
    },
    onProgress(ratio) {
      // Written as a transform so the per-frame update stays compositor-only
      // — animating `width` would relayout the wave row 60 times a second.
      progress.style.transform = `scaleX(${ratio})`;
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
  const onVersionClick = (button: HTMLButtonElement) => () => engine.crossfadeTo(button.dataset.version as BqstVersion);
  const versionHandlers = versionButtons.map((button) => {
    const h = onVersionClick(button);
    button.addEventListener('click', h);
    return { button, h };
  });
  const onResize = () => drawWaveform();
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
    if (waveFadeId) cancelAnimationFrame(waveFadeId);
    window.removeEventListener('resize', onResize);
    playButton.removeEventListener('click', onPlayClick);
    playButton.removeEventListener('pointerdown', onPointerPrime);
    playButton.removeEventListener('touchstart', onPointerPrime);
    versionHandlers.forEach(({ button, h }) => button.removeEventListener('click', h));
    engine.dispose();
  });
}

// LIVE CHORD MONITOR PIANO
// ============================================================
//
// The chord engine now lives in `src/lib/chord-engine.ts`, shared by all
// three themes (blueprint here, classic, and transit) via a relative import —
// the same way this file already reaches `src/lib/visuals/*`: blueprint is a
// separate Vite app, but its dev server and build both resolve relative
// imports outside its own root without extra config, so no build-time
// inlining step (like `tools/build-blueprint.mjs` uses for `src/data`) was
// needed here. It used to be a hand-maintained fork duplicated per theme and
// drifted more than once; see `chord-engine.ts`'s header for the full story.
// Everything below this point is blueprint-theme DOM wiring only — piano
// rendering, pointer/keyboard input, and the readout — none of it is chord
// logic.
//
// The colocated `article-widgets.test.ts` is the corpus guard: it pins the
// shared engine's output against the app's own corpus expectations for this
// theme's import path.
export { lcmDetectChord };

function initLcmDemo() {
  const placeholder = document.getElementById('lcm-demo') as HTMLElement | null;
  if (!placeholder) return;

  const LOW = 60, HIGH = 74;
  const offsetToKey: Record<number, string> = {};
  Object.entries(LCM_KEY_OFFSETS).forEach(([code, off]) => { offsetToKey[off] = code.replace('Key', ''); });

  const pointerNotes = new Map<number, number>();
  const keyHeld = new Set<number>();

  placeholder.innerHTML = `
    <div class="lcm-demo">
      <div class="lcm-readout" aria-live="polite" aria-atomic="true">
        <div class="lcm-chord lcm-empty">play some notes</div>
        <div class="lcm-notes"></div>
        <div class="lcm-alts"></div>
      </div>
      <div class="lcm-piano" role="group" aria-label="Playable piano"></div>
      <p class="lcm-hint">Play with your computer keyboard - the letters are printed on the keys. Hold a few at once to build a chord (or use multi-touch on the keys).</p>
    </div>`;

  const piano = placeholder.querySelector('.lcm-piano') as HTMLElement;
  const chordEl = placeholder.querySelector('.lcm-chord') as HTMLElement;
  const notesEl = placeholder.querySelector('.lcm-notes') as HTMLElement;
  const altsEl = placeholder.querySelector('.lcm-alts') as HTMLElement;

  const whites: number[] = [];
  for (let n = LOW; n <= HIGH; n++) if (!LCM_BLACK.has(lcmPc(n))) whites.push(n);
  const whiteIndex: Record<number, number> = {};
  whites.forEach((n, i) => { whiteIndex[n] = i; });
  const keyEls: Record<number, HTMLElement> = {};

  for (let n = LOW; n <= HIGH; n++) {
    const black = LCM_BLACK.has(lcmPc(n));
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = `lcm-key ${black ? 'black' : 'white'}`;
    el.dataset.note = String(n);
    const label = offsetToKey[n - LOW];
    el.innerHTML = label ? `<span class="lcm-key-label">${label}</span>` : '';
    el.setAttribute('aria-label', `${lcmName(n)}${Math.floor(n / 12) - 1}`);
    if (black) {
      const prevWhite = whiteIndex[n - 1];
      el.style.left = `calc((${prevWhite + 1}) * (100% / ${whites.length}))`;
    } else {
      el.style.flex = '1';
    }
    piano.appendChild(el);
    keyEls[n] = el;
  }

  function activeNotes() {
    return Array.from(new Set([...keyHeld, ...pointerNotes.values()])).sort((a, b) => a - b);
  }
  function render() {
    const notes = activeNotes();
    const active = new Set(notes);
    for (let n = LOW; n <= HIGH; n++) keyEls[n].classList.toggle('active', active.has(n));
    const { primary, alternatives } = lcmDetectChord(notes);
    if (!notes.length) {
      chordEl.textContent = 'play some notes';
      chordEl.classList.add('lcm-empty');
      notesEl.textContent = '';
      altsEl.textContent = '';
      return;
    }
    chordEl.classList.remove('lcm-empty');
    chordEl.textContent = primary ? primary.displayName : '—';
    const spell = primary?.spelling || {};
    const seen = new Set<number>();
    const noteNames: string[] = [];
    notes.forEach((n) => { const pc = lcmPc(n); if (!seen.has(pc)) { seen.add(pc); noteNames.push(spell[pc] || lcmName(pc)); } });
    notesEl.textContent = noteNames.join('  ·  ');
    altsEl.textContent = alternatives.length ? `alt: ${alternatives.map((a) => a.displayName).join('   ·   ')}` : '';
  }

  const onPointerDown = (e: PointerEvent) => {
    const key = (e.target as HTMLElement).closest('.lcm-key') as HTMLElement | null;
    if (!key) return;
    e.preventDefault();
    pointerNotes.set(e.pointerId, parseInt(key.dataset.note!, 10));
    render();
  };
  piano.addEventListener('pointerdown', onPointerDown);
  const endPointer = (e: PointerEvent) => { if (pointerNotes.delete(e.pointerId)) render(); };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  // Only hijack the ~15 mapped letter keys while the piano is actually on
  // screen — a page-wide preventDefault on letters would break typing and
  // shortcuts everywhere else on the article. Same pattern as initDemoPlayer:
  // starts true (corrected by the observer's first callback) and stays true if
  // IntersectionObserver is unavailable so the piano still works.
  let pianoVisible = true;
  let pianoIO: IntersectionObserver | undefined;
  const demo = placeholder.querySelector('.lcm-demo') as HTMLElement;
  if (typeof IntersectionObserver !== 'undefined' && demo) {
    pianoIO = new IntersectionObserver((entries) => {
      pianoVisible = entries[0].isIntersecting;
    });
    pianoIO.observe(demo);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const off = LCM_KEY_OFFSETS[e.code];
    if (off === undefined) return;
    // Off-screen piano: let the key through un-prevented (no note either).
    if (!pianoVisible) return;
    e.preventDefault();
    keyHeld.add(LOW + off);
    render();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const off = LCM_KEY_OFFSETS[e.code];
    if (off === undefined) return;
    keyHeld.delete(LOW + off);
    render();
  };
  const onBlur = () => { keyHeld.clear(); pointerNotes.clear(); render(); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  cleanups.push(() => {
    pianoIO?.disconnect();
    piano.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', endPointer);
    window.removeEventListener('pointercancel', endPointer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });

  render();
}

// ============================================================
// THIS-WEBSITE THEME PALETTE (this site's palette)
// ============================================================
function initThemePalette() {
  const placeholder = document.getElementById('theme-palette-placeholder') as HTMLElement | null;
  if (!placeholder) return;

  const surfaces = [
    { color: '#e4e1d8', label: 'land' },
    { color: '#eeebe4', label: 'city' },
    { color: '#dde9d7', label: 'park' },
    { color: '#d0e4ee', label: 'water' },
    { color: '#f4f1ea', label: 'paper' },
    { color: '#1a1a1a', label: 'ink' },
  ];
  const lines = [
    { color: '#d13d59', label: 'projects' },
    { color: '#754fad', label: 'music' },
    { color: '#815e49', label: 'about' },
    { color: '#33b4e5', label: 'blue' },
    { color: '#66bb6a', label: 'green' },
    { color: '#fa6b49', label: 'orange' },
    { color: '#e488ad', label: 'pink' },
    { color: '#fae933', label: 'yellow' },
    { color: '#8a8578', label: 'muted' },
  ];
  const swatches = (colors: { color: string; label: string }[]) =>
    colors
      .map((c) => `<div class="palette-swatch"><div class="palette-swatch-color" style="background:${c.color}"></div><div class="palette-swatch-label">${c.label}</div></div>`)
      .join('');

  placeholder.innerHTML = `
    <div class="theme-palette">
      <div class="palette-group">
        <div class="palette-label">this site — land-use surfaces</div>
        <div class="palette-swatches">${swatches(surfaces)}</div>
      </div>
      <div class="palette-group">
        <div class="palette-label">this site — transit line colors</div>
        <div class="palette-swatches">${swatches(lines)}</div>
      </div>
    </div>`;
}

// ============================================================
// THIS-WEBSITE DEMO PLAYER
// ============================================================
function initDemoPlayer() {
  const placeholder = document.getElementById('demo-player-placeholder') as HTMLElement | null;
  if (!placeholder) return;

  placeholder.innerHTML = `
    <div class="demo-player">
      <canvas class="demo-waveform-canvas"></canvas>
      <div class="demo-meters">
        <div class="demo-meter-group"><canvas class="demo-vec-canvas"></canvas><span class="demo-meter-label">stereo</span></div>
        <div class="demo-meter-group"><canvas class="demo-vu-canvas"></canvas><span class="demo-meter-label">vu</span></div>
      </div>
    </div>`;

  const player = placeholder.querySelector('.demo-player') as HTMLElement;
  const waveCanvas = player.querySelector('.demo-waveform-canvas') as HTMLCanvasElement;
  const vuCanvas = player.querySelector('.demo-vu-canvas') as HTMLCanvasElement;
  const vecCanvas = player.querySelector('.demo-vec-canvas') as HTMLCanvasElement;

  const vuW = 190, vuH = 130, vecW = 140, vecH = 140;
  const vuCtx = sizeCanvas(vuCanvas, vuW, vuH);
  const vecCtx = sizeCanvas(vecCanvas, vecW, vecH);

  const accentColor = () => `rgba(${INK_RGB},1)`; // meter markings stay ink navy, like the VU faces
  const accentRgba = (a: number) => `rgba(${INK_RGB},${a})`;

  function sizeWave() {
    const rect = waveCanvas.getBoundingClientRect();
    return sizeCanvas(waveCanvas, Math.max(rect.width, 100), Math.max(rect.height, 56));
  }
  let waveCtx: CanvasRenderingContext2D | undefined;
  requestAnimationFrame(() => { waveCtx = sizeWave(); drawWaveIdle(); });

  function drawArc(ctx: CanvasRenderingContext2D, w: number, h: number, needleFrac: number | null) {
    const cx = w / 2, cy = h * 0.92;
    const r = w * 0.36;
    const sa = Math.PI * 0.85, ea = Math.PI * 0.15;
    const sweep = sa - ea;
    ctx.strokeStyle = accentRgba(0.3);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, -sa, -ea); ctx.stroke();
    const rs = dbToFrac(-10);
    ctx.strokeStyle = 'rgba(199,75,80,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, -(sa - rs * sweep), -ea); ctx.stroke();
    const dbMarks = [-40, -20, -10, -5, -3, 0];
    ctx.font = "8px 'Be Vietnam Pro', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dbMarks.forEach((db) => {
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? 'rgba(199,75,80,0.85)' : accentRgba(0.7);
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 6) * Math.cos(a), cy - (r - 6) * Math.sin(a));
      ctx.lineTo(cx + (r + 3) * Math.cos(a), cy - (r + 3) * Math.sin(a));
      ctx.stroke();
      ctx.fillStyle = isRed ? 'rgba(199,75,80,0.85)' : accentRgba(0.8);
      ctx.fillText(String(db), cx + (r + 14) * Math.cos(a), cy - (r + 14) * Math.sin(a));
    });
    for (let db = -40; db <= 0; db += 1) {
      if (dbMarks.includes(db)) continue;
      if (db < -10 && db % 5 !== 0) continue;
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? 'rgba(199,75,80,0.4)' : accentRgba(0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 3) * Math.cos(a), cy - (r - 3) * Math.sin(a));
      ctx.lineTo(cx + (r + 2) * Math.cos(a), cy - (r + 2) * Math.sin(a));
      ctx.stroke();
    }
    if (needleFrac !== null) {
      const na = sa - needleFrac * sweep;
      ctx.strokeStyle = accentColor(); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (r + 5) * Math.cos(na), cy - (r + 5) * Math.sin(na));
      ctx.stroke();
    }
    ctx.fillStyle = accentColor();
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawVecIdle() {
    vecCtx.clearRect(0, 0, vecW, vecH);
    vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
    vecCtx.beginPath();
    vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
    vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
    vecCtx.stroke();
    vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
  }
  function drawWaveIdle() {
    if (!waveCtx) return;
    const rect = waveCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    waveCtx.clearRect(0, 0, w, h);
    waveCtx.beginPath();
    waveCtx.strokeStyle = accentRgba(0.3); waveCtx.lineWidth = 1.5;
    waveCtx.moveTo(0, h / 2); waveCtx.lineTo(w, h / 2);
    waveCtx.stroke();
  }
  function drawAllIdle() {
    vuCtx.clearRect(0, 0, vuW, vuH); drawArc(vuCtx, vuW, vuH, 0);
    drawVecIdle();
    drawWaveIdle();
  }
  drawAllIdle();

  let audioBuffer: AudioBuffer | null = null;
  let demoAnimId: number | null = null;
  let vuSmoothed = -40;
  let playbackStart = 0;
  let disposed = false;
  // Whether the widget is on-screen. Starts true (corrected by the observer on its
  // first callback); stays true if IntersectionObserver is unavailable so the loop
  // still runs. Gates drawLive so an off-screen widget costs nothing.
  let demoVisible = true;
  const CHUNK = 1024;

  const decodeCtx = getAC();
  fetch(asset('/assets/audio/snippets/looseends.mp3'))
    .then((r) => r.arrayBuffer())
    .then((buf) => decodeCtx.decodeAudioData(buf))
    .then((decoded) => {
      if (disposed) return;
      audioBuffer = decoded;
      playbackStart = performance.now();
      // Start the loop only if visible AND not already running — the Intersection
      // Observer may have started it already (it fires before decode finishes for an
      // on-screen widget). Without this guard both paths schedule drawLive and two
      // rAF chains run forever.
      if (demoVisible && demoAnimId === null) demoAnimId = requestAnimationFrame(drawLive);
    })
    .catch(() => {});

  function drawLive() {
    // Pause the 60fps loop when disposed OR scrolled off-screen — no point drawing
    // (and allocating two Float32Arrays) a widget nobody can see. The observer below
    // restarts it when it scrolls back into view.
    if (disposed || !demoVisible) {
      demoAnimId = null;
      return;
    }
    demoAnimId = requestAnimationFrame(drawLive);
    if (!audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const elapsed = (performance.now() - playbackStart) / 1000;
    const totalSamples = audioBuffer.length;
    const sampleOffset = Math.floor((elapsed * sampleRate) % totalSamples);
    const chanL = audioBuffer.getChannelData(0);
    const chanR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : chanL;
    const dataL = new Float32Array(CHUNK);
    const dataR = new Float32Array(CHUNK);
    for (let i = 0; i < CHUNK; i++) {
      const idx = (sampleOffset + i) % totalSamples;
      dataL[i] = chanL[idx];
      dataR[i] = chanR[idx];
    }
    let sumSq = 0;
    for (let i = 0; i < CHUNK; i++) { const m = (dataL[i] + dataR[i]) * 0.5; sumSq += m * m; }
    const rms = Math.sqrt(sumSq / CHUNK);
    const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
    vuSmoothed += (Math.max(-40, Math.min(0, dbFS)) - vuSmoothed) * 0.18;
    vuCtx.clearRect(0, 0, vuW, vuH);
    drawArc(vuCtx, vuW, vuH, dbToFrac(vuSmoothed));
    // vectorscope — phosphor persistence
    // Phosphor-persistence fade toward the canvas backdrop (= --w-card / page bg),
    // so old dots decay to the card colour instead of a lighter paper tint.
    vecCtx.fillStyle = 'rgba(255,248,225,0.3)';
    vecCtx.fillRect(0, 0, vecW, vecH);
    vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
    vecCtx.beginPath();
    vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
    vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
    vecCtx.stroke();
    vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
    vecCtx.fillStyle = accentRgba(0.85);
    const step = Math.max(1, Math.floor(CHUNK / 256));
    const rad = Math.min(vecW, vecH) / 2 - 4;
    for (let i = 0; i < CHUNK; i += step) {
      const mid = (dataL[i] + dataR[i]) * 0.5;
      const side = (dataL[i] - dataR[i]) * 0.5;
      vecCtx.fillRect(vecW / 2 + side * rad * 2, vecH / 2 - mid * rad * 2, 1.5, 1.5);
    }
    if (!waveCtx) return;
    const rect = waveCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    waveCtx.clearRect(0, 0, w, h);
    const sliceW = w / CHUNK;
    const cy = h / 2;
    waveCtx.beginPath(); waveCtx.moveTo(0, cy);
    for (let i = 0; i < CHUNK; i++) {
      const v = (dataL[i] + dataR[i]) * 0.5;
      waveCtx.lineTo(i * sliceW, cy - v * cy);
    }
    waveCtx.lineTo(w, cy); waveCtx.closePath();
    waveCtx.fillStyle = accentRgba(0.12);
    waveCtx.fill();
    waveCtx.beginPath();
    for (let i = 0; i < CHUNK; i++) {
      const v = (dataL[i] + dataR[i]) * 0.5;
      const y = cy - v * cy;
      i === 0 ? waveCtx.moveTo(0, y) : waveCtx.lineTo(i * sliceW, y);
    }
    waveCtx.strokeStyle = accentRgba(0.95); waveCtx.lineWidth = 1.5;
    waveCtx.stroke();
  }

  let demoResizeTimer: number;
  const onResize = () => {
    clearTimeout(demoResizeTimer);
    demoResizeTimer = window.setTimeout(() => { waveCtx = sizeWave(); }, 150);
  };
  window.addEventListener('resize', onResize);

  // Only run the draw loop while the widget is in view. Toggling visibility restarts
  // the loop (drawLive self-pauses when it goes off-screen).
  let demoIO: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== 'undefined') {
    demoIO = new IntersectionObserver((entries) => {
      demoVisible = entries[0].isIntersecting;
      if (demoVisible && !disposed && demoAnimId === null) {
        demoAnimId = requestAnimationFrame(drawLive);
      }
    });
    demoIO.observe(player);
  }

  cleanups.push(() => {
    disposed = true;
    if (demoAnimId) cancelAnimationFrame(demoAnimId);
    clearTimeout(demoResizeTimer);
    window.removeEventListener('resize', onResize);
    demoIO?.disconnect();
    demoAnimId = null;
    audioBuffer = null;
  });
}

// ============================================================
// QUANTLAB VISUALS (quantlab-analyst / quantlab-research / quantlab-systems)
// Ported from the original site's main.js (initQuantlabVisuals /
// initQuantlabFinVisuals). Light theme only: the original's isLightTheme
// branches are collapsed and the palette follows the article's settled rules —
// single-series visuals use poppy red for the primary series; comparison
// visuals pair it with chrome grey, adding light blueprint blue when a third
// series (or a good-vs-warn contrast) is needed; ink navy for text/grids only.
// Semantic colors (verified-green, danger red) keep their meaning.
// ============================================================


function qlaEl(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function qlaShell(node: HTMLElement, kicker: string, meta: string): HTMLElement {
  node.textContent = '';
  const shell = qlaEl('div', 'qla-visual');
  const header = qlaEl('div', 'qla-visual-header');
  header.appendChild(qlaEl('span', 'qla-visual-kicker', kicker));
  header.appendChild(qlaEl('span', 'qla-visual-meta', meta));
  shell.appendChild(header);
  const body = qlaEl('div', 'qla-visual-body');
  shell.appendChild(body);
  node.appendChild(shell);
  return body;
}

// Legend row: colored dots + labels, right-aligned above the canvas.
function qlfLegend(items: Array<{ cls: string; label: string }>): HTMLElement {
  const row = qlaEl('div', 'qlf-legend');
  items.forEach((it) => {
    const item = qlaEl('span', 'qlf-legend-item');
    item.appendChild(qlaEl('i', `qlf-legend-swatch ${it.cls}`));
    item.appendChild(qlaEl('span', undefined, it.label));
    row.appendChild(item);
  });
  return row;
}

// Visually-hidden keyboard fallback driving the same crosshair as the pointer.
function qlfCrosshairInput(n: number, ariaLabel: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'qlf-sr-range';
  input.min = '0';
  input.max = String(n - 1);
  input.step = '1';
  input.value = String(n - 1);
  input.setAttribute('aria-label', ariaLabel);
  return input;
}

// Fixed readout row below a chart. set(null) keeps last values but dims them.
function qlfReadout(fields: Array<{ key: string; label: string; width: number }>) {
  const row = qlaEl('div', 'qlf-readout is-idle');
  row.setAttribute('aria-live', 'polite');
  const boxes: Record<string, HTMLElement> = {};
  fields.forEach((f) => {
    const cell = qlaEl('span', 'qlf-readout-field');
    cell.appendChild(qlaEl('span', 'qlf-readout-label', f.label));
    // Figure space keeps the empty box glyph-bearing so the row's baseline
    // doesn't shift on first fill (see the original's comment). Written as an
    // escape: a literal U+2007 in the source degraded to a plain space in the
    // toolchain, the box collapsed to its min-height, and the labels visibly
    // hopped as the row re-baselined on first hover.
    const box = qlaEl('span', 'qlf-readout-value', '\u2007');
    box.style.minWidth = `calc(${f.width}ch + 1px)`;
    boxes[f.key] = box;
    cell.appendChild(box);
    row.appendChild(cell);
  });
  return {
    row,
    set(values: Record<string, string> | null) {
      if (values) {
        Object.keys(values).forEach((k) => { if (boxes[k]) boxes[k].textContent = values[k]; });
      } else {
        Object.keys(boxes).forEach((k) => { boxes[k].textContent = '\u2007'; });
      }
      row.classList.toggle('is-idle', !values);
    },
  };
}

// Pointer/touch crosshair over a canvas, snapped to the nearest index.
// Listeners live on elements created inside the placeholder, so they're
// discarded with the subtree on astro:before-swap — no explicit removal needed.
function qlfAttachCrosshair(
  canvas: HTMLCanvasElement,
  input: HTMLInputElement,
  n: number,
  padL: number,
  padR: number,
  setCursor: (i: number | null) => void,
) {
  const fromEvent = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const pw = Math.max(1, rect.width - padL - padR);
    const i = Math.round(((e.clientX - rect.left - padL) / pw) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const onMove = (e: PointerEvent) => {
    const i = fromEvent(e);
    input.value = String(i);
    setCursor(i);
  };
  canvas.classList.add('qlf-crosshair-canvas');
  canvas.addEventListener('pointerdown', onMove);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => setCursor(null));
  input.addEventListener('input', () => setCursor(parseInt(input.value, 10)));
  input.addEventListener('focus', () => {
    canvas.parentElement!.classList.add('qlf-cross-focus');
    setCursor(parseInt(input.value, 10));
  });
  input.addEventListener('blur', () => {
    canvas.parentElement!.classList.remove('qlf-cross-focus');
    setCursor(null);
  });
}

// Coalesce redraws to one per frame: pointermove crosshairs can fire several
// times per frame and each original setCursor() drew synchronously. The
// returned scheduler queues at most one rAF; cleanup cancels a pending one.
function makeRafDraw(draw: () => void): () => void {
  let id: number | null = null;
  const request = () => {
    if (id !== null) return;
    id = requestAnimationFrame(() => { id = null; draw(); });
  };
  cleanups.push(() => { if (id !== null) cancelAnimationFrame(id); id = null; });
  return request;
}

// ---- quantlab-analyst: 1. the compounding curve (memo survival = p^n) ----
function initQlaCompound(node: HTMLElement) {
  const body = qlaShell(node, 'why 95% per number is not 95% per memo', 'memo survival = p^n · at 40 claims per memo');

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Curve of memo survival rate versus per-number accuracy at 40 claims per memo, with markers for v2.1 at the 95.4% wall and the teacher at 99.8%');
  body.appendChild(qlfLegend([
    { cls: 'qlf-sw-series', label: 'survival curve' },
    { cls: 'qlf-sw-measured', label: 'measured models' },
  ]));
  canvasWrap.appendChild(canvas);
  const CROSS_N = COMPOUND_CROSS_N;
  const crossInput = qlfCrosshairInput(CROSS_N, 'Step along the accuracy axis to read the survival curve');
  canvasWrap.appendChild(crossInput);
  body.appendChild(canvasWrap);

  const crossReadout = qlfReadout([
    { key: 'acc', label: 'per-number accuracy', width: 6 },
    { key: 'surv', label: 'memo survival', width: 6 },
  ]);
  body.appendChild(crossReadout.row);

  let cursor: number | null = null;

  function draw() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const ctx = sizeCanvas(canvas, w, COMPOUND_HEIGHT);
    canvas.style.height = `${COMPOUND_HEIGHT}px`;
    drawCompound(ctx, { w, palette: PALETTE }, cursor);
  }
  const requestDraw = makeRafDraw(draw);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    if (cursor === null) crossReadout.set(null);
    else {
      const pv = compoundCursorP(cursor);
      crossReadout.set({
        acc: `${(pv * 100).toFixed(1)}%`,
        surv: `${(survival(pv, COMPOUND_N_CLAIMS) * 100).toFixed(1)}%`,
      });
    }
    requestDraw();
  }

  qlfAttachCrosshair(canvas, crossInput, CROSS_N, 44, 14, setCursor);
  const onResize = () => requestDraw();
  window.addEventListener('resize', onResize);
  // The container may lack layout at init (fonts/first paint); the observer
  // fires once layout exists and again on any container resize.
  const ro = new ResizeObserver(() => requestDraw());
  ro.observe(canvasWrap);
  cleanups.push(() => { ro.disconnect(); window.removeEventListener('resize', onResize); });
  setCursor(null);
}

// ---- quantlab-analyst: 2. one real repair (static before/after) ----
function initQlaGate(node: HTMLElement, fixer: any) {
  const body = qlaShell(node, 'one real repair', `from the fixer logs · ${fixer.ticker} · excerpt`);

  const { beforeTokens, afterTokens, badSet, goodSet } =
    deriveGateMarks(fixer.before, fixer.after, fixer.violations);

  function renderExcerpt(title: string, tokenList: Array<{ type: string; text: string }>, markSet: Set<number>, markClass: string) {
    const col = qlaEl('div', 'qla-fixer-col');
    col.appendChild(qlaEl('div', 'qla-fixer-col-title', title));
    const box = qlaEl('div', 'qla-memo');
    tokenList.forEach((tok, i) => {
      if (markSet.has(i)) box.appendChild(qlaEl('mark', markClass, tok.text));
      else box.appendChild(document.createTextNode(tok.text));
    });
    col.appendChild(box);
    return col;
  }
  const report = qlaEl('div', 'qla-gate-report-strip');
  report.appendChild(qlaEl('span', 'qla-gate-report-label', "the fixer's input · the gate's report:"));
  fixer.violations.forEach((v: string) => report.appendChild(qlaEl('span', 'qla-gate-chip', v)));
  report.appendChild(qlaEl('span', 'qla-gate-report-tail', 'untraceable → rewrite'));
  body.appendChild(report);

  const fixerGrid = qlaEl('div', 'qla-fixer-grid');
  fixerGrid.appendChild(renderExcerpt(`before: rejected, ${fixer.violations.length} untraceable numbers`, beforeTokens, badSet, 'qla-mark-bad'));
  fixerGrid.appendChild(renderExcerpt('after: one pass of the fixer', afterTokens, goodSet, 'qla-mark-good'));
  body.appendChild(fixerGrid);
}

// ---- quantlab-analyst: 3. you be the judge (blind A/B game) ----
function initQlaJudge(node: HTMLElement, judgePairs: any[]) {
  const body = qlaShell(node, 'you be the judge', 'real memos, numbers already verified · which reads like the frontier model?');

  const status = qlaEl('p', 'qla-judge-status', '');
  body.appendChild(status);
  const grid = qlaEl('div', 'qla-judge-grid');
  body.appendChild(grid);
  const controls = qlaEl('div', 'qla-judge-controls');
  body.appendChild(controls);
  const feedback = qlaEl('p', 'qla-judge-feedback', '');
  feedback.setAttribute('aria-live', 'polite');
  body.appendChild(feedback);
  const scoreLine = qlaEl('p', 'qla-judge-score', '');
  scoreLine.setAttribute('aria-live', 'polite');
  body.appendChild(scoreLine);

  const ROUNDS = 3;
  let order: number[] = [];
  let round = 0;
  let correct = 0;

  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const trimmedPairs = trimJudgePairs(judgePairs);

  // One fixed panel height for every round: measure the tallest post-trim
  // excerpt at the real two-column track width (two probe columns needed —
  // with an empty grid, auto-fit collapses to one full-width track).
  let bodyHeight = 0;
  function measurePanels() {
    const probeCols = [0, 1].map(() => {
      const col = qlaEl('div', 'qla-judge-col qla-judge-probe');
      const panel = qlaEl('div', 'qla-judge-panel');
      panel.appendChild(qlaEl('div', 'qla-judge-panel-label', 'memo A'));
      panel.appendChild(qlaEl('div', 'qla-judge-panel-body', ''));
      col.appendChild(panel);
      return col;
    });
    probeCols.forEach((col) => grid.appendChild(col));
    const probeBody = probeCols[0].querySelector('.qla-judge-panel-body') as HTMLElement;
    let max = 0;
    trimmedPairs.forEach((tp) => {
      [tp.teacher, tp.ours].forEach((text) => {
        probeBody.textContent = text;
        max = Math.max(max, probeBody.offsetHeight);
      });
    });
    probeCols.forEach((col) => grid.removeChild(col));
    bodyHeight = max;
    grid.querySelectorAll<HTMLElement>('.qla-judge-panel-body').forEach((b) => {
      b.style.height = `${bodyHeight}px`;
    });
  }

  function makePanel(label: string, text: string) {
    const panel = qlaEl('div', 'qla-judge-panel');
    panel.appendChild(qlaEl('div', 'qla-judge-panel-label', `memo ${label}`));
    const bodyEl = qlaEl('div', 'qla-judge-panel-body', text);
    if (bodyHeight) bodyEl.style.height = `${bodyHeight}px`;
    panel.appendChild(bodyEl);
    return panel;
  }

  function renderRound() {
    grid.textContent = '';
    controls.textContent = '';
    feedback.textContent = '';
    feedback.className = 'qla-judge-feedback';
    scoreLine.textContent = '';
    const pair = trimmedPairs[order[round]];
    const teacherIsA = Math.random() < 0.5;
    status.textContent = `round ${round + 1} of ${ROUNDS} · ${pair.ticker}`;
    const panelA = makePanel('A', teacherIsA ? pair.teacher : pair.ours);
    const panelB = makePanel('B', teacherIsA ? pair.ours : pair.teacher);
    const guessButtons: HTMLButtonElement[] = [];

    ['A', 'B'].forEach((letter) => {
      const col = qlaEl('div', 'qla-judge-col');
      col.appendChild(letter === 'A' ? panelA : panelB);
      const btn = qlaEl('button', 'qla-btn qla-judge-guess', `memo ${letter} is Sonnet`) as HTMLButtonElement;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const guessedTeacherA = letter === 'A';
        const right = guessedTeacherA === teacherIsA;
        if (right) correct += 1;
        round += 1;
        const picked = letter === 'A' ? panelA : panelB;
        picked.classList.add(right ? 'is-pick-correct' : 'is-pick-wrong');
        feedback.className = `qla-judge-feedback ${right ? 'is-correct' : 'is-wrong'}`;
        feedback.textContent = right ? 'Correct. That one was Sonnet.' : "Not this time. The other memo was Sonnet's.";
        guessButtons.forEach((b) => { b.disabled = true; });
        if (round < ROUNDS) {
          const next = qlaEl('button', 'qla-btn qla-btn-accent', 'next round') as HTMLButtonElement;
          next.type = 'button';
          next.addEventListener('click', renderRound);
          controls.appendChild(next);
          next.focus();
        } else {
          finish();
        }
      });
      guessButtons.push(btn);
      col.appendChild(btn);
      grid.appendChild(col);
    });
  }

  function finish() {
    status.textContent = 'all rounds played';
    scoreLine.textContent = `You went ${correct}/${ROUNDS}.`;
    const again = qlaEl('button', 'qla-btn qla-btn-accent', 'play again') as HTMLButtonElement;
    again.type = 'button';
    again.addEventListener('click', start);
    controls.appendChild(again);
  }

  function start() {
    order = shuffle(judgePairs.map((_, i) => i)).slice(0, ROUNDS);
    round = 0;
    correct = 0;
    renderRound();
  }
  measurePanels();
  // Re-measure once real fonts are in (guarded: the swap may already have
  // discarded this widget by the time fonts resolve).
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { if (node.isConnected) measurePanels(); }).catch(() => {});
  }
  const onResize = () => measurePanels();
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  start();
}

// ---- quantlab-analyst: 4. the roster ----
function initQlaRoster(node: HTMLElement, roster: any) {
  const models = roster.models as any[];
  const body = qlaShell(node, 'the roster', `every model, same company (${roster.ticker}) · real memos, every number checked by the gate`);

  const TEACHER = parseInt(roster.teacherPass, 10);
  let selected = models.length - 1;

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.style.cursor = 'pointer';
  canvas.setAttribute('role', 'img');
  canvasWrap.appendChild(canvas);
  body.appendChild(canvasWrap);

  const controls = qlaEl('div', 'qla-roster-controls');
  const selLabel = qlaEl('label', 'qla-roster-label', 'model:');
  const select = document.createElement('select');
  select.className = 'qla-roster-select';
  select.setAttribute('aria-label', 'Choose a model to inspect its memo');
  models.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = m.name;
    select.appendChild(opt);
  });
  selLabel.setAttribute('for', 'qlaRosterSelect');
  select.id = 'qlaRosterSelect';
  controls.appendChild(selLabel);
  controls.appendChild(select);
  body.appendChild(controls);

  const desc = qlaEl('p', 'qla-roster-desc', '');
  body.appendChild(desc);
  const stats = qlaEl('div', 'qla-roster-stats');
  const statPass = qlaEl('span', 'qla-roster-stat', '');
  const statAcc = qlaEl('span', 'qla-roster-stat', '');
  const statMemo = qlaEl('span', 'qla-roster-stat', '');
  const statVerdict = qlaEl('span', 'qla-roster-verdict', '');
  stats.appendChild(statPass);
  stats.appendChild(statAcc);
  stats.appendChild(statMemo);
  stats.appendChild(statVerdict);
  body.appendChild(stats);

  body.appendChild(qlfLegend([
    { cls: 'qla-sw-good', label: 'traced to evidence' },
    { cls: 'qla-sw-bad', label: 'failed the gate' },
    { cls: 'qlf-sw-plain', label: 'plain text: not a claim (years, ids)' },
  ]));

  const memoPane = qlaEl('div', 'qla-memo qla-roster-memo');
  memoPane.setAttribute('tabindex', '0');
  memoPane.setAttribute('aria-label', 'The selected model’s memo with verified and violating numbers highlighted');
  body.appendChild(memoPane);

  // Match the original exhibit's full-width height control. Pointer movement
  // is tracked on window so a drag keeps working after the pointer leaves the
  // narrow grip; the global listeners are also removed during article swaps.
  const grip = qlaEl('div', 'qla-roster-grip');
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'horizontal');
  grip.setAttribute('aria-label', 'Drag to resize the memo pane; arrow keys also work');
  grip.setAttribute('tabindex', '0');
  body.appendChild(grip);

  const MIN_MEMO_HEIGHT = 160;
  const maxMemoHeight = () => Math.round(window.innerHeight * 0.75);
  const setMemoHeight = (height: number) => {
    const next = Math.max(MIN_MEMO_HEIGHT, Math.min(maxMemoHeight(), height));
    memoPane.style.height = `${next}px`;
    grip.setAttribute('aria-valuemin', String(MIN_MEMO_HEIGHT));
    grip.setAttribute('aria-valuemax', String(maxMemoHeight()));
    grip.setAttribute('aria-valuenow', String(Math.round(next)));
  };
  let dragFrom: { y: number; height: number } | null = null;
  const onDragMove = (event: PointerEvent) => {
    if (!dragFrom) return;
    setMemoHeight(dragFrom.height + (event.clientY - dragFrom.y));
    event.preventDefault();
  };
  const onDragEnd = () => {
    dragFrom = null;
    grip.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  };
  grip.addEventListener('pointerdown', (event) => {
    dragFrom = { y: event.clientY, height: memoPane.getBoundingClientRect().height };
    grip.classList.add('is-dragging');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
    event.preventDefault();
  });
  grip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    setMemoHeight(memoPane.getBoundingClientRect().height + (event.key === 'ArrowDown' ? 40 : -40));
    event.preventDefault();
  });
  setMemoHeight(memoPane.getBoundingClientRect().height || 300);
  cleanups.push(onDragEnd);

  function renderMemo(m: any) {
    memoPane.textContent = '';
    m.segments.forEach((seg: any) => {
      if (seg.t === 'ok') memoPane.appendChild(qlaEl('mark', 'qla-mark-good', seg.s));
      else if (seg.t === 'bad') memoPane.appendChild(qlaEl('mark', 'qla-mark-bad', seg.s));
      else memoPane.appendChild(document.createTextNode(seg.s));
    });
    memoPane.scrollTop = 0;
  }

  function drawChart() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(300, rect.width);
    const ctx = sizeCanvas(canvas, w, ROSTER_HEIGHT);
    canvas.style.height = `${ROSTER_HEIGHT}px`;
    drawRoster(ctx, { w, palette: PALETTE }, models, TEACHER, selected);

    canvas.setAttribute('aria-label',
      `Cited-pass rate by model in training order, teacher at ${TEACHER}% for reference. Selected: ${models[selected].name} at ${models[selected].passRate}.`);
  }
  const requestDraw = makeRafDraw(drawChart);

  function selectModel(i: number) {
    selected = i;
    const m = models[i];
    select.value = String(i);
    desc.textContent = m.desc;
    statPass.textContent = `cited pass ${m.passRate}`;
    statAcc.textContent = `per-number ${m.acc}`;
    statMemo.textContent = `this memo: ${m.memoOk} verified · ${m.memoBad} untraceable`;
    statVerdict.textContent = m.memoPassed ? 'gate: PASS' : 'gate: FAIL';
    statVerdict.classList.toggle('is-pass', m.memoPassed);
    renderMemo(m);
    requestDraw();
  }

  const onCanvasClick = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const pw = Math.max(1, rect.width - ROSTER_PAD.l - ROSTER_PAD.r);
    const rel = (e.clientX - rect.left - ROSTER_PAD.l) / pw;
    const i = Math.max(0, Math.min(models.length - 1, Math.round(rel * (models.length - 1))));
    selectModel(i);
  };
  canvas.addEventListener('click', onCanvasClick);
  select.addEventListener('change', () => selectModel(parseInt(select.value, 10)));

  const onResize = () => {
    setMemoHeight(memoPane.getBoundingClientRect().height);
    requestDraw();
  };
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  selectModel(selected);
}

// ---- quantlab-analyst: 5. calibrated compression (imatrix explainer) ----
function initQlaQuant(node: HTMLElement) {
  const blocks = QUANT_BLOCKS;
  const LADDERS = fitLadders(blocks);
  const LEVELS = beeswarmLevels(blocks);
  const body = qlaShell(node, 'compression, calibrated', 'how imatrix quantization works · every weight snaps to its nearest rung');

  let mode = 'naive';

  const toggle = qlaEl('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Rung placement mode');
  const naiveBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'naive 4-bit') as HTMLButtonElement;
  const calBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'calibrated (imatrix)') as HTMLButtonElement;
  naiveBtn.type = 'button';
  calBtn.type = 'button';
  toggle.appendChild(naiveBtn);
  toggle.appendChild(calBtn);
  body.appendChild(toggle);

  body.appendChild(qlfLegend([
    { cls: 'qla-sw-weight', label: 'weight' },
    { cls: 'qlf-sw-series', label: 'important weight' },
    { cls: 'qlf-sw-rung', label: 'rung (quantization level)' },
  ]));

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Number line of weight values split into three blocks, each with its own evenly spaced ladder of three quantization rungs. In the naive state each ladder is fitted to minimize average error and the important weights sit visibly off-rung. In the calibrated state the same ladders are refitted with importance-weighted error, so blocks holding important weights shift their scale and offset to land those weights near rungs, at the cost of larger error on the same blocks’ unimportant weights.');
  canvasWrap.appendChild(canvas);
  body.appendChild(canvasWrap);

  // Both captions share one grid cell so toggling never shifts layout.
  const captions = qlaEl('div', 'qla-imx-captions');
  const naiveCap = qlaEl('p', undefined, 'Each block of weights gets its own evenly spaced ladder, fitted to minimize average error. Every weight counts equally.');
  const calCap = qlaEl('p', undefined, 'Same ladders, refitted: errors on heavily used weights count for more, so the fit protects them.');
  captions.appendChild(naiveCap);
  captions.appendChild(calCap);
  body.appendChild(captions);
  body.appendChild(qlaEl('p', 'qlf-chip-note', 'dashed lines divide the blocks · simplified; real blocks hold 32 weights'));

  function draw() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const ctx = sizeCanvas(canvas, w, QUANT_HEIGHT);
    canvas.style.height = `${QUANT_HEIGHT}px`;
    drawQuant(ctx, { w, palette: PALETTE }, blocks, LEVELS, LADDERS[mode]);
  }
  const requestDraw = makeRafDraw(draw);

  function setMode(next: string) {
    mode = next;
    const naiveActive = mode === 'naive';
    naiveBtn.classList.toggle('is-active', naiveActive);
    calBtn.classList.toggle('is-active', !naiveActive);
    naiveBtn.setAttribute('aria-pressed', naiveActive ? 'true' : 'false');
    calBtn.setAttribute('aria-pressed', naiveActive ? 'false' : 'true');
    naiveCap.classList.toggle('is-off', !naiveActive);
    calCap.classList.toggle('is-off', naiveActive);
    requestDraw();
  }

  naiveBtn.addEventListener('click', () => setMode('naive'));
  calBtn.addEventListener('click', () => setMode('calibrated'));

  const onResize = () => requestDraw();
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(() => requestDraw());
  ro.observe(canvasWrap);
  cleanups.push(() => { ro.disconnect(); window.removeEventListener('resize', onResize); });
  setMode('naive');
}

// ---- quantlab-research: 1. the lookahead cheat ----
function initQlfLookahead(node: HTMLElement, la: any) {
  const body = qlaShell(node, 'the lookahead cheat', 'SPY weekly · toy momentum: buy if close > close 4 weeks ago');

  const { n, cheatEq, honestEq, holdEq } = lookaheadSeries(la.close, la.open);
  const series = { dates: la.dates, cheatEq, honestEq, holdEq };
  const finalPct = (eq: number[]) => (eq[eq.length - 1] - 1) * 100;
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

  const readout = qlaEl('div', 'qlf-la-readout');
  function makeStat(label: string, cls: string) {
    const box = qlaEl('div', `qlf-la-stat ${cls}`);
    const big = qlaEl('span', 'qlf-la-big', '');
    box.appendChild(big);
    box.appendChild(qlaEl('span', 'qlf-la-stat-label', label));
    readout.appendChild(box);
    return { box, big };
  }
  const cheatStat = makeStat('cheat · total return', 'qlf-la-stat-cheat');
  const honestStat = makeStat('honest · total return', 'qlf-la-stat-honest');
  const holdStat = makeStat('buy & hold · total return', 'qlf-la-stat-hold');
  cheatStat.big.textContent = fmtPct(finalPct(cheatEq));
  honestStat.big.textContent = fmtPct(finalPct(honestEq));
  holdStat.big.textContent = fmtPct(finalPct(holdEq));
  body.appendChild(readout);
  body.appendChild(qlaEl('p', 'qlf-la-window-note', `cumulative over the charted window (${la.dates[0].slice(0, 4)}–${la.dates[n - 1].slice(0, 4)}), from the backtest`));

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Equity curves for the same momentum strategy: ${fmtPct(finalPct(cheatEq))} when cheating by trading at the signal close, ${fmtPct(finalPct(honestEq))} when honestly trading at the next open, with buy-and-hold at ${fmtPct(finalPct(holdEq))} for reference`);
  body.appendChild(qlfLegend([
    { cls: 'qlf-sw-warn', label: 'cheat' },
    { cls: 'qlf-sw-accent', label: 'honest' },
    { cls: 'qlf-sw-hold', label: 'buy & hold' },
  ]));
  canvasWrap.appendChild(canvas);
  const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect all three equity curves');
  canvasWrap.appendChild(crossInput);
  body.appendChild(canvasWrap);

  const crossReadout = qlfReadout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'cheat', label: 'cheat', width: 6 },
    { key: 'honest', label: 'honest', width: 6 },
    { key: 'hold', label: 'buy & hold', width: 6 },
  ]);
  body.appendChild(crossReadout.row);

  const caption = qlaEl('p', 'qla-compound-takeaway');
  caption.textContent = `Toy rule: buy when this week's close is above the close four weeks ago, otherwise stay flat. The cheat trades at the same close the signal was computed from, which is impossible in live trading, and that alone produces ${fmtPct(finalPct(cheatEq))}. Forced to wait for the next open, the same strategy makes ${fmtPct(finalPct(honestEq))}, less than buy-and-hold. The only difference is when the trade happens.`;
  body.appendChild(caption);

  let cursor: number | null = null;
  const eqPct = (eq: number[], i: number) => fmtPct((eq[i] - 1) * 100);

  function draw() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const ctx = sizeCanvas(canvas, w, LOOKAHEAD_HEIGHT);
    canvas.style.height = `${LOOKAHEAD_HEIGHT}px`;
    drawLookahead(ctx, { w, palette: PALETTE }, series, cursor);
  }
  const requestDraw = makeRafDraw(draw);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    crossReadout.set(cursor === null ? null : {
      date: la.dates[cursor],
      cheat: eqPct(cheatEq, cursor),
      honest: eqPct(honestEq, cursor),
      hold: eqPct(holdEq, cursor),
    });
    requestDraw();
  }

  qlfAttachCrosshair(canvas, crossInput, n, LOOKAHEAD_PAD.l, LOOKAHEAD_PAD.r, setCursor);
  setCursor(null);
  const onResize = () => requestDraw();
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
}

// ---- quantlab-research: 2. kalman vs rolling OLS ----
function initQlfKalman(node: HTMLElement, km: any) {
  const body = qlaShell(node, 'kalman vs rolling OLS hedge ratio', 'best pair · selection 2016-2020, traded 2021+ · same target, two estimators');

  const n = km.dates.length;
  const splitIdx = qlfNearestIndex(km.dates, km.split_date);
  const ols = km.rolling_ols_beta as Array<number | null>;
  const series = { dates: km.dates as string[], kalman_beta: km.kalman_beta as number[], ols };

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.setAttribute('role', 'img');
  const olsVals = ols.filter((v): v is number => v !== null);
  canvas.setAttribute('aria-label', `Hedge ratio over time: a 250-day rolling OLS estimate that whipsaws between ${Math.min(...olsVals).toFixed(1)} and ${Math.max(...olsVals).toFixed(1)}, versus a Kalman-filtered estimate that stays between ${Math.min(...km.kalman_beta).toFixed(2)} and ${Math.max(...km.kalman_beta).toFixed(2)} while tracking the same underlying level, with the 2016-2020 selection window shaded`);
  body.appendChild(qlfLegend([
    { cls: 'qlf-sw-series', label: 'kalman filter' },
    { cls: 'qlf-sw-measured', label: '250-day rolling OLS (textbook method)' },
    { cls: 'qlf-sw-window', label: 'selection window (pair chosen here)' },
  ]));
  canvasWrap.appendChild(canvas);
  const crossInput = qlfCrosshairInput(n, 'Step through dates to compare the rolling OLS and Kalman hedge ratios');
  canvasWrap.appendChild(crossInput);
  body.appendChild(canvasWrap);

  const readout = qlfReadout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'kalman', label: 'kalman β', width: 6 },
    { key: 'ols', label: 'rolling OLS β', width: 6 },
    { key: 'gap', label: 'gap', width: 7 },
  ]);
  body.appendChild(readout.row);

  let cursor: number | null = null;

  function draw() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const ctx = sizeCanvas(canvas, w, KALMAN_HEIGHT);
    canvas.style.height = `${KALMAN_HEIGHT}px`;
    drawKalman(ctx, { w, palette: PALETTE }, series, splitIdx, cursor);
  }
  const requestDraw = makeRafDraw(draw);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    if (cursor === null) readout.set(null);
    else {
      const kb = km.kalman_beta[cursor];
      const ob = ols[cursor];
      readout.set({
        date: km.dates[cursor],
        kalman: kb.toFixed(3),
        ols: ob === null ? '—' : ob.toFixed(3),
        gap: ob === null ? '—' : `${kb - ob >= 0 ? '+' : ''}${(kb - ob).toFixed(3)}`,
      });
    }
    requestDraw();
  }

  qlfAttachCrosshair(canvas, crossInput, n, KALMAN_PAD.l, KALMAN_PAD.r, setCursor);
  const onResize = () => requestDraw();
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  setCursor(null);
}

// ---- quantlab-research: 3. the survivorship wedge ----
function initQlfSurvivorship(node: HTMLElement, sv: any) {
  const body = qlaShell(node, 'the survivorship wedge', 'survivors-only universe vs the ETF that held the losers');

  const n = sv.dates.length;

  const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
  const canvas = document.createElement('canvas');
  canvas.className = 'qla-compound-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Cumulative growth of one dollar: today's S&P survivors reach $${sv.survivors[n - 1].toFixed(2)} while the real equal-weight ETF reaches $${sv.rsp[n - 1].toFixed(2)}, a widening wedge of pure survivorship bias`);
  body.appendChild(qlfLegend([
    { cls: 'qlf-sw-warn', label: 'survivors only' },
    { cls: 'qlf-sw-accent', label: 'RSP (held the losers)' },
    { cls: 'qlf-sw-gap', label: 'survivorship wedge' },
  ]));
  canvasWrap.appendChild(canvas);
  const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect both curves and the survivorship gap');
  canvasWrap.appendChild(crossInput);
  body.appendChild(canvasWrap);

  const crossReadout = qlfReadout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'survivors', label: 'survivors', width: 6 },
    { key: 'rsp', label: 'RSP', width: 6 },
    { key: 'gap', label: 'gap', width: 5 },
  ]);
  body.appendChild(crossReadout.row);

  let cursor: number | null = null;

  const meter = qlaEl('div', 'qlf-meter');
  meter.appendChild(qlaEl('div', 'qla-gate-report-title', 'what the headline is really worth'));

  const YEARS = 9;
  const measuredPct = sv.premium_yr * 100;
  const adjusted = ((1 + sv.momentum_headline) / Math.pow(1 + sv.premium_yr, YEARS) - 1) * 100;
  const big = qlaEl('p', 'qlf-meter-big is-at-measured');
  big.textContent = `+840% claimed → roughly +${Math.round(adjusted)}% after removing the measured ${measuredPct.toFixed(1)}%/yr bias, compounded over ${YEARS} years`;
  meter.appendChild(big);
  meter.appendChild(qlaEl('p', 'qla-compound-takeaway', 'A first-order correction, not a re-backtest: the proper fix is a point-in-time universe. This shows the approximate size of the effect.'));
  body.appendChild(meter);

  function draw() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const ctx = sizeCanvas(canvas, w, SURVIVORSHIP_HEIGHT);
    canvas.style.height = `${SURVIVORSHIP_HEIGHT}px`;
    drawSurvivorship(ctx, { w, palette: PALETTE }, sv, cursor);
  }
  const requestDraw = makeRafDraw(draw);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    crossReadout.set(cursor === null ? null : {
      date: sv.dates[cursor],
      survivors: `$${sv.survivors[cursor].toFixed(2)}`,
      rsp: `$${sv.rsp[cursor].toFixed(2)}`,
      gap: `+${((sv.survivors[cursor] / sv.rsp[cursor] - 1) * 100).toFixed(0)}%`,
    });
    requestDraw();
  }

  qlfAttachCrosshair(canvas, crossInput, n, SURVIVORSHIP_PAD.l, SURVIVORSHIP_PAD.r, setCursor);
  const onResize = () => requestDraw();
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  setCursor(null);
}

// ---- quantlab-systems: risk gate playground (same rules as risk.py) ----
function initQlfRiskGate(node: HTMLElement) {
  // The allowlist / per-symbol cap / gross cap / kill-switch rules live in
  // the shared `visuals/quant.ts` (the same rules as quantlab/risk.py). This
  // function is only the console around them.
  const LIMITS = DEFAULT_RISK_LIMITS;
  const engine = createRiskEngine(LIMITS);
  const state = engine.state;

  const body = qlaShell(node, 'risk gate playground', 'every order proposes itself · same rules as risk.py');

  // 1. status strip: same fixed height in both states (no layout shift)
  const statusStrip = qlaEl('div', 'qlf-status-strip', 'risk service: ACTIVE');
  statusStrip.setAttribute('role', 'status');
  statusStrip.setAttribute('aria-live', 'polite');
  body.appendChild(statusStrip);

  // 2. limits row
  const limitsWrap = qlaEl('div', 'qlf-risk-row');
  limitsWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'limits'));
  const limitsRow = qlaEl('div', 'qlf-limits-row');
  ([
    ['gross cap', `$${LIMITS.gross / 1000}k`],
    ['per-symbol cap', `$${LIMITS.perSymbol / 1000}k`],
    ['daily loss limit', `$${LIMITS.dailyLoss / 1000}k`],
    ['allowed', LIMITS.allowed.join(' ')],
  ] as Array<[string, string]>).forEach((pair) => {
    const field = qlaEl('span', 'qlf-readout-field');
    field.appendChild(qlaEl('span', 'qlf-readout-label', pair[0]));
    field.appendChild(qlaEl('span', 'qlf-limits-value', pair[1]));
    limitsRow.appendChild(field);
  });
  limitsWrap.appendChild(limitsRow);
  body.appendChild(limitsWrap);

  // 3. current state: three fixed-height tiles
  const stateWrap = qlaEl('div', 'qlf-risk-row');
  stateWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'current state'));
  const tiles = qlaEl('div', 'qlf-state-tiles');
  type Tile = { tile: HTMLElement; body: HTMLElement; val?: HTMLElement; sub?: HTMLElement };
  function makeTile(label: string): Tile {
    const tile = qlaEl('div', 'qlf-state-tile');
    tile.appendChild(qlaEl('span', 'qlf-state-label', label));
    const tileBody = qlaEl('div', 'qlf-state-body');
    tile.appendChild(tileBody);
    tiles.appendChild(tile);
    return { tile, body: tileBody };
  }
  function makeValueTile(label: string): Required<Tile> {
    const t = makeTile(label) as Required<Tile>;
    t.body.classList.add('qlf-state-body-center');
    t.val = qlaEl('span', 'qlf-state-value', '');
    t.sub = qlaEl('span', 'qlf-state-sub', '');
    t.body.appendChild(t.val);
    t.body.appendChild(t.sub);
    return t;
  }
  const grossTile = makeValueTile('gross exposure');
  const pnlTile = makeValueTile('day p&l');
  const posTile = makeTile('positions');
  const posLines = LIMITS.allowed.map((sym) => {
    const line = qlaEl('div', 'qlf-pos-line');
    line.appendChild(qlaEl('span', 'qlf-pos-sym', sym));
    const amt = qlaEl('span', 'qlf-pos-amt', '—');
    line.appendChild(amt);
    posTile.body.appendChild(line);
    return { sym, amt };
  });
  stateWrap.appendChild(tiles);
  body.appendChild(stateWrap);

  const pulseTimers = new Set<number>();
  function pulse(el: HTMLElement) {
    el.classList.remove('qlf-pulse');
    void el.offsetWidth;
    el.classList.add('qlf-pulse');
    const id = window.setTimeout(() => { el.classList.remove('qlf-pulse'); pulseTimers.delete(id); }, 700);
    pulseTimers.add(id);
  }
  cleanups.push(() => pulseTimers.forEach((id) => clearTimeout(id)));

  function setTile(t: Required<Tile>, text: string, sub: string) {
    if (t.val.textContent === text && t.sub.textContent === sub) return;
    t.val.textContent = text;
    t.sub.textContent = sub;
    pulse(t.tile);
  }
  function setPositions() {
    let changed = false;
    posLines.forEach((line) => {
      const held = state.positions[line.sym] || 0;
      const text = held !== 0 ? qlfMoney(held) : '—';
      if (line.amt.textContent !== text) {
        line.amt.textContent = text;
        line.amt.classList.toggle('is-held', held !== 0);
        changed = true;
      }
    });
    if (changed) pulse(posTile.tile);
  }

  // 4. audit log
  const logWrap = qlaEl('div', 'qlf-risk-row');
  logWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'audit log (append-only)'));
  const log = qlaEl('div', 'qlf-audit-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Risk service audit log');
  log.setAttribute('tabindex', '0');
  logWrap.appendChild(log);
  body.appendChild(logWrap);

  // 5. button groups
  const bottomBar = qlaEl('div', 'qlf-risk-bottom');
  function makeGroup(label: string, rowClass?: string) {
    const group = qlaEl('div', 'qlf-btn-group');
    group.appendChild(qlaEl('span', 'qlf-btn-group-label', label));
    const row = qlaEl('div', `qlf-risk-buttons${rowClass ? ` ${rowClass}` : ''}`);
    group.appendChild(row);
    bottomBar.appendChild(group);
    return row;
  }
  const orderRow = makeGroup('propose orders', 'qlf-order-row');
  const controlRow = makeGroup('controls');
  body.appendChild(bottomBar);

  function renderState() {
    const gross = engine.gross();
    setTile(grossTile, `${qlfMoney(gross)} / ${qlfMoney(LIMITS.gross)}`, `${Math.round((gross / LIMITS.gross) * 100)}% of cap`);
    setTile(pnlTile, qlfMoney(state.dayPnl), state.killed ? 'kill switch tripped' : `kill switch at ${qlfMoney(-LIMITS.dailyLoss)}`);
    pnlTile.val.classList.toggle('is-negative', state.dayPnl < 0);
    setPositions();
    statusStrip.textContent = state.killed ? 'KILL SWITCH TRIPPED' : 'risk service: ACTIVE';
    statusStrip.classList.toggle('is-tripped', state.killed);
    node.querySelector('.qla-visual')!.classList.toggle('qlf-is-killed', state.killed);
    orderRow.querySelectorAll('button[data-buy]').forEach((b) => {
      b.setAttribute('aria-disabled', state.killed ? 'true' : 'false');
    });
  }

  function appendLog(approved: boolean | null, text: string, reasons?: string[]) {
    const line = qlaEl('div', `qlf-audit-line ${approved === null ? '' : approved ? 'is-approved' : 'is-rejected'}`);
    const ts = new Date().toTimeString().slice(0, 8);
    line.appendChild(qlaEl('span', 'qlf-audit-ts', ts));
    if (approved !== null) line.appendChild(qlaEl('span', 'qlf-audit-verdict', approved ? 'APPROVED' : 'REJECTED'));
    line.appendChild(qlaEl('span', 'qlf-audit-text', reasons && reasons.length ? `${text}: ${reasons.join('; ')}` : text));
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    log.appendChild(line);
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  const logEntry = (entry: { approved: boolean | null; text: string; reasons: string[] }) =>
    appendLog(entry.approved, entry.text, entry.reasons);

  function placeOrder(symbol: string, notional: number, viaFlatten?: boolean) {
    logEntry(engine.placeOrder(symbol, notional, viaFlatten));
    renderState();
  }

  function makeBtn(row: HTMLElement, label: string, handler: () => void, extraClass?: string | null, isBuy?: boolean) {
    const btn = qlaEl('button', `qla-btn qlf-risk-btn${extraClass ? ` ${extraClass}` : ''}`, label) as HTMLButtonElement;
    btn.type = 'button';
    if (isBuy) btn.dataset.buy = '1';
    btn.addEventListener('click', handler);
    row.appendChild(btn);
    return btn;
  }

  makeBtn(orderRow, '+$25k AAPL', () => placeOrder('AAPL', 25000), null, true);
  makeBtn(orderRow, '+$35k MSFT', () => placeOrder('MSFT', 35000), null, true);
  makeBtn(orderRow, '+$15k AAPL', () => placeOrder('AAPL', 15000), null, true);
  makeBtn(orderRow, '+$40k SPY', () => placeOrder('SPY', 40000), null, true);
  makeBtn(orderRow, '+$10k TSLA', () => placeOrder('TSLA', 10000), null, true);

  const mark = (delta: number) => { engine.markPnl(delta).forEach(logEntry); renderState(); };
  makeBtn(controlRow, 'simulate a -$6k day', () => mark(-6000), 'qlf-risk-btn-warn');
  makeBtn(controlRow, 'simulate +$3k day', () => mark(3000));
  makeBtn(controlRow, 'flatten', () => {
    const syms = engine.flattenSymbols();
    if (!syms.length) {
      appendLog(null, 'flatten: already flat');
      renderState();
      return;
    }
    syms.forEach((sym) => placeOrder(sym, -state.positions[sym], true));
  });
  makeBtn(controlRow, 'reset', () => {
    logEntry(engine.reset());
    renderState();
  });

  appendLog(null, 'risk service online · propose an order');
  renderState();
}

// ---- entry points: query placeholders, fetch data, init ----
function initQuantlabVisuals() {
  const compoundNode = document.getElementById('qla-compound-visual');
  const gateNode = document.getElementById('qla-gate-visual');
  const judgeNode = document.getElementById('qla-judge-visual');
  const rosterNode = document.getElementById('qla-roster-visual');
  const quantNode = document.getElementById('qla-quant-visual');
  if (!compoundNode && !gateNode && !judgeNode && !rosterNode && !quantNode) return;

  if (compoundNode) initQlaCompound(compoundNode);
  if (quantNode) initQlaQuant(quantNode);

  if (gateNode || judgeNode || rosterNode) {
    // A swap can land before the fetch resolves; `disposed` (set by the swap's
    // cleanup) stops us from initializing into a detached subtree.
    let disposed = false;
    cleanups.push(() => { disposed = true; });
    fetch(asset('/assets/data/quantlab-visual-data.json'))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (disposed) return;
        // Keep the classic fork's per-key diagnostics: a payload that fetches
        // fine but lost a key used to leave a silently blank exhibit.
        if (gateNode && data.fixer) initQlaGate(gateNode, data.fixer);
        else if (gateNode) console.warn('quantlab-visual-data.json: missing fixer key; repair exhibit skipped');
        if (judgeNode && Array.isArray(data.judgePairs) && data.judgePairs.length) initQlaJudge(judgeNode, data.judgePairs);
        else if (judgeNode) console.warn('quantlab-visual-data.json: missing judgePairs; judge visual skipped');
        if (rosterNode && data.roster && Array.isArray(data.roster.models)) initQlaRoster(rosterNode, data.roster);
        else if (rosterNode) console.warn('quantlab-visual-data.json: missing roster key; roster exhibit skipped');
      })
      .catch((err) => {
        // visuals are progressive enhancement; the article reads fine without them
        console.warn('quantlab-analyst visuals: data fetch failed', err);
      });
  }
}

function initQuantlabFinVisuals() {
  const lookaheadNode = document.getElementById('qlf-lookahead-visual');
  const kalmanNode = document.getElementById('qlf-kalman-visual');
  const survivorshipNode = document.getElementById('qlf-survivorship-visual');
  const riskNode = document.getElementById('qlf-risk-visual');
  if (!lookaheadNode && !kalmanNode && !survivorshipNode && !riskNode) return;

  if (riskNode) initQlfRiskGate(riskNode);

  if (lookaheadNode || kalmanNode || survivorshipNode) {
    let disposed = false;
    cleanups.push(() => { disposed = true; });
    fetch(asset('/assets/data/quantlab-fin-data.json'))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (disposed) return;
        if (lookaheadNode && data.lookahead) initQlfLookahead(lookaheadNode, data.lookahead);
        else if (lookaheadNode) console.warn('quantlab-fin-data.json: missing lookahead key; visual skipped');
        if (kalmanNode && data.kalman) initQlfKalman(kalmanNode, data.kalman);
        else if (kalmanNode) console.warn('quantlab-fin-data.json: missing kalman key; visual skipped');
        if (survivorshipNode && data.survivorship) initQlfSurvivorship(survivorshipNode, data.survivorship);
        else if (survivorshipNode) console.warn('quantlab-fin-data.json: missing survivorship key; visual skipped');
      })
      .catch((err) => {
        console.warn('quantlab visuals: data fetch failed', err);
      });
  }
}

// ============================================================
// wiring
// ============================================================
// Canonical glossary tooltip lives in src/lib/chrome/glossary.ts, shared with
// classic and transit (see that file for the wave3 audit notes). This theme's
// contribution that won the audit is aria-hidden maintenance on the tooltip
// (already folded into the shared module) plus fixing a real bug: blueprint's
// article body scrolls inside its own `.article-overlay` element, not the
// window, so dismissing the tooltip only on window resize (never scroll) let
// it strand mid-page when the overlay scrolled under it. scrollTarget below
// fixes that.
function initGlossary(article: HTMLElement) {
  if (!article.querySelector('.gloss-term[data-gloss]')) return;
  const scrollTarget = article.closest('.article-overlay') ?? window;
  const glossary = createGlossaryTooltip({
    container: article,
    columnSelector: '.article-body',
    scrollTarget,
  });
  cleanups.push(() => glossary.destroy());
}

export function initWidgets(article: HTMLElement | null = document.querySelector('.article-body')) {
  cleanupWidgets();
  if (!article) return;
  initGlossary(article);
  initBqstDspLab();
  initBqstAudioDemo();
  initLcmDemo();
  initThemePalette();
  initDemoPlayer();
  initQuantlabVisuals();
  initQuantlabFinVisuals();
}
export function cleanupWidgets() {
  while (cleanups.length) {
    try {
      cleanups.pop()!();
    } catch {
      /* ignore */
    }
  }
}
