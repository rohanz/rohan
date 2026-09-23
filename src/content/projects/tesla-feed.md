---
title: "tracking every change to the global Supercharger network"
barTitle: "supercharger tracker"
summary: A data pipeline that snapshots all 10,000+ Tesla Supercharger sites worldwide and logs exactly what changed at each one between runs (openings, closures, stall counts, power upgrades, non-Tesla access), using schema-driven field-level change detection.
image: /assets/images/projects/tesla/banner.webp
order: 12
technologies:
  - Python
  - SQL
  - Data Pipelines
---

## the problem

Tesla's Supercharger network keeps changing: new stations open, existing ones gain stalls or power, some close, and more of them open up to non-Tesla cars. A snapshot of the network tells you what exists today. I wanted the history as well: what changed at each site since the last look, which is the part that matters if you are tracking how charging infrastructure grows.

I built a small pipeline, during the same internship at AlphaGeo as my <a href="/projects/datacenter-atlas">data center atlas</a>, that keeps its own copy of every Supercharger site and records each change field by field, so the history survives.

## how it works

The pipeline pulls the full global dataset from the <span class="gloss-term" data-gloss="A community-maintained site that tracks every Supercharger worldwide and exposes the full list as JSON.">supercharge.info</span> API, reconciles it against a local SQLite database, and logs every field-level mutation to an append-only audit trail. The database currently holds 10,443 sites.

### schema-driven change detection

This is the core of the system. Rather than hardcoding field comparisons, I use SQLAlchemy's `inspect()` to dynamically iterate over every column in the ORM model and compare normalized old vs. new values. Adding a new tracked field means adding one column to the model; the diff logic picks it up automatically with no other code changes.

### value normalization

The `normalize()` function handles the subtle cases that cause false-positive diffs:

- **Floats:** GPS coordinates rounded to 6 decimal places (~11 cm precision) to avoid floating-point drift across API calls
- **Datetimes:** handles both Python `datetime` objects and ISO 8601 strings, normalizing to a consistent `.isoformat()` representation
- **Nulls:** treats `None` and empty strings as the same missing value
- **Booleans and strings:** type-aware comparison with whitespace trimming

### data model

23 columns tracking everything: full address, GPS coordinates, stall count, power capacity (kW), solar canopy presence, battery storage, non-Tesla EV access, PlugShare and OSM cross-reference IDs, elevation, operational status, and temporal metadata.

## architecture

- **<span class="gloss-term" data-gloss="An upsert inserts a row if it is new and updates it if it exists. Idempotent means running it twice with the same data changes nothing the second time.">Idempotent upserts</span>:** each run inserts new sites or updates existing ones by primary key lookup, safe to run on any schedule
- **Database-agnostic ORM:** SQLAlchemy with SQLite for local use, swappable to PostgreSQL via connection string
- **Append-only changelog:** timestamped, field-level change records in `tesla_update.log` create a full historical audit trail of network evolution

Here's a sample of the changelog showing real mutations: stations opening, power upgrades, GPS coordinate corrections, and new cross-reference IDs being added. Across its runs so far the log has recorded 1,215 new sites and 5,122 field-level updates, including 1,205 new sites between a run in May 2025 and the next in March 2026.

![Field-level change detection log showing station mutations](assets/images/projects/tesla/changelog.webp)

## limitations

- It runs on a cron schedule, so a site that changes twice between runs shows up as one net change, and the schedule sets the resolution of the history.
- `status_days`, a counter of how long a site has been in its current status, ticks up on its own, so it appears in about three quarters of all logged updates. It should be excluded from diffing so the real changes stand out.
- The changelog is a text file. Querying the history ("every site that gained power in 2025") would need it loaded into a table first.

## what stuck with me

**Reflection beats hardcoding.** Using SQLAlchemy's column inspection as the single source of truth for both storage and change detection eliminated an entire class of bugs where the schema and diff logic drift apart.

**Normalization is the hard part.** The change detection logic itself is short. The engineering work is making sure that "42.123456" and "42.1234561" don't trigger a spurious update, and that a missing value reads the same whether the API sends `null` or an empty string.
