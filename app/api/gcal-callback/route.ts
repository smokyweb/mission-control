import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const CLIENT_ID = process.env.GOOGLE_GCAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_GCAL_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.NODE_ENV === "production" 
  ? "https://missions.batmanbluestone.com/api/gcal-callback"
  : "http://localhost:3000/api/gcal-callback";

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

    const creds = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      token_uri: "https://oauth2.googleapis.com/token",
    };

    const credsPath = path.join(os.homedir(), ".openclaw", "workspace", "google-calendar-creds.json");
    fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));

    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h1 style="color:#f5c200">✅ Calendar Reconnected!</h1>
          <p>Google Calendar has been authorized successfully.</p>
          <p><a href="/calendar" style="color:#f5c200">← Back to Calendar</a></p>
        </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`<h1>Error: ${msg}</h1>`, { headers: { "Content-Type": "text/html" } });
  }
}

