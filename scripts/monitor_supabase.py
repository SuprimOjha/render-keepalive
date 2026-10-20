#!/usr/bin/env python3
"""Run due HTTP checks from Supabase. Uses only Python's standard library."""
import json, os, socket, time, ipaddress
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener\n\nclass NoRedirect(HTTPRedirectHandler):\n    """Never follow user-controlled redirects to avoid redirect-based SSRF."""\n    def redirect_request(self, req, fp, code, msg, headers, newurl):\n        return None\n\nSAFE_OPENER = build_opener(NoRedirect())

API = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MAX_CHECKS = int(os.environ.get("MAX_CHECKS_PER_RUN", "50"))

def headers(prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    return h

def request_json(url, method="GET", data=None, extra_headers=None, timeout=15):
    h = headers()
    if extra_headers: h.update(extra_headers)
    payload = json.dumps(data).encode() if data is not None else None
    req = Request(url, data=payload, headers=h, method=method)
    with urlopen(req, timeout=timeout) as response:
        raw = response.read()
        return json.loads(raw) if raw else None

def validate_public_url(value):
    p = urlparse(value)
    if p.scheme not in ("http", "https") or not p.hostname or p.username or p.password:
        raise ValueError("Only public HTTP(S) URLs are allowed")
    host = p.hostname.lower()
    if host in ("localhost", "metadata.google.internal") or host.endswith((".local", ".localhost", ".internal")):
        raise ValueError("Local host blocked")
    for info in socket.getaddrinfo(host, p.port or (443 if p.scheme == "https" else 80), type=socket.SOCK_STREAM):
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ValueError("Private or non-global address blocked")
    return value

def check(url):
    start = time.monotonic()
    status_code, error = None, None
    try:
        safe = validate_public_url(url)
        req = Request(safe, headers={"User-Agent": "RenderMonitor/1.0", "Accept": "*/*"}, method="GET")
        try:
            with SAFE_OPENER.open(req, timeout=12) as response:
                status_code = response.status
                response.read(512)
        except HTTPError as exc:
            status_code = exc.code
            exc.read(512)
        latency = round((time.monotonic() - start) * 1000)
        return status_code, latency, status_code < 400, None if status_code < 400 else f"HTTP {status_code}"
    except Exception as exc:
        return status_code, round((time.monotonic() - start) * 1000), False, str(exc)[:240]

def main():
    if not API or not KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets.")
    due = request_json(f"{API}/rest/v1/monitors?select=id,user_id,url,interval_minutes,last_checked_at&is_active=eq.true&order=last_checked_at.asc.nullsfirst&limit={MAX_CHECKS}")
    now = datetime.now(timezone.utc)
    count = 0
    for monitor in due or []:
        last = monitor.get("last_checked_at")
        if last:
            try:
                last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                if (now - last_dt).total_seconds() < int(monitor.get("interval_minutes", 10)) * 60:
                    continue
            except ValueError:
                pass
        code, latency, is_up, error = check(monitor["url"])
        checked_at = datetime.now(timezone.utc).isoformat()
        row = {"monitor_id": monitor["id"], "user_id": monitor["user_id"], "status_code": code,
               "latency_ms": latency, "is_up": is_up, "error": error, "checked_at": checked_at}
        request_json(f"{API}/rest/v1/monitor_checks", "POST", row, {"Prefer": "return=minimal"})
        request_json(f"{API}/rest/v1/monitors?id=eq.{monitor['id']}", "PATCH",
                     {"last_status": "up" if is_up else "down", "last_checked_at": checked_at},
                     {"Prefer": "return=minimal"})
        print(f"{monitor['id']}: {'UP' if is_up else 'DOWN'} {code} {latency}ms")
        count += 1
    print(f"Completed {count} due checks.")

if __name__ == "__main__":
    main()
