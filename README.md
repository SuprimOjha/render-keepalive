# RenderMonitor

### A small project born from a real developer frustration.

I built RenderMonitor because I ran into a frustrating part of using Render's free tier: after a period without traffic, a web service can spin down. When I came back to test a project or show it to someone, I sometimes had to wait for the service to wake up before I could use it. Those few minutes felt like a long time when I was just trying to work on my projects.

I wanted to understand the problem better and build a small tool that could send periodic requests to a service, record the result, and make service status easier to see. That idea became **RenderMonitor**.

This project is built **for educational purposes**. It is my way of learning about web deployment, HTTP health checks, GitHub Actions automation, uptime monitoring, and building a useful developer tool from a problem I personally experienced.

> **A note on reliability:** This project is a learning tool, not a promise of uninterrupted uptime. Render may spin down free services after inactivity, and GitHub Actions schedules can be delayed or skipped. A scheduled ping can sometimes help wake a service, but it cannot guarantee that the service will never sleep.

---

## Project screenshots

I’ll add screenshots here as the interface develops. If you fork the project, you can replace these placeholders with your own screenshots.

<!-- Screenshot 1: Main dashboard -->
### Dashboard

<!-- Replace the placeholder below with an image path, for example: ![RenderMonitor dashboard](docs/images/dashboard.png) -->
**[Insert dashboard screenshot here]**

<!-- Screenshot 2: Add monitor dialog -->
### Add a monitor

<!-- Replace the placeholder below with an image path, for example: ![Add monitor dialog](docs/images/add-monitor.png) -->
**[Insert add-monitor screenshot here]**

<!-- Screenshot 3: GitHub Actions workflow result -->
### Keepalive workflow result

<!-- Replace the placeholder below with an image path, for example: ![GitHub Actions health check result](docs/images/workflow-result.png) -->
**[Insert workflow result screenshot here]**

---

## What it does

### Render keepalive bot

- Sends an HTTP GET request to a public endpoint on a scheduled GitHub Actions workflow.
- Retries some failed requests and records the timestamp, HTTP status, response time, and error details.
- Publishes the latest status and rolling check history to a separate `monitor-data` branch.
- Lets you run the check manually from the GitHub Actions tab.

### Interactive uptime dashboard

- Email/password sign-up and sign-in through Supabase.
- Add, edit, pause, resume, and delete monitors.
- Test an endpoint before saving it.
- Search monitors and filter by status.
- Review recent check history, response latency, and activity.
- Export recorded check history to CSV.
- Uses Supabase Row Level Security to help isolate users' data.

The dashboard scheduler and the standalone Render keepalive workflow are separate features. The keepalive bot only needs the `RENDER_URL` secret; it does not need Supabase.

---

## Try the keepalive bot with your own service

**Fork this repository first.** Each user needs their own copy of the repository and must configure their own GitHub Actions secrets. Secrets are not copied when a repository is forked.

### Step 1 — Fork the repository

Click **Fork** on GitHub:

**[Fork RenderMonitor](https://github.com/SuprimOjha/render-keepalive/fork)**

### Step 2 — Add your Render URL

In your fork, open:

**Settings → Secrets and variables → Actions → New repository secret**

Create a secret with:

- **Name:** `RENDER_URL`
- **Value:** the public URL of your own Render service, preferably a health endpoint that should return a successful response.

For example, if your app is a FastAPI service and OpenAPI is enabled, you can try:

```text
https://your-service.onrender.com/openapi.json
```

If your backend has a dedicated `/health` or `/healthz` endpoint, prefer that. The correct path depends on your application.

### Step 3 — Enable and run the workflow

1. Open **Settings → Actions → General** in your fork and make sure GitHub Actions are enabled.
2. Check that workflow permissions allow the workflow to publish its status files to the `monitor-data` branch.
3. Open **Actions → Render keepalive → Run workflow** to test it.
4. Open the run summary to see the result.
5. The workflow stores `status.json` and `history.json` on the `monitor-data` branch.

The scheduled workflow is configured to run periodically, but GitHub Actions does not guarantee exact execution times.

### Which endpoint should I use?

A URL returning HTTP 404 means that the requested route was not found; it does not by itself mean the server is asleep. A response from the host means the request reached a server, but a 404 is not a successful health check. Configure a route that actually exists and returns a successful response, then test it manually.

---

## Run the dashboard locally

### Requirements

- Node.js and npm
- A free [Supabase](https://supabase.com) project
- Git

### 1. Clone your fork

Replace `YOUR_GITHUB_USERNAME` with your GitHub username:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/render-keepalive.git
cd render-keepalive
npm install
```

### 2. Configure Supabase

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run the SQL in `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the following public frontend variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Start the development server:

```bash
npm run dev
```

6. Visit [http://localhost:3000](http://localhost:3000).

**Security:** Never commit `.env.local` or expose your Supabase service-role key in a `NEXT_PUBLIC_` variable. The service-role key bypasses Row Level Security and should only be used in trusted server-side or GitHub Actions contexts that need it.

### Optional: dashboard scheduler

If you want to run the separate dashboard monitor scheduler, configure these repository Actions secrets in your fork:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The standalone Render keepalive workflow only requires `RENDER_URL`.

### Deploy the dashboard

You can import your fork into [Vercel](https://vercel.com). Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as project environment variables, then deploy. Configure GitHub Actions secrets separately in your fork.

---

## Tech stack

- **Frontend:** Next.js, React, TypeScript, CSS
- **Database and authentication:** Supabase
- **Automation:** GitHub Actions
- **Health-check script:** Python

## Run checks locally

```bash
npm run test:python
npm run lint
npm run build
```

## Limitations and responsible use

- GitHub Actions schedules are best-effort and can be delayed or skipped.
- Render free services may spin down after inactivity; this bot cannot guarantee uninterrupted uptime or eliminate every cold start.
- Monitoring checks only the configured URL and cannot prove that every part of an application is functioning correctly.
- This repository is an educational starter, not a hardened production monitoring service. Before opening it to untrusted users at scale, add stronger SSRF/egress protection, rate limiting, abuse prevention, notification handling, retention policies, and independent monitoring.
- Use automation responsibly and follow the usage terms of the services you depend on.

## Why I made it

I made this because I wanted to solve a small but real annoyance in my own development workflow, while learning how real-world monitoring tools work. If it helps someone else learn about deployments, health checks, and automation too, that’s a bonus.

If you try it, find a bug, or have an idea for improving it, feel free to open an issue or contribute.

## License

MIT
