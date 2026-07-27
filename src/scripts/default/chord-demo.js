let lcmMount = null;
// ============================================================
// LIVE CHORD MONITOR — embedded demo (chord engine ported from the app)
// ============================================================
//
// The chord engine below is a HAND-MAINTAINED PORT of
// `live-chord-monitor/src/music/chords.ts`. Nothing links the two files: they
// live in different repos, and they WILL drift apart the moment the app's
// engine is corrected and this copy is not re-synced. That has already
// happened once — the app fixed a batch of naming bugs and the demo kept
// reproducing them for months.
//
// `chord-demo.test.ts` (beside this file) is what catches the drift: it pins
// the demo's output against the app's own corpus expectations. When you change
// the app engine, re-read it, port the change here, and update that test.
//
// The port is deliberately REDUCED, and these omissions are intentional rather
// than drift: sharps-only spelling (no flat-key preference, no enharmonic root
// respelling), slash inversions only, and a single `maj` name style. The demo
// has no settings UI to expose any of those, so porting them would be dead
// code. Everything else — templates, scoring, alteration ordering, spelling —
// is meant to match the app exactly.
const LCM_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LCM_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LCM_LETTER_TO_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LCM_BLACK = new Set([1, 3, 6, 8, 10]);
// Computer-keyboard layout: A W S E D F T G Y H U J K O L mapped C..D (offsets 0-14).
const LCM_KEY_OFFSETS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14 };

