// The live-chord-monitor article's playable piano, shared by every theme.
//
// The chord engine lives in `src/lib/chord-engine.ts`; this file is only the
// DOM wiring around it — piano rendering, pointer/keyboard input, and the
// readout. Styling is each theme's `.lcm-*` rules.

import { lcmDetectChord, lcmName, lcmPc, LCM_BLACK, LCM_KEY_OFFSETS } from '../chord-engine';

export interface LcmDemoOptions {
  root: ParentNode;
}

/** Mount the piano into `#lcm-demo` if the article has one; returns cleanup. */
export function initLcmDemo({ root }: LcmDemoOptions): () => void {
  const placeholder = root.querySelector<HTMLElement>('#lcm-demo');
  if (!placeholder) return () => {};

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
    const key = document.createElement('button');
    key.type = 'button';
    key.tabIndex = -1;
    key.className = `lcm-key ${black ? 'black' : 'white'}`;
    key.dataset.note = String(n);
    const label = offsetToKey[n - LOW];
    key.innerHTML = label ? `<span class="lcm-key-label">${label}</span>` : '';
    key.setAttribute('aria-label', `${lcmName(n)}${Math.floor(n / 12) - 1}`);
    if (black) {
      const prevWhite = whiteIndex[n - 1];
      key.style.left = `calc((${prevWhite + 1}) * (100% / ${whites.length}))`;
    } else {
      key.style.flex = '1';
    }
    piano.appendChild(key);
    keyEls[n] = key;
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
  // shortcuts everywhere else on the article. Starts true (corrected by the
  // observer's first callback) and stays true if IntersectionObserver is
  // unavailable so the piano still works.
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

  render();

  return () => {
    pianoIO?.disconnect();
    piano.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', endPointer);
    window.removeEventListener('pointercancel', endPointer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}
