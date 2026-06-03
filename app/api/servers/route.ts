import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import https from 'https';

const GMAIL_CREDS_FILE = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'workspace', 'gmail-knoxweb-creds.json');

// In-memory token cache for Gmail
let gmailTokenCache: { token: string | null; expiresAt: number } = { token: null, expiresAt: 0 };

async function getGmailToken(): Promise<string> {
  const now = Date.now();
  if (gmailTokenCache.token && gmailTokenCache.expiresAt > now + 5 * 60 * 1000) return gmailTokenCache.token;
  const creds = JSON.parse(fs.readFileSync(GMAIL_CREDS_FILE, 'utf8'));
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token, grant_type: 'refresh_token' });
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const r = JSON.parse(d);
        if (r.error) return reject(new Error(r.error_description || r.error));
        gmailTokenCache = { token: r.access_token, expiresAt: now + r.expires_in * 1000 };
        resolve(r.access_token);
      });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

async function sendGmail({ to, subject, htmlBody }: { to: string; subject: string; htmlBody: string }): Promise<void> {
  const token = await getGmailToken();
  const boundary = `boundary_${Date.now()}`;
  const text = htmlBody.replace(/<[^>]+>/g, '');
  const raw = [
    `From: Kevin <kevin@knoxwebhq.com>`, `To: ${to}`, `Subject: ${subject}`,
    `MIME-Version: 1.0`, `Content-Type: multipart/alternative; boundary="${boundary}"`, ``,
    `--${boundary}`, `Content-Type: text/plain; charset=UTF-8`, ``, text, ``,
    `--${boundary}`, `Content-Type: text/html; charset=UTF-8`, ``, htmlBody, ``, `--${boundary}--`
  ].join('\r\n');
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ raw: encoded });
    const req = https.request({ hostname: 'gmail.googleapis.com', path: '/gmail/v1/users/me/messages/send', method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { const r = JSON.parse(d); r.error ? reject(new Error(r.error.message)) : resolve(); });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

const SERVERS_FILE = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'workspace', 'servers.json');

