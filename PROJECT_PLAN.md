# AI Digests

## Overview

AI Digests is a personal automation platform that generates and emails curated digests on a schedule.

The goal is to create a reusable system that can support multiple digest types while sharing the same infrastructure for:

* Data collection
* AI summarization
* Email generation
* Scheduling
* Archiving

The first version will focus on two weekly digests:

1. Frontend Ecosystem Digest
2. Rabbit Hole Digest

---

# Project Status

## ✅ Phase 0 — Repository Scaffolding (Complete)

* Directory tree for automation (`src/`) and dashboard (`dashboard/`)
* Root `package.json` with ESM, all dependencies installed
* `dashboard/package.json` with Astro + React + Tailwind v4
* `.env` and `.env.example` with all required variables
* `src/config/digests.json` — single source of truth
* `.gitignore`
* Sample archive files in `archives/` for dashboard development
* `dashboard/astro.config.mjs` with `@tailwindcss/vite`
* `dashboard/src/lib/archives.js` — utility to read archives

## ✅ Phase 1 — Data Services (Complete)

* `src/services/npm.js` — fetch latest version from npm registry
* `src/services/github.js` — fetch releases + trending repos
* `src/services/rss.js` — fetch and parse RSS/Atom feeds
* `src/services/openai.js` — generate summaries (OpenAI or OpenCode Zen)
* `src/services/email.js` — send HTML emails via Gmail SMTP

## ✅ Smoke Test — All Services Verified

All 5 services tested against real APIs:

```
npm:        ✓ react → 19.2.7, astro → 6.4.4, @angular/core → 22.0.0
github:     ✓ facebook/react v19.2.7, 14 trending repos
rss:        ✓ javascriptweekly → 4 articles
openai:     ✓ real summary generated via OpenCode Zen (deepseek-v4-flash-free)
email:      ✓ delivered to inbox
```

## 🔲 Phase 3 — Digest Scripts (Next)

Wire services together into `src/digests/frontend.js` and `src/digests/rabbit-hole.js`.

## 🔲 Phase 4 — GitHub Actions Workflows

Cron-triggered CI files.

## 🔲 Phase 5 — Astro Dashboard

Archive site (built with sample data, ready for development).

## 🔲 Phase 6 — Dashboard Deployment

GitHub Pages deploy workflow.

---

# Tech Stack

## AI Provider

The project uses **OpenCode Zen** (`https://opencode.ai/zen/v1`) as the primary AI provider. OpenAI direct is available as a fallback. The API is interchangeable — both are accessed through the `openai` npm library.

Current model: `deepseek-v4-flash-free` (free tier, sufficient for text summarization).

## Automation (GitHub Actions / Node.js)

* Node.js 20+
* JavaScript (ES Modules)
* OpenCode Zen API (OpenAI-compatible)
* Gmail SMTP (nodemailer)
* RSS Feeds (rss-parser)
* npm Registry API
* GitHub API

## Email (Planned — Phase 2)

* React (JSX components)
* `@react-email/components`
* `react-dom/server` → renders to HTML string

## Dashboard (Planned — Phase 5)

* Astro 5
* React — interactive components
* Tailwind CSS v4
* Deployed to GitHub Pages

---

# Architecture

The project has two layers that share the `archives/` directory as their contract:

```
┌─────────────────────────────────────┐
│   Layer 1: Automation (Node.js)     │
│   Runs in GitHub Actions on cron    │
│                                     │
│   Fetch → Summarize → Email → Save  │
│                         to archives/│
└──────────┬──────────────────────────┘
           │ writes .md files
           ▼
┌─────────────────────────────────────┐
│   Layer 2: Dashboard (Astro+React)  │
│   Reads archives/ at build time     │
│                                     │
│   Renders digest archive pages      │
│   with search & filtering           │
└─────────────────────────────────────┘
```

This separation means:
- The automation never needs to know about Astro or React.
- The dashboard never needs API keys or network calls — it's purely a static site.
- Each layer can be developed, tested, and deployed independently.

---

# Current File Tree

