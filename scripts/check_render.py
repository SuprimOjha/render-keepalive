#!/usr/bin/env python3
"""Best-effort Render keepalive check with retrying and JSON history output."""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

MAX_HISTORY = 100
USER_AGENT = "RenderMonitor-Keepalive/2.0"


def now_iso():
    """Return an RFC 3339 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_history(path, max_history=MAX_HISTORY):
    """Load existing history defensively and cap its length."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        checks = data.get("checks", []) if isinstance(data, dict) else []
        if not isinstance(checks, list):
            return []
        return checks[:max_history]
    except (OSError, json.JSONDecodeError, AttributeError):
        return []


def validate_url(value):
    """Accept only absolute HTTP(S) URLs without embedded credentials."""
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("RENDER_URL must be an absolute HTTP or HTTPS URL.")
    if parsed.username or parsed.password:
        raise ValueError("RENDER_URL must not contain embedded credentials.")
    if parsed.hostname.lower() in ("localhost", "metadata.google.internal") or parsed.hostname.lower().endswith((".local", ".localhost", ".internal")):
        raise ValueError("RENDER_URL must point to a public host, not a local address.")
    try:
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("RENDER_URL contains an invalid port.") from exc
    return parsed


def check_url(url, timeout=20, retries=3, retry_delay=2):
    """Probe an endpoint with bounded retries; return a serializable result."""
    parsed = validate_url(url)
    result = {
        "checkedAt": now_iso(),
        "status": "offline",
        "httpStatus": None,
        "latencyMs": None,
        "endpointHost": parsed.hostname,
        "attempts": 0,
        "error": None,
    }
    last_error = None
    for attempt in range(1, retries + 1):
        result["attempts"] = attempt
        started = time.monotonic()
        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "*/*", "Cache-Control": "no-cache"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result["httpStatus"] = response.status
                response.read(1024)
            result["latencyMs"] = round((time.monotonic() - started) * 1000)
            result["status"] = "online" if 200 <= result["httpStatus"] < 400 else "offline"
            last_error = None if result["status"] == "online" else f"Endpoint returned HTTP {result['httpStatus']}."
        except urllib.error.HTTPError as exc:
            result["httpStatus"] = exc.code
            result["latencyMs"] = round((time.monotonic() - started) * 1000)
            try:
                exc.read(1024)
            except Exception:
                pass
            last_error = f"Endpoint returned HTTP {exc.code}."
            if 200 <= exc.code < 400:
                result["status"] = "online"
                last_error = None
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            result["latencyMs"] = round((time.monotonic() - started) * 1000)
            reason = getattr(exc, "reason", exc)
            last_error = f"{type(reason).__name__}: {reason}"[:240]
        except Exception as exc:
            result["latencyMs"] = round((time.monotonic() - started) * 1000)
            last_error = f"{type(exc).__name__}: {exc}"[:240]

        if result["status"] == "online":
            result["error"] = None
            return result
        if attempt < retries:
            time.sleep(retry_delay * attempt)

    result["error"] = last_error or "Endpoint did not return a successful HTTP status."
    return result


def main():
    parser = argparse.ArgumentParser(description="Wake a Render service and save its health-check history.")
    parser.add_argument("--output-dir", default=".", help="Directory for status.json and history.json")
    parser.add_argument("--timeout", type=int, default=20, help="Seconds allowed per HTTP attempt (default: 20)")
    parser.add_argument("--retries", type=int, default=3, help="Total attempts before marking the endpoint offline (default: 3)")
    parser.add_argument("--retry-delay", type=float, default=2, help="Base delay between retries in seconds (default: 2)")
    parser.add_argument("--max-history", type=int, default=MAX_HISTORY, help="Maximum number of history records to retain")
    args = parser.parse_args()

    if args.timeout < 1 or not 1 <= args.retries <= 10 or args.retry_delay < 0 or args.max_history < 1:
        parser.error("timeout and max-history must be positive; retries must be 1–10; retry-delay cannot be negative")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    status_path = output_dir / "status.json"
    history_path = output_dir / "history.json"
    url = os.environ.get("RENDER_URL", "").strip()

    if not url:
        result = {
            "checkedAt": now_iso(), "status": "unconfigured", "httpStatus": None,
            "latencyMs": None, "endpointHost": None, "attempts": 0,
            "error": "Missing RENDER_URL repository Actions secret.",
        }
    else:
        try:
            result = check_url(url, args.timeout, args.retries, args.retry_delay)
        except ValueError as exc:
            result = {
                "checkedAt": now_iso(), "status": "unconfigured", "httpStatus": None,
                "latencyMs": None, "endpointHost": None, "attempts": 0, "error": str(exc),
            }

    checks = load_history(history_path, args.max_history)
    checks.insert(0, result)
    checks = checks[:args.max_history]
    status_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    history_path.write_text(json.dumps({"checks": checks}, indent=2) + "\n", encoding="utf-8")

    summary = (
        f"## Render keepalive result\n\n"
        f"- **Status:** {result['status']}\n"
        f"- **Endpoint:** {result['endpointHost'] or 'not configured'}\n"
        f"- **HTTP status:** {result['httpStatus'] if result['httpStatus'] is not None else 'n/a'}\n"
        f"- **Latency:** {str(result['latencyMs']) + ' ms' if result['latencyMs'] is not None else 'n/a'}\n"
        f"- **Attempts:** {result['attempts']}\n"
        f"- **Checked at:** {result['checkedAt']}\n"
        f"- **Error:** {result['error'] or 'none'}\n"
    )
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write(summary)

    print(summary)
    if result["status"] != "online":
        return 1 if result["status"] == "offline" else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
