---
title: Overview
description: Technical documentation for the Commons Hub Brussels infrastructure.
---

# Commons Hub Brussels — Technical Docs

Commons Hub Brussels runs on a **Next.js** website backed by a data pipeline that aggregates events, room bookings, membership info, and financial data.

## Architecture at a Glance

- **Website** — Next.js app serving [commonshub.brussels](https://commonshub.brussels). Reads pre-generated JSON data from `data/` at runtime.
- **Event Pipeline** — Fetches events from Luma (ICS + API) and Google Calendar, consolidates them into monthly `events.json` files, and generates markdown for LLM discoverability. See [Events](/website/events).
- **Data Directory** — Structured `data/{year}/{month}/` tree holding raw calendar feeds, Luma API responses, images, blockchain transactions, and consolidated events. See [Data](/website/data).
- **Rooms** — Configurable rooms with Google Calendar integration for bookings. See [Rooms](/website/rooms).
- **Scheduled Tasks** — Periodic data fetching via `fetch-recent.js` and Docker entrypoint. See [Cron](/website/cron).
- **CLI** — The `chb` command-line tool for listing and syncing events. See [CLI](/cli).
- **Elinor** — An AI community manager running on Discord via OpenClaw. See [Elinor](/elinor).
