import { NextResponse } from "next/server";

const CLIENT_ID = "385361697637-h7pkua5eln05m1hl6mrrp4oel9sirjfm.apps.googleusercontent.com";
const REDIRECT_URI = "https://missions.batmanbluestone.com/api/brent-gcal-callback";

export async function GET() {
  const url = new URL("https://accounts.google.com/o/oauth2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces new refresh token every time

  return NextResponse.redirect(url.toString());
}
