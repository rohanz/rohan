---
title: PatentEase
summary: A mobile patent management system that simplifies the submission, tracking, and management of patent applications, featuring an ML-powered similarity checker and integration with Singapore's IPOS patent database.
image: assets/images/projects/patent/banner.png
technologies:
  - React Native
  - Python
  - FastAPI
  - PostgreSQL
  - Machine Learning
---

## The Problem

Patent submission is broken - lengthy forms, no unified platform, and almost zero transparency post-submission. There's no reason given for rejections, no way to follow up, and no consolidated view for companies managing multiple patents.

I built PatentEase as a mobile-first solution that handles the entire patent lifecycle: submission, tracking, similarity analysis, and file management - all in one app.

## Features

![The PatentEase dashboard showing status counters and notification cards](assets/images/projects/patent/screenshot-dashboard.png)

- **Real-time dashboard** with notification cards and clickable status counters across four states (approved, in review, pending, rejected)
- **Streamlined submission** - one form for patents, trademarks, and copyrights, with PDF uploads and auto-generated application numbers (e.g., `PAT-2023-0002`)
- **Color-coded tracking** with status filtering and tap-to-detail navigation
- **File management** - searchable two-column grid with PDF preview, signed URL downloads (60s expiry), and native share integration
- **ML-powered similarity checker** that flags overlapping patents before submission
- **Theming and accessibility** - full dark/light mode, language support scaffolding, and password management with compliance-grade validation

## Technical Deep Dive

### Similarity Checker

The most technically challenging feature. When a user views a patent's details, the pipeline runs:

1. Existing patents are fetched from Singapore's IPOS via their public API
2. Both existing and submitted patents are vector-encoded
3. Cosine similarity is computed against the corpus with a configurable threshold (default 0.7)
4. Top 3 matches are returned with scores and downloadable documents

I built this as a **separate FastAPI microservice** rather than embedding it in the main backend - this kept the ML pipeline isolated, independently deployable, and non-blocking through async file processing. The main app communicates with it via REST, so swapping out the encoding model or scaling the service independently is trivial.

![The similarity checker showing matched patents with confidence scores](assets/images/projects/patent/screenshot-similarity.png)

### Architecture

I chose **Supabase** over a custom backend for a reason - it gave me auth, PostgreSQL, object storage, and real-time subscriptions out of the box, letting me focus engineering time on the features that actually differentiated the product (similarity checker, tracking UX).

- **Auth**: Supabase Auth with email/password, session persistence via AsyncStorage, and compliance-grade password validation (8+ chars, letters, numbers, special characters)
- **Real-time**: PostgreSQL Changes subscription on the notifications table. The dashboard auto-refreshes every 5 seconds, with notification types (`new-patent`, `status-change`) driving the UI
- **Storage**: Patent PDFs uploaded to Supabase object storage with signed URLs generated on-demand (60-second validity for security)
- **Frontend**: React Native 0.76 + Expo 52 with file-based routing (Expo Router), React Native Paper for Material Design, and Reanimated for fluid animations

![Color-coded patent tracking with status filtering](assets/images/projects/patent/screenshot-tracking.png)

### Testing & Quality

I applied both **black-box and white-box testing** methodologies:

- **Equivalence class partitioning** to define valid/invalid input groups across login and submission flows
- **Boundary value analysis** for edge cases (empty fields, malformed emails, weak passwords, mismatched confirmations)
- **Control flow graph analysis** - the login flow had a cyclomatic complexity of 5, meaning 5 independent paths requiring coverage. All paths were tested and passed

## Key Learnings

A few things I'd carry forward from this project:

**Microservice boundaries matter.** Isolating the similarity checker as its own FastAPI service was the best architectural decision I made. It could be developed, tested, and deployed independently - when I needed to adjust the encoding pipeline, the main app didn't need a single change.

**Test before you code.** Writing test cases first (equivalence classes, boundary values, control flow paths) caught edge cases I wouldn't have thought of otherwise. Every test passed on the first integration run - that doesn't happen by accident.

**Pick your abstractions wisely.** Supabase handled auth, storage, and real-time so I didn't have to. That freed up time to build the similarity checker and polish the UX - the parts that actually made the product worth using.