```text
ai-digests/
├── archives/
│   ├── 2026-06-01-sample-frontend.md
│   └── 2026-06-01-sample-rabbit-hole.md
│
├── dashboard/                        # Astro project (scaffolded, not yet built)
│   ├── src/
│   │   ├── lib/archives.js           # reads ../archives/ at build time
│   │   ├── styles/global.css         # Tailwind v4 entry
│   │   ├── pages/archives/           # dynamic route slot (Phase 5)
│   │   ├── components/               # React islands (Phase 5)
│   │   └── layouts/                  # Astro layout shell (Phase 5)
│   ├── astro.config.mjs
│   └── package.json
│
├── scripts/
│   └── test-services.mjs             # smoke test for all services
│
├── src/
│   ├── config/digests.json           # single source of truth
│   ├── digests/                      # orchestration scripts (Phase 3 — next)
│   ├── services/
│   │   ├── email.js                  # Gmail SMTP via nodemailer
│   │   ├── github.js                 # GitHub API (releases + trending)
│   │   ├── npm.js                    # npm registry version lookup
│   │   ├── rss.js                    # RSS feed parser
│   │   └── openai.js                 # AI summaries (Zen or OpenAI)
│   └── email/                        # React email templates (Phase 2)
│       ├── components/
│       ├── templates/
│       ├── render.js
│       └── previews/
│
├── .env                              # keys (gitignored)
├── .env.example
├── .gitignore
├── package.json
└── PROJECT_PLAN.md
```

---

# Digest 1: Frontend Ecosystem Digest

## Schedule

Every Monday

## Purpose

Provide a quick overview of the frontend ecosystem.

## Frameworks to Track

* React
* Next.js
* Vue
* Nuxt
* Astro
* Svelte
* Angular
* Vite
* Node.js

## Data Sources

### Versions

* npm registry
* GitHub releases

### Articles

* JavaScript Weekly
* Frontend Focus
* React Status
* Dev.to
* Smashing Magazine

## Email Contents

### Framework Versions

Current version for each tracked framework.

### Release Highlights

Summaries of notable releases.

### Top Articles

5–10 important frontend articles.

### AI Summary

One concise overview of the week's ecosystem changes.

---

# Digest 2: Rabbit Hole Digest

## Schedule

Every Friday

## Purpose

Discover interesting things on the internet.

## Content Types

* Open-source projects
* Creative websites
* Developer tools
* Experimental projects
* Visualizations
* Weird and fun tech discoveries

## Data Sources

* GitHub Trending
* Hacker News
* Product Hunt
* Developer blogs
* Reddit developer communities

## AI Instructions

Generate a fun and engaging newsletter.

Prioritize:

* Unexpected discoveries
* Useful tools
* Cool projects
* Interesting engineering work

Avoid:

* Generic news
* Marketing-heavy content

---

# Email System

## Delivery Method

Gmail SMTP

## Environment Variables

```env
# OpenAI (fallback if OpenCode Zen is not configured)
OPENAI_API_KEY=

# OpenCode Zen (preferred)
OPENCODE_API_KEY=
OPENCODE_BASE_URL=https://opencode.ai/zen/v1
OPENCODE_MODEL=deepseek-v4-flash-free

# Gmail SMTP
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Recipient
EMAIL_TO=
```

## Email Generation

**Current (Phase 3):** Plain HTML string built in the digest script. Sent directly via `email.js`.

**Planned (Phase 2):** React components rendered to HTML via `react-dom/server`:
```
Digest data (JSON) → React component (JSX) → HTML string → Gmail SMTP
```

---

# Dashboard (Astro + React)

## Purpose

A public-facing archive of all generated digests.

## Features (Initial)

* Landing page with list of all digests (newest first)
* Individual digest detail pages
* Digest type filtering (Frontend vs Rabbit Hole)
* RSS feed of digests
* Responsive design with Tailwind CSS

## Status

Scaffolded and ready for development. Sample archives exist. See Phase 5.

---

# GitHub Actions

## Frontend Digest

```yaml
Schedule: Every Monday
```

Workflow (Phase 3 scope):

