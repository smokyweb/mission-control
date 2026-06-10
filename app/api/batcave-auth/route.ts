import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'batcave-servers-salt-2026').digest('hex');
}

const SUPER_ADMINS: Record<string, string> = {
  'kevin@bluestoneapps.com': hashPassword('@@@.Kevin1.@@@'),
};

export async function POST(req: NextRequest) {
  const { action, email, password } = await req.json();

  if (action === 'login') {
    // Check super admin credentials
    const expectedHash = SUPER_ADMINS[email?.toLowerCase()];
    if (expectedHash && hashPassword(password) === expectedHash) {
      const res = NextResponse.json({ ok: true, role: 'superadmin' });
      res.cookies.set('batcave_session', 'authenticated', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
      return res;
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('batcave_session', '', { maxAge: 0, path: '/' });
    return res;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
