import { lcmDetectChord, lcmName, lcmPc, LCM_BLACK, LCM_KEY_OFFSETS } from '../../lib/chord-engine';

let lcmMount = null;
// ============================================================
// LIVE CHORD MONITOR — embedded demo
// ============================================================
//
// The chord engine now lives in `src/lib/chord-engine.ts`, shared by all
// three themes (classic here, transit, and blueprint). It used to be a
// hand-maintained port duplicated in each theme and it drifted more than
// once; see that file's header for the full story. Everything below this
// point is classic-theme DOM wiring only — piano rendering, pointer/keyboard
// input, and the readout — none of it is chord logic.
//
// `chord-demo.test.ts` (beside this file) is the colocated corpus guard: it
// pins the shared engine's output against the app's own corpus expectations
// for this theme's import path.
export { lcmDetectChord };

function initLcmDemo(container) {
    const placeholder = container.querySelector('#lcm-demo');
    if (!placeholder || placeholder._lcmInit) return;
    placeholder._lcmInit = true;

    const LOW = 60, HIGH = 74; // C4..D5 — exactly the computer-keyboard window
    const offsetToKey = {};
    Object.entries(LCM_KEY_OFFSETS).forEach(([code, off]) => { offsetToKey[off] = code.replace('Key', ''); });

    const pointerNotes = new Map(); // pointerId -> note (mouse/touch press-and-hold)
    const keyHeld = new Set();      // held via computer keyboard

    placeholder.innerHTML = `
        <div class="lcm-demo">
            <div class="lcm-readout" aria-live="polite" aria-atomic="true">
                <div class="lcm-chord">play some notes</div>
                <div class="lcm-notes"></div>
                <div class="lcm-alts"></div>
            </div>
            <div class="lcm-piano" role="group" aria-label="Playable piano"></div>
            <p class="lcm-hint">Play with your computer keyboard - the letters are printed on the keys. Hold a few at once to build a chord (or use multi-touch on the keys).</p>
        </div>`;

    const piano = placeholder.querySelector('.lcm-piano');
    const chordEl = placeholder.querySelector('.lcm-chord');
    const notesEl = placeholder.querySelector('.lcm-notes');
    const altsEl = placeholder.querySelector('.lcm-alts');

    const whites = [];
    for (let n = LOW; n <= HIGH; n++) if (!LCM_BLACK.has(lcmPc(n))) whites.push(n);
    const whiteIndex = {};
    whites.forEach((n, i) => { whiteIndex[n] = i; });
    const keyEls = {};

    for (let n = LOW; n <= HIGH; n++) {
        const black = LCM_BLACK.has(lcmPc(n));
        const el = document.createElement('button');
        el.type = 'button';
        // Out of the tab order: the keyboard interface is the printed A–L letter keys, not
        // Enter/Space on each button (press-and-hold can't be expressed by a single Enter).
        el.tabIndex = -1;
        el.className = `lcm-key ${black ? 'black' : 'white'}`;
        el.dataset.note = n;
        const label = offsetToKey[n - LOW];
        el.innerHTML = label ? `<span class="lcm-key-label">${label}</span>` : '';
        el.setAttribute('aria-label', `${lcmName(n)}${Math.floor(n / 12) - 1}`);
        if (black) {
            // sit on the gap after the previous white key (CSS translateX(-50%) self-centers)
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
        // spell each held pitch (low→high) using the detected chord's spelling
        const spell = primary?.spelling || {};
        const seen = new Set();
        const noteNames = [];
        notes.forEach(n => { const pc = lcmPc(n); if (!seen.has(pc)) { seen.add(pc); noteNames.push(spell[pc] || lcmName(pc)); } });
        notesEl.textContent = noteNames.join('  ·  ');
        altsEl.textContent = alternatives.length ? `alt: ${alternatives.map(a => a.displayName).join('   ·   ')}` : '';
    }

    // Pointer: press-and-hold — a note sounds while pressed and releases when you let go,
    // like a real key. (Chords are built by holding multiple keyboard keys, or multi-touch.)
    piano.addEventListener('pointerdown', e => {
        const key = e.target.closest('.lcm-key');
        if (!key) return;
        e.preventDefault();
        pointerNotes.set(e.pointerId, parseInt(key.dataset.note, 10));
        render();
    });
    const endPointer = e => { if (pointerNotes.delete(e.pointerId)) render(); };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    // Computer keyboard: press-and-hold (natural chord playing). Active only while the demo is visible.
    const onKeyDown = e => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        // Don't swallow letter keys when the user is typing in a field.
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
        const off = LCM_KEY_OFFSETS[e.code];
        if (off === undefined) return;
        e.preventDefault();
        keyHeld.add(LOW + off);
        render();
    };
    const onKeyUp = e => {
        const off = LCM_KEY_OFFSETS[e.code];
        if (off === undefined) return;
        keyHeld.delete(LOW + off);
        render();
    };
    // Releasing held keys on blur prevents stuck notes when focus leaves mid-hold
    // (the keyup would otherwise land on a different window and never arrive).
    const onBlur = () => { keyHeld.clear(); pointerNotes.clear(); render(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    lcmDemoCleanup = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('pointerup', endPointer);
        window.removeEventListener('pointercancel', endPointer);
        lcmDemoCleanup = null;
    };

    render();
}
let lcmDemoCleanup = null;

export function init(root = document) {
    cleanup();
    lcmMount = root.querySelector('#lcm-demo');
    initLcmDemo(root);
}
export function cleanup() {
    if (lcmDemoCleanup) lcmDemoCleanup();
    if (lcmMount) delete lcmMount._lcmInit;
    lcmMount = null;
}
