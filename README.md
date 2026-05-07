# job-tracker

A multi-tenant job tracker. Hosted dashboard on Vercel; an optional Mac agent runs locally and sends you an iMessage / macOS notification every morning.

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ web/  (Next.js, Vercel)  │ ◄─────► │ Turso (libSQL)           │
│  • Google sign-in         │         │  users / portfolios /    │
│  • Portfolios + map UI    │         │  jobs / snapshots /      │
│  • Adds jobs via static   │         │  similar_jobs / tokens   │
│    fetch (Greenhouse,     │         └──────────┬───────────────┘
│    Lever, Ashby)          │                    │
│  • Vercel Cron every 3h   │                    │
└────────────┬──────────────┘                    │
             │ REST + bearer token               │
             ▼                                   ▼
     ┌────────────────────────────────────────────────┐
     │ agent/  (Mac CLI, runs via launchd every 3h)   │
     │  • Pulls user's tracked URLs                   │
     │  • Playwright for LinkedIn / Workday           │
     │  • Posts results back                          │
     │  • Morning digest → iMessage + macOS banner    │
     └────────────────────────────────────────────────┘
```

## Repo layout

| Path | What |
| --- | --- |
| `web/` | Next.js 15 app — deploys to Vercel |
| `agent/` | Node CLI users install on their Mac |
| `packages/db/` | Drizzle schema + libSQL client |
| `packages/core/` | Site adapters (Greenhouse / Lever / Ashby / LinkedIn / generic) and shared fetch helpers |

## One-time setup (you, the operator)

1. **Turso DB** — create a free database at <https://turso.tech>:
   ```bash
   turso db create job-tracker
   turso db show job-tracker --url
   turso db tokens create job-tracker
   ```
2. **Google OAuth** — create credentials at <https://console.cloud.google.com/apis/credentials>. Authorized redirect URI: `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for dev).
3. **(Optional) Resend** — for the email digest fallback. Free at <https://resend.com>.
4. **Local install + push schema:**
   ```bash
   npm install
   cp web/.env.example web/.env.local
   # fill in TURSO_*, AUTH_*, AUTH_SECRET (openssl rand -base64 32)
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push
   npm run dev:web
   ```
5. **Deploy to Vercel:**
   ```bash
   cd web && vercel
   ```
   In the Vercel dashboard, set the env vars from `.env.example`. Add `CRON_SECRET` to gate the cron endpoints.

## How users use it

1. Sign in with Google.
2. Create a portfolio (e.g., "NYC startups").
3. Paste job URLs. The web app fetches what it can statically.
4. Optional: open `/agent`, mint a token, run the one-line installer on their Mac:
   ```bash
   curl -fsSL https://YOUR-DOMAIN.vercel.app/install.sh | bash
   ```
   The installer drops `~/Library/LaunchAgents/com.jobtracker.agent.plist`. It runs at login and every 3 hours.
5. To get iMessage delivery, set `JOBTRACKER_IMESSAGE_TO=+15555550123` in `~/.jobtracker/agent/.env`.

## What gets tracked

For every URL, every fetch records a snapshot. We detect:

- **Removed** — page goes 404, or contains "no longer accepting applications". Status flips to `removed`.
- **Deadline soon** — JSON-LD `validThrough` parsed; the digest surfaces deadlines in the next 7 days.
- **Similar postings** — for adapters that support it (Greenhouse / Lever / Ashby), the careers index is scanned and new sibling postings appear under "Similar postings discovered" in the portfolio.

## Adapters

| Site | Static (Vercel cron) | Browser (agent) |
| --- | --- | --- |
| Greenhouse | ✓ | – |
| Lever | ✓ | – |
| Ashby | ✓ | – |
| LinkedIn | – | ✓ |
| Generic (JSON-LD `JobPosting`) | ✓ | – |

Adding an adapter: implement `SiteAdapter` in `packages/core/src/adapters/` and register it in `adapters/index.ts`.

## Privacy

- Each user's jobs are scoped by `user_id` and never returned across accounts.
- Agent tokens are stored hashed (sha256). The plaintext token is shown once at creation.
- The Mac agent sends its bearer token only to your configured `JOBTRACKER_API` host.

## Uninstall the agent

```bash
launchctl unload ~/Library/LaunchAgents/com.jobtracker.agent.plist
rm -rf ~/.jobtracker ~/Library/LaunchAgents/com.jobtracker.agent.plist
```
