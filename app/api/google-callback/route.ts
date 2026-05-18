import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLIENT_ID = "385361697637-o14hn24qktrd3k73h812hcpo668ev5ju.apps.googleusercontent.com";;
const CLIENT_SECRET = "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";;
const REDIRECT_URI = "https://missions.batmanbluestone.com/api/google-callback";
const WORKSPACE = path.join(os.homedir(), ".openclaw", "workspace");

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`<h1>Error: ${error}</h1>`, { headers: { "Content-Type": "text/html" } });
  }
  if (!code) {
    return new NextResponse("<h1>No code received</h1>", { headers: { "Content-Type": "text/html" } });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return new NextResponse(`<h1>Token error: ${tokens.error}</h1><p>${tokens.error_description}</p>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const baseCreds = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      token_uri: "https://oauth2.googleapis.com/token",
      expiry_date: Date.now() + (tokens.expires_in * 1000),
    };

    // Save to all three credential files
    fs.writeFileSync(path.join(WORKSPACE, "google-calendar-creds.json"), JSON.stringify(baseCreds, null, 2));
    fs.writeFileSync(path.join(WORKSPACE, "google-drive-creds.json"), JSON.stringify(baseCreds, null, 2));
    fs.writeFileSync(path.join(WORKSPACE, "google-sheets-creds.json"), JSON.stringify(baseCreds, null, 2));

    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center;max-width:400px">
          <h1 style="color:#22c55e;font-size:3rem;margin:0">✅</h1>
          <h2 style="color:#f5c200">Google Reconnected!</h2>
          <p style="color:#aaa">Calendar, Drive, and Sheets are all authorized and ready.</p>
          <div style="margin-top:2rem;display:flex;gap:1rem;justify-content:center">
            <a href="/" style="background:#1a1a2e;color:#f5c200;padding:0.6rem 1.2rem;border-radius:8px;text-decoration:none">← Bat Cave</a>
          </div>
        </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`<h1>Error: ${msg}</h1>`, { headers: { "Content-Type": "text/html" } });
  }
}
