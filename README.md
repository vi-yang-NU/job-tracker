# job-tracker

A multi-tenant job tracker. Hosted dashboard on Vercel; an optional Mac agent runs locally and sends you iMessage / macOS notifications **only when something has actually changed**.

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ Next.js (Vercel, root)   │ ◄─────► │ Turso (libSQL)           │
│  • Google sign-in         │         │  users / portfolios /    │
│  • Portfolios + map UI    │         │  jobs / snapshots /      │
│  • Status incl. "watching"│         │  similar_jobs / tokens   │
│  • Vercel Cron every 3h   │         │  notifications (inbox)   │
└────────────┬──────────────┘         └──────────┬───────────────┘
             │ REST + bearer token               │
             ▼                                   ▼
     ┌────────────────────────────────────────────────┐
     │ agent/  (Mac CLI, runs via launchd every 3h)   │
     │  • Pulls user's tracked URLs                   │
     │  • Playwright for LinkedIn / Workday           │
     │  • Posts results, drains inbox, acks           │
     │  • Silent when nothing changed                 │
     └────────────────────────────────────────────────┘
```

## What's tracked, what triggers a ping

For every URL we record a snapshot per fetch. The server emits notifications only on **transitions**:

| Event | When |
| --- | --- |
| `job_opened` | Page was unavailable, now available — covers "applications opened" for jobs you've marked **watching** |
| `job_removed` | Page was available, now 404 / "no longer accepting" |
| `deadline_set` | Job had no deadline; the page now has one |
| `deadline_soon` | Daily scan: deadline falls within 3 days, one ping per (job, day) |
| `new_similar` | New sibling postings appeared at a tracked company's careers index |

If none of those happened during a tick, the agent stays silent — no daily noise.

## "I want to apply in 2027" — the `watching` status

Set a job's status to **watching** and optionally a target apply date. The agent keeps fetching it every 3h. The moment the page transitions from unavailable to available — or its deadline gets announced — you get a ping.

Use this for cohorted programs (internships, fellowships, returnships) that haven't opened yet, or roles you want to revisit later.

## Repo layout

| Path | What |
| --- | --- |
| `src/`, `next.config.mjs`, `package.json` | Next.js 15 app at the repo root — deploys to Vercel with zero dashboard config |
| `agent/` | Node CLI that users install on their Mac |
| `packages/db/` | Drizzle schema + libSQL client |
| `packages/core/` | Site adapters + shared fetch helpers |

## Operator setup (one-time, by you)

1. **Turso DB** — free at <https://turso.tech>:
   ```bash
   turso db create job-tracker
   turso db show job-tracker --url        # → TURSO_DATABASE_URL
   turso db tokens create job-tracker     # → TURSO_AUTH_TOKEN
   ```
2. **Google OAuth** — credentials at <https://console.cloud.google.com/apis/credentials>. Authorized redirect URI: `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for dev).
3. **Public Git repo** — push this monorepo somewhere users can `git clone` it. The hosted `install.sh` clones from the URL you set in `JOBTRACKER_REPO_URL` (no default — required).
4. **Local install + push schema:**
   ```bash
   npm install
   cp .env.example .env.local              # fill in values
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push
   npm run dev
   ```
5. **Deploy to Vercel:** Import the GitHub repo in Vercel — it auto-detects Next.js at the repo root, no Root Directory override needed. Then set env vars in **Settings → Environment Variables**:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXTAUTH_URL`
   - `CRON_SECRET` (any random string — gates the cron endpoints)
   - `JOBTRACKER_REPO_URL` — the public Git URL the installer clones from
   - `JOBTRACKER_REPO_BRANCH` (optional, default `main`)

## End-user flow

1. Sign in with Google.
2. Create a portfolio (e.g., "NYC startups", "2027 internships").
3. Paste job URLs. The web fetches what it can statically (Greenhouse / Lever / Ashby / generic JSON-LD).
4. Optionally set status + target apply date per job.
5. **Optional Mac agent** — open `/agent` on the deployed site, mint a token, run:
   ```bash
   curl -fsSL https://YOUR-DOMAIN.vercel.app/install.sh | bash
   ```
   Paths default to `~/.jobtracker` but honor `$JOBTRACKER_HOME` if you want to relocate. To enable iMessage delivery, set `JOBTRACKER_IMESSAGE_TO=+15555550123` in `~/.jobtracker/agent/.env`.

### Why agent runs are coalesced on boot

The launchd plist uses `RunAtLoad=true` + `StartInterval=10800`. While the Mac is asleep / off, no `StartInterval` firings stack up — macOS just runs the agent **once** when the laptop wakes (via `RunAtLoad`), then resumes every-3-hour ticks. Exactly the "aggregate while off, single check on next boot" behavior.

## Adapters

| Site | Static (Vercel cron) | Browser (agent) |
| --- | --- | --- |
| Greenhouse | ✓ | – |
| Lever | ✓ | – |
| Ashby | ✓ | – |
| LinkedIn | – | ✓ |
| Generic (JSON-LD `JobPosting`) | ✓ | – |

Adding an adapter: implement `SiteAdapter` in [`packages/core/src/adapters/`](packages/core/src/adapters/) and register it in [`adapters/index.ts`](packages/core/src/adapters/index.ts).

## Privacy

- Each user's jobs are scoped by `user_id` and never returned across accounts.
- Agent tokens are stored hashed (sha256). The plaintext token is shown once at creation.
- The Mac agent sends its bearer token only to your configured `JOBTRACKER_API` host.

## Uninstall the agent

```bash
launchctl unload ~/Library/LaunchAgents/com.jobtracker.agent.plist
rm -rf "${JOBTRACKER_HOME:-$HOME/.jobtracker}" ~/Library/LaunchAgents/com.jobtracker.agent.plist
```