1. Fetch framework versions
2. Fetch articles
3. Generate AI summary
4. Build email HTML
5. Send email
6. Save archive markdown file

## Rabbit Hole Digest

```yaml
Schedule: Every Friday
```

Workflow (Phase 3 scope):

1. Fetch interesting content
2. Generate AI summary
3. Build email HTML
4. Send email
5. Save archive markdown file

## Deploy Dashboard

```yaml
Triggers: After either digest completes, or on push
```

Workflow:

1. Checkout repo (includes updated `archives/`)
2. Install dependencies in `dashboard/`
3. Run `astro build`
4. Deploy `dist/` to GitHub Pages

---

# Archive System

Each digest generates a markdown file saved to `archives/`.

Example:

```text
archives/
├── 2026-06-08-frontend.md
├── 2026-06-12-rabbit-hole.md
```

The Astro dashboard reads these files at build time and renders them as archive pages.

## Frontmatter Format

Each archive file includes YAML frontmatter for the dashboard to parse:

```markdown
---
title: "Frontend Ecosystem Digest"
date: 2026-06-08
type: frontend
---

## Framework Versions

| Framework | Version |
|-----------|---------|
| React     | 19.1.0  |
...
```

---

# Development Workflow

```bash
# Automation (root)
npm run test:services       # smoke test all API services
npm run digest:frontend     # run frontend digest (Phase 3)
npm run digest:rabbit-hole  # run rabbit hole digest (Phase 3)
npm run digest:all          # run both

# Dashboard (dashboard/)
npm run dev                 # local Astro dev server (Phase 5)
npm run build               # static build
npm run preview             # preview built site
```

---

# Phase 3 — Implementation Plan (Next Up)

## `src/digests/frontend.js`

1. Read config from `src/config/digests.json` (frameworks, RSS feeds, system prompt)
2. Call `getLatestVersion()` for each framework (npm.js)
3. Call `getLatestRelease()` for each framework repo (github.js)
4. Call `fetchArticles()` for each RSS feed (rss.js)
5. Build user prompt with versions + articles
6. Call `generateSummary()` (openai.js)
7. Build HTML email string
8. Call `sendEmail()` (email.js)
9. Write archive markdown to `archives/YYYY-MM-DD-frontend.md`

## `src/digests/rabbit-hole.js`

1. Read config
2. Call `getTrendingRepos()` (github.js)
3. Fetch from Hacker News, dev blogs (via rss.js or direct fetch)
4. Build user prompt
5. Call `generateSummary()`
6. Build HTML email string
7. Call `sendEmail()`
8. Write archive markdown to `archives/YYYY-MM-DD-rabbit-hole.md`

---

# Future Digest Ideas

## AI Tool Radar

Track:

* New AI products
* Open-source AI projects
* Model releases

## Builder Digest

Track:

* Indie hacker projects
* SaaS opportunities
* Startup trends

## GitHub Discovery

Track:

* Trending repositories
* Rising projects
* Interesting maintainers

## Career Digest

Track:

* Frontend job trends
* New technologies
* Learning resources

---

# MVP Definition

The project is considered successful when:

* [ ] GitHub Actions runs automatically on schedule.
* [ ] Weekly Frontend Digest email is delivered.
* [ ] Weekly Rabbit Hole Digest email is delivered.
* [ ] AI summaries are included in each email.
* [ ] Archives are generated with YAML frontmatter.
* [ ] Configuration is stored in code.
* [ ] Astro dashboard is deployed and accessible online.
* [ ] Dashboard shows all archives with type filtering and RSS feed.

Everything else is a future enhancement.

---

# Portfolio Value

This project demonstrates:

* Automation & CI/CD
* AI integration (OpenCode Zen / OpenAI)
* React email template architecture (planned)
* Astro static site generation (planned)
* API consumption (npm, GitHub, RSS)
* Scheduling & cron workflows
* Email delivery & HTML rendering
* Data aggregation & summarization
* Modern full-stack JavaScript

The project is showcased via the live Astro dashboard and can be linked from a personal portfolio website.
