import { asset } from './base.js';
// Mirrored from www/rohan-website-transit/src/content/projects frontmatter
// (title, summary, technologies). Keep slugs in sync with that collection.
export const PROJECTS = [
  {
    title: 'distilling a financial analyst: small open models to frontier accuracy',
    slug: 'quantlab-analyst',
    summary: "Fine-tuning small open-source models (Qwen3 8B and 14B, QLoRA on one RTX 4090) into a financial memo system where every number is mechanically verified: a tuned writer, a tuned repair model, and a deterministic gate that together match a frontier model on provable correctness. Every experiment pre-registered, including the failures.",
    tech: ["Python", "Fine-tuning", "LLM Systems", "QLoRA", "Evals", "Finance"],
  },
  {
    title: 'quant strategy research: strategies, and the ways backtests lie',
    slug: 'quantlab-research',
    summary: "The strategy-research arm of a miniature trading firm: a backtesting engine that makes cheating structurally impossible, pairs trading with Kalman-adaptive hedging, factor strategies with survivorship bias measured at +4.6%/yr instead of disclaimed, and an ML layer that lost to its baseline.",
    tech: ["Python", "Finance", "Backtesting", "DSP", "Machine Learning", "Statistics"],
  },
  {
    title: 'careersphere',
    slug: 'careersphere',
    summary: "A PyCon Singapore 2026 champion project that maps a person's skills to realistic career moves using OpenAI, SkillsFuture data, live job signals, and a 3D role sphere.",
    tech: ["Python", "OpenAI", "AI Agents", "React", "3D Visualization", "DuckDB", "Data Pipelines", "Cloud Infra"],
  },
  {
    title: 'bqst',
    slug: 'bqst',
    summary: "An audio mastering plugin built in C++/JUCE, combining custom DSP, saturation design, oversampling, preset management, DAW validation, and a polished hardware-inspired interface.",
    tech: ["C++", "JUCE", "DSP", "Product Design"],
  },
  {
    title: 'yourcast!',
    slug: 'yourcast',
    summary: "A personalized AI podcast generator: agents cluster the day's news across your interests and produce custom 3-5 minute episodes with natural narration, end to end from scrape to published feed.",
    tech: ["Python", "AI Agents", "Data Pipelines", "Cloud Infra", "DevOps", "PostgreSQL"],
  },
  {
    title: 'Data Center Atlas',
    slug: 'datacenter-atlas',
    summary: "An ETL pipeline that builds a unified, deduplicated atlas of global data center facilities from Wikidata, OpenStreetMap, PeeringDB, and industry sources — one queryable geospatial dataset where none existed.",
    tech: ["Python", "AI Agents", "Data Pipelines", "Web Scraping", "SQL", "Geospatial"],
  },
  {
    title: 'PatentEase',
    slug: 'patentease',
    summary: "A mobile-first app covering the whole patent lifecycle — submission, tracking, ML-driven similarity analysis, and file management — replacing opaque forms with a single transparent workflow.",
    tech: ["React Native", "Python", "FastAPI", "PostgreSQL", "Machine Learning"],
  },
  {
    title: 'live chord monitor',
    slug: 'live-chord-monitor',
    summary: "A real-time MIDI and computer-keyboard chord monitor: a root-agnostic chord-detection engine with correct enharmonic spelling, built as a signed and notarized macOS app in Electron, React, and TypeScript.",
    tech: ["TypeScript", "React", "Electron", "Web MIDI", "Real-Time", "Music Theory"],
  },
  {
    title: 'Tesla Supercharger Tracker',
    slug: 'tesla-feed',
    summary: "A change-tracking pipeline for Tesla's Supercharger network: field-level diffs over time (new stations, power upgrades, stall counts, non-Tesla access) rather than just a snapshot of the current state.",
    tech: ["Python", "SQL", "Data Pipelines"],
  },
  {
    title: 'This Website',
    slug: 'this-website',
    summary: "This site itself, built from scratch with no frameworks or templates — hand-rolled HTML, JS, and canvas, designed and shipped solo as an exercise in owning every pixel.",
    tech: ["JavaScript", "Web Audio API", "Canvas", "UI/UX Design"],
  },
].map((project) => ({
  ...project,
  url: `https://www.rohanjk.xyz/projects/${project.slug}`,
  image: asset(`/projects/${project.slug}.webp`), // banner copied from the live site
}));
