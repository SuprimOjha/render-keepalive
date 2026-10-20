"use client";

import { useCallback, useEffect, useState } from "react";

type Check = {
  checkedAt: string;
  status: "online" | "offline" | "unconfigured" | string;
  httpStatus: number | null;
  latencyMs: number | null;
  endpointHost: string | null;
  error: string | null;
};

type History = { checks: Check[] };

const DATA_BASE =
  "https://raw.githubusercontent.com/SuprimOjha/render-keepalive/monitor-data";

function formatDate(value?: string | null) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function Home() {
  const [latest, setLatest] = useState<Check | null>(null);
  const [history, setHistory] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [statusResponse, historyResponse] = await Promise.all([
        fetch(`${DATA_BASE}/status.json?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`${DATA_BASE}/history.json?t=${Date.now()}`, { cache: "no-store" }),
      ]);

      if (!statusResponse.ok) {
        throw new Error("No monitoring data found yet. Run the GitHub Actions workflow once.");
      }

      const status = (await statusResponse.json()) as Check;
      setLatest(status);

      if (historyResponse.ok) {
        const data = (await historyResponse.json()) as History;
        setHistory(Array.isArray(data.checks) ? data.checks.slice(0, 20) : []);
      } else {
        setHistory([]);
      }

      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load monitoring data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const onlineCount = history.filter((check) => check.status === "online").length;
  const uptime =
    history.length > 0 ? Math.round((onlineCount / history.length) * 100) : null;
  const status = latest?.status ?? "unknown";

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Render Keepalive Monitor home">
          <span className="brand-mark">R</span>
          <span>Render<span className="brand-light">Monitor</span></span>
        </a>
        <a
          className="github-link"
          href="https://github.com/SuprimOjha/render-keepalive"
          target="_blank"
          rel="noreferrer"
        >
          View repository ↗
        </a>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> SERVICE OBSERVABILITY</div>
        <h1>Know when your<br /><span>service is responding.</span></h1>
        <p className="hero-copy">
          Scheduled HTTP health checks for Render services, with response-time
          measurements and a record of recent results.
        </p>
      </section>

      {loadError && (
        <div className="notice" role="status">
          <strong>Monitoring data unavailable</strong>
          <span>{loadError}</span>
          <span>Set the RENDER_URL repository secret, then run Actions → Render health check.</span>
        </div>
      )}

      <section className="section-heading">
        <div>
          <h2>Service overview</h2>
          <p>Checks are scheduled every 10 minutes by GitHub Actions.</p>
        </div>
        <button className="refresh-button" onClick={() => { setLoading(true); void refresh(); }}>
          ↻ Refresh
        </button>
      </section>

      <section className="metrics-grid">
        <article className="metric-card primary-card">
          <div className="metric-label">CURRENT STATUS</div>
          <div className="status-line">
            <span className={`status-dot ${status === "online" ? "green" : status === "offline" ? "red" : "gray"}`} />
            <span className="status-value">
              {loading ? "Checking…" : status === "online" ? "Responding" : status === "offline" ? "Unavailable" : status === "unconfigured" ? "Not configured" : "No data"}
            </span>
          </div>
          <div className="metric-foot">{latest?.endpointHost ?? "Configure RENDER_URL in repository secrets"}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">LAST RESPONSE TIME</div>
          <div className="metric-number">{latest?.latencyMs != null ? `${latest.latencyMs} ms` : "—"}</div>
          <div className="metric-foot">Measured by the latest check</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">HTTP STATUS CODE</div>
          <div className="metric-number">{latest?.httpStatus ?? "—"}</div>
          <div className="metric-foot">2xx and 3xx count as successful</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">RECENT SUCCESS RATE</div>
          <div className="metric-number">{uptime == null ? "—" : `${uptime}%`}</div>
          <div className="metric-foot">Based on {history.length} latest recorded checks</div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><h2>Recent checks</h2><p>Latest monitoring results</p></div>
            <span className="pill">{history.length} records</span>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">◷</span>
              <strong>No checks recorded yet</strong>
              <p>After configuring the secret, manually run the workflow in GitHub Actions.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>RESULT</th><th>TIME</th><th>HTTP</th><th>LATENCY</th></tr></thead>
                <tbody>
                  {history.map((check, index) => (
                    <tr key={`${check.checkedAt}-${index}`}>
                      <td><span className={`result-tag ${check.status === "online" ? "tag-online" : "tag-offline"}`}>{check.status === "online" ? "● Online" : check.status === "unconfigured" ? "○ Setup needed" : "● Offline"}</span></td>
                      <td>{formatDate(check.checkedAt)}</td>
                      <td>{check.httpStatus ?? "—"}</td>
                      <td>{check.latencyMs != null ? `${check.latencyMs} ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {latest?.error && <p className="error-text">Latest error: {latest.error}</p>}
        </article>

        <aside className="panel details-panel">
          <div className="panel-heading"><div><h2>Monitor details</h2><p>Configuration at a glance</p></div></div>
          <div className="detail-row"><span>Check interval</span><strong>10 minutes</strong></div>
          <div className="detail-row"><span>Scheduler</span><strong>GitHub Actions</strong></div>
          <div className="detail-row"><span>Last checked</span><strong>{formatDate(latest?.checkedAt)}</strong></div>
          <div className="detail-row"><span>Data branch</span><strong>monitor-data</strong></div>
          <div className="info-callout">
            <strong>Important about Render Free</strong>
            <p>Health checks help you observe availability, but they cannot guarantee that a free instance stays awake. Scheduled jobs can also be delayed.</p>
          </div>
          <a className="action-link" href="https://github.com/SuprimOjha/render-keepalive/actions" target="_blank" rel="noreferrer">
            Open workflow runs <span>↗</span>
          </a>
        </aside>
      </section>

      <footer className="footer">
        <span>Render Monitor <span className="footer-muted">· Built with Next.js</span></span>
        <span>Auto-refreshes dashboard every 60 seconds</span>
      </footer>
    </main>
  );
}
