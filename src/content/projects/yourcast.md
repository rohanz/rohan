---
title: "personal AI podcasts from 200+ news feeds"
barTitle: "yourcast"
summary: A serverless application that generates personalized 3-5 minute AI-narrated podcasts based on user-selected topics, aggregating stories from 200+ RSS feeds and processing 16,000+ articles daily.
image: /assets/images/projects/yourcast/banner.webp
order: 8
technologies:
  - Python
  - AI Agents
  - Data Pipelines
  - Cloud Infra
  - DevOps
  - PostgreSQL
---

## the problem

I follow a lot of different topics: music production, AI, MMA, news, startups, film. Keeping up meant visiting 10-15 news sites and YouTube channels a day. I wanted my news as a podcast I could play on the move, but the options were either generic robot narration or hour-long debates I didn't have time for.

So I built yourcast on my own for the Google Cloud Run Hackathon 2025. You pick the topics you care about, press one button, and about two minutes later you have a narrated news episode a few minutes long, with chapters and a link to every source it used.

![The yourcast landing page](assets/images/projects/yourcast/screenshot-landing.webp)

## what it does

You sign in with Google, choose from curated topic categories or define your own custom topics, and generate an episode in one click. The built-in player has full playback controls, chapter timestamps, and source citations for every story, plus an archive of your last five episodes.

![Topic selection and personalization](assets/images/projects/yourcast/screenshot-personalize.webp)

## how it works

### finding the news

Every six hours, a scheduled job pulls articles from over 200 <span class="gloss-term" data-gloss="RSS is a plain feed format news sites publish, listing their latest articles in a machine-readable way.">RSS</span> feeds spanning technology, sports, entertainment, finance, and more, which adds up to **16,000+ articles a day**.

News feeds overlap heavily, so articles are deduplicated before anything else. Each one is turned into an <span class="gloss-term" data-gloss="An embedding is a list of numbers representing a text's meaning, so two articles about the same event end up close together even if they share few words.">embedding</span> with Google's text-embedding-004, and articles with <span class="gloss-term" data-gloss="A measure of how closely two embedding vectors point in the same direction, from -1 to 1. Near 1 means the texts mean nearly the same thing.">cosine similarity</span> above 0.85 become candidates for the same story. Gemini then checks whether they really cover the same event, and gives each story an importance score from 0 to 100. Everything is stored in PostgreSQL with <span class="gloss-term" data-gloss="A PostgreSQL extension that stores vectors and runs similarity searches inside the database.">pgvector</span>. The result is one take on each story instead of five versions of the same news.

### picking your stories

When you ask for an episode, the selector ranks the stories. Topics with more news get more airtime, older stories lose weight (breaking news fades fast, science fades slowly), and stories that many outlets are covering get a boost. Anything older than five days, or already heard in one of your previous episodes, is skipped.

### writing the script

The script is written by a small team of agents built with Google's <span class="gloss-term" data-gloss="Agent Development Kit: Google's framework for composing LLM agents, including sequential and parallel agent pipelines that share session state.">Agent Development Kit (ADK)</span>, all running Gemini 2.0 Flash Lite with strict rules to stick to the source articles:

- Three setup agents run in sequence: one picks the episode title and tone from the top stories, one writes the episode description, and one writes the intro and outro to match that tone.
- Then one topic agent per topic writes its segment, all in parallel. Each gets a word budget proportional to how much news its topic has, and has to land within 85-105% of it so episodes come out a consistent length.

### making the audio

Eight parallel <span class="gloss-term" data-gloss="Text-to-speech: turning the written script into narrated audio.">text-to-speech</span> workers process the script sections concurrently. That parallelism cut audio generation time by over 7x compared to doing it section by section. The sections are then stitched together with chapter markers and source links:

![The built-in podcast player with chapter timestamps](assets/images/projects/yourcast/screenshot-player.webp)

### infrastructure

Everything runs serverless on Google Cloud:

- **Cloud Run** for three services: the Next.js web app, a FastAPI backend, and the generation worker
- **Cloud SQL** (PostgreSQL with pgvector) for articles, story clusters, and user data
- **Cloud Tasks** as the generation job queue, and **Cloud Scheduler** for the RSS runs
- **Cloud Storage** for the finished audio, served through signed URLs that expire after an hour

![System architecture showing the Cloud Run services, Cloud SQL, and Cloud Tasks pipeline](assets/images/projects/yourcast/architecture.webp)

## limitations

- An episode takes about two minutes to generate, so you wait for it rather than pressing play straight away.
- I used Gemini's native text-to-speech for the demo video, but while it was in preview its rate limits were too tight for production, so the live app uses a different voice.
- Stories are deduplicated but not linked over time. yourcast doesn't yet know that "candidate wins election" follows "candidate's rally speech", so it can't deliver follow-ups to stories you have been tracking.

## what stuck with me

**Parallelism is where the speed came from.** It showed up in three places: topic agents writing their segments at the same time, eight text-to-speech chunks rendering at once, and ten workers fetching RSS feeds in parallel. Each one turned a queue of slow network calls into a single wait.

**Deduplication decides the quality.** News feeds overlap massively. Without clustering similar stories, the podcast would repeat the same information from different outlets, and no amount of script polish would hide that.

**Serverless still needs capacity planning.** I deployed three Cloud Run services plus Cloud SQL, Cloud Tasks, and Cloud Scheduler without managing a single server, but each service still needed its own limits. The web app takes 80 concurrent requests; the worker takes only three jobs at a time (one RSS run, two podcasts) and gets a 15-minute timeout.

This was my first time taking an AI application all the way from idea to a deployed product that other people could use. Try it:

<a href="https://yourcast-web-zprpg5fm2a-uc.a.run.app" target="_blank" rel="noopener noreferrer" class="try-it-btn">try yourcast!</a>
