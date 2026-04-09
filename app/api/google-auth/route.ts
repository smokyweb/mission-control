import { NextResponse } from "next/server";

const CLIENT_ID = "385361697637-o14hn24qktrd3k73h812hcpo668ev5ju.apps.googleusercontent.com";;
const REDIRECT_URI = "https://missions.batmanbluestone.com/api/google-callback";

export async function GET() {
  const url = new URL("https://accounts.google.com/o/oauth2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.deployments",
    "https://mail.google.com/",
  ].join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}
