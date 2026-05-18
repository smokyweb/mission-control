import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ARCHER_EMAIL = "archer@bluestoneapps.com";
const ARCHER_PASSWORD = "archer2026";
const COOKIE_NAME = "archer_session";
const COOKIE_VALUE = "archer-authenticated-2026";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  // Accept either email+password or just password (backward compat)
  const emailOk = !email || email.toLowerCase().trim() === ARCHER_EMAIL;
  if (!emailOk || password !== ARCHER_PASSWORD) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  return NextResponse.json({ authenticated: session?.value === COOKIE_VALUE });
}
