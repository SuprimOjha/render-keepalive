# RenderMonitor — your own uptime monitoring platform

An UptimeRobot-inspired starter built with Next.js, Supabase, Python, and GitHub Actions. The dashboard supports account sign-in, adding/editing/pausing/deleting monitors, endpoint tests, search and status filters, recent check history, and CSV export.

> **Reliability note:** GitHub Actions schedules are best-effort. Runs may be delayed or skipped. This is a lightweight keepalive/monitoring starter, not a guarantee of uninterrupted uptime or a real-time monitoring network.

## Quick start: use the keepalive bot for your own Render service

**You should fork this repository into your own GitHub account.** The workflow runs in the repository where it is installed, and each user must configure their own secret. Forking does not copy repository Actions secrets.

1. **Fork this repo:** open [the GitHub fork page](https://github.com/SuprimOjha/render-keepalive/fork) and create your own copy. Use your fork for the remaining steps.
2. **Check Actions permissions:** in your fork, open **Settings → Actions → General**. Ensure Actions are enabled and the workflow has permission to create and push repository contents (the workflow publishes status history to a `monitor-data` branch).
3. **Add your endpoint secret:** open **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `RENDER_URL`
   - Value: your public Render service URL, for example `https://your-service.onrender.com/openapi.json` for a FastAPI app with OpenAPI enabled.
   - Do not include passwords, access tokens, or other credentials in the URL.
4. **Run it once:** open **Actions → Render keepalive → Run workflow**. If GitHub asks you to enable workflows in the fork, enable them first.
5. **Read the result:** open the run summary. The latest status and rolling history are published to the `monitor-data` branch as `status.json` and `history.json`.
6. **Check the schedule:** the workflow is configured for a scheduled run. GitHub may delay or skip scheduled runs; check the Actions tab to confirm it is running.

### What URL should I use?

- For FastAPI, try `https://your-service.onrender.com/openapi.json` if the OpenAPI route is enabled.
- Prefer a small, explicit `/health` route if your application provides one.
- A root URL returning HTTP 404 means that the requested path was not found. It does **not** prove the service is asleep. A responding 404 proves the host answered, but does not prove the application is healthy.
- If a service returns 404 on all expected routes, inspect your backend routes and deployment logs before changing the monitor.

### Keepalive behavior and limits

- Sends an HTTP GET with a dedicated User-Agent and cache-bypass header.
- Uses bounded retries and records timestamp, HTTP status, latency, attempts, and errors.
- Writes a concise GitHub Actions summary for every run.
- Publishes the latest result and a rolling history to the separate `monitor-data` branch.
- Render Free web services may spin down after inactivity and take time to wake. A keepalive request can help trigger a sleeping service, but GitHub Actions is not guaranteed to run at the exact scheduled minute. It cannot guarantee that the service never sleeps.
- If a cold start exceeds the timeout, increase the timeout/retry settings in the workflow. Do not make the schedule excessively frequent; respect your hosting provider's terms and usage limits.

## Interactive monitoring dashboard

The Next.js dashboard includes:
- Supabase email/password sign-up and sign-in.
- Create, edit, pause/resume, and delete monitors.
- Test a public HTTP(S) URL before saving.
- Search and filter by operational, incident, or paused status.
- Uptime summary, recent response latency, recent check outcome bars, and activity list.
- Export check history to CSV.
- User-isolated data through Supabase Row Level Security (RLS).

### 1. Fork and clone

Fork this repository to your GitHub account, then clone your fork:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/render-keepalive.git
cd render-keepalive
npm install
```

### 2. Configure Supabase

1. Create a project at [Supabase](https://supabase.com).
2. Open the Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
5. Start locally with `npm run dev` and open [http://localhost:3000](http://localhost:3000).

Keep the Supabase service-role key private. Never place it in a `NEXT_PUBLIC_` variable or commit it to Git.

### 3. Configure the dashboard scheduler (optional)

If you use the separate dashboard monitor scheduler, configure the repository Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS, so store it only as a GitHub Actions secret. Manually run **Actions → Monitor scheduler** to test it.

The standalone Render keepalive workflow only requires `RENDER_URL`; it does not need Supabase.

### 4. Deploy the frontend

Import your fork into [Vercel](https://vercel.com) and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables. Deploy the project. Configure any workflow secrets separately in your fork—GitHub secrets are not copied from the upstream repository.

### 5. Test locally

```bash
npm run test:python
npm run lint
npm run build
```

## Security and production readiness

This is a starter/MVP. Before allowing untrusted users at scale, add DNS-rebinding-resistant egress controls, rate limits, abuse prevention, incident deduplication, notifications, scheduler fairness, retention policies, and independent probes. A public endpoint tester must be hardened against SSRF before production use. The dashboard scheduler and the standalone Render keepalive workflow are separate features.

## License

MIT
