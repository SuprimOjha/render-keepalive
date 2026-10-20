"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, type Monitor, type MonitorCheck } from "../lib/supabase";

type TestResult = { ok: boolean; statusCode?: number; latencyMs?: number; error?: string };
const intervals = [5, 10, 15, 30, 60];
const when = (v: string | null) => v ? new Date(v).toLocaleString() : "Not checked yet";
const hostname = (v: string) => { try { return new URL(v).hostname; } catch { return v; } };

export default function Home() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [checks, setChecks] = useState<MonitorCheck[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(10);
  const [formMessage, setFormMessage] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user) return;
    setLoading(true); setError("");
    const [mr, cr] = await Promise.all([
      supabase.from("monitors").select("*").order("created_at", { ascending: false }),
      supabase.from("monitor_checks").select("*").order("checked_at", { ascending: false }).limit(500),
    ]);
    if (mr.error) setError(mr.error.message);
    else {
      const list = (mr.data ?? []) as Monitor[];
      setMonitors(list);
      setSelectedId((old) => old && list.some((m) => m.id === old) ? old : list[0]?.id ?? null);
    }
    if (cr.error) setError((old) => old || cr.error.message);
    else setChecks((cr.data ?? []) as MonitorCheck[]);
    setLoading(false);
  }, [supabase, session]);
  useEffect(() => { void loadData(); }, [loadData]);

  const filtered = useMemo(() => monitors.filter((m) => {
    const matchText = (m.name + " " + m.url).toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "all" || (filter === "up" && m.is_active && m.last_status === "up") ||
      (filter === "down" && m.is_active && m.last_status === "down") || (filter === "paused" && !m.is_active);
    return matchText && matchStatus;
  }), [monitors, search, filter]);
  const active = monitors.filter((m) => m.is_active);
  const up = active.filter((m) => m.last_status === "up").length;
  const down = active.filter((m) => m.last_status === "down").length;
  const selected = monitors.find((m) => m.id === selectedId) ?? null;
  const selectedChecks = checks.filter((c) => c.monitor_id === selectedId).slice(0, 30);
  const latencyValues = selectedChecks.filter((c) => c.latency_ms !== null);
  const avg = latencyValues.length ? Math.round(latencyValues.reduce((n, c) => n + (c.latency_ms ?? 0), 0) / latencyValues.length) : null;
  const success = checks.length ? Math.round(checks.filter((c) => c.is_up).length / checks.length * 100) : null;

  async function authenticate(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setAuthMessage("");
    const r = authMode === "signup" ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (r.error) setAuthMessage(r.error.message);
    else if (authMode === "signup" && !r.data.session) setAuthMessage("Account created. Check your email to confirm it, then sign in.");
    else setAuthMessage("Signed in successfully.");
  }
  async function signOut() { if (supabase) { await supabase.auth.signOut(); setMonitors([]); setChecks([]); } }
  function openNew() { setEditing(null); setName(""); setUrl(""); setInterval(10); setTest(null); setFormMessage(""); setModal(true); }
  function openEdit(m: Monitor) { setEditing(m.id); setName(m.name); setUrl(m.url); setInterval(m.interval_minutes); setTest(null); setFormMessage(""); setModal(true); }

  async function testUrl() {
    setTesting(true); setTest(null); setFormMessage("");
    try {
      const r = await fetch("/api/check-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await r.json() as TestResult;
      if (!r.ok) setFormMessage(data.error || "Could not test URL."); else setTest(data);
    } catch { setFormMessage("Network error while testing this URL."); }
    finally { setTesting(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    setSaving(true); setFormMessage("");
    try {
      const normalized = new URL(url).toString();
      if (!["http:", "https:"].includes(new URL(normalized).protocol)) throw new Error("Use an HTTP or HTTPS URL.");
      const values = { name: name.trim(), url: normalized, interval_minutes: interval };
      const r = editing ? await supabase.from("monitors").update(values).eq("id", editing).select().single()
        : await supabase.from("monitors").insert({ ...values, user_id: session.user.id }).select().single();
      if (r.error) throw new Error(r.error.message);
      setModal(false); setNotice(editing ? "Monitor updated." : "Monitor created."); setSelectedId((r.data as Monitor).id);
      await loadData();
    } catch (err) { setFormMessage(err instanceof Error ? err.message : "Could not save monitor."); }
    finally { setSaving(false); }
  }
  async function toggle(m: Monitor) {
    if (!supabase) return; setBusy(m.id);
    const r = await supabase.from("monitors").update({ is_active: !m.is_active }).eq("id", m.id);
    if (r.error) setError(r.error.message); else { setNotice(m.is_active ? "Monitor paused." : "Monitor resumed."); await loadData(); }
    setBusy(null);
  }
  async function remove(m: Monitor) {
    if (!supabase || !window.confirm(`Delete “${m.name}” and its history? This cannot be undone.`)) return;
    setBusy(m.id); const r = await supabase.from("monitors").delete().eq("id", m.id);
    if (r.error) setError(r.error.message);
    else { setNotice("Monitor deleted."); await loadData(); }
    setBusy(null);
  }
  function exportCsv() {
    const rows = [["Monitor", "URL", "Status", "HTTP", "Latency ms", "Checked at", "Error"],
      ...checks.map((c) => { const m = monitors.find((x) => x.id === c.monitor_id); return [m?.name ?? c.monitor_id, m?.url ?? "", c.is_up ? "UP" : "DOWN", c.status_code ?? "", c.latency_ms ?? "", c.checked_at, c.error ?? ""]; })];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "render-monitor-history.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  if (!ready) return <main className="setup-screen"><div className="loading-orb" /><p>Loading RenderMonitor…</p></main>;
  if (!supabase) return <main className="setup-screen"><section className="setup-card">
    <div className="brand"><span className="brand-mark">R</span><span>Render<span className="brand-light">Monitor</span></span></div>
    <div className="eyebrow"><span className="eyebrow-dot" /> YOUR OWN UPTIME PLATFORM</div><h1>Your services.<br /><span>Under watch.</span></h1>
    <p className="hero-copy">Connect Supabase to enable accounts, persistent monitors, and check history.</p>
    <ol className="setup-steps"><li><b>1.</b><span>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>.</span></li>
      <li><b>2.</b><span>Run <code>supabase/schema.sql</code> in its SQL Editor.</span></li><li><b>3.</b><span>Copy <code>.env.example</code> to <code>.env.local</code> and set the project URL and anon key.</span></li>
      <li><b>4.</b><span>Add <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> as GitHub Actions secrets.</span></li></ol>
    <a className="button button-primary setup-link" href="https://github.com/SuprimOjha/render-keepalive">Open repository ↗</a>
  </section></main>;
  if (!session) return <main className="setup-screen"><section className="auth-card">
    <div className="brand"><span className="brand-mark">R</span><span>Render<span className="brand-light">Monitor</span></span></div><div className="eyebrow"><span className="eyebrow-dot" /> UPTIME, MADE VISIBLE</div>
    <h1>{authMode === "login" ? "Welcome back." : "Start monitoring."}</h1><p className="hero-copy">Keep an eye on the services your projects depend on.</p>
    <form className="stack-form" onSubmit={authenticate}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" required minLength={8} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      {authMessage && <p className="inline-message">{authMessage}</p>}<button className="button button-primary" type="submit">{authMode === "login" ? "Sign in" : "Create account"} →</button></form>
    <p className="auth-switch">{authMode === "login" ? "New here?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthMessage(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
    <p className="auth-foot">Your data is isolated with Supabase Row Level Security.</p>
  </section></main>;

  return <main className="app-shell">
    <aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">R</span><span>Render<span className="brand-light">Monitor</span></span></a>
      <div className="side-section-label">WORKSPACE</div><button className="nav-item nav-active" onClick={() => setFilter("all")}>▦ &nbsp; Overview <span className="nav-count">{monitors.length}</span></button>
      <button className="nav-item" onClick={() => { setFilter("down"); document.getElementById("monitor-list")?.scrollIntoView({ behavior: "smooth" }); }}>◉ &nbsp; Incidents <span className="nav-count">{down}</span></button>
      <button className="nav-item" onClick={exportCsv}>⇩ &nbsp; Export history</button>
      <div className="sidebar-bottom"><div className="plan-box"><b>✦ &nbsp; Free workspace</b><p>Monitoring for makers and small projects.</p><span className="plan-meter"><i style={{ width: `${Math.min(monitors.length * 10, 100)}%` }} /></span><small>{monitors.length} monitors · suggested MVP limit 10</small></div>
        <div className="user-chip"><span className="avatar">{(session.user.email ?? "U")[0].toUpperCase()}</span><span className="user-text"><b>{session.user.email}</b><small>Personal workspace</small></span><button onClick={signOut} title="Sign out" aria-label="Sign out">↗</button></div></div>
    </aside>
    <section className="main-area"><header className="app-topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="live-label"><i /> Monitor service</span><button className="button button-primary compact" onClick={openNew}>＋ Add monitor</button></div></header>
      <div className="dashboard-content"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> LIVE SERVICE HEALTH</div><h1>Your uptime, at a glance.</h1><p>One calm place to see what’s working and what needs attention.</p></div><button className="button button-quiet" onClick={() => void loadData()} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh data"}</button></div>
        {(error || notice) && <div className={error ? "toast toast-error" : "toast"} role="status"><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
        <section className="stats-grid"><article className="stat-card"><div className="stat-head">ACTIVE MONITORS <span className="stat-icon violet">⌁</span></div><div className="stat-value">{active.length}<small> / 10</small></div><div className="stat-note">{monitors.length - active.length} paused · {monitors.length} total</div></article>
          <article className="stat-card"><div className="stat-head">OPERATIONAL <span className="stat-icon green-icon">✓</span></div><div className="stat-value">{up}<small> services</small></div><div className="stat-note"><span className="note-green">●</span> Last recorded status</div></article>
          <article className="stat-card"><div className="stat-head">ACTIVE INCIDENTS <span className="stat-icon red-icon">!</span></div><div className="stat-value">{down}<small> services</small></div><div className="stat-note"><span className={down ? "note-red" : "note-green"}>●</span> {down ? "Needs attention" : "No recorded outages"}</div></article>
          <article className="stat-card"><div className="stat-head">RECENT SUCCESS RATE <span className="stat-icon blue-icon">↗</span></div><div className="stat-value">{success === null ? "—" : `${success}%`}</div><div className="stat-note">Based on {checks.length} latest checks</div></article></section>
        <section className="monitor-section" id="monitor-list"><div className="section-title-row"><div><h2>Your monitors <span className="count-badge">{monitors.length}</span></h2><p>Manage endpoints and inspect recent performance.</p></div><button className="button button-secondary compact" onClick={openNew}>＋ New monitor</button></div>
          <div className="monitor-toolbar"><label className="search-box">⌕ <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search monitors or URLs…" /></label><div className="filter-tabs">{(["all", "up", "down", "paused"]).map((f) => <button key={f} className={filter === f ? "filter-active" : ""} onClick={() => setFilter(f)}>{({ all: "All", up: "Operational", down: "Incidents", paused: "Paused" } as Record<string,string>)[f]}</button>)}</div></div>
          {loading && !monitors.length ? <div className="empty-panel">Loading monitors…</div> : !filtered.length ? <div className="empty-panel"><span className="empty-illustration">⌁</span><h3>{monitors.length ? "No monitors match this view" : "Your first monitor starts here"}</h3><p>{monitors.length ? "Try a different filter or search." : "Add a public website or API URL to start collecting history."}</p>{!monitors.length && <button className="button button-primary" onClick={openNew}>＋ Add your first monitor</button>}</div> :
            <div className="monitor-table-wrap"><table className="monitor-table"><thead><tr><th>MONITOR</th><th>STATUS</th><th>INTERVAL</th><th>LAST CHECKED</th><th>LATENCY</th><th>ACTIONS</th></tr></thead><tbody>
              {filtered.map((m) => { const c = checks.find((x) => x.monitor_id === m.id); return <tr key={m.id} className={selectedId === m.id ? "selected-row" : ""} onClick={() => setSelectedId(m.id)}>
                <td><div className="monitor-name-cell"><span className={`service-mark ${!m.is_active ? "mark-paused" : m.last_status === "up" ? "mark-up" : m.last_status === "down" ? "mark-down" : "mark-pending"}`}>{!m.is_active ? "Ⅱ" : m.last_status === "up" ? "✓" : m.last_status === "down" ? "!" : "·"}</span><span className="monitor-labels"><b>{m.name}</b><small>{hostname(m.url)}</small></span></div></td>
                <td><span className={`status-pill ${!m.is_active ? "paused-pill" : m.last_status === "up" ? "up-pill" : m.last_status === "down" ? "down-pill" : "pending-pill"}`}><i />{!m.is_active ? "Paused" : m.last_status === "up" ? "Operational" : m.last_status === "down" ? "Down" : "Pending"}</span></td>
                <td>Every {m.interval_minutes} min</td><td>{when(m.last_checked_at)}</td><td>{c?.latency_ms == null ? "—" : `${c.latency_ms} ms`}</td>
                <td><div className="row-actions"><button title="Edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); openEdit(m); }}>✎</button><button title={m.is_active ? "Pause" : "Resume"} aria-label={m.is_active ? "Pause" : "Resume"} disabled={busy === m.id} onClick={(e) => { e.stopPropagation(); void toggle(m); }}>{m.is_active ? "Ⅱ" : "▶"}</button><button title="Delete" aria-label="Delete" disabled={busy === m.id} onClick={(e) => { e.stopPropagation(); void remove(m); }}>⌫</button></div></td>
              </tr>; })}</tbody></table></div>}
          <div className="table-foot"><span>Showing {filtered.length} of {monitors.length} monitors</span><span><i className="tiny-green" /> Supabase workspace data</span></div>
        </section>
        <section className="lower-grid"><article className="surface-card"><div className="section-title-row"><div><h2>Performance snapshot</h2><p>{selected?.name ?? "Select a monitor"}</p></div><span className="soft-chip">Recent checks</span></div>
          {selected ? <><div className="performance-numbers"><div><small>AVERAGE RESPONSE</small><b>{avg === null ? "—" : `${avg} ms`}</b></div><div><small>RECENT CHECKS</small><b>{selectedChecks.length}</b></div><div><small>SUCCESS RATE</small><b>{selectedChecks.length ? Math.round(selectedChecks.filter((c) => c.is_up).length / selectedChecks.length * 100) + "%" : "—"}</b></div></div>
            <div className="history-bars" aria-label="Recent check outcomes">{[...selectedChecks].reverse().slice(-24).map((c) => <span key={c.id} title={`${when(c.checked_at)} · ${c.is_up ? "Up" : "Down"}`} className={c.is_up ? "bar-up" : "bar-down"} />)}{!selectedChecks.length && <p>No checks recorded yet.</p>}</div><div className="chart-legend"><span><i className="tiny-green" /> Successful</span><span><i className="tiny-red" /> Failed</span></div></> : <div className="empty-small">Add or select a monitor to inspect it.</div>}</article>
          <article className="surface-card"><div className="section-title-row"><div><h2>Latest activity</h2><p>Recent check events across your monitors</p></div><span className="soft-chip">{checks.length} checks</span></div>
            {checks.length ? <div className="activity-list">{checks.slice(0,5).map((c) => <div className="activity-item" key={c.id}><span className={c.is_up ? "activity-icon activity-up" : "activity-icon activity-down"}>{c.is_up ? "✓" : "!"}</span><div><b>{monitors.find((m) => m.id === c.monitor_id)?.name ?? "Monitor"}</b><p>{c.is_up ? "Health check succeeded" : c.error || "Health check failed"}</p><small>{when(c.checked_at)}</small></div><span className={c.is_up ? "activity-code code-up" : "activity-code code-down"}>{c.status_code ?? "ERR"}</span></div>)}</div> : <div className="empty-small">Activity appears after the scheduler records its first check.</div>}</article></section>
        <footer className="app-footer"><span>RenderMonitor · Built for independent builders</span><span><i className="tiny-green" /> Supabase · GitHub Actions</span></footer>
      </div>
    </section>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section className="monitor-modal" role="dialog" aria-modal="true" aria-labelledby="monitor-form-title">
      <div className="modal-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> MONITOR CONFIGURATION</div><h2 id="monitor-form-title">{editing ? "Edit monitor" : "Add a monitor"}</h2><p>Use a public endpoint reachable over HTTP or HTTPS.</p></div><button className="modal-close" onClick={() => setModal(false)} aria-label="Close">×</button></div>
      <form className="stack-form" onSubmit={save}><label>Monitor name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Production API" /></label>
        <label>Website or API URL<input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} required placeholder="https://api.example.com/health" /></label>
        <div className="form-help">Use a public HTTP(S) URL. The test endpoint blocks common private/local addresses; this is not a complete production SSRF defense.</div>
        <div className="test-url-row"><button type="button" className="button button-secondary" disabled={!url || testing} onClick={() => void testUrl()}>{testing ? "Testing…" : "↗ Test URL"}</button>{test && <span className={test.ok ? "test-success" : "test-failure"}>{test.ok ? "✓ Reachable" : "✕ Unavailable"} · HTTP {test.statusCode} · {test.latencyMs} ms</span>}</div>
        <label>Check interval<select value={interval} onChange={(e) => setInterval(Number(e.target.value))}>{intervals.map((n) => <option value={n} key={n}>Every {n} minutes</option>)}</select></label>
        <div className="form-help">GitHub Actions runs on a best-effort schedule. The chosen interval is a target, not a real-time guarantee.</div>
        {formMessage && <p className="inline-message">{formMessage}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create monitor"} →</button></div>
      </form>
    </section></div>}
  </main>;
}
