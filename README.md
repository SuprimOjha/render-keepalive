# Render Keepalive Monitor

A Next.js dashboard and GitHub Actions workflow for scheduled health checks of Render web services. It records HTTP availability, response time, and recent check history.

> **Important:** This is an uptime-monitoring project, not a guarantee that a Render Free service will remain awake. Scheduled GitHub Actions runs can be delayed, and providers may apply their own free-tier restrictions. Use a hosting plan that supports always-on services if you need guaranteed availability.

## Features

- Scheduled health checks every 10 minutes using GitHub Actions
- Manual checks through the Actions tab
- HTTP status and response-time measurements
- A lightweight Next.js dashboard with recent history
- Monitoring data stored on a separate `monitor-data` branch so data updates do not trigger a Vercel deployment from `main`
- No database required

## Setup

### 1. Target Render API

The workflow is preconfigured to check:

`https://nepal-vegetation-lag-api.onrender.com/`

You do not need to add a secret to start checking this service. The workflow treats any HTTP response below 400 as a successful response; if the root path returns 404, configure `RENDER_URL` as a repository secret with the correct public health endpoint.

To monitor a different URL or override the default, open **Settings → Secrets and variables → Actions → New repository secret**:

- **Name:** `RENDER_URL`
- **Value:** The full public health-check URL.

Use a lightweight health endpoint that returns a successful HTTP status. Do not put credentials or private tokens in the URL.

### 2. Enable Actions write permission

Open **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save. The workflow needs this to update the `monitor-data` branch.

### 3. Run the workflow once

Open **Actions → Render health check → Run workflow**. The workflow will create/update the `monitor-data` branch with `status.json` and `history.json`.

Scheduled runs use the cron expression `*/10 * * * *` (every 10 minutes, UTC). GitHub Actions scheduling is best-effort and may be delayed, so it is not a precision scheduler.

### 4. Run the dashboard locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The dashboard reads the latest status from this repository's public `monitor-data` branch. If the workflow has not run yet, it will show setup guidance.

### 5. Deploy the dashboard (optional)

Import this repository into Vercel and deploy the `main` branch. The workflow writes monitoring data to `monitor-data`, not `main`, to avoid triggering a deployment on every check.

## Files

- `.github/workflows/health-check.yml` — scheduled workflow
- `scripts/check_render.py` — makes the HTTP request and updates check history
- `app/page.tsx` — monitoring dashboard
- `app/globals.css` — dashboard styles

## Troubleshooting

- **Unconfigured:** Add the `RENDER_URL` repository secret.
- **No data yet:** Run the workflow manually from the Actions tab.
- **Permission denied on push:** Enable workflow read/write permissions in repository settings.
- **Offline result:** Check the URL, endpoint health, and workflow logs.
- **Render still sleeps:** Scheduled requests do not guarantee that a Free instance remains awake. Check Render's current plan policies and use an always-on plan if required.

## License

MIT
