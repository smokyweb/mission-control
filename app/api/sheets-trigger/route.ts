import { NextRequest, NextResponse } from "next/server";
import http from "http";

const SECRET = "sheets-trigger-2026-xk9q";
const MAILER_PORT = 3043;

function triggerMailer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: MAILER_PORT, path: "/trigger", method: "POST" },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await triggerMailer();
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET — returns a clickable button page (bookmark this URL)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const triggered = req.nextUrl.searchParams.get("run") === "1";

  if (key !== SECRET) {
    return new NextResponse("<h1>Unauthorized</h1>", { status: 401, headers: { "Content-Type": "text/html" } });
  }

  let resultHtml = "";
  if (triggered) {
    try {
      await triggerMailer();
      resultHtml = `<div style="background:#16a34a;color:#fff;padding:1rem 1.5rem;border-radius:10px;margin-bottom:1.5rem;font-size:1.1rem">
        ✅ Mailer triggered! Emails sending from kevin@bluestoneapps.com.<br>
        <small style="opacity:0.85">Check Column M in the sheet — timestamps will appear within seconds.</small>
      </div>`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      resultHtml = `<div style="background:#dc2626;color:#fff;padding:1rem 1.5rem;border-radius:10px;margin-bottom:1.5rem">❌ Error: ${msg}</div>`;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>📧 Follow-Up Mailer</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0A0A0F; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1A1A2E; border: 1px solid #2A2A3E; border-radius: 16px; padding: 2.5rem; max-width: 420px; width: 90%; text-align: center; }
    h1 { font-size: 1.6rem; margin: 0 0 0.5rem; }
    p { color: #888; margin: 0 0 1.5rem; font-size: 0.95rem; }
    .btn { display: inline-block; background: #2563eb; color: #fff; padding: 0.85rem 2rem; border-radius: 10px; text-decoration: none; font-size: 1.1rem; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
    .note { margin-top: 1.5rem; color: #555; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5rem;margin-bottom:0.5rem">📧</div>
    <h1>Follow-Up Mailer</h1>
    <p>Sends pending follow-up emails from<br><strong style="color:#60a5fa">kevin@bluestoneapps.com</strong></p>
    ${resultHtml}
    <a class="btn" href="?key=${SECRET}&run=1">▶ Send Pending Follow-Ups Now</a>
    <div class="note">Only sends rows with X in Column L and empty Column M</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
