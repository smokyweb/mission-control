'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const login = async () => {
    setLoading(true); setError('');
    const r = await fetch('/api/batcave-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) {
      router.push(params.get('from') || '/servers');
    } else {
      setError(j.error || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ background: '#1A1A2E', border: '1px solid rgba(245,197,0,0.3)', borderRadius: '12px', padding: '40px', width: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🦇</div>
          <h1 style={{ color: '#f5c518', fontSize: '20px', fontWeight: 900, letterSpacing: '0.15em', margin: 0 }}>BAT CAVE</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '4px 0 0' }}>Mission Control</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ background: '#0A0A0F', border: '1px solid rgba(245,197,0,0.2)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ background: '#0A0A0F', border: '1px solid rgba(245,197,0,0.2)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
          {error && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}
          <button
            onClick={login}
            disabled={loading || !email || !password}
            style={{ background: '#f5c518', color: '#000', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 900, fontSize: '14px', cursor: 'pointer', opacity: loading || !email || !password ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
          Staff? Use <a href="/portal/servers" style={{ color: '#f5c518', textDecoration: 'none' }}>/portal/servers</a>
        </p>
      </div>
    </div>
  );
}

export default function BatcaveLogin() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A0A0F' }} />}><LoginForm /></Suspense>;
}
