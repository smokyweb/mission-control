import ServersClient from './ServersClient';

export default function ServersPage() {
  return <ServersClient />;
}

// Also export config so this page works without Cloudflare auth
export const dynamic = 'force-dynamic';
