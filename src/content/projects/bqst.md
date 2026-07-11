---
title: bqst
summary: "An audio mastering plugin built in C++/JUCE, combining custom DSP, saturation design, oversampling, preset management, DAW validation, and a polished hardware-inspired interface."
image: /assets/images/projects/bqst/banner.webp
order: 4
technologies:
  - C++
  - JUCE
  - DSP
  - Real-Time Audio
  - Signal Processing
  - Product Design
---

<p class="bqst-download-actions">
  <a href="/downloads/bqst/BQST-1.0.2-macOS-universal.pkg" class="try-it-btn" download>download bqst for macOS</a>
  <a href="https://ko-fi.com/rohanjk" class="support-btn" target="_blank" rel="noopener noreferrer">buy me a coffee</a>
</p>

## why i built it

BQST is a working <span class="gloss-term" data-gloss="JUCE is a C++ framework for building audio plugins and audio apps. It handles a lot of the host/plugin plumbing, UI framework, parameters, and cross-platform build structure.">JUCE</span> <span class="gloss-term" data-gloss="VST3 and AU are plugin formats used by DAWs. Standalone means the same processor can also run as its own app, outside a DAW.">VST3/AU/Standalone</span> audio plugin with a custom GUI, <span class="gloss-term" data-gloss="Automatable parameters can be recorded, drawn, or controlled by the DAW over time, so plugin controls can move during playback or export.">automatable parameters</span>, presets, <span class="gloss-term" data-gloss="Processing audio at a higher temporary sample rate, then filtering it back down, which helps reduce harsh digital artifacts from nonlinear effects.">oversampling</span>, <span class="gloss-term" data-gloss="pluginval is a validation tool for audio plugins. It stress-tests plugin loading, parameters, state saving, automation, editor behavior, and audio processing stability.">pluginval</span> validation, and a release build installed into Ableton. It sits right at the intersection of practically all the things I'm into: programming, music production, audio engineering, <span class="gloss-term" data-gloss="Digital signal processing: using code and math to shape audio, images, sensors, or any signal that changes over time.">DSP</span>, and product design.

Music production has never been a cheap hobby. <span class="gloss-term" data-gloss="Digital Audio Workstations: software like Ableton, Logic, or Pro Tools where music is recorded, edited, mixed, and produced.">DAWs</span> already cost a decent amount, and the plugins that actually help with production and mixing can get expensive fast. At some point I started thinking: what if I could build one of the tools I kept reaching for? Or make one I felt would genuinely help me?

I've also always wanted to dip my toes into DSP. Not by watching plugin-development videos forever, or taking a course in school, but by building a real signal processor, and one that was useful enough to actually put on music.

## what is it?

That's how bqst came about, short for **<span class="gloss-term" data-gloss="Peter Baxandall was a British audio engineer known for the Baxandall tone-control circuit, a classic bass/treble EQ design that became common in hi-fi and studio gear.">Baxandall</span> EQ and Saturation**. The idea was simple: a broad tone-shaping equalizer feeding a tasteful harmonic generator.

<img src="/assets/images/projects/bqst/final-ui.webp" alt="Final BQST plugin interface" class="bqst-article-image">

An equalizer, or an EQ, boosts or cuts parts of the frequency spectrum of a signal. In music, that means adding an airy sheen to a vocal, reducing the harshness of a cymbal, or giving a kick drum more sub bass weight. The EQ module is the left half.

A harmonic generator is a little less straightforward. When you drive analog gear like <span class="gloss-term" data-gloss="Magnetic recording machines that store audio on tape. Pushed tape often sounds compressed, rounded, and slightly softened in the top end.">tape machines</span>, <span class="gloss-term" data-gloss="Vacuum tubes are old-school amplifying components. In audio, they are often associated with smooth compression, warmth, and even-harmonic richness.">tubes</span>, <span class="gloss-term" data-gloss="Operational amplifiers are small amplifier circuits used all over audio electronics. When pushed, they can add thickness, density, or a sharper transistor-like edge depending on the design.">op-amps</span>, or <span class="gloss-term" data-gloss="An electrical transformer passes signal between coils of wire. In audio gear, pushing one can add gentle compression, low-mid weight, and odd-harmonic edge.">transformers</span>, they don't just make the signal louder; they add new frequencies related to the original sound. Those added frequencies are called <span class="gloss-term" data-gloss="Harmonics are frequencies related to a source tone by whole-number multiples. For example, a 1 kHz tone has harmonics at 2 kHz, 3 kHz, 4 kHz, and so on.">harmonics</span>. In the right amount, they can make audio feel thicker, warmer, brighter, or more expensive. Too much of it just becomes distortion. BQST's saturation stage is my attempt at toeing that line, creating two algorithms that make signals sound full and dense, or a little aggressive and edgy. The saturation module is the right half.

