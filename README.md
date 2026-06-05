# AI Digests

A personal automation platform that generates and emails curated AI-powered digests on a schedule, with a public archive dashboard.

---

## Architecture

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

- The automation never needs to know about Astro or React.
- The dashboard never needs API keys or network calls — it's purely a static site.
- Each layer can be developed, tested, and deployed independently.

---

## Digests

### Frontend Ecosystem Digest
- **Schedule:** Every Monday
- **Tracks:** React, Next.js, Vue, Nuxt, Astro, Svelte, Angular, Vite, Node.js
- **Sources:** npm registry, GitHub releases, JavaScript Weekly, Frontend Focus, React Status, Dev.to, Smashing Magazine

### Rabbit Hole Digest
- **Schedule:** Every Friday
- **Sources:** GitHub Trending, Hacker News, Product Hunt
- **Focus:** Unexpected discoveries, useful tools, cool projects, interesting engineering

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Automation | Node.js 20+, ESM, GitHub Actions |
| AI Provider | OpenCode Zen (OpenAI-compatible) · `deepseek-v4-flash-free` |
| Email | Gmail SMTP via nodemailer |
| RSS | rss-parser |
| Dashboard | Astro 5, React 19, Tailwind CSS v4 |
| Deployment | GitHub Pages (static) |

---

## Development

```bash
# Install dependencies (automation)
npm install

# Install dependencies (dashboard)
cd dashboard && npm install && cd ..

# Smoke test all API services
npm run test:services

# Run a digest locally (sends email + writes archive)
npm run digest:frontend
npm run digest:rabbit-hole
npm run digest:all

# Dashboard dev server
cd dashboard && npm run dev

# Dashboard production build
cd dashboard && npm run build
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCODE_API_KEY` | Yes | OpenCode Zen API key |
| `OPENCODE_BASE_URL` | No | Default: `https://opencode.ai/zen/v1` |
| `OPENCODE_MODEL` | No | Default: `deepseek-v4-flash-free` |
| `GMAIL_USER` | Yes | Gmail address for SMTP |
| `GMAIL_APP_PASSWORD` | Yes | Gmail app password |
| `EMAIL_TO` | Yes | Recipient email address |

Copy `.env.example` to `.env` and fill in your values.

---

## GitHub Actions

| Workflow | Trigger | Action |
|----------|---------|--------|
| `frontend-digest.yml` | Mon 12:00 UTC | Fetch versions + articles → AI summary → email → archive |
| `rabbit-hole-digest.yml` | Fri 12:00 UTC | Fetch trending + discoveries → AI summary → email → archive |
| `deploy-dashboard.yml` | After digest or push to `archives/` | Build Astro site → deploy to GitHub Pages |

All workflows can also be triggered manually from the Actions tab.

---

## Project Structure

```
ai-digests/
├── archives/                    # Generated digest markdown files
├── dashboard/                   # Astro + React static site
│   └── src/
│       ├── components/          # React islands (FilterBar)
│       ├── layouts/             # Astro layout shell
│       ├── lib/archives.js      # Reads archives/ at build time
│       ├── pages/               # Landing page, detail pages, RSS feed
│       └── styles/global.css    # Tailwind v4 entry
├── scripts/                     # Smoke tests
├── src/
│   ├── config/digests.json      # Single source of truth
│   ├── digests/                 # Orchestration scripts
│   ├── lib/archive.js           # Archive writing utility
│   ├── services/                # API integrations
│   │   ├── email.js             # Gmail SMTP
│   │   ├── github.js            # GitHub API (releases + trending)
│   │   ├── npm.js               # npm registry
│   │   ├── openai.js            # AI summaries
│   │   └── rss.js               # RSS/Atom feeds
│   └── email/                   # React email templates (future)
├── .github/workflows/           # CI/CD pipelines
├── .env.example
└── package.json
```

---

## License

MIT
