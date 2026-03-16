---
title: Data Center Atlas
summary: An automated pipeline that discovers, extracts, and consolidates 11,000+ data center facilities worldwide using AI agents, vision-based PDF extraction, and geospatial deduplication.
image: assets/images/projects/datacenter/banner.png
technologies:
  - Python
  - AI Agents
  - Web Scraping
  - SQL
  - Geospatial
---

## The Problem

There's no single source of truth for global data center locations. Facility data is scattered across Wikidata, OpenStreetMap, PeeringDB, industry news, and proprietary market reports locked behind interactive web viewers. During an internship, I needed a unified, deduplicated dataset - so I built an ETL (Extract, Transform, Load) pipeline that aggregates all of them.

## How It Works

The pipeline runs in three stages, each targeting a different source category.

### Public Databases

The first stage pulls structured records from Wikidata (via SPARQL), OpenStreetMap (via the Overpass API), and PeeringDB (via its REST API). PeeringDB enforces strict rate limits, so requests are batched with randomized jitter between them to stay within their acceptable usage policy.

![Stage 1: public source extraction](assets/images/projects/datacenter/screenshot-sources.png)

### RSS Feeds

Next, six industry news feeds are polled for articles mentioning data center construction, expansions, or acquisitions. Relevant articles are scraped asynchronously (15 concurrent workers with per-host connection limits) and sent to Gemini for structured extraction - pulling out facility names, locations, capacities, and status.

![Stage 2: RSS feed processing](assets/images/projects/datacenter/screenshot-news.png)

### The AI Agent

The most technically interesting piece. A LangGraph state machine autonomously locates the latest Cushman & Wakefield market reports:

1. Searches Google via SerpAPI for candidate report pages
2. Each candidate is scored by Gemini 2.5 Pro with structured output (Pydantic models) returning confidence + reasoning
3. If a clear winner exists (confidence >= 0.85 with >= 0.2 gap), it skips expensive final analysis
4. Otherwise, it launches headless Playwright browsers to render top candidates and feeds the full HTML to the LLM for a final decision

The screenshot below shows the agent evaluating candidates and selecting the Americas report with a confidence score of 1.00:

![Stage 3: AI agent discovering Cushman & Wakefield reports](assets/images/projects/datacenter/screenshot-agent.png)

### Vision-Based PDF Extraction

Once the agent finds a report, the next challenge is extracting data from it. Cushman & Wakefield publishes reports as interactive FlippingBook web viewers - no downloadable PDFs. My scraper handles this:

1. Playwright navigates the viewer, detecting the platform variant (cushwake.cld.bz vs. digital.cushmanwakefield.com)
2. Captures page-by-page screenshots with content-loading verification
3. Detects end-of-document via page counter parsing
4. Stitches screenshots into a PDF, then converts each page to an image at 200 DPI
5. Each image is sent to Gemini Vision for structured JSON extraction

As an optimization, only the first page is processed initially to extract a source specifier (e.g., "Americas H2 2024") - if it already exists in the database, the remaining pages are skipped entirely.

### Geospatial Deduplication

With data coming from 6+ sources, overlap is inevitable. The merge pipeline uses a three-layer approach:

- **Source-level** - URL tracking for news, source specifier checking for reports, natural API idempotency for public databases
- **Cross-source** - EPSG:3857 projected coordinates with a 300m proximity threshold combined with 90% fuzzy name matching (token sort ratio). Richer records fill in missing attributes from sparser ones
- **Database-level** - composite primary keys `(source, source_specifier, id)` with `INSERT OR REPLACE` for atomic upserts

After all three stages complete, the pipeline standardizes status values and reports the final database statistics:

![Pipeline complete: 10,578 facilities across four status categories](assets/images/projects/datacenter/screenshot-complete.png)

## Architecture

The high-level flow follows the diagram below - public sources, news feeds, and Cushman & Wakefield reports are processed in sequence, then deduplicated and stored in SQLite.

![Pipeline architecture](assets/images/projects/datacenter/architecture.png)

Under the hood, the codebase follows a clean ETL separation: `scrape/` (acquisition), `extract/` (parsing + AI), `transform/` (merge + dedup), `load/` (persistence to SQLite via SQLAlchemy). All tunable parameters - concurrency limits, DPI, AI prompts, keyword filters, feed URLs - live in a single `config.yaml`.

## Key Learnings

A few things that stood out from building this end to end:

**Early exits save real money.** Processing a full Cushman report through Gemini Vision costs meaningful API credits. Extracting just page 1 first to check for duplicates before committing to the full document was a simple optimization with outsized impact.

**Graceful degradation beats rigid pipelines.** The Playwright scraper tries direct PDF download first, falls back to FlippingBook navigation, then to generic keyboard-based page navigation. Each source has its own quirks - building for failure modes kept the pipeline running unattended.

**Structured output from LLMs changes everything.** Pydantic models as Gemini's output schema meant I got typed, validated JSON back instead of parsing free-text responses. The agent's confidence scores and reasoning fields made debugging trivial.
