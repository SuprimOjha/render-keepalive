# RenderMonitor — your own uptime monitoring platform

An UptimeRobot-inspired MVP built with Next.js, Supabase, Python, and GitHub Actions.

> **Reliability note:** GitHub Actions scheduling is best effort. Runs can be delayed or skipped, so this is a keepalive workaround—not guaranteed uptime or a real-time monitoring network.

## Render keepalive bot

The `Render keepalive` GitHub Actions workflow sends an HTTP GET request to your Render service every 10 minutes. It retries transient failures, records status/latency/attempts, and stores the latest status plus a rolling history on the `monitor-data` branch.

1. Open **Settings → Secrets and variables → Actions** in this repository.
2. Add a repository secret named `RENDER_URL`.
3. Set its value to the exact public URL of your Render backend, ideally a lightweight health endpoint such as `https://your-service.onrender.com/health`. If your backend has no health route, use its base URL.
4. Open **Actions → Render keepalive → Run workflow** to test it immediately.
5. View each run's summary and the `status.json` / `history.json` files on the `monitor-data` branch.

Do not add credentials or private tokens to the URL. The URL is stored as a GitHub secret, but the hostname can appear in the public status history if this repository is public.

### Keepalive behavior

- HTTP GET with a dedicated User-Agent and cache-bypass header.
- 20-second timeout per attempt and up to 3 attempts.
- 2xx and 3xx responses count as reachable; 4xx and 5xx responses count as unhealthy.
- Network errors are retried with a short increasing delay.
- Writes a concise GitHub Actions job summary for every run.
- Saves the latest result and the last 100 checks.
- Keeps the history branch separate from `main` so generated status files do not trigger the app's normal CI workflow.
- Fails the workflow when the endpoint remains unhealthy, while still attempting to publish the recorded result.

**Important:** Render Free services can sleep and take time to wake. A request every 10 minutes may help reduce sleeping, but GitHub Actions is not guaranteed to run exactly on schedule, and a successful response does not guarantee every application feature works.

## Uptime monitoring dashboard

### 1. Supabase
Create a project at https://supabase.com, then run `supabase/schema.sql` in SQL Editor.

### 2. Next.js
```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Open http://localhost:3000 and create an account.

### 3. Scheduler secrets
Add repository Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS: never put it in a `NEXT_PUBLIC_` variable or commit it. Manually run Actions → Monitor scheduler to test.

### 4. Deploy
Import the repo into Vercel and add the two `NEXT_PUBLIC_` variables. The database stores history; Vercel does not need local persistence.

### 5. Tests
Run `npm run test:python`, `npm run lint`, and `npm run build`. CI runs Python tests and a Next.js build.

## Production hardening

This is an MVP. Before allowing untrusted users at scale, add DNS-rebinding-resistant egress controls, rate limits, abuse prevention, incident deduplication, notifications, scheduler fairness, data retention, and independent probes. The dashboard scheduler checks active user-configured monitors separately from the Render keepalive bot.

## License
MIT
