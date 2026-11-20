# EarthEcho product spec (spec-first)

This file is the written spec the build follows. Each stage was agreed against it before the next stage started.

## Problem
A smallholder farmer has to decide when to irrigate, what to plant next and which hazards are near, without a lab, an agronomist on call or reliable internet. Free satellite and open data exist, but they are hard to read.

## Users
Smallholder farmers in Bangladesh (first), India, Pakistan, Nepal, Myanmar and Bhutan, on a phone, reading Bengali or English.

## Goals
1. Turn open data for one plot into a plain-language plan: when to irrigate, which crops suit the soil, which hazards are nearby.
2. Show where every number comes from and whether it was entered, assumed or estimated.
3. Work on a phone, install like an app and open offline with the last data.

## Non-goals
- No yield or income forecast.
- No pesticide or fertiliser doses.
- No replacement for the local agriculture officer: the app supports the decision, the farmer decides.

## Scope (tabs)
My Farm; Today (Weather, Disaster watch, Irrigation); Plan (Rotation planner, Suitability, Market prices, Suppliers); Your land (Soil, Environment); Help (Ask EarthEcho, Data and sources).

## Acceptance criteria
- Every screen exists in English and Bengali.
- Every result names its data source.
- The assistant answers only from the plot's data and retrieved knowledge, cites sources as [S1], [S2], and says "no data" instead of guessing.
- The app builds with `npm run build` and the MCP smoke test passes (`node mcp/smoke-test.js`).
- Secrets are only server-side environment variables.

## Build stages and review gates
1. Navigation tabs and theme. Gate: every tab opens, light and dark mode both readable.
2. Data platform (weather, soil, rain, hazards, prices). Gate: each number shows its source and a data test passes (`data-tools/test_*.py`).
3. Planning (irrigation, suitability, rotation planner). Gate: results match hand-checked examples for the demo area (Mokamtala, Shibganj, Bogura).
4. AI assistant last. Gate: answers cite sources, refuse out-of-scope questions, and handle Bengali questions.
5. Knowledge as MCP servers (`mcp/`). Gate: smoke test passes in CI.
6. Submission. Gate: README, screenshots and live link checked.

## Review process
Design options were shown before being applied. Each stage was approved before the next began. Commits are small, one change each, and CI (GitHub Actions) builds the app on every push.