// `suffixAlteration` is the tension the suffix already spells (the `#11` in `7#11`). It is extracted at
// format time so a suffix alteration and any extra alterations print as ONE ordered group (`C7(b9,#11)`,
// never `C7#11b9`); the `suffix` string keeps it, because the spelling rules read that string.
// `degreeOverrides` (interval -> 0-based degree) covers templates whose spelling the suffix-sniffing
// defaults cannot infer, e.g. `7alt`, whose 3 is a #9 and whose 8 is a b13.
const LCM_TEMPLATES = [
    { suffix: '13', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'maj13', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'm13', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: '13sus4', intervals: [0, 5, 7, 10, 2, 9], priority: 66, omit5: true },
    { suffix: '11', intervals: [0, 4, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: 'maj11', intervals: [0, 4, 7, 11, 2, 5], priority: 64, omit5: true },
    { suffix: 'm11', intervals: [0, 3, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: '9', intervals: [0, 4, 7, 10, 2], priority: 56, omit5: true },
    { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], priority: 56, omit5: true },
    { suffix: 'm9', intervals: [0, 3, 7, 10, 2], priority: 56, omit5: true },
    { suffix: '7b9', suffixAlteration: 'b9', intervals: [0, 4, 7, 10, 1], priority: 55, omit5: true },
    { suffix: '7#9', suffixAlteration: '#9', intervals: [0, 4, 7, 10, 3], priority: 55, omit5: true },
    { suffix: '7#11', suffixAlteration: '#11', intervals: [0, 4, 7, 10, 6], priority: 55, omit5: true },
    { suffix: '7b13', suffixAlteration: 'b13', intervals: [0, 4, 7, 10, 8], priority: 55, omit5: true },
    // The altered dominant prints as `C7alt`, not as the spelled `C7(b9,#9,#5)`. `alt` is how the idiom
    // names this sound: it says "every tension comes from the altered scale" in one token, whereas the
    // spelled form implies a specific chosen subset and forces an arbitrary #5-vs-b13 choice for a tone
    // that is both. It carries no `suffixAlteration` for the same reason — `alt` is the whole label, so
    // there is nothing to fold into an extras group.
    { suffix: '7alt', intervals: [0, 4, 10, 1, 3, 8], priority: 56, degreeOverrides: { 3: 1, 8: 5 } },
    { suffix: '9sus4', intervals: [0, 5, 7, 10, 2], priority: 54, omit5: true },
    // [C E G A D] is a sixth-ninth chord in every fake book; with no template of its own it used to
    // resolve to `D9sus4` on a foreign root. The `/` is part of the suffix, not a slash bass, so an
    // inverted voicing legitimately reads `C6/9/G` — a form that does appear in print.
    // Like `6`/`m6`, and for the same reason, these do NOT allow an omitted fifth: [0 2 4 9] is far too
    // common a shape, and a fifth-less 6/9 swallowed dozens of better-named voicings whole. The priority
    // is set just high enough to carry the complete five-note shape past its `9sus4`-on-another-root twin.
    { suffix: '6/9', intervals: [0, 4, 7, 9, 2], priority: 55 },
    // `m6/9` sits lower because it needs no such headroom: its rival is a `m7b5add11` a minor third
    // below, which is already the weaker reading. Any higher and it starts winning that argument even
    // when the sounding bass is the m7b5 root, turning `Cm7b5add11` into `D#m6/9/B#`.
    { suffix: 'm6/9', intervals: [0, 3, 7, 9, 2], priority: 37 },
    { suffix: '7b5', suffixAlteration: 'b5', intervals: [0, 4, 6, 10], priority: 49 },
    { suffix: '7#5', suffixAlteration: '#5', intervals: [0, 4, 8, 10], priority: 49 },
    { suffix: 'maj7#5', suffixAlteration: '#5', intervals: [0, 4, 8, 11], priority: 49 },
    { suffix: 'mMaj7', intervals: [0, 3, 7, 11], priority: 48, omit5: true },
    { suffix: 'maj7', intervals: [0, 4, 7, 11], priority: 47, omit5: true },
    { suffix: '7', intervals: [0, 4, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7', intervals: [0, 3, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7b5', intervals: [0, 3, 6, 10], priority: 47 },
    { suffix: 'dim7', intervals: [0, 3, 6, 9], priority: 47 },
    { suffix: 'dimMaj7', intervals: [0, 3, 6, 11], priority: 46 },
    { suffix: '7sus4', intervals: [0, 5, 7, 10], priority: 46 },
    // `6`/`m6` deliberately do NOT allow an omitted fifth: a sixth chord minus its fifth is note-for-note
    // a minor/diminished triad, so allowing the omission made `[C E A]` indistinguishable from `Am/C`.
    { suffix: '6', intervals: [0, 4, 7, 9], priority: 42 },
    { suffix: 'm6', intervals: [0, 3, 7, 9], priority: 42 },
    { suffix: 'add9', intervals: [0, 4, 7, 2], priority: 39, omit5: true },
    { suffix: 'madd9', intervals: [0, 3, 7, 2], priority: 39, omit5: true },
    { suffix: 'add11', intervals: [0, 4, 7, 5], priority: 37, omit5: true },
    // No `add13` template: an added 13th is enharmonically a major 6th, so the `6` template above already
    // covers that voicing. A separate add13 entry would only ever surface as a redundant alternative.
    { suffix: '', intervals: [0, 4, 7], priority: 30 },
    { suffix: 'm', intervals: [0, 3, 7], priority: 30 },
    { suffix: 'dim', intervals: [0, 3, 6], priority: 30 },
    { suffix: 'aug', intervals: [0, 4, 8], priority: 30 },
    { suffix: 'sus4', intervals: [0, 5, 7], priority: 28 },
    { suffix: 'sus2', intervals: [0, 2, 7], priority: 28 },
    { suffix: '5', intervals: [0, 7], priority: 18 },
];

// Scoring weights. An omission is cheaper than an addition: a missing fifth is idiomatic, a note the
// name does not mention is not. Contradictions (two thirds, two fifths, two sevenths) cost more still.
const LCM_OMISSION_COST = 11;
const LCM_ADDITION_COST = 14;
const LCM_CONTRADICTION_COST = 12;
const LCM_ROOT_BASS_BONUS = 8;
const LCM_MATCHED_TONE_BONUS = 3;
// Alternatives more than this far below the primary are noise, not interpretations.
const LCM_ALTERNATIVE_WINDOW = 20;

// Compact interval names for two-note voicings, which no chord template can describe honestly.
const LCM_DYAD_INTERVALS = {
    1: { label: 'm2', degree: 1 },
    2: { label: 'M2', degree: 1 },
    3: { label: 'm3', degree: 2 },
    4: { label: 'M3', degree: 2 },
    5: { label: 'P4', degree: 3 },
    6: { label: 'TT', degree: 3 },
    7: { label: '5', degree: 4 },
    8: { label: 'm6', degree: 5 },
    9: { label: 'M6', degree: 5 },
    10: { label: 'm7', degree: 6 },
    11: { label: 'M7', degree: 6 },
};

// Scale degree (0-based, 0 = root) implied by each addition label, so an added note is spelled with the
// letter its NAME claims: a `#11` must be an F#, never a Gb, even when the template suffix says nothing.
const LCM_ADDITION_DEGREES = {
    b9: 1,
    add9: 1,
    '#9': 1,
    addb3: 2,
    add3: 2,
    add11: 3,
    '#11': 3,
    b5: 4,
    add5: 4,
    '#5': 4,
    b13: 5,
    6: 5,
    add13: 5,
    addb7: 6,
    addmaj7: 6,
};

// Print order for alterations inside a parenthesised group: by tension degree (9, 11, 5, 13), and flat
// before natural before sharp within a degree. Charts read upward through the tensions — `C7(b9,#11)`,
// never the semitone-ascending `C7#11b9` the extras happened to be collected in. The altered fifth sits
// between the 11th and the 13th because it is a fifth, not a tension: `C7(#9,#5)`.
const LCM_ALTERATION_ORDER = {
    addb3: 0,
    add3: 1,
    b9: 10,
    add9: 11,
    '#9': 12,
    add11: 20,
    '#11': 21,
    b5: 30,
    add5: 31,
    '#5': 32,
    b13: 40,
    6: 41,
    add13: 42,
    addb7: 50,
    addmaj7: 51,
};

const lcmPc = m => ((m % 12) + 12) % 12;
const lcmNorm = i => ((i % 12) + 12) % 12;
const lcmName = pc => LCM_NAMES_SHARP[lcmPc(pc)];

function lcmAccidental(diff) {
    return ({ 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' })[diff] ?? '';
}

function lcmDegreeForInterval(interval, t) {
    const override = t.degreeOverrides?.[interval];
    if (override !== undefined) return override;

    const suffix = t.suffix;
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

/**
 * @param {number} root
 * @param {number[]} intervals
 * @param {Map<number, number>} degrees
 * @returns {Record<number, string>}
 */
function lcmBuildSpelling(root, intervals, degrees) {
    /** @type {Record<number, string>} */
    const spelling = {};
    const rootLetterIndex = LCM_LETTERS.indexOf(lcmName(root)[0]);
    for (const interval of intervals) {
        const targetPc = lcmNorm(root + interval);
        const letter = LCM_LETTERS[(rootLetterIndex + (degrees.get(interval) ?? 0)) % 7];
        spelling[targetPc] = `${letter}${lcmAccidental(lcmNorm(targetPc - LCM_LETTER_TO_PC[letter]))}`;
    }
    return spelling;
}

// Every extra note gets a label. Returning '' here used to let a sounding note vanish from the name
// while still being drawn on the keyboard, and cost the candidate nothing in the ranking.
function lcmDescribeExtra(interval, intervals) {
    const has = value => intervals.includes(value);
    const hasSeventh = has(10) || has(11);

    if (interval === 1) return 'b9';
    if (interval === 2) return 'add9';
    if (interval === 3) return has(4) ? '#9' : 'addb3';
    if (interval === 4) return 'add3';
    if (interval === 5) return 'add11';
    // Over a template that already asserts some fifth, a 6-semitone extra is a raised eleventh; only a
    // template with no fifth at all can call it a flat fifth.
    if (interval === 6) return has(7) || has(8) ? '#11' : 'b5';
    if (interval === 7) return 'add5';
    // Likewise `#5` would contradict a template that already spells a diminished or perfect fifth.
    if (interval === 8) return has(7) || has(6) ? 'b13' : '#5';
    // An added 6th over a seventh chord is a 13; over a plain triad it is just a 6 (which collapses
    // onto the dedicated `6`/`m6` templates and avoids a redundant "add13" twin in the alternatives).
    if (interval === 9) return hasSeventh ? 'add13' : '6';
    if (interval === 10) return 'addb7';
    if (interval === 11) return 'addmaj7';
    return `add${interval}`;
}

// True when the extra note directly contradicts a quality the template already asserts.
function lcmContradicts(interval, intervals) {
    const has = value => intervals.includes(value);
    if (interval === 4 && has(3)) return true;
    if (interval === 7 && (has(6) || has(8))) return true;
    if (interval === 10 && has(11)) return true;
    if (interval === 11 && has(10)) return true;
    return false;
}

function lcmAlterationOrder(a, b) {
    const rank = label => LCM_ALTERATION_ORDER[label] ?? 60;
    return rank(a) - rank(b) || a.localeCompare(b);
}

// Fold a template's own alteration back in with the extra ones so they print as a single ordered group.
// Only done when there is something to merge with: a bare `C7#11` or `Cmaj7#5` keeps its familiar
// one-piece suffix. The template's `suffix` field is untouched, so the spelling rules that sniff it
// (`#9` -> D#, `#11` -> F#, `b13` -> Ab) still see the string they expect.
function lcmRegroupAlterations(suffix, suffixAlteration, additions) {
    const sorted = [...additions].sort(lcmAlterationOrder);
    if (suffixAlteration === undefined || additions.length === 0 || !suffix.endsWith(suffixAlteration)) {
        return { suffix, additions: sorted };
    }
    return {
        suffix: suffix.slice(0, suffix.length - suffixAlteration.length),
        additions: [...additions, suffixAlteration].sort(lcmAlterationOrder),
    };
}

// Additions are parenthesised whenever bare concatenation would read as a different chord: `C` + `#9`
// must never render as `C#9` (a chord on C sharp), and `Gadd11` + `6` must never render as `Gadd116`.
function lcmFormatAdditions(additions, suffix) {
    if (additions.length === 0) return '';
    const ambiguous = additions.length > 1
        || suffix === ''
        // A compound suffix already ends in a degree number that the addition would run straight into:
        // `C6/9` + `b9` must not render as the unreadable `C6/9b9`.
        || suffix.includes('/')
        || additions.some(addition => /^\d/.test(addition));
    return ambiguous ? `(${additions.join(',')})` : additions[0];
}

// The slash bass follows the chord's own spelling so the name matches the notes shown (`Cdim/Eb`),
// except where that spelling is a double accidental — `Cdim7/A` reads better than `Cdim7/Bbb`.
function lcmBassName(bass, spelling) {
    const spelled = spelling[bass];
    if (spelled === undefined || spelled.endsWith('##') || spelled.endsWith('bb')) return lcmName(bass);
    return spelled;
}

// Two-note voicings: no chord template can describe them honestly, so they are named as an interval
// above the bass. The perfect fifth keeps its idiomatic power-chord label, so a fourth reads as
// `C P4` rather than an inverted `F5/C`.
function lcmDescribeDyad(pcs, bass) {
    const other = pcs.find(pc => pc !== bass) ?? pcs[0];
    const interval = lcmNorm(other - bass);
    const descriptor = LCM_DYAD_INTERVALS[interval];
    const rootName = lcmName(bass);
    const degrees = new Map([[0, 0], [interval, descriptor.degree]]);
    return {
        root: bass,
        bass,
        omissions: [],
        additions: [],
        score: 100,
        displayName: interval === 7 ? `${rootName}5` : `${rootName} ${descriptor.label}`,
        spelling: lcmBuildSpelling(bass, [0, interval], degrees),
    };
}

function lcmCompareCandidates(a, b) {
    if (a.score !== b.score) return b.score - a.score;

    const aRooted = a.root === a.bass ? 1 : 0;
    const bRooted = b.root === b.bass ? 1 : 0;
    if (aRooted !== bRooted) return bRooted - aRooted;

    const aDecoration = a.additions.length + a.omissions.length;
    const bDecoration = b.additions.length + b.omissions.length;
    if (aDecoration !== bDecoration) return aDecoration - bDecoration;

    // Prefer the plainer label on a genuine tie; ties are broken deterministically by name.
    if (a.displayName.length !== b.displayName.length) return a.displayName.length - b.displayName.length;
    return a.displayName.localeCompare(b.displayName);
}

/**
 * A named reading of a sounding pitch-class set.
 * @typedef {object} LcmCandidate
 * @property {number} root
 * @property {number} bass
 * @property {string[]} omissions
 * @property {string[]} additions
 * @property {number} score
 * @property {string} displayName
 * @property {Record<number, string>} spelling — pitch class -> letter+accidental
 */

/**
 * Detect chords from a set of MIDI notes. Slash inversions, sharp spelling.
 * Exported for `chord-demo.test.ts`, the drift guard described at the top of this file.
 * @param {number[]} activeNotes
 * @returns {{ primary: LcmCandidate | null, alternatives: LcmCandidate[] }}
 */
export function lcmDetectChord(activeNotes) {
    const pcs = Array.from(new Set(activeNotes.map(lcmPc))).sort((a, b) => a - b);
    if (pcs.length === 0) return { primary: null, alternatives: [] };
    if (pcs.length === 1) {
        const only = pcs[0];
        return {
            primary: {
                root: only,
                bass: only,
                omissions: [],
                additions: [],
                score: 1,
                displayName: lcmName(only),
                spelling: { [only]: lcmName(only) },
            },
            alternatives: [],
        };
    }

    const bass = lcmPc(Math.min(...activeNotes));
    if (pcs.length === 2) return { primary: lcmDescribeDyad(pcs, bass), alternatives: [] };

    const candidates = [];
    for (const root of pcs) {
        const intervals = pcs.map(pc => lcmNorm(pc - root));
        const intervalSet = new Set(intervals);
        for (const t of LCM_TEMPLATES) {
            const missing = t.intervals.filter(i => !intervalSet.has(i));
            if (missing.length > 0 && !missing.every(i => i === 7 && t.omit5)) continue;

            // Extras are sorted so two spellings of the same chord can never differ only in addition order.
            const extras = intervals.filter(i => !t.intervals.includes(i)).sort((a, b) => a - b);
            const additions = extras.map(i => lcmDescribeExtra(i, t.intervals));
            const omissions = missing.map(i => (i === 7 ? 'no5' : `no${i}`));
            const contradictions = extras.filter(i => lcmContradicts(i, t.intervals)).length;
            // Count the tones actually SOUNDING, not the template's slot count: a three-note sound must
            // not be credited for a fourth tone it omits.
            const matchedTones = t.intervals.length - missing.length;
            const score = 100
                - missing.length * LCM_OMISSION_COST
                - additions.length * LCM_ADDITION_COST
                - contradictions * LCM_CONTRADICTION_COST
                + t.priority
                + (bass === root ? LCM_ROOT_BASS_BONUS : 0)
                + matchedTones * LCM_MATCHED_TONE_BONUS;

            const sounding = [...t.intervals.filter(i => !missing.includes(i)), ...extras];
            const degrees = new Map();
            for (const i of t.intervals) degrees.set(i, lcmDegreeForInterval(i, t));
            extras.forEach((i, index) => {
                degrees.set(i, LCM_ADDITION_DEGREES[additions[index]] ?? lcmDegreeForInterval(i, t));
            });
            const spelling = lcmBuildSpelling(root, sounding, degrees);

            const regrouped = lcmRegroupAlterations(t.suffix, t.suffixAlteration, additions);
            const formatted = lcmFormatAdditions(regrouped.additions, regrouped.suffix);
            // An addition group and an omission group must never sit side by side ("Cadd9(6)(no5)").
            // When the additions already print parenthesised, the omissions join that same group; when a
            // lone addition is glued to the suffix (`Fmaj7#11`), it stays glued and the omissions keep
            // their own group.
            const merged = formatted.startsWith('(') && omissions.length > 0
                ? `${formatted.slice(0, -1)},${omissions.join(',')})`
                : `${formatted}${omissions.length > 0 ? `(${omissions.join(',')})` : ''}`;
            const base = `${lcmName(root)}${regrouped.suffix}${merged}`;

            candidates.push({
                root,
                bass,
                omissions,
                additions,
                score,
                displayName: bass === root ? base : `${base}/${lcmBassName(bass, spelling)}`,
                spelling,
            });
        }
    }

    // Every candidate resolves to the same sounding pitch-class set (template minus omissions plus
    // extras IS the input), so the resolved set plus the root reduces to the root: two labels for the
    // same root are the same chord wearing two hats (`C9(no5)` vs `C7(no5)add9`). Candidates arrive
    // pre-sorted, so the best-scoring label per root survives.
    const seen = new Set();
    const deduped = candidates
        .sort(lcmCompareCandidates)
        .filter(c => (seen.has(c.root) ? false : seen.add(c.root)));

    const primary = deduped[0] ?? null;
    const alternatives = primary === null
        ? []
        : deduped.slice(1, 5).filter(c => c.score >= primary.score - LCM_ALTERNATIVE_WINDOW);
    return { primary, alternatives };
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