The signed and notarized universal macOS installer supports Apple Silicon and Intel Macs and includes VST3 and Audio Unit formats. The source code is available at <a href="https://github.com/rohanz/bqst" target="_blank" rel="noopener noreferrer">github.com/rohanz/bqst</a>.

BQST is free to download. If it's useful to you and you want to support future development, you can <a href="https://ko-fi.com/rohanjk" target="_blank" rel="noopener noreferrer">buy me a coffee</a>.

Before getting into the sound design, there was one engineering constraint that shaped the whole project: this had to run safely inside a DAW.

## realtime constraints

A plugin's <span class="gloss-term" data-gloss="In JUCE, processBlock is the callback where the DAW gives the plugin a block of audio samples to transform and return.">processBlock</span> runs on a high-priority <span class="gloss-term" data-gloss="The audio thread is the time-critical thread that fills audio buffers for the host. If it stalls, the listener can hear clicks, gaps, or dropouts.">audio thread</span> that the DAW calls every few milliseconds with a <span class="gloss-term" data-gloss="A buffer is a small chunk of audio samples processed together, instead of processing the whole song at once.">buffer</span> to fill. Miss that deadline and the user hears a click or a dropout; there is no retry button. That makes the audio callback a <span class="gloss-term" data-gloss="A real-time context has a hard deadline. Code in it should avoid anything with unpredictable timing, because being late is audible.">real-time context</span>: no <span class="gloss-term" data-gloss="Locks coordinate access between threads, but they can stall a high-priority audio thread if another thread is holding the lock.">locks</span> that might stall the thread, no file or network I/O, and no per-sample <span class="gloss-term" data-gloss="Allocations ask the memory manager for new memory. That can be unpredictable, so audio plugins avoid allocations in the hot audio path.">allocations</span> in the hot path. BQST reads host parameters through JUCE's <span class="gloss-term" data-gloss="JUCE's AudioProcessorValueTreeState is a parameter and state system that connects plugin controls, host automation, presets, and the audio processor.">AudioProcessorValueTreeState</span>, smooths gain, mix, and bypass changes, and gates filter coefficient updates behind smoothers so automation does not <span class="gloss-term" data-gloss="Zipper noise is audible stepping or clicking caused by abrupt parameter changes instead of smooth movement.">zipper</span>. It also uses `juce::ScopedNoDenormals` in `processBlock` to avoid CPU slowdowns from <span class="gloss-term" data-gloss="Subnormal floating-point values are extremely tiny numbers that can make some CPUs run much slower unless the plugin flushes them away.">subnormal floating-point values</span>. The <span class="gloss-term" data-gloss="The GUI thread handles drawing, mouse input, menus, and other visual work. It can be slower because it is not directly responsible for filling the next audio buffer.">GUI thread</span> handles presets, file access, and drawing; the audio thread only does the work needed to produce the next block of samples. The same discipline shows up in game engines, embedded firmware, and low-latency networking: anywhere a callback has a deadline it cannot miss.

Let's start with the left half: the EQ module.

## bax eq design

A Baxandall-style EQ is built for broad tone moves: making a mix feel brighter, darker, heavier, or lighter without sounding obviously "EQ'd."

Each side has a <span class="gloss-term" data-gloss="A filter that raises or lowers everything below a chosen frequency.">low shelf</span> and <span class="gloss-term" data-gloss="A filter that raises or lowers everything above a chosen frequency.">high shelf</span> with +/-6 dB of gain. The shelf frequency selectors are stepped:

- Low shelf: 74, 84, 98, 116, 131, 166, 230, 361 Hz
- High shelf: 1.6, 1.8, 2.1, 2.5, 3.4, 4.8, 7.1, 18 kHz

