---
title: bqst
summary: "A professional-grade audio mastering plugin built in C++/JUCE, combining custom DSP, real-time signal visualization, oversampling, preset management, and a polished hardware-inspired interface."
image: assets/images/projects/bqst/banner.png
technologies:
  - C++
  - JUCE
  - DSP
  - Real-Time Audio
  - Signal Processing
  - Product Design
---

## Forewarning, And The Why

If you thought some of my other project writeups got too deep into nerdy details, you're not ready for this one. BQST sits right at the intersection of practically all the things I'm into: programming, music production, audio engineering, <span class="gloss-term" tabindex="0" data-gloss="Digital signal processing: using code and math to shape audio, images, sensors, or any signal that changes over time.">DSP</span>, and AI-assisted software development, so let me go a little crazy with this.

Music production has never been a cheap hobby. <span class="gloss-term" tabindex="0" data-gloss="Digital Audio Workstations: software like Ableton, Logic, or Pro Tools where music is recorded, edited, mixed, and produced.">DAWs</span> already cost a decent amount, and the plugins that actually help with production and mixing can get expensive fast. At some point I started thinking: what if I could build one of the tools I kept reaching for? Or make one I felt would genuinely help me?

I've also always wanted to dip my toes into digital signal processing. Not by watching plugin-development videos forever, or taking a course in school, but by building a real signal processor, and one that was legitimately useful. With Codex helping me move through the unfamiliar JUCE/plugin architecture, I went from never having made an audio plugin before to finishing a working VST3/AU/Standalone build with a custom GUI, automatable parameters, presets, <span class="gloss-term" tabindex="0" data-gloss="Processing audio at a higher temporary sample rate, then filtering it back down, which helps reduce harsh digital artifacts from nonlinear effects.">oversampling</span>, pluginval validation, and a release build installed into Ableton.

## What is it?

That's how bqst came about, short for **Baxandall EQ and Saturation**. The idea was simple: a broad tone-shaping equalizer feeding a tasteful harmonic generator. 

<img src="assets/images/projects/bqst/final-ui.png" alt="Final BQST plugin interface" class="bqst-article-image">

An equalizer, or an EQ, boosts or cuts parts of the frequency spectrum of a signal. In music, that could mean adding an airy sheen to a vocal, reducing the harshness of a cymbal, or giving a kick drum more sub bass weight. The EQ module is on the left.

A harmonic generator is a little less straightforward. When you drive analog gear like <span class="gloss-term" tabindex="0" data-gloss="Magnetic recording machines that store audio on tape. Pushed tape often sounds compressed, rounded, and slightly softened in the top end.">tape machines</span>, <span class="gloss-term" tabindex="0" data-gloss="Vacuum tubes are old-school amplifying components. In audio, they are often associated with smooth compression, warmth, and even-harmonic richness.">tubes</span>, <span class="gloss-term" tabindex="0" data-gloss="Operational amplifiers are small amplifier circuits used all over audio electronics. When pushed, they can add thickness, density, or a sharper transistor-like edge depending on the design.">op-amps</span>, or <span class="gloss-term" tabindex="0" data-gloss="An electrical transformer passes signal between coils of wire. In audio gear, pushing one can add gentle compression, low-mid weight, and odd-harmonic edge.">transformers</span>, they don't just make the signal louder; they add new frequencies related to the original sound. Those added frequencies are called harmonics. In the right amount, they can make audio feel thicker, warmer, brighter, or more expensive. Too much of it just becomes distortion. BQST's saturation stage is my attempt at controlling that line, with two algorithms that can make signals sound full and dense, or a little aggressive and edgy. The saturation module is on the right.

## Bax EQ design

A Baxandall-style EQ is built for broad tone moves: making a mix feel brighter, darker, heavier, or lighter without sounding obviously "EQ'd."

Each side has a <span class="gloss-term" tabindex="0" data-gloss="A filter that raises or lowers everything below a chosen frequency.">low shelf</span> and <span class="gloss-term" tabindex="0" data-gloss="A filter that raises or lowers everything above a chosen frequency.">high shelf</span> with +/-6 dB of gain. The shelf frequency selectors are stepped:

- Low shelf: 74, 84, 98, 116, 131, 166, 230, 361 Hz
- High shelf: 1.6, 1.8, 2.1, 2.5, 3.4, 4.8, 7.1, 18 kHz

The graph below shows the shape of those shelves across the audible range.

<div id="bqst-eq-visual"></div>

