let lcmMount = null;
// ============================================================
// LIVE CHORD MONITOR — embedded demo (chord engine ported from the app)
// ============================================================
const LCM_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LCM_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LCM_LETTER_TO_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LCM_BLACK = new Set([1, 3, 6, 8, 10]);
// Computer-keyboard layout: A W S E D F T G Y H U J K O L mapped C..D (offsets 0-14).
const LCM_KEY_OFFSETS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14 };

const LCM_TEMPLATES = [
    { suffix: '13', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'maj13', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'm13', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: '11', intervals: [0, 4, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: 'maj11', intervals: [0, 4, 7, 11, 2, 5], priority: 64, omit5: true },
    { suffix: 'm11', intervals: [0, 3, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: '9', intervals: [0, 4, 7, 10, 2], priority: 56, omit5: true },
    { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], priority: 56, omit5: true },
    { suffix: 'm9', intervals: [0, 3, 7, 10, 2], priority: 56, omit5: true },
    { suffix: '7b9', intervals: [0, 4, 7, 10, 1], priority: 55, omit5: true },
    { suffix: '7#9', intervals: [0, 4, 7, 10, 3], priority: 55, omit5: true },
    { suffix: '7#11', intervals: [0, 4, 7, 10, 6], priority: 55, omit5: true },
    { suffix: '7b13', intervals: [0, 4, 7, 10, 8], priority: 55, omit5: true },
    { suffix: '7b5', intervals: [0, 4, 6, 10], priority: 49 },
    { suffix: '7#5', intervals: [0, 4, 8, 10], priority: 49 },
    { suffix: 'maj7#5', intervals: [0, 4, 8, 11], priority: 49 },
    { suffix: 'mMaj7', intervals: [0, 3, 7, 11], priority: 48, omit5: true },
    { suffix: 'maj7', intervals: [0, 4, 7, 11], priority: 47, omit5: true },
    { suffix: '7', intervals: [0, 4, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7', intervals: [0, 3, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7b5', intervals: [0, 3, 6, 10], priority: 47 },
    { suffix: 'dim7', intervals: [0, 3, 6, 9], priority: 47 },
    { suffix: '6', intervals: [0, 4, 7, 9], priority: 42, omit5: true },
    { suffix: 'm6', intervals: [0, 3, 7, 9], priority: 42, omit5: true },
    { suffix: 'add9', intervals: [0, 4, 7, 2], priority: 39, omit5: true },
    { suffix: 'madd9', intervals: [0, 3, 7, 2], priority: 39, omit5: true },
    { suffix: 'add11', intervals: [0, 4, 7, 5], priority: 37, omit5: true },
    { suffix: '', intervals: [0, 4, 7], priority: 30 },
    { suffix: 'm', intervals: [0, 3, 7], priority: 30 },
    { suffix: 'dim', intervals: [0, 3, 6], priority: 30 },
    { suffix: 'aug', intervals: [0, 4, 8], priority: 30 },
    { suffix: 'sus4', intervals: [0, 5, 7], priority: 28 },
    { suffix: 'sus2', intervals: [0, 2, 7], priority: 28 },
    { suffix: '5', intervals: [0, 7], priority: 18 },
];

const lcmPc = m => ((m % 12) + 12) % 12;
const lcmNorm = i => ((i % 12) + 12) % 12;
const lcmName = pc => LCM_NAMES_SHARP[lcmPc(pc)];

function lcmAccidental(diff) {
    return ({ 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' })[diff] ?? '';
}

function lcmDegreeForInterval(interval, suffix) {
    if (interval === 0) return 0;
    if (interval === 1 || interval === 2) return 1;
    if (interval === 3 && suffix.includes('#9')) return 1;
    if (interval === 3 || interval === 4) return 2;
    if (interval === 5) return 3;
    if (interval === 6 && suffix.includes('#11')) return 3;
    if (interval === 6 || interval === 7 || (interval === 8 && !suffix.includes('b13'))) return 4;
    if (interval === 9 && suffix.includes('dim7')) return 6; // Cdim7 spells a dim7 (Bbb), not a 6th
    if (interval === 8 || interval === 9) return 5;
    return 6;
}

function lcmBuildSpelling(root, intervals, suffix) {
    const spelling = {};
    const rootLetterIndex = LCM_LETTERS.indexOf(lcmName(root)[0]);
    for (const interval of intervals) {
        const targetPc = lcmNorm(root + interval);
        const letter = LCM_LETTERS[(rootLetterIndex + lcmDegreeForInterval(interval, suffix)) % 7];
        spelling[targetPc] = `${letter}${lcmAccidental(lcmNorm(targetPc - LCM_LETTER_TO_PC[letter]))}`;
    }
    return spelling;
}

function lcmDescribeExtra(interval, intervals) {
    const hasSeventh = intervals.includes(10) || intervals.includes(11);
    if (interval === 1) return 'b9';
    if (interval === 2) return 'add9';
    if (interval === 3 && intervals.includes(4)) return '#9';
    if (interval === 5) return 'add11';
    if (interval === 6 && intervals.includes(7)) return '#11';
    if (interval === 6) return 'b5';
    if (interval === 8 && intervals.includes(7)) return 'b13';
    if (interval === 8) return '#5';
    if (interval === 9) return hasSeventh ? 'add13' : '6';
    if (interval === 10) return 'addb7';
    if (interval === 11) return 'addmaj7';
    return '';
}

// Detect chords from a set of MIDI notes. Slash inversions, sharp spelling.
// Mirrors src/music/chords.ts detectChord() — root-agnostic template matching + scoring.
function lcmDetectChord(activeNotes) {
    const pcs = Array.from(new Set(activeNotes.map(lcmPc))).sort((a, b) => a - b);
    if (pcs.length === 0) return { primary: null, alternatives: [] };
    if (pcs.length === 1) {
        return { primary: { displayName: lcmName(pcs[0]), spelling: { [pcs[0]]: lcmName(pcs[0]) } }, alternatives: [] };
    }

    const bass = lcmPc(Math.min(...activeNotes));
    const candidates = [];
    for (const root of pcs) {
        const intervals = pcs.map(pc => lcmNorm(pc - root));
        const intervalSet = new Set(intervals);
        if (!intervalSet.has(0)) continue;
        for (const t of LCM_TEMPLATES) {
            const missing = t.intervals.filter(i => !intervalSet.has(i));
            if (missing.length > 0 && !missing.every(i => i === 7 && t.omit5)) continue;
            const extras = intervals.filter(i => !t.intervals.includes(i));
            const additions = extras.map(i => lcmDescribeExtra(i, t.intervals)).filter(Boolean);
            const omissions = missing.map(i => (i === 7 ? 'no5' : `no${i}`));
            const score = (100 - missing.length * 11 - additions.length * 7)
                + t.priority + (bass === root ? 8 : 0) + t.intervals.length * 3;
            const base = `${lcmName(root)}${t.suffix}${additions.join('')}${omissions.length ? `(${omissions.join(',')})` : ''}`;
            const displayName = bass === root ? base : `${base}/${lcmName(bass)}`;
            candidates.push({ displayName, score, spelling: lcmBuildSpelling(root, [...t.intervals, ...extras], t.suffix) });
        }
    }

    const seen = new Set();
    const deduped = candidates
        .filter(c => (seen.has(c.displayName) ? false : seen.add(c.displayName)))
        .sort((a, b) => b.score - a.score || b.displayName.length - a.displayName.length);
    return { primary: deduped[0] ?? null, alternatives: deduped.slice(1, 5) };
}

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