The graph below shows all of those stepped shelf positions across the audible range.

<div id="bqst-eq-visual"></div>

The filters are JUCE <span class="gloss-term" data-gloss="IIR means infinite impulse response: a recursive digital filter design that can create efficient EQ curves with very little CPU.">IIR</span> low/high shelves with a deliberately low <span class="gloss-term" data-gloss="Q describes how narrow or wide a filter shape is. A lower Q means a broader, gentler curve.">Q</span> around `0.38`, closer to classic tone-control behavior than a modern <span class="gloss-term" data-gloss="A parametric EQ gives precise control over frequency, gain, and bandwidth. It is great for surgical correction, while BQST is intentionally broader and more tone-control-like.">parametric</span> shelf.

Under the hood, each shelf is a <span class="gloss-term" data-gloss="A two-pole/two-zero digital filter building block used for EQs, shelves, and tone controls.">biquad</span> coefficient set. During a gain move, the gain value is smoothed sample-by-sample, and the coefficients are recalculated only while that smoother is still moving toward its target. Once the knob has settled, the filter reuses the same coefficient set. That keeps automation from zippering without rebuilding filter coefficients forever when nothing is changing.

The right half of BQST is trickier, because saturation is less about a perfect-looking curve and more about how the algorithm behaves when real audio hits it.

## saturation design

The saturation side was the most subjective part of the plugin. EQ curves can be judged fairly visually, but saturation has to be judged by how it reacts to real audio. A curve that looks smooth on a graph can still sound brittle on a kick drum, dull on a vocal, or too obvious across a full mix.

I started by designing the two modes around different use cases. Cream was meant to be the smoother, denser mode: the kind of saturation that makes a signal feel thicker without immediately announcing itself as distortion. Grit was meant to be firmer and more transformer-like, with more edge and forwardness, but still usable outside of special-effect settings. The names are based on character rather than topology, because that is how I actually think when reaching for a processor during a mix.

The early versions exposed the usual problems with saturation quickly. Loud kick drums and 808s could push the algorithm into a harsh high-frequency buzz, and the more aggressive mode could make the upper mids feel too crunchy and forward. That was useful feedback: the issue wasn't just the <span class="gloss-term" data-gloss="A waveshaper changes sample values with a curve. Gentle curves sound like saturation; aggressive curves can sound like clipping.">waveshaper</span> curve, but the whole signal path around it.

The fix was to treat saturation as a small system rather than a single function. The <span class="gloss-term" data-gloss="A plot of input level against output level. A straight line is clean; a bent line means the processor is adding saturation or distortion.">transfer curve</span> still matters, but it sits inside a chain: low-end control before the nonlinear stage, a carefully shaped soft-clipping function, tone shaping after saturation, and static autogain calibrated against different kinds of material. That made the algorithms behave more like a usable audio tool and less like a distortion demo.

The graph below isolates the waveshaping part of that saturation system. **Click and drag upward on the Drive knob** to see how the algorithms change as they are pushed harder.

<div id="bqst-transfer-visual"></div>

As the drive increases, the straight dry signal starts to bend. That bend is the whole point: the peaks are rounded instead of chopped flat, which is what creates the extra harmonic content without immediately sounding like hard clipping.

The two algorithms, cream and grit, both use soft nonlinear transfer curves, but the surrounding tone network is different.

## saturation algorithms
### cream

Cream is the smoother mode. It is meant to feel thick and polished rather than obviously distorted. The algorithm combines:

- a soft asymmetric <span class="gloss-term" data-gloss="tanh is the hyperbolic tangent function. In audio, it is often used as a smooth S-shaped curve that rounds peaks instead of chopping them flat.">tanh</span> curve
- a small even-harmonic <span class="gloss-term" data-gloss="Bias means slightly offsetting the waveshaper instead of keeping it perfectly centered. That asymmetry tends to create more even harmonics, which often read as warmth or density.">bias</span> term
- <span class="gloss-term" data-gloss="Cubic weighting adds a small third-order term to the signal before shaping. As drive rises, it encourages stronger odd harmonics without jumping straight into hard clipping.">cubic weighting</span> for odd harmonics at higher drive
- <span class="gloss-term" data-gloss="Pre/de-emphasis means boosting or shaping a frequency range before processing, then counter-shaping it afterward. It lets the saturator react differently to part of the spectrum without leaving the final tone overly hyped.">pre/de-emphasis</span> around the upper treble
- a low-end guard before and after the nonlinear stage