The filters are JUCE IIR low/high shelves with a deliberately low <span class="gloss-term" tabindex="0" data-gloss="Q describes how narrow or wide a filter shape is. A lower Q means a broader, gentler curve.">Q</span> around `0.38`, closer to classic tone-control behavior than a modern parametric shelf.

Under the hood, each shelf is a <span class="gloss-term" tabindex="0" data-gloss="A two-pole/two-zero digital filter building block used for EQs, shelves, and tone controls.">biquad</span> coefficient set. During a gain move, coefficients are recalculated while the smoother is active, then left alone once the target is reached. That keeps automation smooth without constantly rebuilding filters when nothing is changing.

## Saturation Design

The saturation side was the most subjective part. Saturation is controlled distortion: it rounds off peaks and adds harmonics. It's easy to overdo, and early versions of BQST did exactly that. Loud kick drums could trigger a brittle edge, and the transformer mode made the upper mids too crunchy and forward, similar to an old cassette tape or something. Cool effect in its own right, but not the point of this.

The fix was to stop treating saturation as just a <span class="gloss-term" tabindex="0" data-gloss="A waveshaper changes sample values with a curve. Gentle curves sound like saturation; aggressive curves can sound like clipping.">waveshaper</span>. The <span class="gloss-term" tabindex="0" data-gloss="A plot of input level against output level. A straight line is clean; a bent line means the processor is adding saturation or distortion.">transfer curve</span> still matters, but it sits inside a small signal chain: filtering before the nonlinearity, a carefully shaped nonlinear function, level compensation, and gentle tone shaping after it.

The graph below is interactive. Click and drag upward on the Drive knob to see the waveshaping part of the algorithms change as they are pushed harder.

<div id="bqst-transfer-visual"></div>

As the drive increases, the straight dry signal starts to bend. That bend is the whole point: the peaks are rounded instead of chopped flat, which is what creates the extra harmonic content without immediately sounding like hard clipping.

The two algorithms, cream and grit, both use soft nonlinear transfer curves, but the surrounding tone network is different.

## Saturation Algorithms
### Cream

Cream is the smoother mode. It is meant to feel thick and polished rather than obviously distorted. The algorithm combines:

- a soft asymmetric `tanh` curve
- a small even-harmonic bias term
- cubic weighting for odd harmonics at higher drive
- pre/de-emphasis around the upper treble
- a low-end guard before and after the nonlinear stage

The pre/de-emphasis matters because full-band saturation can make treble harsh very quickly. Cream shapes what enters and exits the saturator, so the result feels more like analog density than a clipper.

### Grit

Grit is transformer-inspired. It is a little firmer and more forward, but I still wanted it to be usable on more than one special effect setting. It uses:

- a firmer `tanh` transfer curve
- a small bias term
- low-mid weighting before saturation
- mild top rounding after saturation
- the same low-end guard structure

The goal wasn't to make an exact circuit model. It was to design a useful studio tool: slightly thicker, a little more forward, but not so hyped that it only works as a special effect.

The harmonic fingerprint graph below shows what those choices do to a simple 1 kHz tone. Lower harmonics tend to read as thickness or warmth; stronger upper harmonics can read as edge, bite, or grit.

This one is interactive too. Turn the Drive knob to see how the harmonic balance shifts between gentle density and more obvious saturation.

<div id="bqst-harmonics-visual"></div>

Drive controls can be misleading because louder almost always sounds better. BQST has autogain enabled by default. After saturation, the plugin measures the dry and wet RMS levels for the block and applies a bounded matching gain to the wet path before the Mix control. That way, turning up Drive changes the tone more than it changes the loudness.

## Oversampling

Oversampling is one of those words that sounds more complicated than the basic idea. The plugin temporarily processes audio at a higher internal sample rate, up to 8x, then filters and brings it back down to the host's normal rate.

This matters most in the saturation stage. A nonlinear curve creates new harmonics above the original signal. If those harmonics are generated too close to the host sample rate's <span class="gloss-term" tabindex="0" data-gloss="The highest frequency a digital system can represent at a given sample rate. At 44.1 kHz, it is about 22.05 kHz.">Nyquist limit</span>, they can fold back into the audible range as <span class="gloss-term" tabindex="0" data-gloss="Digital foldback where frequencies above Nyquist reappear as unrelated lower frequencies, often sounding brittle or inharmonic.">aliasing</span>. That foldback doesn't sound like nice analog saturation; it sounds like unrelated high-frequency dirt.

