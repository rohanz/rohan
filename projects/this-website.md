---
title: This Website
summary: A zero-dependency, single-page portfolio site with real-time audio visualizations, canvas-rendered backgrounds, and a Markdown-driven project system - all in vanilla JS.
image: assets/images/projects/website/banner.png
technologies:
  - JavaScript
  - Web Audio API
  - Canvas
  - UI/UX Design
---

## Why Build From Scratch?

I wanted a portfolio that reflected my interests - music, design, and building things from the ground up. No templates, no frameworks. One HTML file, one JS file, one CSS file, full control over every pixel.

It was also a deliberate exercise in design and UI/UX, something I haven't always had the luck of delving deep into. With AI, I believe a developer can and should take a project from concept through design, architecture, and deployment entirely solo. It's a newfound superpower that's somehow become accessible to all of us. That's the reason I do so many projects - and why I push each one to a finished, production-quality product.

## Development Workflow

The entire site was built in collaboration with Claude Code. Not just code autocomplete or mindless slave to do everything for me - I used it as a genuine development partner across the full stack. Skills and agents handled discrete tasks like generating project writeups from GitHub repos, while plugins connected to Chrome DevTools for live visual debugging. The workflow was conversational: I'd describe what I wanted, review the output in the browser, and occasionally have to tweak the code, and iterate in real time.

It's a good example of what AI-assisted development actually looks like in practice - not replacing the developer, but compressing the feedback loop so one person can move between design, frontend, content, and infrastructure without context-switching overhead.

## Audio Visualizations

Forgive me, I'm about to get a little nerdy as I explain how I designed the audio visualizations. Since I produce, mix and master music, I wanted the music section to give you a little more than a play and pause button - so I built three real-time visualizations that show you what's actually happening inside a track. Take a look:

<div id="demo-player-placeholder"></div>

The **waveform** on the left is the most intuitive - it's the raw shape of the sound over time. Louder sections spike, quiet sections flatten. It gives you an immediate feel for the energy and dynamics of a track.

On the right, the **VU meter** tells you how loud the track is at any given moment, the way a real analog meter would.

Under the hood, it computes RMS amplitude, maps it to a logarithmic dB scale, and drives a needle across an arc. The scale is deliberately non-linear - the range from -40 to -10 dB spans 70% of the arc, while -10 to 0 dB gets the remaining 30%, giving more resolution where it actually matters. The needle uses exponential smoothing so it responds naturally rather than jumping between frames.

Next to it, the **stereoscope** shows how wide the stereo image is - whether the sound is centred (mono) or spread across left and right.

It's a Lissajous vectorscope, the same tool broadcast engineers use to check phase correlation. Left and right channels are plotted as (x, y) coordinates, so mono signals collapse to a diagonal line and wide stereo spreads into an ellipse. The glow comes from a phosphor persistence trick: instead of clearing the canvas each frame, previous frames are faded with a semi-transparent fill, so bright points leave trails.

I chose these three because together they cover the fundamentals - loudness, dynamics, and stereo width. All three share a single `requestAnimationFrame` loop that's torn down when navigating away to avoid burning CPU while invisible.

## Theme System

As for how it looks, dark and light themes are implemented through ~20 CSS custom properties, swapped by toggling a single `data-theme` attribute. All canvas visualizations listen for a custom `theme-changed` event to redraw with the correct accent colors immediately. Here's the full palette for both:

<div id="theme-palette-placeholder"></div>

The site is mobile compatible too, re-ordered a little here and there for convenience.

![The mobile homepage](assets/images/projects/website/mobile-view.png)

## Key Learnings

A few things that stood out:

**Design is a muscle, not a talent.** I went into this with very little UI/UX experience. Having AI handle the implementation grunt work let me iterate on visual decisions fast enough to actually develop an eye for it.

**AI is a collaborator, not a replacement.** The best results came from treating Claude like a pair programmer - describing intent, reviewing output, and steering. The taste and judgement are still yours.

**You don't need a framework for everything.** No build step, no dependency updates, no virtual DOM. The entire site loads in three files and deploys by pushing static assets. Sometimes less really is more.