The pre/de-emphasis matters because full-band saturation can make treble harsh very quickly. Cream shapes what enters and exits the saturator, so the result feels more like analog density than a clipper. The core waveshaper uses drive-dependent terms for the knee, asymmetry, odd-harmonic push, and wet blend. Here, `drive01` is the Drive knob normalized to a 0-1 range:

```cpp
const auto push = drive01 * drive01;
const auto maxPush = push * drive01;
const auto asymmetry = drive01 * (0.016f + drive01 * 0.045f + push * 0.040f);
const auto oddWeight = drive01 * (0.032f + drive01 * 0.095f + push * 0.115f + maxPush * 0.135f);
const auto softKnee = 0.80f + drive01 * 0.42f + push * 0.36f + maxPush * 0.60f;

const auto driven = sample * softKnee + oddWeight * sample * sample * sample + asymmetry;
const auto shaped = (std::tanh(driven) - std::tanh(asymmetry)) * (1.0f + 0.07f * drive01 + 0.13f * maxPush);
const auto blend = drive01 * 0.39f + push * 0.16f + maxPush * 0.15f;
return sample * (1.0f - blend) + shaped * blend;
```
### grit

Grit is transformer-inspired. It is a little firmer and more forward, but I still wanted it to be more than just a hyped special effect. It uses:

- a firmer tanh transfer curve
- a small bias term
- low and low-mid weighting before saturation
- partial low-end restore and mild top rounding after saturation
- the same low-end guard structure

That pre/post tone path is what makes Grit feel less like a generic clipper. The low and low-mid content pushes into the nonlinear stage a little harder, then some of that tonal tilt is restored afterward, leaving more transformer-like weight without simply EQ-boosting the final signal. Those design choices show up more clearly in the harmonic fingerprint graph below, which uses a simple 1 kHz tone. Lower harmonics tend to read as thickness or warmth; stronger upper harmonics can read as edge or bite.

This one is interactive too. **Turn the Drive knob** to see how the harmonic balance shifts between gentle density and more obvious saturation.

<div id="bqst-harmonics-visual"></div>

<span class="gloss-term" data-gloss="Related to the Fletcher-Munson or equal-loudness curves: our ears do not hear all frequencies equally at every volume. Louder playback can feel fuller and more exciting even when the processing itself has not really improved the sound.">Humans often perceive louder music as better music</span>, which makes drive controls easy to misjudge. If a saturation stage gets louder as it gets pushed, it can feel like an improvement even when the main change is just extra volume. BQST has <span class="gloss-term" data-gloss="Autogain automatically compensates for the level added by processing, so the before/after volume stays roughly consistent and the tone change is easier to judge.">autogain</span> enabled by default to make that comparison fairer. Instead of chasing the signal level live, it uses a static compensation curve calibrated offline against sine tones, bass, drums, and full mixes near commercial loudness. I rendered each source through both saturation modes at fixed drive values, measured the output level against the dry input, and fit one compensation curve per algorithm. That compensation is applied to the wet path before the Mix control, so turning up Drive changes the tone more than it changes the loudness.

The table shows the result in dB of gain compensation. "Compensation" is the curve baked into the plugin; "target" is the average level reduction suggested by the calibration material. Negative numbers mean the plugin turns the wet signal down by that amount. The goal was not to perfectly match every possible source, but to land within about half a dB on average without adding a live level detector into the audio path.

<table class="bqst-data-table">
  <thead>
    <tr>
      <th>Drive</th>
      <th>Cream Compensation</th>
      <th>Cream Target</th>
      <th>Grit Compensation</th>
      <th>Grit Target</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>3 dB</td><td>-0.8 dB</td><td>-1.3 dB</td><td>-1.5 dB</td><td>-1.7 dB</td></tr>
    <tr><td>6 dB</td><td>-2.4 dB</td><td>-2.5 dB</td><td>-3.7 dB</td><td>-3.5 dB</td></tr>
    <tr><td>12 dB</td><td>-6.2 dB</td><td>-5.8 dB</td><td>-7.9 dB</td><td>-7.8 dB</td></tr>
    <tr><td>18 dB</td><td>-9.7 dB</td><td>-10.1 dB</td><td>-11.4 dB</td><td>-11.5 dB</td></tr>
  </tbody>
