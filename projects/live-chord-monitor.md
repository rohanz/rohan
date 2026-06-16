---
title: live chord monitor
summary: "A real-time MIDI and computer-keyboard chord monitor: a root-agnostic chord-detection engine with correct enharmonic spelling, built as a signed and notarized macOS app in Electron, React, and TypeScript."
image: assets/images/projects/live-chord-monitor/banner.webp
technologies:
  - TypeScript
  - React
  - Electron
  - Web MIDI
  - Real-Time
  - Music Theory
---

## why i built it

Alongside making music, I teach music theory and production lessons online. A lot of that happens at the keyboard: I play a voicing and explain why it works. But a screen-share doesn't show what my hands are doing, and stopping to name every chord out loud breaks the flow of a lesson.

Paid tools exist that show chords from <span class="gloss-term" data-gloss="MIDI is a protocol that lets instruments and computers send note and control messages to each other. A MIDI keyboard sends 'note on'/'note off' events rather than audio.">MIDI</span>, but the ones I tried were rigid: one naming convention, one spelling, no say over inversions or how busy the readout got. In a lesson I want to control exactly how a chord is named and spelled to match whatever I'm teaching that day, so I built a tool with those controls.

What surprised me was how deep the core problem went. Turning a handful of held keys into the chord name a musician would actually write down is much harder than it looks, and getting it right is what kept me going well past "good enough for a lesson."

## what is it?

Live Chord Monitor is a desktop app that listens to every connected MIDI device and the computer keyboard, works out the chord you're playing in real time, and shows both its name and the notes on a <span class="gloss-term" data-gloss="A grand staff is the treble and bass staves joined together, the standard way piano music is written.">grand staff</span>. Settings control the naming style, inversions, sharp or flat spelling, and how long a chord lingers on screen after you let go.

![The Live Chord Monitor app: a held chord named at the top, written out on a grand staff, with the notes lit on the piano below.](assets/images/projects/live-chord-monitor/app-ui.webp)

The chord-detection engine at the centre of it runs right here in the browser. I ported it from the app's TypeScript so you can try it without installing anything. The full source is on <a href="https://github.com/rohanz/live-chord-monitor" target="_blank" rel="noopener noreferrer">github.com/rohanz/live-chord-monitor</a>.

## try it

Play a chord and it names it. Use your computer keyboard (the letters are printed on the keys) or tap the keys. A few to try: hold `A D G` for a C major triad (C, E, G); add `J` to make it a Cmaj7; or play `D G K` and watch it read `C/E`, the same triad with E in the bass, a <span class="gloss-term" data-gloss="An inversion is a chord with a note other than the root in the bass. C major with E in the bass is the first inversion, written C/E.">first inversion</span>.

<div id="lcm-demo"></div>

That readout is doing more than looking notes up in a table. Working out a chord from a set of notes is the interesting part, so I'll start there.

## naming a chord from notes

A handful of pressed keys is just a set of <span class="gloss-term" data-gloss="A pitch class is a note name regardless of octave. Every C is pitch class 0, every C# is 1, and so on up to 11. There are only 12.">pitch classes</span>. The same set can be several different chords depending on which note you treat as the <span class="gloss-term" data-gloss="The root is the note a chord is named from and built on. The root of a C major chord is C.">root</span>. C, E and G spell a C major chord; the notes A, C and E spell A minor, and the two overlap. So the engine doesn't assume the lowest note is the root. It treats every active pitch class as a candidate root, measures the <span class="gloss-term" data-gloss="An interval is the distance between two notes in semitones. A major third is 4 semitones; a perfect fifth is 7.">intervals</span> of the other notes against it, and tests that interval set against 34 chord templates, from triads up through 13th chords and altered dominants.

Plenty of candidates can fit at once. A busy voicing might match a dozen names, so each one gets a score and the highest wins:

```ts
// Try every active note as a possible root; score how well each template fits.
const exactness = 100 - missing.length * 11 - additions.length * 7;
const score =
  exactness +
  template.priority +              // extensions outrank plain triads
  (bass === root ? 8 : 0) +        // reward the name whose root is actually in the bass
  template.intervals.length * 3;   // and the more complete, more specific name
```

A few decisions live in that scoring. Incomplete or cluttered matches lose points, so a clean triad beats a triad with two stray notes hanging off it. The priority term lets a true `Cmaj9` outrank the plain `Cmaj7` sitting inside it. And the bass bonus is what produces <span class="gloss-term" data-gloss="A slash chord names the chord and then the bass note after a slash, like C/E for a C chord with E in the bass.">slash chords</span> on its own: play C-E-G with E at the bottom and `C/E` scores highest, ahead of any rootless reading.

Real voicings often leave notes out, too. Jazz pianists drop the fifth all the time, since it adds little and frees up a finger, so the engine lets the perfect fifth go missing and still finds the chord. That is why C-E-Bb-D comes back as `C9` instead of matching nothing. When more than one name is defensible, the next four candidates show up under the primary as alternatives.

## spelling it right

Getting the name right is only half the job. The notes have to be spelled correctly too, and pitch class alone can't do that. Pitch class 10 is the same piano key whether you call it A# or Bb, but inside a C7 chord it is a Bb, the flat seventh, and writing A# would look wrong to any musician.

So the engine keeps no table of spellings. It steps through the chord's notes by <span class="gloss-term" data-gloss="The seven letter names A through G. Each chord tone should use a different letter so the chord reads correctly, e.g. C-E-G-Bb, not C-E-G-A#.">diatonic letter steps</span> from the root letter, then works out each <span class="gloss-term" data-gloss="A sharp, flat, double-sharp, or double-flat sign that raises or lowers a letter note. Bb is B-flat; Bbb is B-double-flat.">accidental</span> from the distance between where the note actually lands and that letter's natural pitch:

```ts
// Spell each tone by stepping diatonic LETTERS from the root, then pick the accidental
// from the gap to that letter's natural pitch. So C7's seventh is Bb, and a diminished
// seventh chord's is a double-flat (Cdim7 -> Bbb), never A# or A.
const letter = LETTERS[(rootLetterIndex + degreeForInterval(interval)) % 7];
const accidental = accidentalFor(targetPitch - naturalPitchOf(letter));
spelling[targetPitch] = `${letter}${accidental}`;
```

The double-flat case is the one I find most satisfying. A `Cdim7` stacks minor thirds: C, Eb, Gb, and then a note that sounds like A but functions as a diminished seventh, so it has to be written B𝄫 to keep one letter per chord tone. The engine spells it that way, and that spelling flows into the notation, so the accidentals on the staff follow the theory instead of the raw key. You can see it in the demo above as the note row re-spells itself when the chord around it changes.

One honest limit: the sharp-or-flat choice is a single global toggle, not full key-signature awareness. The engine spells correctly within a chord, but it doesn't know you're sitting in the key of Eb. I labeled the setting "Spelling" rather than "Key" so it doesn't claim more than it delivers.

## real time, with real hardware

The input side has its own set of problems, and they only really surface once real hardware is involved.

The first: the same note can arrive from more than one place at once. A MIDI keyboard, the computer keyboard, and a mouse click can all be holding middle C together. So the app doesn't track a note as simply down or up. It tracks the set of sources currently holding each note and releases it only when the last source lets go, so one input lifting off never cuts a note another input is still playing.

The second: hardware gets unplugged mid-chord. Pull out a controller while keys are down and those <span class="gloss-term" data-gloss="A stuck note is one the app thinks is still held because it never received the matching 'note off', often after a device disconnects mid-note.">notes would stick</span> forever, because the matching "note off" never arrives. The app listens for device disconnects over the <span class="gloss-term" data-gloss="The Web MIDI API lets a browser or Electron app talk to MIDI devices directly, including hot-plugging devices while running.">Web MIDI API</span> and fires the missing note-offs itself for whatever that device was holding.

The third is subtler, and it is purely about feel. When you lift a chord your fingers don't all leave at the same millisecond, so for a moment the app sees the chord shrink to whichever note happened to release last, and the readout flashes a wrong name on the way out. The fix is a small state machine that separates what's displayed from what's held. New notes appear instantly, but a shrinking chord waits about 60 milliseconds to check whether it is a real change or the beginning of a full release, and a full release can linger and fade instead of blinking straight to blank. I moved that timing logic into its own module so I could test it against a fake clock.

## shipping it

The app made sound and named a chord fairly early. That was a long way from finished.

Because it is an <span class="gloss-term" data-gloss="Electron packages a web app (HTML/JS) with a browser engine and Node.js so it can run as a native desktop app on macOS, Windows, and Linux.">Electron</span> app taking input from devices, I treated security as part of the build. The renderer runs <span class="gloss-term" data-gloss="A sandboxed renderer is isolated from the operating system, so even a compromised web layer can't freely touch files or the system.">sandboxed</span> with context isolation and no Node access. The production UI is served over a custom privileged `app://` scheme with path-traversal guarding instead of `file://`. There is a real <span class="gloss-term" data-gloss="A Content Security Policy restricts what a page is allowed to load and run, which limits the damage if malicious content ever got in.">Content-Security-Policy</span>, and the permission handler grants MIDI and nothing else.

Distribution is the stage where a lot of side projects stop. This one ships as a signed and <span class="gloss-term" data-gloss="Apple's process of scanning and approving a Mac app so Gatekeeper will run it without scary warnings. Stapling attaches the approval ticket to the app so it works offline.">notarized</span> universal binary: a single download that runs natively on Apple Silicon and Intel Macs, built with a hardened runtime, notarized and stapled by Apple, with every signing credential kept in the macOS keychain and out of the repo. Getting `spctl` to report "Notarized Developer ID" and `stapler` to pass is a real piece of engineering on its own, with nothing to do with music.

Underneath all of it sits a suite of about 50 tests. The chord engine is the most heavily covered: triads, sevenths, extensions, every naming and inversion mode, the fifth-omission cases, the ambiguous voicings, and spelling edge cases like `C7`→Bb and `Cdim7`→B𝄫. Plain functions with no UI are easy to test, which is part of why the chord logic lives completely apart from React.

## what stuck with me

**Chord naming is really a ranking problem.** The same notes can be several legitimate chords, so the engine never looks one up. It generates every defensible candidate and scores them, which is the same shape as search relevance or a classifier: the real work is in the scoring heuristic and the tie-breaks, not the data. Once I framed it that way, ambiguous voicings stopped being bugs. I just show the runner-up names underneath.

**The hard part was perception, not math.** The chord theory was deterministic and working early on. What actually felt broken was the readout flickering as a chord was released, and the fix was a state machine that models the gap between what's held and what's shown. Responsiveness that feels right has to be designed in on purpose.

**Correctness belongs in pure functions.** All the chord theory is plain functions with no React, no audio, no DOM, which is exactly why I could nail down dozens of edge cases in fast unit tests and rework the scoring without worrying about breaking something. The messy, mockable parts (MIDI, audio, rendering) stay at the edges. I let the question "what do I want to be able to test?" shape the architecture.

**A desktop app has a security surface a web page doesn't.** Wrapping web code in Electron gives it a path to the operating system, so "finished" had to include sandboxing the renderer, serving the UI over a locked-down scheme, enforcing a CSP, and handing the renderer only the MIDI permission. None of it shows up in a screenshot, but once people install software instead of visiting a page, that surface is yours to defend.