<div id="bqst-oversampling-visual"></div>

Oversampling gives those new harmonics more room to exist before the anti-alias filter removes them. It also helps the high EQ shelf behave better near the top of the audible range, because the filter is no longer being squeezed against the original Nyquist limit as aggressively.

## Taste Matters More

The first working version of BQST already had the core idea: EQ, saturation, oversampling controls, meters, and left/right processing. But it looked like a prototype. A lot of the final work wasn't adding more DSP; it was making the thing feel like a real audio tool.

<img src="assets/images/projects/bqst/prototype-ui.png" alt="Early BQST prototype interface" class="bqst-article-image">

Boring.

I designed all the assets myself. I wanted the plugin to borrow from the timeless, familiar language of analog hardware: big cream knobs, physical markings, screws, VU meters, and textured anodized faceplates. But I also wanted it to feel modern, so I kept the shapes simple, the shadows restrained, and the layout minimal. Those choices make the interface inviting but readable. VU meters aren't just decoration, either; they give a slower, more musical sense of level than a twitchy digital peak meter.

<div class="bqst-asset-strip">
  <div class="bqst-asset-card">
    <img src="assets/images/projects/bqst/asset-knob-large.png" alt="Large BQST cream gain knob">
    <span>large gain knob</span>
  </div>
  <div class="bqst-asset-card">
    <img src="assets/images/projects/bqst/asset-knob-small.png" alt="Small BQST cream selector knob">
    <span>selector knob</span>
  </div>
  <div class="bqst-asset-card">
    <img src="assets/images/projects/bqst/asset-vu-meter.png" alt="BQST VU meter frame asset">
    <span>vu meter</span>
  </div>
</div>

The same thinking applied to the workflow. I didn't want to copy analog limitations just for the sake of it. On old hardware, turning up drive usually meant compensating the output level manually, which made sense when the gear was operated with two hands. With a plugin, you often have one mouse and one focus point. So BQST has autogain to keep the perceived level steady while you judge the saturation, instead of forcing you to adjust drive and output at the same time.

That balance became the design philosophy: keep the best parts of analog familiarity, but embrace the places where digital can be more flexible and efficient. Mid/side processing is rare in analog hardware, and having it independently available per module is probably impossible to find. In BQST, the EQ can run in M/S while the saturation stays in L/R, or the other way around, because digital routing makes that kind of flexibility possible.

The same idea shows up in the workflow details. Realtime and render oversampling are separated so the plugin can stay lower-latency while tracking or early-stage mixing, then use heavier processing only when exporting. Presets, undo, tooltips, and linked left/right controls aren't flashy features, but they make the plugin feel less like a machine you have to manage and more like a tool that gets out of the way.

That became a big lesson for me. AI can make it dramatically easier to get to working software, which means "it works" is less of a differentiator by itself. Software still has to look good, feel good, and make tasteful product decisions. BQST is vintage in its references, modern in its minimalism, and direct in use: turn drive and hear density, link channels when needed, switch M/S when the mix calls for it, and trust that the levels, latency, and routing are being handled quietly in the background. 

## What Really Matters

**AI is most powerful when you already understand the domain.** I hadn't built an audio plugin before, but I've been using plugins for years. I knew what a useful plugin should feel like: the controls it needed, the pitfalls to avoid, the workflow problems to solve, and the difference between a cool demo and something I would actually put on a mix. That domain knowledge made the AI assistance feel like a superpower, because I could judge the results instead of just accepting them.

**Using Codex well is its own engineering skill.** The speed came from knowing how to steer the system: giving precise listening notes, asking for architectural changes, validating the output in Ableton, and pushing back when something sounded or behaved wrong. Codex helped me move through JUCE and plugin architecture quickly, but the useful progress came from directing it with clear constraints.

**DSP is both math and ergonomics.** A saturation curve can look reasonable in isolation and still feel wrong on a kick drum. The final sound came from combining nonlinear transfer functions with filtering, autogain, oversampling, and careful parameter ranges.

**Taste is part of engineering.** The final plugin isn't better only because the algorithms improved. It's better because the interface became clearer, more trustworthy, and more intentional. The useful product was somewhere between analog-inspired familiarity and digital workflow improvements.

**Production readiness is a system problem.** The plugin wasn't "done" when it made sound. It needed automation names, undo behavior, presets, AU/VST3 validation, signing, install paths, latency handling, and DAW testing.