</table>

That brings up another problem with nonlinear audio processing: once a plugin creates new harmonic content, it also has to decide what to do with harmonics that land above the host's normal sample-rate limit. The fix is a process known as oversampling.

## oversampling

Oversampling is one of those words that sounds more complicated than the basic idea. BQST temporarily processes audio at a higher internal <span class="gloss-term" data-gloss="Sample rate is how many audio samples are stored or processed per second. CD audio is 44.1 kHz, which means 44,100 samples per second.">sample rate</span>, up to 8x, using JUCE's `dsp::Oversampling` with half-band polyphase IIR filters, then brings it back down to the host's normal rate.

This matters especially in saturation. A nonlinear curve creates new harmonics above the original signal. If those harmonics are generated too close to the host sample rate's <span class="gloss-term" data-gloss="The highest frequency a digital system can represent at a given sample rate. At 44.1 kHz, it is about 22.05 kHz.">Nyquist limit</span>, they can fold back into the audible range as <span class="gloss-term" data-gloss="Digital foldback where frequencies above Nyquist reappear as unrelated lower frequencies, often sounding brittle or inharmonic.">aliasing</span>. That foldback doesn't sound like nice analog saturation; it sounds like unrelated high-frequency dirt.

<div id="bqst-oversampling-visual"></div>

Oversampling gives those new harmonics more room to exist before the <span class="gloss-term" data-gloss="An anti-alias filter removes frequencies that would fold back into the audible range when audio returns to a lower sample rate.">anti-alias filter</span> removes them. It also helps the high EQ shelf behave better near the top of the audible range, because the filter is no longer being squeezed against the original Nyquist limit as aggressively.

## demo

Finally, let's actually listen to it. The demo below shows the same drum loop: one clean, with no processing, and the other processed through BQST. Headphones or monitors are ideal here, because the changes are more about weight, transient shape, and tone. The processed version uses a +2.2 dB high-shelf boost at 2.1 kHz, a +1.7 dB low-shelf boost at 116 Hz, and Cream Drive around 14 dB. **Press play, then flip between Clean and BQST while it is playing.** Listen for added thickness and a touch more edge on the <span class="gloss-term" data-gloss="Transients are the short initial peaks of sounds like drum hits. They strongly affect punch, clarity, and perceived attack.">transients</span>, even though the peak level is lower after processing: roughly -1.7 to -2.5 <span class="gloss-term" data-gloss="dBFS means decibels relative to full scale. In digital audio, 0 dBFS is the maximum level before clipping.">dBFS</span> peak.

<div id="bqst-audio-demo" data-clean="assets/audio/bqst/drums-clean.wav" data-processed="assets/audio/bqst/drums-bqst.wav" data-bpm="90" data-settings="2.1 kHz +2.2 dB · 116 Hz +1.7 dB · Cream Drive ~14 dB"></div>

## taste matters

The first working version of BQST already had the core idea: EQ, saturation, oversampling controls, meters, and left/right processing. But it looked like a prototype. A lot of the final work wasn't adding more DSP; it was making the thing feel like a real audio tool.

<img src="/assets/images/projects/bqst/prototype-ui.webp" alt="Early BQST prototype interface" class="bqst-article-image">

It worked, but visually, it left a lot to be desired.

I started designing all the assets myself. I wanted the plugin to borrow from the timeless, familiar language of analog hardware: big cream knobs, physical markings, screws, <span class="gloss-term" data-gloss="A VU meter is a slower level meter originally used in analog audio equipment. It responds more like perceived loudness than a fast peak meter.">VU meters</span>, and textured anodized faceplates, but I also wanted it to feel modern. So I kept the shapes simple, the shadows restrained, and the layout minimal. Those choices make the interface inviting but readable. VU meters aren't just decoration, either; they give a slower, more musical sense of level than a twitchy digital peak meter.

