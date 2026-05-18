import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLIENT_ID = "385361697637-h7pkua5eln05m1hl6mrrp4oel9sirjfm.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://missions.batmanbluestone.com/api/brent-gcal-callback";

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

    // Save creds
    const creds = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      token_uri: "https://oauth2.googleapis.com/token",
    };

    const credsPath = path.join(os.homedir(), ".openclaw", "workspace", "brent-calendar-creds.json");
    fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));

    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h1 style="color:#f5c200">✅ Calendar Connected!</h1>
          <p>Brent's Google Calendar has been authorized successfully.</p>
          <p style="color:rgba(255,255,255,0.5)">You can close this tab.</p>
        </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`<h1>Error: ${msg}</h1>`, { headers: { "Content-Type": "text/html" } });
  }
}
