import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

interface BrentGCalCreds {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  token_uri: string;
}

const TZ = "America/Port-au-Prince";

function loadCreds(): BrentGCalCreds {
  const p = path.join(os.homedir(), ".openclaw", "workspace", "brent-calendar-creds.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function getToken(creds: BrentGCalCreds): Promise<string> {
  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
    }

    const creds = loadCreds();
    const token = await getToken(creds);

    // Fetch from primary calendar
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/primary/events`);
    url.searchParams.set("timeMin", start);
    url.searchParams.set("timeMax", end);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeZone", TZ);
    url.searchParams.set("maxResults", "100");

    const evRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const evData = await evRes.json();

    const events = (evData.items || []).map((e: {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      htmlLink?: string;
    }) => ({
      id: e.id,
      summary: e.summary || "(No title)",
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      htmlLink: e.htmlLink,
      calendar: "Brent",
      calendarId: "primary",
    }));

    return NextResponse.json(events);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Create event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const creds = loadCreds();
    const token = await getToken(creds);

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: body.summary,
          description: body.description,
          location: body.location,
          start: body.start,
          end: body.end,
        }),
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Update event
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    const creds = loadCreds();
    const token = await getToken(creds);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Delete event
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const creds = loadCreds();
    const token = await getToken(creds);

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
