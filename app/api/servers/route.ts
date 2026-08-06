import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import https from 'https';

// DATA_DIR env var allows overriding the data directory for cloud deployments
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'workspace');
// Ensure data directory exists
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
const GMAIL_CREDS_FILE = path.join(DATA_DIR, 'gmail-knoxweb-creds.json');

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

const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

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
  dmSent?: boolean;
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

// Sync Discord roles for a staff member based on their channel assignments
async function syncDiscordRolesForMember(data: ServersData, member: StaffMember) {
  const channelRoles = (data.config as unknown as { channelRoles?: Record<string, Record<string, { roleId: string; channelName: string }>> })?.channelRoles ?? {};
  const VIEW = '1024', ALLOW = '379904'; // VIEW|SEND|READ_HIST|ATTACH|EMBED|EMOJI
  const DENY = '67584'; // VIEW|SEND|READ_HIST

  // If member is a server admin on any servers, assign ALL channel roles for those servers
  for (const serverId of (member.serverAdmins || [])) {
    const token = getBotToken(data, serverId);
    if (!token) continue;
    let discordId = member.discordId;
    if (!discordId && member.discordUsername) {
      const mRes = await discordApi(token, 'GET', `/guilds/${serverId}/members?limit=1000`);
      if (mRes.ok && Array.isArray(mRes.data)) {
        const found = (mRes.data as {user:{id:string;username:string}}[]).find(m => m.user.username.toLowerCase() === member.discordUsername.toLowerCase());
        if (found) { discordId = found.user.id; member.discordId = discordId; }
      }
    }
    if (!discordId) continue;
    // Assign all ch-* roles for this server
    for (const [, roleInfo] of Object.entries(channelRoles[serverId] ?? {})) {
      try { await discordApi(token, 'PUT', `/guilds/${serverId}/members/${discordId}/roles/${roleInfo.roleId}`, undefined); } catch { /* skip */ }
    }
  }

  if (!member.channelAssignments?.length) return;

  for (const assignment of member.channelAssignments) {
    const { serverId, channelId, channelName } = assignment;
    const token = getBotToken(data, serverId);
    if (!token) continue;

    let roleInfo = channelRoles[serverId]?.[channelId];

    // If no role exists for this channel, create it and lock the channel
    if (!roleInfo) {
      try {
        const newRole = await discordApi(token, 'POST', `/guilds/${serverId}/roles`, { name: `ch-${channelName}`, permissions: '0', mentionable: false, hoist: false });
        if (newRole.ok && newRole.data.id) {
          const roleId = newRole.data.id;
          await discordApi(token, 'PUT', `/channels/${channelId}/permissions/${serverId}`, { type: 0, deny: DENY, allow: '0' });
          await discordApi(token, 'PUT', `/channels/${channelId}/permissions/${roleId}`, { type: 0, allow: ALLOW, deny: '0' });
          // Allow Owner role
          const rolesRes = await discordApi(token, 'GET', `/guilds/${serverId}/roles`);
          if (rolesRes.ok && Array.isArray(rolesRes.data)) {
            const ownerRole = (rolesRes.data as {id:string;name:string}[]).find(r => r.name === 'Owner');
            if (ownerRole) await discordApi(token, 'PUT', `/channels/${channelId}/permissions/${ownerRole.id}`, { type: 0, allow: ALLOW, deny: '0' });
          }
          if (!channelRoles[serverId]) channelRoles[serverId] = {};
          channelRoles[serverId][channelId] = { roleId, channelName };
          (data.config as unknown as { channelRoles: unknown }).channelRoles = channelRoles;
          roleInfo = { roleId, channelName };
        }
      } catch (e) { continue; }
    }
    if (!roleInfo) continue;

    let discordId = member.discordId;
    if (!discordId && member.discordUsername) {
      const mRes = await discordApi(token, 'GET', `/guilds/${serverId}/members?limit=1000`);
      if (mRes.ok && Array.isArray(mRes.data)) {
        const found = (mRes.data as {user:{id:string;username:string}}[]).find(
          m => m.user.username.toLowerCase() === member.discordUsername.toLowerCase()
        );
        if (found) { discordId = found.user.id; member.discordId = discordId; }
      }
    }
    if (!discordId) continue;

    try {
      await discordApi(token, 'PUT', `/guilds/${serverId}/members/${discordId}/roles/${roleInfo.roleId}`, undefined);
    } catch (e) { /* skip silently */ }
  }
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
  // 204 No Content has empty body — don't try to parse
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return { ok: res.ok, status: res.status, data: null };
  }
  try {
    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
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

  if (body.action === 'sendChannelMessage') {
    const { serverId, channelId, message } = body;
    if (!channelId || !message) return NextResponse.json({ error: 'channelId and message required' }, { status: 400 });
    const botToken = data.config?.discordBotToken;
    if (!botToken) return NextResponse.json({ error: 'No bot token configured' }, { status: 400 });
    // Send message to Discord channel via API
    const result = await new Promise<{ok: boolean; error?: string}>((resolve) => {
      const payload = JSON.stringify({ content: message });
      const req = https.request({
        hostname: 'discord.com',
        path: `/api/v10/channels/${channelId}/messages`,
        method: 'POST',
        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) resolve({ ok: true });
          else resolve({ ok: false, error: `Discord API ${res.statusCode}: ${d.slice(0, 100)}` });
        });
      });
      req.on('error', e => resolve({ ok: false, error: e.message }));
      req.write(payload); req.end();
    });
    return NextResponse.json(result);
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
    // Sync Discord roles after assignment update
    await syncDiscordRolesForMember(data, data.staff[idx]).catch(console.error);
    // Also ensure all server admins have roles for any servers this member is an admin on
    if (data.staff[idx].serverAdmins?.length) {
      for (const adminServerId of data.staff[idx].serverAdmins) {
        const otherAdmins = data.staff.filter(s => s.serverAdmins?.includes(adminServerId) && s.discordId && s.id !== id);
        for (const otherAdmin of otherAdmins) {
          await syncDiscordRolesForMember(data, otherAdmin).catch(console.error);
        }
      }
    }
    writeServers(data); // Save any discordId updates
    return NextResponse.json({ ok: true, member: data.staff[idx] });
  }

  if (body.action === 'removeStaff') {
    const { id } = body;
    const member = data.staff.find(s => s.id === id);
    if (!member) return NextResponse.json({ ok: true });

    // Kick from Discord + remove channel roles before wiping local data
    const kickResults: { serverId: string; ok: boolean; error?: string }[] = [];
    if (member.discordId) {
      const serverIds = new Set<string>();
      for (const sid of member.serverAdmins || []) serverIds.add(sid);
      for (const ca of member.channelAssignments || []) serverIds.add(ca.serverId);

      for (const serverId of serverIds) {
        const token = getBotToken(data, serverId);
        if (!token) { kickResults.push({ serverId, ok: false, error: 'no bot token' }); continue; }

        // Remove all ch-* roles for this member on this server
        const channelRoles = (data.config as unknown as { channelRoles?: Record<string, Record<string, { roleId: string; channelName: string }>> })?.channelRoles ?? {};
        const roles = channelRoles[serverId] ?? {};
        for (const [, roleInfo] of Object.entries(roles)) {
          await discordApi(token, 'DELETE', `/guilds/${serverId}/members/${member.discordId}/roles/${roleInfo.roleId}`).catch(() => {});
        }

        // Kick from guild (removes remaining roles + leaves server)
        const kickResult = await discordApi(token, 'DELETE', `/guilds/${serverId}/members/${member.discordId}`);
        kickResults.push({ serverId, ok: kickResult.ok, error: kickResult.data?.message });
      }
    }

    data.staff = data.staff.filter(s => s.id !== id);
    const kickDetails = kickResults.map(r => `${r.serverId}: ${r.ok ? 'kicked' : (r.error || 'skipped')}`).join('; ') || 'no discordId';
    addHistory(data, { action: 'staff_remove', staffId: id, staffName: member.name, details: `${member.name} removed. Discord: ${kickDetails}`, performedBy: by });
    writeServers(data);
    return NextResponse.json({ ok: true, discordCleanup: kickResults });
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
    // Auto-setup Discord role for new channel (lock channel, create ch-* role)
    try {
      const channelRoles = (data.config as unknown as { channelRoles?: Record<string, Record<string, { roleId: string; channelName: string }>> })?.channelRoles ?? {};
      const FULL_ALLOW = '379904'; // VIEW+SEND+READ_HIST+ATTACH+EMBED+EMOJI
      const DENY_ALL = (BigInt(1024)|BigInt(2048)|BigInt(65536)).toString();
      const everyoneId = serverId;

      // Create ch-<name> role
      const roleRes = await discordApi(token, 'POST', `/guilds/${serverId}/roles`, { name: `ch-${newCh.name}`, permissions: '0', mentionable: false, hoist: false });
      if (roleRes.ok && roleRes.data.id) {
        const roleId = roleRes.data.id;

        // Deny @everyone
        await discordApi(token, 'PUT', `/channels/${newCh.id}/permissions/${everyoneId}`, { type: 0, deny: DENY_ALL, allow: '0' });
        // Allow ch-* role full permissions
        await discordApi(token, 'PUT', `/channels/${newCh.id}/permissions/${roleId}`, { type: 0, allow: FULL_ALLOW, deny: '0' });

        // Allow Owner role
        const rolesRes = await discordApi(token, 'GET', `/guilds/${serverId}/roles`);
        if (rolesRes.ok && Array.isArray(rolesRes.data)) {
          const ownerRole = (rolesRes.data as { id: string; name: string }[]).find(r => r.name === 'Owner');
          if (ownerRole) await discordApi(token, 'PUT', `/channels/${newCh.id}/permissions/${ownerRole.id}`, { type: 0, allow: FULL_ALLOW, deny: '0' });
        }

        // Save to channelRoles map
        if (!(data.config as unknown as { channelRoles?: unknown }).channelRoles) (data.config as unknown as { channelRoles: unknown }).channelRoles = {};
        if (!channelRoles[serverId]) channelRoles[serverId] = {};
        channelRoles[serverId][newCh.id] = { roleId, channelName: newCh.name };
        (data.config as unknown as { channelRoles: unknown }).channelRoles = channelRoles;

        // Assign new role to all server admins on this server
        const serverAdmins = data.staff.filter(s => s.serverAdmins?.includes(serverId) && s.discordId);
        for (const admin of serverAdmins) {
          await discordApi(token, 'PUT', `/guilds/${serverId}/members/${admin.discordId}/roles/${roleId}`, undefined);
        }
      }
    } catch (e) { console.error('Auto role setup failed:', e); }

    writeServers(data);

    // Auto-provision the new agent workspace in the background
    const SCRIPT = path.join(DATA_DIR, 'provision-server.py');
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
    if (!data.invites?.length) return NextResponse.json({ ok: true, updated: 0, invites: [] });
    let updated = 0;
    for (const inv of data.invites) {
      if (inv.status !== 'pending') continue;
      if (new Date(inv.expiresAt) < new Date()) { inv.status = 'expired'; updated++; continue; }
      // Use per-server bot token (each server has its own bot)
      const token = getBotToken(data, inv.serverId);
      if (!token) { console.warn(`No bot token for server ${inv.serverId} (${inv.serverName}), skipping`); continue; }
      const r = await discordApi(token, 'GET', `/invites/${inv.code}?with_counts=true`);
      // 404 means invite was used and deleted by Discord (single-use invites disappear after use)
      const inviteWasUsed = r.status === 404 || (r.ok && (r.data.uses ?? 0) >= 1);
      if (!r.ok && r.status !== 404) { console.warn(`Invite check failed for ${inv.invitedName}: ${JSON.stringify(r.data)}`); continue; }
      if (inviteWasUsed) {
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
        // Auto-send Discord DM if discord username provided and DM not yet sent
        if (inv.invitedDiscord && !inv.dmSent) {
          try {
            const dmUserId = inv.discordUserId || (() => {
              const found = (mR.ok && Array.isArray(mR.data))
                ? (mR.data as {user:{id:string;username:string}}[]).find(m => m.user.username.toLowerCase() === inv.invitedDiscord!.toLowerCase())
                : undefined;
              return found?.user.id || null;
            })();
            if (dmUserId) {
              const dmCh = await discordApi(token, 'POST', '/users/@me/channels', { recipient_id: dmUserId });
              if (dmCh.ok) {
                const dmMsg = `Hi ${inv.invitedName}! 👋 Welcome to **${inv.serverName}**! We're glad to have you.\n\nIf you need anything or have questions, feel free to reach out. Looking forward to working with you!`;
                await discordApi(token, 'POST', `/channels/${dmCh.data.id}/messages`, { content: dmMsg });
                inv.dmSent = true;
                addHistory(data, { action: 'invite_accepted', serverId: inv.serverId, staffName: inv.invitedName, details: `Welcome DM sent to ${inv.invitedName} on Discord`, performedBy: 'system' });
              }
            }
          } catch (e) {
            console.error('Auto DM failed for', inv.invitedName, e);
          }
        }
        updated++;
      }
    }
    // Secondary pass: match pending invites by Discord username against current members
    for (const inv of data.invites) {
      if (inv.status !== 'pending') continue;
      if (!inv.invitedDiscord) continue;
      const token = getBotToken(data, inv.serverId);
      if (!token) continue;
      try {
        const mR = await discordApi(token, 'GET', `/guilds/${inv.serverId}/members?limit=1000`);
        if (mR.ok && Array.isArray(mR.data)) {
          const found = (mR.data as {user:{id:string;username:string};joined_at:string}[]).find(
            m => m.user.username.toLowerCase() === inv.invitedDiscord!.toLowerCase()
          );
          if (found) {
            inv.status = 'accepted';
            inv.acceptedAt = found.joined_at || new Date().toISOString();
            inv.discordUserId = found.user.id;
            inv.discordUsername = found.user.username;
            addHistory(data, { action: 'invite_accepted', serverId: inv.serverId, staffName: inv.invitedName, details: `${inv.invitedName} found in ${inv.serverName} as @${found.user.username} (matched by username)`, performedBy: 'system' });
            updated++;
          }
        }
      } catch (e) { /* skip */ }
    }
    if (updated > 0) writeServers(data);
    return NextResponse.json({ ok: true, updated, invites: data.invites });
  }

  // ── Get live server members ──────────────────────────────────────────────────
  if (body.action === 'getMembers') {
    const { serverId } = body;
    if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });
    const token = getBotToken(data, serverId);
    if (!token) return NextResponse.json({ error: 'No bot token for this server' }, { status: 400 });
    const r = await discordApi(token, 'GET', `/guilds/${serverId}/members?limit=1000`);
    if (!r.ok) return NextResponse.json({ error: r.data?.message || 'Failed to fetch members' }, { status: 500 });
    const members = (r.data as {user:{id:string;username:string;discriminator:string};nick:string|null;joined_at:string}[])
      .filter(m => m.user.username !== 'Deleted User')
      .map(m => ({ id: m.user.id, username: m.user.username, nick: m.nick, joinedAt: m.joined_at }));
    return NextResponse.json({ ok: true, members });
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
    // Delete from list entirely instead of just marking revoked
    data.invites = data.invites.filter(i => i.id !== inviteId);
    addHistory(data, { action: 'invite_revoked', staffName: inv.invitedName, details: `Invite to ${inv.invitedName} revoked and deleted`, performedBy: by });
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

  // ── Sync all Discord roles ──────────────────────────────────────────────
  // ── Sync All (roles + lock channels + agent permissions) ────────────────────
  if (body.action === 'syncAll') {
    // 1. Lock all channels
    const DENY_V = (BigInt(1024)|BigInt(2048)|BigInt(65536)).toString();
    const ALLOW_V = '379904';
    const OPEN_V = new Set(['general','main','activity-planner']);
    const cRolesV = (data.config as unknown as { channelRoles?: Record<string, Record<string, { roleId: string; channelName: string }>> })?.channelRoles ?? {};
    let fixedChannels = 0;
    for (const [guildId] of Object.entries(data.servers)) {
      const tok = getBotToken(data, guildId);
      if (!tok) continue;
      const chRes = await discordApi(tok, 'GET', `/guilds/${guildId}/channels`);
      if (!chRes.ok || !Array.isArray(chRes.data)) continue;
      const rolesRes = await discordApi(tok, 'GET', `/guilds/${guildId}/roles`);
      const ownerR = rolesRes.ok && Array.isArray(rolesRes.data) ? (rolesRes.data as {id:string;name:string}[]).find(r=>r.name==='Owner') : null;
      for (const ch of (chRes.data as {id:string;name:string;type:number;permission_overwrites:{id:string;deny:string;type:number}[]}[])) {
        if (ch.type !== 0 || OPEN_V.has(ch.name)) continue;
        const evDeny = ch.permission_overwrites?.find(p=>p.id===guildId&&parseInt(p.deny)>0);
        const rInfo = cRolesV[guildId]?.[ch.id];
        if (evDeny && rInfo) continue;
        let rId = rInfo?.roleId;
        if (!rInfo) {
          const nr = await discordApi(tok,'POST',`/guilds/${guildId}/roles`,{name:`ch-${ch.name}`,permissions:'0',mentionable:false,hoist:false});
          if (nr.ok && nr.data?.id) { rId=nr.data.id; if(!cRolesV[guildId])cRolesV[guildId]={};cRolesV[guildId][ch.id]={roleId:rId,channelName:ch.name}; }
        }
        await discordApi(tok,'PUT',`/channels/${ch.id}/permissions/${guildId}`,{type:0,deny:DENY_V,allow:'0'});
        if (rId) await discordApi(tok,'PUT',`/channels/${ch.id}/permissions/${rId}`,{type:0,allow:ALLOW_V,deny:'0'});
        if (ownerR) await discordApi(tok,'PUT',`/channels/${ch.id}/permissions/${ownerR.id}`,{type:0,allow:ALLOW_V,deny:'0'});
        fixedChannels++;
      }
    }
    (data.config as unknown as { channelRoles: unknown }).channelRoles = cRolesV;
    // 2. Sync all roles
    let synced = 0;
    for (const member of data.staff) {
      if (member.channelAssignments?.length || member.serverAdmins?.length) {
        await syncDiscordRolesForMember(data, member).catch(console.error);
        synced++;
      }
    }
    writeServers(data);
    // Fire-and-forget: clear stale thinking blocks on all servers
    const WS = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'agents', 'axelsonnet4', 'workspace');
    const THINKING_SCRIPT = path.join(WS, 'fix-all-thinking-blocks.py');       // Linux servers
    const STONYX_FULL_SCRIPT = path.join(WS, 'reset-all-stonyx.py');           // Stonyx full reset
    const STONYX_SCRIPT = path.join(WS, 'fix-stonyx-thinking2.py');            // Stonyx trajectory only
    const AGENT_SYNC_SCRIPT = path.join(WS, 'sync-channel-assignments-to-agents.py');
    [THINKING_SCRIPT, STONYX_FULL_SCRIPT, STONYX_SCRIPT, AGENT_SYNC_SCRIPT].forEach(script => {
      try {
        const child = spawn('python', [script], { detached: true, stdio: 'ignore' });
        child.unref();
      } catch { /* ignore */ }
    });
    return NextResponse.json({ ok: true, fixedChannels, synced, backgroundTasks: 'clearing thinking blocks on all 4 servers (including Stonyx) + syncing agent permissions' });
  }

  if (body.action === 'syncAllRoles') {
    let synced = 0;
    for (const member of data.staff) {
      // Sync anyone with channel assignments OR server admin status
      if (member.channelAssignments?.length || member.serverAdmins?.length) {
        await syncDiscordRolesForMember(data, member).catch(console.error);
        synced++;
      }
    }
    writeServers(data);
    return NextResponse.json({ ok: true, synced });
  }

  // ── Lock all channels across all servers ──────────────────────────────
  // ── Clear thinking blocks for a specific channel ────────────────────
  if (body.action === 'clearChannelThinking') {
    const { serverId: clearServerId, channelId: clearChannelId } = body;
    if (!clearServerId || !clearChannelId) return NextResponse.json({ error: 'serverId and channelId required' }, { status: 400 });
    // Find the agent for this channel
    const clearServer = data.servers[clearServerId];
    const clearChannel = clearServer?.channels?.find((c: {id: string; agentId?: string}) => c.id === clearChannelId);
    const agentId = clearChannel?.agentId;
    const machinesMap = (data.config as unknown as { machines?: Record<string, { host?: string; port?: number; user?: string; password?: string }> })?.machines ?? {};
    const machine = machinesMap[clearServerId];
    if (!machine?.host || !machine?.password) return NextResponse.json({ error: 'No SSH credentials for this server' }, { status: 400 });
    // Run hard session reset script for this specific channel
    const resetScript = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'workspace', 'reset-channel-sessions.py');
    const child = spawn('python', [resetScript, clearServerId, clearChannelId], { detached: true, stdio: 'ignore' });
    child.unref();
    return NextResponse.json({ ok: true, message: `Hard-resetting all sessions for #${clearChannel?.name || clearChannelId} on ${clearServer?.name || clearServerId}. The agent will start fresh on next message.`, agentId });
  }

  if (body.action === 'lockAllChannels') {
    const DENY = (BigInt(1024)|BigInt(2048)|BigInt(65536)).toString();
    const ALLOW_FULL = '379904';
    const OPEN_CHANNELS = new Set(['general','main','activity-planner']);
    const channelRolesMap = (data.config as unknown as { channelRoles?: Record<string, Record<string, { roleId: string; channelName: string }>> })?.channelRoles ?? {};
    let totalFixed = 0;

    for (const [guildId, server] of Object.entries(data.servers)) {
      const token = getBotToken(data, guildId);
      if (!token) continue;
      const channelsRes = await discordApi(token, 'GET', `/guilds/${guildId}/channels`);
      if (!channelsRes.ok || !Array.isArray(channelsRes.data)) continue;
      const rolesRes = await discordApi(token, 'GET', `/guilds/${guildId}/roles`);
      const ownerRole = rolesRes.ok && Array.isArray(rolesRes.data) ? (rolesRes.data as {id:string;name:string}[]).find(r => r.name === 'Owner') : null;

      for (const ch of (channelsRes.data as {id:string;name:string;type:number;permission_overwrites:{id:string;deny:string;type:number}[]}[])) {
        if (ch.type !== 0 || OPEN_CHANNELS.has(ch.name)) continue;
        const everyoneDeny = ch.permission_overwrites?.find(p => p.id === guildId && parseInt(p.deny) > 0);
        const roleInfo = channelRolesMap[guildId]?.[ch.id];
        if (everyoneDeny && roleInfo) continue; // already set up

        // Create role if missing
        let roleId = roleInfo?.roleId;
        if (!roleInfo) {
          const nr = await discordApi(token, 'POST', `/guilds/${guildId}/roles`, { name: `ch-${ch.name}`, permissions: '0', mentionable: false, hoist: false });
          if (nr.ok && nr.data.id) {
            roleId = nr.data.id;
            if (!channelRolesMap[guildId]) channelRolesMap[guildId] = {};
            channelRolesMap[guildId][ch.id] = { roleId, channelName: ch.name };
          }
        }
        await discordApi(token, 'PUT', `/channels/${ch.id}/permissions/${guildId}`, { type: 0, deny: DENY, allow: '0' });
        if (roleId) await discordApi(token, 'PUT', `/channels/${ch.id}/permissions/${roleId}`, { type: 0, allow: ALLOW_FULL, deny: '0' });
        if (ownerRole) await discordApi(token, 'PUT', `/channels/${ch.id}/permissions/${ownerRole.id}`, { type: 0, allow: ALLOW_FULL, deny: '0' });
        totalFixed++;
      }
    }
    (data.config as unknown as { channelRoles: unknown }).channelRoles = channelRolesMap;
    writeServers(data);
    return NextResponse.json({ ok: true, fixed: totalFixed });
  }

  // ── Sync agent permissions (update AGENTS.md on all servers) ──────────────────
  if (body.action === 'syncAgentPermissions') {
    const agentSyncScript = path.join(process.env.USERPROFILE || process.env.HOME || '', '.openclaw', 'agents', 'axelsonnet4', 'workspace', 'sync-channel-assignments-to-agents.py');
    try {
      const child = spawn('python', [agentSyncScript], { detached: true, stdio: 'ignore' });
      child.unref();
      return NextResponse.json({ ok: true, updated: 'running in background', message: 'Agent permissions sync started. All agent AGENTS.md files will be updated with current staff assignments (takes ~30s).' });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

