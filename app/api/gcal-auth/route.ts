import { NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_GCAL_CLIENT_ID || "";
const REDIRECT_URI = process.env.NODE_ENV === "production" 
  ? "https://missions.batmanbluestone.com/api/gcal-callback"
  : "http://localhost:3000/api/gcal-callback";

export async function GET() {
  const url = new URL("https://accounts.google.com/o/oauth2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}

