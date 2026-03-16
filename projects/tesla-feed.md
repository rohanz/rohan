---
title: Tesla Supercharger Tracker
summary: A data pipeline that tracks the entire global Tesla Supercharger network, performing schema-driven field-level change detection to maintain a complete audit trail of infrastructure evolution.
image: assets/images/projects/tesla/banner.png
technologies:
  - Python
  - SQL
  - Data Pipelines
---

## The Problem

Tesla's Supercharger network is constantly evolving - new stations opening, existing ones upgrading power capacity, stall counts changing, non-Tesla access expanding. I wanted a way to track these changes over time at the field level, not just know the current state.

## How It Works

The pipeline pulls the full global dataset from the supercharge.info API, reconciles it against a local SQLite database, and logs every field-level mutation to an append-only audit trail.

### Schema-Driven Change Detection

The core of the system. Rather than hardcoding field comparisons, I use SQLAlchemy's `inspect()` to dynamically iterate over every column in the ORM model and compare normalized old vs. new values. Adding a new tracked field means adding one column to the model - the diff logic picks it up automatically with zero additional code.

### Value Normalization

The `normalize()` function handles the subtle cases that cause false-positive diffs:

- **Floats** - GPS coordinates rounded to 6 decimal places (~11cm precision) to avoid floating-point drift across API calls
- **Datetimes** - handles both Python `datetime` objects and ISO 8601 strings, normalizing to a consistent `.isoformat()` representation
- **Nulls** - guards against `None` vs. empty string ambiguity
- **Booleans and strings** - type-aware comparison with whitespace trimming

### Data Model

23 columns tracking everything: full address, GPS coordinates, stall count, power capacity (kW), solar canopy presence, battery storage, non-Tesla EV access, PlugShare and OSM cross-reference IDs, elevation, operational status, and temporal metadata.

## Architecture

- **Idempotent upserts** - each run inserts new sites or updates existing ones by primary key lookup, safe to run on any schedule
- **Database-agnostic ORM** - SQLAlchemy with SQLite for local use, swappable to PostgreSQL via connection string
- **Append-only changelog** - timestamped, field-level change records in `tesla_update.log` create a full historical audit trail of network evolution

Here's a sample of the changelog showing real mutations - stations opening, power upgrades, GPS coordinate corrections, and new cross-reference IDs being added:

![Field-level change detection log showing station mutations](assets/images/projects/tesla/changelog.png)

## Key Learnings

Two things that stood out:

**Reflection beats hardcoding.** Using SQLAlchemy's column inspection as the single source of truth for both storage and change detection eliminated an entire class of bugs where the schema and diff logic drift apart.

**Normalization is the hard part.** The actual change detection logic is trivial - the engineering challenge is ensuring that "42.123456" and "42.1234561" don't trigger a spurious update. Getting normalization right meant zero false positives from day one.
