---
title: yourcast!
summary: A serverless application that generates personalized 3-5 minute AI-narrated podcasts based on user-selected topics, aggregating stories from 200+ RSS feeds and processing 16,000+ articles daily.
image: assets/images/projects/yourcast/banner.png
technologies:
  - Python
  - Gemini AI
  - Google Cloud Run
  - Cloud SQL
  - Cloud Tasks
---

## The Problem

I follow a lot of different topics - music production, AI, MMA, news, startups, film. Keeping up meant visiting 10-15 news sites and YouTube channels daily. I wanted my news in podcast format, but existing options were either generic robot narration or hour-long debates I didn't have time for.

So I built yourcast - a personalized AI podcast generator that creates custom 3-5 minute episodes tailored to your interests.

![yourcast screenshot](assets/images/projects/yourcast/screenshot-landing.png)

## Features

yourcast features secure Google authentication, curated topic categories, and the ability to define your own custom topics. One click generates a personalized episode in under two minutes. The built-in player offers full playback controls, chapter timestamps, and source citations for every story—plus an archive to revisit your previous episodes.

![yourcast personalization](assets/images/projects/yourcast/screenshot-personalize.png)

## How It Works

### Data Pipeline

The system ingests **16,000+ articles daily** from over 200 RSS feeds spanning technology, sports, entertainment, finance, and more.

To avoid redundant coverage, articles are deduplicated using semantic clustering with Google's text-embedding-004. Each article gets vector-embedded, and stories with cosine similarity above 0.85 are grouped together. This ensures you get one comprehensive take on each story rather than five versions of the same news.

### Multi-Agent Script Generation

The podcast scripts are generated using Google's Agent Development Kit (ADK) with Gemini AI. Different agents handle:
- Story selection and prioritization based on your interests
- Script structure and narrative flow
- Tone and pacing adjustments
- Content summarization without losing key details

### Audio Generation

Eight parallel text-to-speech workers process the script sections concurrently. This parallelization was crucial - it reduced generation time by over 7x compared to sequential processing.

![yourcast interface](assets/images/projects/yourcast/screenshot-player.png)

### Infrastructure

The entire system runs serverless on Google Cloud:
- **Cloud Run** for the application containers
- **Cloud SQL** (PostgreSQL) for article storage and user data
- **Cloud Tasks** for managing the generation pipeline

This architecture auto-scales from zero to 1000+ instances based on demand, with podcast generation completing in under two minutes.

![yourcast architecture](assets/images/projects/yourcast/architecture.png)

## Key Learnings

**Parallelism is your best friend.** Three places where parallelism saved me: agent execution with multiple TopicScriptAgents running simultaneously, TTS generation with 8 audio chunks processing at once, and RSS fetching with 10 parallel workers for feed discovery. Combined speedup: 3× faster generation.

**Semantic deduplication is essential.** News feeds have massive overlap. Without clustering similar stories, podcasts would repeat the same information from different sources.

**Serverless is magic.** I deployed 3 Cloud Run services, Cloud SQL, Cloud Tasks, and Cloud Scheduler. Total infrastructure management time? Zero hours.

<br>

This was my first time building a production-grade AI-powered application from end to end—from inception to shipping the final product. I can get into excruciating detail about the finer technical points (and I probably will), but first—why don't you [try it](https://yourcast-web-zprpg5fm2a-uc.a.run.app)?
