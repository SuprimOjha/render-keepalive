import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivateIPv4(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || p[0] >= 224;
}
function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") ||
    v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") ||
    v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string };
    if (typeof body.url !== "string" || body.url.length > 2048) {
      return NextResponse.json({ error: "Provide a URL under 2048 characters." }, { status: 400 });
    }
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return NextResponse.json({ error: "Only public HTTP(S) URLs are supported." }, { status: 400 });
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
        host.endsWith(".internal") || host === "metadata.google.internal") {
      return NextResponse.json({ error: "Private and local hosts cannot be checked." }, { status: 400 });
    }
    if (isIP(host)) {
      if ((isIP(host) === 4 && isPrivateIPv4(host)) || (isIP(host) === 6 && isPrivateIPv6(host))) {
        return NextResponse.json({ error: "Private IP addresses cannot be checked." }, { status: 400 });
      }
    } else {
      const addresses = await lookup(host, { all: true, verbatim: true });
      if (!addresses.length || addresses.some((a) =>
        (isIP(a.address) === 4 && isPrivateIPv4(a.address)) ||
        (isIP(a.address) === 6 && isPrivateIPv6(a.address)))) {
        return NextResponse.json({ error: "Host resolves to a private or unsupported address." }, { status: 400 });
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const started = performance.now();
    try {
      const response = await fetch(parsed.toString(), {
        method: "GET", redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "RenderMonitor-URL-Test/1.0", "Accept": "*/*" },
        cache: "no-store",
      });
      return NextResponse.json({
        ok: response.status < 400, statusCode: response.status,
        latencyMs: Math.round(performance.now() - started),
        finalUrl: parsed.origin + parsed.pathname,
      });
    } finally { clearTimeout(timer); }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach this URL.";
    return NextResponse.json({ error: message.slice(0, 180) }, { status: 400 });
  }
}