<div class="bqst-asset-strip">
  <div class="bqst-asset-card">
    <img src="/assets/images/projects/bqst/asset-knob-large.webp" alt="Large BQST cream gain knob">
    <span>large gain knob</span>
  </div>
  <div class="bqst-asset-card">
    <img src="/assets/images/projects/bqst/asset-knob-small.webp" alt="Small BQST cream selector knob">
    <span>selector knob</span>
  </div>
  <div class="bqst-asset-card">
    <img src="/assets/images/projects/bqst/asset-vu-meter.webp" alt="BQST VU meter frame asset">
    <span>vu meter</span>
  </div>
</div>

I didn't want to copy analog design just for the sake of it, though. The design philosophy became: keep the familiarity of analog hardware, but use digital where it genuinely improves the workflow. <span class="gloss-term" data-gloss="Mid/side processing splits stereo into center information (mid) and left-right difference information (side), which lets a processor affect width and center tone separately.">Mid/side processing</span> is rare in analog gear, and having it independently available per module is even rarer. In BQST, the EQ can run in M/S while the saturation stays in L/R, or the other way around, because digital routing makes that flexibility practical.

The workflow was designed around user convenience in the same way. Realtime and render oversampling are separated because those moments have different priorities: while tracking or writing, low <span class="gloss-term" data-gloss="Latency is delay between input and output. In recording or live monitoring, high latency makes playing feel disconnected from what you hear.">latency</span> matters more, so the plugin can run lighter; during export, latency no longer matters, so it can switch to higher-quality oversampling. Presets, undo, tooltips, and linked left/right controls work the same way. They aren't flashy features, but they make the plugin feel less like a machine you have to manage and more like a tool that stays out of the way.

Designing BQST became a bigger lesson about software in general. A product can be technically functional and still feel unfinished. The details are what make people trust it: how it looks, how it responds, how predictable it feels, and whether it disappears into the workflow. BQST is vintage in its references, modern in its minimalism, and direct in use: it presents familiar controls, handles levels, latency, and routing quietly in the background, and still leaves the important decisions easy to tweak.

## what stuck with me

**Domain knowledge is a superpower.** I hadn't built an audio plugin before, but I've been using plugins for years. I knew what a useful plugin should feel like: the controls it needed, the pitfalls to avoid, the workflow problems to solve, and the difference between a cool demo and something I would actually put on a mix. That made the engineering loop much sharper, because I could listen to a bug, describe it precisely, and decide whether a code change actually fixed the musical problem.

**DSP is both math and ergonomics.** A saturation curve can look reasonable in isolation and still feel wrong on a kick drum. The final sound came from combining nonlinear transfer functions with filtering, autogain, oversampling, and careful parameter ranges.

**Using AI well is an engineering skill.** Codex was useful because I could give it precise constraints, inspect the result, test it in context, and redirect it when the output was wrong. I used it to move quickly through unfamiliar JUCE scaffolding, parameter wiring, and editor plumbing, but the important part was steering the loop: describing audio bugs clearly, asking for architectural changes, validating behavior in Ableton, checking the code paths, and deciding whether a change actually solved the musical problem. I didn't take a backseat and hoping the prompts worked; I was using AI inside a disciplined loop of implementation, listening, measurement, correction, and validation.

**Taste is part of engineering.** The final plugin isn't better only because the algorithms improved. It's better because the interface became clearer, more trustworthy, and more intentional. The useful product was somewhere between analog-inspired familiarity and digital workflow improvements.

**Production readiness is a system problem.** The plugin wasn't "done" when it made sound. It needed automation names, undo behavior, presets, AU/VST3 validation, signing, install paths, latency handling, and DAW testing. I validated the VST3 with `pluginval` at strictness level 10, checked the AU/VST3 builds in Ableton, and tested state recall, automation, bypass behavior, sample-rate changes, buffer-size changes, fixed UI sizes, and offline render settings.

<p class="bqst-download-actions">
  <a href="/downloads/bqst/BQST-1.0.2-macOS-universal.pkg" class="try-it-btn" download>download bqst for macOS</a>
  <a href="https://ko-fi.com/rohanjk" class="support-btn" target="_blank" rel="noopener noreferrer">buy me a coffee</a>
</p>
