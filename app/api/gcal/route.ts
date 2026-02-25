import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

interface GCalCreds {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  token_uri: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
  calendar: string;
  calendarId: string;
}

const TZ = "America/Port-au-Prince";
const CAL_LABELS: Record<string, string> = {
  "batmanbluestone@gmail.com": "Personal",
  "kevin@knoxwebhq.com": "Bluestone Apps",
};

function loadCreds(): GCalCreds {
  const p = path.join(os.homedir(), ".openclaw", "workspace", "google-calendar-creds.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function getToken(creds: GCalCreds): Promise<string> {
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
  const d = await res.json();
  if (!d.access_token) throw new Error("Token error: " + JSON.stringify(d));
  return d.access_token;
}

async function gcalFetch(token: string, url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GCal API error ${res.status}: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// GET — list events for a week
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  if (!timeMin || !timeMax) return NextResponse.json({ error: "timeMin and timeMax required" }, { status: 400 });

  try {
    const creds = loadCreds();
    const token = await getToken(creds);
    const calIds = Object.keys(CAL_LABELS);
    const allEvents: GCalEvent[] = [];

    for (const calId of calIds) {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "100");
      const data = await gcalFetch(token, url.toString());
      for (const ev of data?.items ?? []) {
        allEvents.push({ ...ev, calendar: CAL_LABELS[calId], calendarId: calId });
      }
    }

    allEvents.sort((a, b) => (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? ""));
    return NextResponse.json({ events: allEvents });
  } catch (err) {
    return NextResponse.json({ error: String(err), events: [] });
  }
}

// POST — create event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { calendarId, summary, description, location, startDateTime, endDateTime, allDay, date } = body;
    if (!calendarId || !summary) return NextResponse.json({ error: "calendarId and summary required" }, { status: 400 });

    const creds = loadCreds();
    const token = await getToken(creds);

    const event: Record<string, unknown> = { summary, description, location };
    if (allDay) {
      event.start = { date };
      event.end = { date };
    } else {
      event.start = { dateTime: startDateTime, timeZone: TZ };
      event.end = { dateTime: endDateTime, timeZone: TZ };
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const created = await gcalFetch(token, url, { method: "POST", body: JSON.stringify(event) });
    return NextResponse.json({ event: { ...created, calendar: CAL_LABELS[calendarId], calendarId } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — update event
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { calendarId, eventId, summary, description, location, startDateTime, endDateTime, allDay, date } = body;
    if (!calendarId || !eventId) return NextResponse.json({ error: "calendarId and eventId required" }, { status: 400 });

    const creds = loadCreds();
    const token = await getToken(creds);

    const event: Record<string, unknown> = { summary, description, location };
    if (allDay) {
      event.start = { date };
      event.end = { date };
    } else {
      event.start = { dateTime: startDateTime, timeZone: TZ };
      event.end = { dateTime: endDateTime, timeZone: TZ };
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const updated = await gcalFetch(token, url, { method: "PUT", body: JSON.stringify(event) });
    return NextResponse.json({ event: { ...updated, calendar: CAL_LABELS[calendarId], calendarId } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — delete event
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get("calendarId");
    const eventId = searchParams.get("eventId");
    if (!calendarId || !eventId) return NextResponse.json({ error: "calendarId and eventId required" }, { status: 400 });

    const creds = loadCreds();
    const token = await getToken(creds);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    await gcalFetch(token, url, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
