---
title: "a patent app that checks new filings against existing patents"
barTitle: "patentease"
summary: A mobile app for filing and tracking patent applications that checks each filing's similarity against existing patents pulled from Singapore's IPOS database, and shows applicants the closest existing patents.
image: /assets/images/projects/patent/banner.webp
order: 10
technologies:
  - React Native
  - Python
  - FastAPI
  - PostgreSQL
  - Machine Learning
---

## the problem

Filing a patent is slow and opaque. The forms are long and repetitive, there is no single place to submit and follow applications, and once something is submitted you get little visibility: no reason given for a rejection, no easy way to follow up, and no consolidated view for a company juggling several filings. On top of that, the most important question before filing, whether something like your invention is already patented, is left for the applicant to research alone.

I built PatentEase, a mobile app for inventors and companies that covers the whole flow in one place: submit an application, track its status, manage its documents, and check it against existing patents. That last part is the core feature. The app pulls existing patents from Singapore's patent office (IPOS), scores how similar each one is to your filing, and shows you the closest matches with their documents so you can compare them side by side.

## features

![The PatentEase dashboard showing status counters and notification cards](assets/images/projects/patent/screenshot-dashboard.webp)

- **Real-time dashboard** with notification cards and clickable status counters across four states (approved, in review, pending, rejected)
- **Streamlined submission:** one form for patents, trademarks, and copyrights, with PDF uploads and auto-generated application numbers (e.g., `PAT-2023-0002`)
- **Color-coded tracking** with status filtering and tap-to-detail navigation
- **File management:** searchable two-column grid with PDF preview, signed URL downloads (60s expiry), and native share integration
- **Similarity checker** that surfaces the existing patents closest to a filing
- **Theming and accessibility:** full dark/light mode, language support scaffolding, and password management with enforced strength rules

## technical deep dive

### similarity checker

This was the hardest feature to build. The idea: turn each patent into a vector so that patents about similar things end up close together, then measure how close your filing is to every existing one. When a user views a patent's details, the pipeline runs:

1. Existing patents are fetched from Singapore's IPOS via their public API
2. Both existing and submitted patents are <span class="gloss-term" data-gloss="Encoding text as a list of numbers so that documents can be compared mathematically. Similar documents get similar vectors.">vector-encoded</span>
3. <span class="gloss-term" data-gloss="A score from the angle between two vectors. 1 means they point the same way (very similar documents); near 0 means unrelated.">Cosine similarity</span> is computed against the corpus with a configurable threshold (default 0.7)
4. Top 3 matches are returned with scores and downloadable documents

I built this as a **separate FastAPI microservice** instead of embedding it in the main backend. That kept the ML pipeline isolated, independently deployable, and non-blocking through async file processing. The main app talks to it over REST, so the encoding model can be swapped or the service scaled without touching the app.

A high score is a prompt to read that patent closely. It is a screening aid for the applicant and makes no legal judgement about novelty.

![The similarity checker showing matched patents with confidence scores](assets/images/projects/patent/screenshot-similarity.webp)

### architecture

I chose **<span class="gloss-term" data-gloss="A hosted backend platform built on PostgreSQL that bundles authentication, file storage, and realtime change notifications.">Supabase</span>** over a custom backend because it gave me auth, PostgreSQL, object storage, and real-time subscriptions out of the box, letting me spend engineering time on the features that set the product apart (similarity checker, tracking UX).

- **Auth**: Supabase Auth with email/password, session persistence via AsyncStorage, and compliance-grade password validation (8+ chars, letters, numbers, special characters)
- **Real-time**: PostgreSQL Changes subscription on the notifications table. The dashboard auto-refreshes every 5 seconds, with notification types (`new-patent`, `status-change`) driving the UI
- **Storage**: Patent PDFs uploaded to Supabase object storage with signed URLs generated on-demand (60-second validity for security)
- **Frontend**: React Native 0.76 + Expo 52 with file-based routing (Expo Router), React Native Paper for Material Design, and Reanimated for fluid animations

![Color-coded patent tracking with status filtering](assets/images/projects/patent/screenshot-tracking.webp)

### testing

I applied both **black-box and white-box testing** methodologies:

- **Equivalence class partitioning** to define valid/invalid input groups across login and submission flows
- **Boundary value analysis** for edge cases (empty fields, malformed emails, weak passwords, mismatched confirmations)
- **Control flow graph analysis:** the login flow had a <span class="gloss-term" data-gloss="The number of independent paths through a piece of code. It tells you the minimum number of test cases needed to exercise every branch.">cyclomatic complexity</span> of 5, meaning 5 independent paths requiring coverage. All paths were tested and passed

## what stuck with me

**Microservice boundaries matter.** Isolating the similarity checker as its own FastAPI service was the best architectural decision I made. It could be developed, tested, and deployed independently: when I needed to adjust the encoding pipeline, the main app didn't need a single change.

**Test before you code.** Writing test cases first (equivalence classes, boundary values, control flow paths) caught edge cases I wouldn't have thought of otherwise, and made the first integration run uneventful.

**Pick your abstractions wisely.** Supabase handled auth, storage, and real-time so I didn't have to. That freed up time to build the similarity checker and polish the UX, the parts that made the product worth using.
