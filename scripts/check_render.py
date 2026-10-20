#!/usr/bin/env python3
"""Check a configured Render URL and write JSON status/history files."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAX_HISTORY = 100
USER_AGENT = "render-keepalive-monitor/1.0"


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_history(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        checks = data.get("checks", [])
        return checks if isinstance(checks, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=".")
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    status_path = output_dir / "status.json"
    history_path = output_dir / "history.json"
    url = os.environ.get("RENDER_URL", "").strip()
    checked_at = now_iso()

    result = {
        "checkedAt": checked_at,
        "status": "unconfigured",
        "httpStatus": None,
        "latencyMs": None,
        "endpointHost": None,
        "error": None,
    }

    if url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                raise ValueError("RENDER_URL must be a valid public HTTP or HTTPS URL.")
            result["endpointHost"] = parsed.hostname
            request = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
                method="GET",
            )
            started = time.monotonic()
            try:
                with urllib.request.urlopen(request, timeout=25) as response:
                    result["httpStatus"] = response.status
                    response.read(1024)
            except urllib.error.HTTPError as error:
                result["httpStatus"] = error.code
                error.read(1024)
            result["latencyMs"] = round((time.monotonic() - started) * 1000)
            result["status"] = "online" if result["httpStatus"] < 400 else "offline"
            if result["status"] == "offline":
                result["error"] = f"Endpoint returned HTTP {result['httpStatus']}."
        except Exception as error:  # Record network, timeout, and URL errors.
            result["status"] = "offline"
            result["error"] = str(error)[:300]

    checks = load_history(history_path)
    checks.insert(0, result)
    checks = checks[:MAX_HISTORY]
    status_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    history_path.write_text(
        json.dumps({"checks": checks}, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Status: {result['status']}")
    print(f"HTTP status: {result['httpStatus']}")
    print(f"Latency: {result['latencyMs']} ms")
    print(f"Checked at: {checked_at}")
    if result["error"]:
        print(f"Error: {result['error']}")


if __name__ == "__main__":
    main()