// ── Types ─────────────────────────────────────────────────────────────────────
interface Channel { name: string; id: string; model: string; agentId: string; }
interface Server { name: string; channels: Channel[]; }
interface ChannelAssignment { serverId: string; channelId: string; channelName: string; serverName: string; }
interface StaffMember {
  id: string; name: string; discordUsername: string; discordId: string;
  role: 'superadmin' | 'admin' | 'staff';
  serverAdmins: string[]; // guild IDs where they are server admin
  channelAssignments: ChannelAssignment[];
  addedAt: string; addedBy: string;
}
interface PortalUser {
  id: string; username: string; passwordHash: string;
  role: 'superadmin' | 'admin' | 'staff';
  staffId?: string; // link to staff member
  createdAt: string; lastLogin?: string;
}
interface Invite {
  id: string; code: string; url: string;
  invitedName: string; invitedEmail: string; invitedDiscord: string;
  serverId: string; serverName: string;
  role: string; channelAssignments: ChannelAssignment[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'converted';
  discordUserId: string | null; discordUsername: string | null;
  createdAt: string; acceptedAt: string | null; expiresAt: string;
}
interface HistoryEntry {
  id: string; timestamp: string;
  action: string; serverId?: string; channelId?: string; channelName?: string;
  agentId?: string; model?: string; staffId?: string; staffName?: string;
  userId?: string; details: string; performedBy: string;
}
interface ServersData {
  config: { discordBotToken: string; machines?: Record<string, unknown> };
  servers: Record<string, Server>;
  staff: StaffMember[];
  portalUsers: PortalUser[];
  invites: Invite[];
  history: HistoryEntry[];
  lastUpdated: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function readServers(): ServersData {
  try {
    const raw = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    if (!raw.staff) raw.staff = [];
    if (!raw.portalUsers) raw.portalUsers = [];
    if (!raw.history) raw.history = [];
    if (!raw.invites) raw.invites = [];
    if (!raw.config) raw.config = { discordBotToken: '' };
    return raw;
  } catch {
    return { config: { discordBotToken: '' }, servers: {}, staff: [], portalUsers: [], invites: [], history: [], lastUpdated: '' };
  }
}

function writeServers(data: ServersData) {
  data.lastUpdated = new Date().toISOString();
  // Keep history trimmed to 500 entries
  if (data.history.length > 500) data.history = data.history.slice(-500);
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
}

function addHistory(data: ServersData, entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  data.history.push({ id: `h-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, timestamp: new Date().toISOString(), ...entry });
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'batcave-servers-salt-2026').digest('hex');
}

// Get bot token for a specific server (falls back to global)
function getBotToken(data: ServersData, serverId?: string): string {
  if (serverId) {
    const machinesMap = (data.config as unknown as { machines?: Record<string, { botToken?: string }> })?.machines ?? {};
    const serverToken = machinesMap[serverId]?.botToken;
    if (serverToken) return serverToken;
  }
  return data.config?.discordBotToken ?? '';
}

// Discord API helper
async function discordApi(token: string, method: string, endpoint: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method,
    headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json };
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const data = readServers();

  if (action === 'history') {
    const limit = parseInt(searchParams.get('limit') || '100');
    return NextResponse.json({ history: data.history.slice(-limit).reverse() });
  }

  // Strip password hashes before sending
  const safeUsers = (data.portalUsers || []).map(({ passwordHash: _, ...u }) => u);
  return NextResponse.json({ ...data, portalUsers: safeUsers });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readServers();
  const by = body.performedBy || 'kevin';

  // ── Model changes ────────────────────────────────────────────────────────
  if (body.action === 'updateModel') {
    const { serverId, channelId, model } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    const ch = server.channels.find(c => c.id === channelId);
    if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    const prev = ch.model;
    ch.model = model;
    addHistory(data, { action: 'model_change', serverId, channelId, channelName: ch.name, model, details: `Model changed from ${prev} to ${model} on #${ch.name}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, channel: ch });
  }

  if (body.action === 'updateServerModel') {
    const { serverId, model } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    server.channels.forEach(c => { c.model = model; });
    addHistory(data, { action: 'model_change', serverId, model, details: `All channels in ${server.name} set to ${model}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, count: server.channels.length });
  }

  // ── Staff management ─────────────────────────────────────────────────────
  if (body.action === 'addStaff') {
    const { name, discordUsername, discordId, role, serverAdmins, channelAssignments } = body;
    if (!name || !discordUsername) return NextResponse.json({ error: 'name and discordUsername required' }, { status: 400 });
    if (data.staff.find(s => s.discordUsername === discordUsername))
      return NextResponse.json({ error: 'Staff member already exists' }, { status: 409 });
    const member: StaffMember = {
      id: `staff-${Date.now()}`, name, discordUsername, discordId: discordId || '',
      role: role || 'staff', serverAdmins: serverAdmins || [],
      channelAssignments: channelAssignments || [],
      addedAt: new Date().toISOString(), addedBy: by,
    };
    data.staff.push(member);
    addHistory(data, { action: 'staff_add', staffId: member.id, staffName: name, details: `${name} (@${discordUsername}) added as ${role || 'staff'}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, member });
  }

  if (body.action === 'updateStaff') {
    const { id, name, discordUsername, discordId, role, serverAdmins, channelAssignments } = body;
    const idx = data.staff.findIndex(s => s.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    const prev = data.staff[idx];
    data.staff[idx] = { ...prev, name: name ?? prev.name, discordUsername: discordUsername ?? prev.discordUsername, discordId: discordId ?? prev.discordId, role: role ?? prev.role, serverAdmins: serverAdmins ?? prev.serverAdmins, channelAssignments: channelAssignments ?? prev.channelAssignments };
    addHistory(data, { action: 'staff_update', staffId: id, staffName: data.staff[idx].name, details: `Updated: role=${data.staff[idx].role}, channels=${data.staff[idx].channelAssignments.length}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, member: data.staff[idx] });
  }

  if (body.action === 'removeStaff') {
    const { id } = body;
    const member = data.staff.find(s => s.id === id);
    if (!member) return NextResponse.json({ ok: true });
    data.staff = data.staff.filter(s => s.id !== id);
    addHistory(data, { action: 'staff_remove', staffId: id, staffName: member.name, details: `${member.name} removed`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true });
  }

  // ── Portal users ─────────────────────────────────────────────────────────
  if (body.action === 'addPortalUser') {
    const { username, password, role, staffId } = body;
    if (!username || !password) return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    if (data.portalUsers.find(u => u.username === username))
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    const user: PortalUser = { id: `user-${Date.now()}`, username, passwordHash: hashPassword(password), role: role || 'staff', staffId, createdAt: new Date().toISOString() };
    data.portalUsers.push(user);
    addHistory(data, { action: 'user_add', userId: user.id, details: `Portal user ${username} added (${role || 'staff'})`, performedBy: by });
    writeServers(data);
    const { passwordHash: _, ...safe } = user;
    return NextResponse.json({ ok: true, user: safe });
  }

  if (body.action === 'updatePortalUser') {
    const { id, role, password, staffId } = body;
    const idx = data.portalUsers.findIndex(u => u.id === id);
    if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (role) data.portalUsers[idx].role = role;
    if (password) data.portalUsers[idx].passwordHash = hashPassword(password);
    if (staffId !== undefined) data.portalUsers[idx].staffId = staffId;
    addHistory(data, { action: 'user_update', userId: id, details: `User ${data.portalUsers[idx].username} updated`, performedBy: by });
    writeServers(data);
    const { passwordHash: _, ...safe } = data.portalUsers[idx];
    return NextResponse.json({ ok: true, user: safe });
  }

  if (body.action === 'removePortalUser') {
    const { id } = body;
    const user = data.portalUsers.find(u => u.id === id);
    if (!user) return NextResponse.json({ ok: true });
    data.portalUsers = data.portalUsers.filter(u => u.id !== id);
    addHistory(data, { action: 'user_remove', userId: id, details: `Portal user ${user.username} removed`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'loginPortalUser') {
    const { username, password } = body;
    const user = data.portalUsers.find(u => u.username === username && u.passwordHash === hashPassword(password));
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    user.lastLogin = new Date().toISOString();
    writeServers(data);
    const { passwordHash: _, ...safe } = user;
    return NextResponse.json({ ok: true, user: safe });
  }

  // ── Discord channel management ────────────────────────────────────────────
  if (body.action === 'addChannel') {
    const { serverId, name, model } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    const token = getBotToken(data, serverId);
    if (!token) return NextResponse.json({ error: 'Discord bot token not configured' }, { status: 400 });
    const result = await discordApi(token, 'POST', `/guilds/${serverId}/channels`, { name, type: 0 });
    if (!result.ok) return NextResponse.json({ error: `Discord API error: ${result.data.message}` }, { status: 400 });
    const slotNum = server.channels.length + 1;
    const serverSlug = server.name.toLowerCase().replace(/\s+/g, '');
    const newCh: Channel = { name: result.data.name, id: result.data.id, model: model || 'anthropic/claude-sonnet-4-6', agentId: `${serverSlug}-slot-${slotNum}` };
    server.channels.push(newCh);
    addHistory(data, { action: 'channel_add', serverId, channelId: newCh.id, channelName: newCh.name, details: `#${newCh.name} created in ${server.name} (agent: ${newCh.agentId})`, performedBy: by });
    writeServers(data);

    // Auto-provision the new agent workspace in the background
    const SCRIPT = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'workspace', 'provision-server.py');
    const machinesMap = (data.config as unknown as { machines?: Record<string, unknown> })?.machines ?? {};
    const hasMachine = !!machinesMap[serverId];
    if (hasMachine) {
      // Fire-and-forget — don't await, let it run in background
      const child = spawn('python', [SCRIPT, serverId, newCh.agentId], { detached: true, stdio: 'ignore' });
      child.unref();
    }

    return NextResponse.json({ ok: true, channel: newCh, autoProvisioning: hasMachine });
  }

  if (body.action === 'renameChannel') {
    const { serverId, channelId, newName } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    const ch = server.channels.find(c => c.id === channelId);
    if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    const token = getBotToken(data, serverId);
    if (!token) return NextResponse.json({ error: 'Discord bot token not configured' }, { status: 400 });
    const result = await discordApi(token, 'PATCH', `/channels/${channelId}`, { name: newName });
    if (!result.ok) return NextResponse.json({ error: `Discord API error: ${result.data.message}` }, { status: 400 });
    const oldName = ch.name;
    ch.name = result.data.name;
    addHistory(data, { action: 'channel_rename', serverId, channelId, channelName: ch.name, details: `#${oldName} renamed to #${ch.name}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, channel: ch });
  }

  if (body.action === 'deleteChannel') {
    const { serverId, channelId } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    const ch = server.channels.find(c => c.id === channelId);
    if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    const token = getBotToken(data, serverId);
    if (!token) return NextResponse.json({ error: 'Discord bot token not configured' }, { status: 400 });
    const result = await discordApi(token, 'DELETE', `/channels/${channelId}`);
    if (!result.ok) return NextResponse.json({ error: `Discord API error: ${result.data.message}` }, { status: 400 });
    server.channels = server.channels.filter(c => c.id !== channelId);
    addHistory(data, { action: 'channel_delete', serverId, channelId, channelName: ch.name, agentId: ch.agentId, details: `#${ch.name} deleted from Discord. Agent workspace ${ch.agentId} preserved on machine.`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, agentId: ch.agentId, note: 'Workspace preserved on remote machine' });
  }

  // ── Config ───────────────────────────────────────────────────────────────
  if (body.action === 'updateConfig') {
    const { discordBotToken } = body;
    if (!data.config) data.config = { discordBotToken: '' };
    if (discordBotToken !== undefined) data.config.discordBotToken = discordBotToken;
    writeServers(data);
    return NextResponse.json({ ok: true });
  }

  // ── Invites ──────────────────────────────────────────────────────────────
  if (body.action === 'createInvite') {
    const { invitedName, invitedEmail, invitedDiscord, serverId, role, channelAssignments } = body;
    const server = data.servers[serverId];
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    const token = getBotToken(data, serverId);
    if (!token) return NextResponse.json({ error: 'Discord bot token not configured in ⚙ Config' }, { status: 400 });
    const channelId = server.channels[0]?.id;
    if (!channelId) return NextResponse.json({ error: 'Server has no channels' }, { status: 400 });
    const r = await discordApi(token, 'POST', `/channels/${channelId}/invites`, { max_uses: 1, max_age: 604800, unique: true });
    if (!r.ok) return NextResponse.json({ error: `Discord: ${r.data.message ?? 'invite creation failed'}` }, { status: 400 });
    const inv: Invite = {
      id: `inv-${Date.now()}`,
      code: r.data.code, url: `https://discord.gg/${r.data.code}`,
      invitedName, invitedEmail: invitedEmail || '', invitedDiscord: invitedDiscord || '',
      serverId, serverName: server.name,
      role: role || 'staff', channelAssignments: channelAssignments || [],
      status: 'pending', discordUserId: null, discordUsername: null,
      createdAt: new Date().toISOString(), acceptedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (!data.invites) data.invites = [];
    data.invites.push(inv);
    addHistory(data, { action: 'invite_created', serverId, staffName: invitedName, details: `Invite created for ${invitedName} to ${server.name}`, performedBy: by });
    writeServers(data);

    // Auto-send invite email if email address provided
    let emailSent = false;
    let emailError: string | null = null;
    if (invitedEmail) {
      try {
        await sendGmail({
          to: invitedEmail,
          subject: `You're invited to join the ${server.name} Discord server`,
          htmlBody: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">Hi ${invitedName}! 👋</h2>
              <p>You've been invited to join the <strong>${server.name}</strong> Discord server.</p>
              <p style="margin: 24px 0;">
                <a href="${inv.url}" style="background: #5865F2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Join ${server.name} on Discord</a>
              </p>
              <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${inv.url}">${inv.url}</a></p>
              <p style="color: #666; font-size: 14px;">⏰ This invite expires in 7 days and can only be used once.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 12px;">Sent by Kevin · Batman Bluestone Studios</p>
            </div>
          `
        });
        emailSent = true;
      } catch (e: unknown) {
        emailError = e instanceof Error ? e.message : String(e);
        console.error('Auto-invite email failed:', emailError);
      }
    }

    return NextResponse.json({ ok: true, invite: inv, emailSent, emailError });
  }

  if (body.action === 'checkInvites') {
    const token = data.config?.discordBotToken;
    if (!token) return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
    if (!data.invites?.length) return NextResponse.json({ ok: true, updated: 0, invites: [] });
    let updated = 0;
    for (const inv of data.invites) {
      if (inv.status !== 'pending') continue;
      if (new Date(inv.expiresAt) < new Date()) { inv.status = 'expired'; updated++; continue; }
      const r = await discordApi(token, 'GET', `/invites/${inv.code}?with_counts=true`);
      if (!r.ok) continue;
      if ((r.data.uses ?? 0) >= 1) {
        inv.status = 'accepted'; inv.acceptedAt = new Date().toISOString();
        // Find who joined — members who joined after invite creation
        const mR = await discordApi(token, 'GET', `/guilds/${inv.serverId}/members?limit=1000`);
        if (mR.ok && Array.isArray(mR.data)) {
          const since = new Date(inv.createdAt).getTime() - 60000;
          const recent = mR.data
            .filter((m: {joined_at: string}) => new Date(m.joined_at).getTime() >= since)
            .sort((a: {joined_at: string}, b: {joined_at: string}) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0] as {user:{id:string;username:string}} | undefined;
          if (recent) { inv.discordUserId = recent.user.id; inv.discordUsername = recent.user.username; }
        }
        addHistory(data, { action: 'invite_accepted', serverId: inv.serverId, staffName: inv.invitedName, details: `${inv.invitedName} accepted invite to ${inv.serverName}${inv.discordUsername ? ` as @${inv.discordUsername}` : ''}`, performedBy: 'system' });
        updated++;
      }
    }
    if (updated > 0) writeServers(data);
    return NextResponse.json({ ok: true, updated, invites: data.invites });
  }

  if (body.action === 'convertInvite') {
    const { inviteId } = body;
    const inv = data.invites?.find(i => i.id === inviteId);
    if (!inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    if (inv.status !== 'accepted') return NextResponse.json({ error: 'Invite not yet accepted' }, { status: 400 });
    const member: StaffMember = {
      id: `staff-${Date.now()}`, name: inv.invitedName,
      discordUsername: inv.discordUsername || inv.invitedDiscord,
      discordId: inv.discordUserId || '',
      role: inv.role as StaffMember['role'],
      serverAdmins: [], channelAssignments: inv.channelAssignments || [],
      addedAt: new Date().toISOString(), addedBy: by,
    };
    data.staff.push(member);
    inv.status = 'converted';
    addHistory(data, { action: 'staff_add', staffId: member.id, staffName: member.name, details: `${member.name} added as ${member.role} via invite`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, member });
  }

  if (body.action === 'revokeInvite') {
    const { inviteId } = body;
    const inv = data.invites?.find(i => i.id === inviteId);
    if (!inv) return NextResponse.json({ ok: true });
    const token = data.config?.discordBotToken;
    if (token && inv.status === 'pending') { await discordApi(token, 'DELETE', `/invites/${inv.code}`); }
    inv.status = 'revoked';
    addHistory(data, { action: 'invite_revoked', staffName: inv.invitedName, details: `Invite to ${inv.invitedName} revoked`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'sendDM') {
    const { inviteId } = body;
    const inv = data.invites?.find(i => i.id === inviteId);
    if (!inv || !inv.invitedDiscord) return NextResponse.json({ error: 'Invite not found or no Discord username' }, { status: 400 });
    const token = data.config?.discordBotToken;
    if (!token) return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
    // Search for user across all guild members
    const mR = await discordApi(token, 'GET', `/guilds/${inv.serverId}/members?limit=1000`);
    if (!mR.ok) return NextResponse.json({ error: 'Could not fetch guild members' }, { status: 500 });
    const found = (mR.data as {user:{id:string;username:string}}[]).find(m => m.user.username.toLowerCase() === inv.invitedDiscord.toLowerCase());
    if (!found) return NextResponse.json({ error: `@${inv.invitedDiscord} is not in ${inv.serverName} yet. Send them the invite link first.` }, { status: 404 });
    const dmR = await discordApi(token, 'POST', '/users/@me/channels', { recipient_id: found.user.id });
    if (!dmR.ok) return NextResponse.json({ error: 'Could not open DM channel' }, { status: 500 });
    const msg = `Hi ${inv.invitedName}! You\'ve been invited to join the **${inv.serverName}** Discord server.\n\nJoin link: ${inv.url}\n\nThis invite expires in 7 days.`;
    const sendR = await discordApi(token, 'POST', `/channels/${dmR.data.id}/messages`, { content: msg });
    if (!sendR.ok) return NextResponse.json({ error: 'Could not send DM' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
