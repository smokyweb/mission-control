"use client";

import { useState, useEffect, useCallback } from "react";

const GOLD = "#f5c200";
const GOLD_DIM = "rgba(245,194,0,0.10)";
const GOLD_BORDER = "rgba(245,194,0,0.20)";
const CARD_BG = "#1A1A2E";
const PAGE_BG = "#0A0A0F";

const MODELS = [
  { label: "Sonnet",   value: "anthropic/claude-sonnet-4-6", color: "#a855f7" },
  { label: "GPT",      value: "openai/gpt-5.4",              color: "#3b82f6" },
  { label: "Gemini",   value: "google/gemini-2.5-flash",     color: "#10b981" },
  { label: "DeepSeek", value: "deepseek/deepseek-chat",      color: "#06b6d4" },
  { label: "Opus",     value: "anthropic/claude-opus-4-7",   color: "#f59e0b" },
];

const ROLES: Record<string, { label: string; color: string; bg: string }> = {
  superadmin: { label: "Super Admin", color: "#f5c200", bg: "rgba(245,194,0,0.15)" },
  admin:      { label: "Admin",       color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  staff:      { label: "Staff",       color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
};

const SERVER_COLORS: Record<string, string> = {
  Stonyx: "#6366f1", Skywork1: "#3b82f6", Skywork2: "#06b6d4", Staxyl: "#10b981", Calyx: "#f97316",
};

interface Channel { name: string; id: string; model: string; agentId: string; }
interface Server { name: string; channels: Channel[]; }
interface ChannelAssignment { serverId: string; channelId: string; channelName: string; serverName: string; }
interface Invite {
  id: string; code: string; url: string;
  invitedName: string; invitedEmail: string; invitedDiscord: string;
  serverId: string; serverName: string; role: string;
  channelAssignments: ChannelAssignment[];
  status: "pending" | "accepted" | "revoked" | "expired" | "converted";
  discordUserId: string | null; discordUsername: string | null;
  createdAt: string; acceptedAt: string | null; expiresAt: string;
}
interface StaffMember {
  id: string; name: string; discordUsername: string; discordId: string;
  role: "superadmin" | "admin" | "staff";
  serverAdmins: string[];
  channelAssignments: ChannelAssignment[];
  addedAt: string; addedBy: string;
}
interface PortalUser {
  id: string; username: string; role: "superadmin" | "admin" | "staff";
  staffId?: string; createdAt: string; lastLogin?: string;
}
interface HistoryEntry {
  id: string; timestamp: string; action: string; serverId?: string;
  channelName?: string; model?: string; staffName?: string;
  userId?: string; details: string; performedBy: string;
}
interface ServersData {
  config: { discordBotToken: string };
  servers: Record<string, Server>;
  staff: StaffMember[];
  portalUsers: PortalUser[];
  invites: Invite[];
  history: HistoryEntry[];
  lastUpdated: string;
}

// Portal user prop — null means full Bat Cave (admin/kevin), non-null means portal login
type PortalUserProp = { id: string; username: string; role: "superadmin" | "admin" | "staff"; staffId?: string } | null;

function modelColor(value: string) { return MODELS.find(m => m.value === value)?.color ?? "#888"; }
function modelLabel(value: string) { return MODELS.find(m => m.value === value)?.label ?? value.split("/").pop() ?? value; }

function RoleBadge({ role }: { role: string }) {
  const r = ROLES[role] ?? ROLES.staff;
  return <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: r.bg, color: r.color, fontWeight: 700 }}>{r.label}</span>;
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "#0A0A0F", border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "13px", boxSizing: "border-box" }} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "#0A0A0F", border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "13px", boxSizing: "border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ onClick, children, variant = "primary", disabled = false, size = "md" }: { onClick: () => void; children: React.ReactNode; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; size?: "sm" | "md" }) {
  const bg = { primary: disabled ? "#333" : GOLD, ghost: "transparent", danger: "rgba(239,68,68,0.1)" };
  const color = { primary: "#000", ghost: "rgba(255,255,255,0.5)", danger: "#ef4444" };
  const border = { primary: "none", ghost: `1px solid ${GOLD_BORDER}`, danger: "1px solid rgba(239,68,68,0.2)" };
  const p = size === "sm" ? "5px 12px" : "8px 18px";
  return <button onClick={onClick} disabled={disabled} style={{ padding: p, borderRadius: "8px", fontWeight: 700, fontSize: "13px", background: bg[variant], color: color[variant], border: border[variant], cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>;
}

function Modal({ onClose, title, children, width = 520 }: { onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "16px", padding: "28px", width, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: GOLD, fontSize: "15px", fontWeight: 700 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── Access helpers ──────────────────────────────────────────────────────────
function isSuperAdmin(u: PortalUserProp) { return !u || u.role === "superadmin"; }
function isAdmin(u: PortalUserProp)      { return !u || u.role === "superadmin" || u.role === "admin"; }
function isStaffOnly(u: PortalUserProp)  { return u?.role === "staff"; }

// Returns the channel IDs a staff user is assigned to (across all servers)
function staffChannelIds(u: PortalUserProp, staff: StaffMember[]): { serverId: string; channelId: string }[] {
  if (!u || !isStaffOnly(u)) return [];
  const member = staff.find(s => s.id === u.staffId);
  if (!member) return [];
  return member.channelAssignments.map(a => ({ serverId: a.serverId, channelId: a.channelId }));
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ServersClient({ portalUser = null }: { portalUser?: PortalUserProp }) {
  const [data, setData] = useState<ServersData | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"servers" | "staff" | "users" | "history">("servers");
  const [serverTab, setServerTab] = useState<"channels" | "manage">("channels");
  const [saving, setSaving] = useState<string | null>(null);
  const [globalModel, setGlobalModel] = useState("anthropic/claude-sonnet-4-6");
  const [applyingGlobal, setApplyingGlobal] = useState(false);

  const [staffModal, setStaffModal] = useState<StaffMember | null | "new">(null);
  const [sf, setSf] = useState({ name: "", discordUsername: "", discordId: "", role: "staff", serverAdmins: [] as string[], channelAssignments: [] as ChannelAssignment[] });

  const [userModal, setUserModal] = useState<PortalUser | null | "new">(null);
  const [uf, setUf] = useState({ username: "", password: "", role: "staff", staffId: "" });

  const [channelRename, setChannelRename] = useState<{ id: string; name: string } | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [addChannelName, setAddChannelName] = useState("");
  const [addChannelModel, setAddChannelModel] = useState("anthropic/claude-sonnet-4-6");
  const [addingChannel, setAddingChannel] = useState(false);

  const [inviteModal, setInviteModal] = useState<{ serverId: string; serverName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Invite system
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [checkingInvites, setCheckingInvites] = useState(false);
  const [invF, setInvF] = useState({ name: "", email: "", discord: "", serverId: "", role: "staff", channelAssignments: [] as ChannelAssignment[] });
  const [createdInvite, setCreatedInvite] = useState<Invite | null>(null);
  const [invCopied, setInvCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [sendingDM, setSendingDM] = useState<string | null>(null);
  const [serverMembers, setServerMembers] = useState<{id:string;username:string;nick:string|null;joinedAt:string;serverId:string;serverName:string}[]>([]);
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [syncingRoles, setSyncingRoles] = useState(false);
  const [lockingChannels, setLockingChannels] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingAgentPerms, setSyncingAgentPerms] = useState(false);
  const [clearingThinking, setClearingThinking] = useState<string | null>(null);
  const [provisionModal, setProvisionModal] = useState<{ serverId: string; serverName: string } | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ ok?: boolean; error?: string; provisioned: number; skipped: number; results: { agent: string; channel: string; model?: string; status: string }[] } | null>(null);
  const [botToken, setBotToken] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/servers");
    const json = await res.json();
    setData(json);
    if (!selectedServer && json.servers) {
      const first = Object.keys(json.servers)[0];
      if (first) setSelectedServer(first);
    }
    setBotToken(json.config?.discordBotToken || "");
  }, [selectedServer]);

  useEffect(() => { load(); }, [load]);

  const api = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch("/api/servers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const json = await res.json();
    if (!json.ok && json.error) alert(json.error);
    return json;
  };

  const updateModel = async (channelId: string, model: string, serverId?: string) => {
    const sid = serverId || selectedServer;
    if (!sid) return;
    setSaving(channelId);
    await api("updateModel", { serverId: sid, channelId, model });
    await load();
    setSaving(null);
  };

  const applyGlobal = async () => {
    if (!selectedServer) return;
    setApplyingGlobal(true);
    await api("updateServerModel", { serverId: selectedServer, model: globalModel });
    await load();
    setApplyingGlobal(false);
  };

  const openStaff = (m: StaffMember | "new") => {
    if (m === "new") setSf({ name: "", discordUsername: "", discordId: "", role: "staff", serverAdmins: [], channelAssignments: [] });
    else setSf({ name: m.name, discordUsername: m.discordUsername, discordId: m.discordId, role: m.role, serverAdmins: m.serverAdmins, channelAssignments: m.channelAssignments });
    setStaffModal(m);
  };

  const saveStaff = async () => {
    if (staffModal === "new") await api("addStaff", sf);
    else if (staffModal) await api("updateStaff", { id: (staffModal as StaffMember).id, ...sf });
    setStaffModal(null);
    await load();
  };

  const removeStaff = async (id: string) => {
    if (!confirm("Remove this staff member?")) return;
    await api("removeStaff", { id });
    await load();
  };

  const openUser = (u: PortalUser | "new") => {
    if (u === "new") setUf({ username: "", password: "", role: "staff", staffId: "" });
    else setUf({ username: u.username, password: "", role: u.role, staffId: u.staffId || "" });
    setUserModal(u);
  };

  const saveUser = async () => {
    if (!uf.username) return;
    if (userModal === "new") {
      if (!uf.password) { alert("Password required"); return; }
      await api("addPortalUser", uf);
    } else if (userModal) {
      await api("updatePortalUser", { id: (userModal as PortalUser).id, role: uf.role, staffId: uf.staffId || undefined, ...(uf.password ? { password: uf.password } : {}) });
    }
    setUserModal(null);
    await load();
  };

  const removeUser = async (id: string) => {
    if (!confirm("Remove this user?")) return;
    await api("removePortalUser", { id });
    await load();
  };

  const doRename = async () => {
    if (!channelRename || !newChannelName || !selectedServer) return;
    await api("renameChannel", { serverId: selectedServer, channelId: channelRename.id, newName: newChannelName });
    setChannelRename(null); setNewChannelName("");
    await load();
  };

  const doDeleteChannel = async (channelId: string, name: string) => {
    if (!confirm(`Delete #${name} from Discord?\n\nNote: The agent workspace is PRESERVED on the remote machine.`)) return;
    await api("deleteChannel", { serverId: selectedServer, channelId });
    await load();
  };

  const doAddChannel = async () => {
    if (!addChannelName || !selectedServer) return;
    setAddingChannel(true);
    await api("addChannel", { serverId: selectedServer, name: addChannelName, model: addChannelModel });
    setAddChannelName(""); setAddingChannel(false);
    await load();
  };

  // Invite handlers
  const createInvite = async () => {
    if (!invF.name || !invF.serverId) return;
    const r = await api("createInvite", {
      invitedName: invF.name,
      invitedEmail: invF.email,
      invitedDiscord: invF.discord,
      serverId: invF.serverId,
      role: invF.role,
      channelAssignments: invF.channelAssignments,
    });
    if (r.ok) { setCreatedInvite(r.invite); setInvCopied(false); setInviteEmailSent(!!r.emailSent); await load(); }
  };

  const checkInvites = async () => {
    setCheckingInvites(true);
    await api("checkInvites");
    await load();
    setCheckingInvites(false);
  };

  const syncMembers = async () => {
    setSyncingMembers(true);
    // Sync all servers at once
    const allMembers: {id:string;username:string;nick:string|null;joinedAt:string;serverId:string;serverName:string}[] = [];
    for (const [sid, srv] of Object.entries(servers)) {
      const r = await api("getMembers", { serverId: sid });
      if (r.ok) {
        r.members.forEach((m: {id:string;username:string;nick:string|null;joinedAt:string}) => {
          allMembers.push({ ...m, serverId: sid, serverName: (srv as {name:string}).name });
        });
      }
    }
    // Deduplicate by user id (same person may be in multiple servers)
    const seen = new Set<string>();
    const deduped = allMembers.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
    setServerMembers(deduped);
    setSyncingMembers(false);
  };

  const syncAllRoles = async () => {
    setSyncingRoles(true);
    const r = await api('syncAllRoles', {});
    setSyncingRoles(false);
    if (r.ok) alert(`Roles synced for ${r.synced} staff members across all servers.`);
    else alert('Sync failed: ' + (r.error || 'unknown error'));
  };

  const lockAllChannels = async () => {
    if (!confirm('Lock & register all unlocked channels across all servers? This will create ch-* roles for any channels missing them.')) return;
    setLockingChannels(true);
    const r = await api('lockAllChannels', {});
    setLockingChannels(false);
    if (r.ok) alert(`Done! Fixed ${r.fixed} unlocked channels across all servers.`);
    else alert('Failed: ' + (r.error || 'unknown error'));
  };

  const clearChannelThinking = async (serverId: string, channelId: string, channelName: string) => {
    if (!confirm(`Clear thinking blocks for #${channelName}? This fixes the "Invalid signature in thinking block" error.`)) return;
    setClearingThinking(channelId);
    const r = await api('clearChannelThinking', { serverId, channelId });
    setClearingThinking(null);
    if (r.ok) alert(`✅ Cleared! ${r.message}`);
    else alert('Failed: ' + (r.error || 'unknown'));
  };

  const syncEverything = async () => {
    setSyncingAll(true);
    const r = await api('syncAll', {});
    setSyncingAll(false);
    if (r.ok) alert(`Sync complete!\nLocked ${r.fixedChannels} new channels\nSynced ${r.synced} staff members\nClearing thinking blocks in background...`);
    else alert('Sync failed: ' + (r.error || 'unknown error'));
  };

  const syncAgentPermissions = async () => {
    setSyncingAgentPerms(true);
    const r = await api('syncAgentPermissions', {});
    setSyncingAgentPerms(false);
    if (r.ok) alert(`Agent permissions synced!\nUpdated ${r.updated} agent AGENTS.md files with current staff assignments.\nAgents will now recognize all assigned staff.`);
    else alert('Sync failed: ' + (r.error || 'unknown error'));
  };

  const addMemberAsStaff = async (member: {id:string;username:string;serverId:string}) => {
    // Look up full name from existing invites first
    const matchedInvite = data?.invites?.find(
      i => i.invitedDiscord?.toLowerCase() === member.username.toLowerCase()
    );
    const defaultName = matchedInvite?.invitedName || member.username;
    const name = matchedInvite?.invitedName || prompt(`Full name for @${member.username}?`, member.username);
    if (!name) return;
    const r = await api("addStaff", { name, discordUsername: member.username, discordId: member.id, serverId: member.serverId, role: matchedInvite?.role || 'staff' });
    if (r.ok) { await load(); setServerMembers(prev => prev.filter(m => m.id !== member.id)); }
  };

  const convertInvite = async (inviteId: string) => {
    const r = await api("convertInvite", { inviteId });
    if (r.ok) { await load(); alert(`${r.member.name} added as staff member!`); }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invite? The link will no longer work.")) return;
    await api("revokeInvite", { inviteId });
    await load();
  };

  const sendDM = async (inviteId: string) => {
    setSendingDM(inviteId);
    const r = await api("sendDM", { inviteId });
    if (r.ok) alert("Discord DM sent!");
    setSendingDM(null);
  };

  const copyInvLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setInvCopied(true);
    setTimeout(() => setInvCopied(false), 2000);
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    await api("updateConfig", { discordBotToken: botToken });
    setSavingConfig(false); setShowConfig(false);
    await load();
  };

  const toggleChannelAssignment = (serverId: string, channelId: string, channelName: string, serverName: string) => {
    const exists = sf.channelAssignments.find(a => a.serverId === serverId && a.channelId === channelId);
    if (exists) setSf(p => ({ ...p, channelAssignments: p.channelAssignments.filter(a => !(a.serverId === serverId && a.channelId === channelId)) }));
    else setSf(p => ({ ...p, channelAssignments: [...p.channelAssignments, { serverId, channelId, channelName, serverName }] }));
  };

  const toggleServerAdmin = (serverId: string) => {
    const exists = sf.serverAdmins.includes(serverId);
    setSf(p => ({ ...p, serverAdmins: exists ? p.serverAdmins.filter(id => id !== serverId) : [...p.serverAdmins, serverId] }));
  };

  const inviteLink = (serverId: string) => `https://discord.com/oauth2/authorize?client_id=BOT_ID&permissions=8&scope=bot%20applications.commands&guild_id=${serverId}`;

  const copyInvite = async (serverId: string) => {
    await navigator.clipboard.writeText(inviteLink(serverId));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: PAGE_BG, color: GOLD }}>Loading...</div>;

  // Hide servers not yet fully provisioned (no SSH credentials)
  const HIDDEN_SERVERS = ['1483827032638099528']; // Calyx — pending setup
  const servers = Object.fromEntries(
    Object.entries(data.servers || {}).filter(([id]) => !HIDDEN_SERVERS.includes(id))
  );
  const server = selectedServer ? servers[selectedServer] : null;
  const staff = data.staff || [];
  const portalUsers = data.portalUsers || [];
  const invites = data.invites || [];
  const history = data.history || [];

  // ── Role-derived permissions ────────────────────────────────────────────
  const canConfig    = isSuperAdmin(portalUser);
  const canManageStaff = isAdmin(portalUser);
  const canManageUsers = isAdmin(portalUser);
  // Admins can only manage non-superadmin users; only superadmin can touch superadmin accounts
  const canEditUser  = (u: PortalUser) => isSuperAdmin(portalUser) || u.role !== "superadmin";
  const canDeleteUser = (u: PortalUser) => isSuperAdmin(portalUser) || u.role !== "superadmin";
  // Role options available when adding/editing — admins cannot assign superadmin
  const allowedRoleOptions = isSuperAdmin(portalUser)
    ? [{ label: "Super Admin", value: "superadmin" }, { label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }]
    : [{ label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }];
  const canViewHistory = true; // all roles
  const canManageChannels = isAdmin(portalUser); // rename/delete/add channels
  const canGlobalModel = isAdmin(portalUser);
  const canProvision = isAdmin(portalUser);
  const canInvite = isAdmin(portalUser);
  const staffOnlyMode = isStaffOnly(portalUser);

  // For staff: which channels they can touch
  const myChannelIds = staffChannelIds(portalUser, staff);

  // Tabs available to this user
  const availableTabs: ("servers" | "staff" | "users" | "history")[] = ["servers"];
  if (canManageStaff) availableTabs.push("staff");
  if (canManageUsers) availableTabs.push("users");
  availableTabs.push("history");

  // ── STAFF-ONLY VIEW: My Channels ─────────────────────────────────────────
  if (staffOnlyMode) {
    // Collect all channels assigned to this staff member
    const myChannels: { server: Server; serverId: string; channel: Channel }[] = [];
    for (const [sid, srv] of Object.entries(servers)) {
      for (const ch of srv.channels) {
        if (myChannelIds.some(a => a.serverId === sid && a.channelId === ch.id)) {
          myChannels.push({ server: srv, serverId: sid, channel: ch });
        }
      }
    }

    return (
      <div style={{ background: PAGE_BG, minHeight: "100vh", color: "#fff", padding: "28px 36px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: GOLD, margin: 0 }}>MY CHANNELS</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", marginTop: "4px" }}>Change the agent model for your assigned channels</p>
        </div>

        {myChannels.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 40px", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
            <div>No channels assigned to your account yet.</div>
            <div style={{ fontSize: "12px", marginTop: "6px" }}>Contact an admin to get channel access.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "640px" }}>
            {myChannels.map(({ server: srv, serverId, channel: ch }) => {
              const color = SERVER_COLORS[srv.name] ?? "#6366f1";
              return (
                <div key={`${serverId}-${ch.id}`} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "12px", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: "11px", color, fontWeight: 700 }}>{srv.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "15px" }}>#</span>
                        <span style={{ fontSize: "15px", fontWeight: 600 }}>{ch.name}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{ch.agentId}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {saving === ch.id && <span style={{ fontSize: "10px", color: GOLD }}>Saving…</span>}
                      <select
                        value={ch.model}
                        onChange={e => updateModel(ch.id, e.target.value, serverId)}
                        disabled={saving === ch.id}
                        style={{ background: `${modelColor(ch.model)}22`, border: `1px solid ${modelColor(ch.model)}66`, color: modelColor(ch.model), padding: "6px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History — read only */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: "12px", letterSpacing: "0.04em" }}>RECENT HISTORY</div>
          {history.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>No history yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", maxWidth: "640px" }}>
              {[...history].reverse().slice(0, 20).map(h => (
                <div key={h.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "7px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", minWidth: "120px" }}>{new Date(h.timestamp).toLocaleString()}</div>
                  <div style={{ flex: 1, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{h.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN / SUPERADMIN FULL VIEW ─────────────────────────────────────────
  return (
    <div style={{ background: PAGE_BG, minHeight: "100vh", color: "#fff", padding: "28px 36px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: GOLD, margin: 0, letterSpacing: "0.04em" }}>SERVER CONTROL PANEL</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", marginTop: "4px" }}>Manage servers, channels, staff, and agent models</p>
        </div>
        {canConfig && (
          <button onClick={() => setShowConfig(true)} style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "12px", background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}`, cursor: "pointer" }}>⚙ Config</button>
        )}
      </div>

      {/* Main Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${GOLD_BORDER}`, marginBottom: "24px" }}>
        {availableTabs.map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ padding: "10px 22px", fontSize: "13px", fontWeight: mainTab === t ? 700 : 400, color: mainTab === t ? GOLD : "rgba(255,255,255,0.4)", borderBottom: mainTab === t ? `2px solid ${GOLD}` : "2px solid transparent", background: "transparent", border: "none", cursor: "pointer", textTransform: "capitalize" }}>
            {t === "staff" ? `Staff (${new Set(staff.map(s => s.discordUsername?.toLowerCase() || s.id)).size})` : t === "users" ? `Users (${portalUsers.length})` : t === "history" ? `History (${history.length})` : "Servers"}
          </button>
        ))}
      </div>

      {/* ── SERVERS TAB ─────────────────────────────────────────────────────── */}
      {mainTab === "servers" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {Object.entries(servers).map(([id, s]) => {
              const active = id === selectedServer;
              const color = SERVER_COLORS[s.name] ?? "#6366f1";
              return (
                <button key={id} onClick={() => { setSelectedServer(id); setServerTab("channels"); }} style={{ background: active ? `${color}22` : CARD_BG, border: `1px solid ${active ? color : GOLD_BORDER}`, borderRadius: "12px", padding: "18px", cursor: "pointer", textAlign: "left", boxShadow: active ? `0 0 0 2px ${color}44` : "none", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span style={{ fontWeight: 700, fontSize: "14px", color: active ? color : "#fff" }}>{s.name}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>{s.channels.length} channels</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                    {Array.from(new Set(s.channels.map(c => modelLabel(c.model)))).map(m => (
                      <span key={m} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "99px", background: `${modelColor(MODELS.find(x => x.label === m)?.value ?? "")}22`, color: modelColor(MODELS.find(x => x.label === m)?.value ?? ""), border: `1px solid ${modelColor(MODELS.find(x => x.label === m)?.value ?? "")}44` }}>{m}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {server && selectedServer && (
            <div style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${GOLD_BORDER}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: SERVER_COLORS[server.name] ?? "#6366f1", boxShadow: `0 0 8px ${SERVER_COLORS[server.name] ?? "#6366f1"}` }} />
                  <span style={{ fontWeight: 700, fontSize: "16px" }}>{server.name}</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{selectedServer}</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {canInvite && <Btn onClick={() => { setShowInviteForm(true); setCreatedInvite(null); setInviteEmailSent(false); setInvF({ name: "", email: "", discord: "", serverId: selectedServer, role: "staff", channelAssignments: [] }); }} variant="ghost" size="sm">📧 Send Invite</Btn>}
                </div>
              </div>

              {/* Server sub-tabs — Manage only for admins */}
              <div style={{ display: "flex", borderBottom: `1px solid ${GOLD_BORDER}` }}>
                <button onClick={() => setServerTab("channels")} style={{ padding: "10px 20px", fontSize: "12px", fontWeight: serverTab === "channels" ? 700 : 400, color: serverTab === "channels" ? GOLD : "rgba(255,255,255,0.4)", borderBottom: serverTab === "channels" ? `2px solid ${GOLD}` : "2px solid transparent", background: "transparent", border: "none", cursor: "pointer" }}>
                  Channels ({server.channels.length})
                </button>
                {canManageChannels && (
                  <button onClick={() => setServerTab("manage")} style={{ padding: "10px 20px", fontSize: "12px", fontWeight: serverTab === "manage" ? 700 : 400, color: serverTab === "manage" ? GOLD : "rgba(255,255,255,0.4)", borderBottom: serverTab === "manage" ? `2px solid ${GOLD}` : "2px solid transparent", background: "transparent", border: "none", cursor: "pointer" }}>
                    Manage Channels
                  </button>
                )}
              </div>

              {/* Channels Tab */}
              {serverTab === "channels" && (
                <div style={{ padding: "20px" }}>
                  {canGlobalModel && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "10px", background: PAGE_BG, border: `1px solid ${GOLD_BORDER}`, marginBottom: "16px" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>Set all to:</span>
                      <select value={globalModel} onChange={e => setGlobalModel(e.target.value)} style={{ background: "#1A1A2E", border: `1px solid ${GOLD_BORDER}`, color: "#fff", padding: "5px 10px", borderRadius: "6px", fontSize: "12px", flex: 1, maxWidth: "200px" }}>
                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <Btn onClick={applyGlobal} disabled={applyingGlobal} size="sm">{applyingGlobal ? "Applying..." : "Apply to All"}</Btn>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {server.channels.map(ch => {
                      const assignedStaff = staff.filter(s => s.channelAssignments.some(a => a.serverId === selectedServer && a.channelId === ch.id));
                      return (
                        <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", background: PAGE_BG, border: `1px solid ${GOLD_BORDER}`, gap: "12px" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>#</span>
                              <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{ch.agentId}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", flex: 2, minWidth: 0 }}>
                            {assignedStaff.length === 0 ? (
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No staff assigned</span>
                            ) : (
                              assignedStaff.map(s => (
                                <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 8px", borderRadius: "99px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "11px", whiteSpace: "nowrap" }}>
                                  <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: GOLD, flexShrink: 0 }}>
                                    {s.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{s.name}</span>
                                  <RoleBadge role={s.role} />
                                </span>
                              ))
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            {saving === ch.id && <span style={{ fontSize: "10px", color: GOLD }}>...</span>}
                            <select value={ch.model} onChange={e => updateModel(ch.id, e.target.value)} disabled={saving === ch.id} style={{ background: `${modelColor(ch.model)}22`, border: `1px solid ${modelColor(ch.model)}66`, color: modelColor(ch.model), padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manage Channels Tab — admin+ only */}
              {serverTab === "manage" && canManageChannels && (
                <div style={{ padding: "20px" }}>
                  <div style={{ padding: "16px", borderRadius: "10px", background: PAGE_BG, border: `1px solid ${GOLD_BORDER}`, marginBottom: "20px" }}>
                    <div style={{ fontSize: "12px", color: GOLD, fontWeight: 700, marginBottom: "12px" }}>Add New Channel</div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <input value={addChannelName} onChange={e => setAddChannelName(e.target.value)} placeholder="channel-name" style={{ flex: 1, minWidth: "160px", padding: "7px 12px", borderRadius: "8px", background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "13px" }} />
                      <select value={addChannelModel} onChange={e => setAddChannelModel(e.target.value)} style={{ padding: "7px 12px", borderRadius: "8px", background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "13px" }}>
                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <Btn onClick={doAddChannel} disabled={!addChannelName || addingChannel} size="sm">{addingChannel ? "Creating..." : "Create"}</Btn>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Requires Discord bot token in Config ⚙ — Agent workspace auto-provisions in background.</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {server.channels.map(ch => (
                      <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", background: PAGE_BG, border: `1px solid ${GOLD_BORDER}` }}>
                        <div>
                          <span style={{ color: "rgba(255,255,255,0.3)" }}>#</span> <span style={{ fontSize: "13px" }}>{ch.name}</span>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginLeft: "8px" }}>{ch.id}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Btn onClick={() => { setChannelRename({ id: ch.id, name: ch.name }); setNewChannelName(ch.name); }} variant="ghost" size="sm">Rename</Btn>
                          <Btn onClick={() => clearChannelThinking(selectedServer, ch.id, ch.name)} variant="ghost" size="sm" disabled={clearingThinking === ch.id}>{clearingThinking === ch.id ? '⏳' : '🧹'} Clear Thinking</Btn>
                          <Btn onClick={() => doDeleteChannel(ch.id, ch.name)} variant="danger" size="sm">Delete</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── STAFF TAB — admin+ only ───────────────────────────────────────── */}
      {mainTab === "staff" && canManageStaff && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <Btn onClick={() => openStaff("new")} variant="ghost">+ Add Staff (manual)</Btn>
              <Btn onClick={() => { setShowInviteForm(true); setCreatedInvite(null); setInvF({ name: "", email: "", discord: "", serverId: "", role: "staff", channelAssignments: [] }); }}>&#9993; Send Invite</Btn>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {invites.filter(i => i.status === "pending").length > 0 && (
                <Btn onClick={checkInvites} disabled={checkingInvites} variant="ghost" size="sm">
                  {checkingInvites ? "Checking…" : `Check Invites (${invites.filter(i => i.status === "pending").length} pending)`}
                </Btn>
              )}
              <Btn onClick={syncMembers} disabled={syncingMembers} variant="ghost" size="sm">
                {syncingMembers ? "Syncing…" : "🔄 Sync Server Members"}
              </Btn>
              <button onClick={syncEverything} disabled={syncingAll} style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: syncingAll ? 'default' : 'pointer', background: 'rgba(245,197,0,0.15)', border: '1px solid rgba(245,197,0,0.4)', color: '#f5c518', opacity: syncingAll ? 0.6 : 1 }}>
                {syncingAll ? "⏳ Syncing Everything…" : "⚡ Sync Everything"}
              </button>
              <Btn onClick={syncAllRoles} disabled={syncingRoles} variant="ghost" size="sm">
                {syncingRoles ? "Syncing roles…" : "🔄 Sync Roles"}
              </Btn>
              <Btn onClick={lockAllChannels} disabled={lockingChannels} variant="ghost" size="sm">
                {lockingChannels ? "Locking…" : "🔒 Lock Channels"}
              </Btn>
              <Btn onClick={syncAgentPermissions} disabled={syncingAgentPerms} variant="ghost" size="sm">
                {syncingAgentPerms ? "Syncing permissions…" : "🤖 Sync Agent Permissions"}
              </Btn>
            </div>
          </div>

          {/* Live Server Members (synced) */}
          {serverMembers.length > 0 && (() => {
            const staffUsernames = new Set(staff.map(s => s.discordUsername?.toLowerCase()));
            const unmatched = serverMembers.filter(m =>
              !staffUsernames.has(m.username.toLowerCase()) &&
              m.username !== 'Deleted User' &&
              !['batmanbluestone','Axel','Skywork1','Skywork2','Staxyl','Stonyx'].includes(m.username)
            );
            if (unmatched.length === 0) return <div style={{ fontSize: "12px", color: "#22c55e", marginBottom: "16px" }}>✅ All server members are already staff</div>;
            return (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "10px" }}>SERVER MEMBERS — NOT YET IN STAFF LIST ({unmatched.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {unmatched.map(m => {
                    const matchedInvite = data?.invites?.find(i => i.invitedDiscord?.toLowerCase() === m.username.toLowerCase());
                    return (
                      <div key={m.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "13px" }}>{matchedInvite?.invitedName || m.nick || m.username}</span>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>@{m.username}</span>
                            {matchedInvite && <RoleBadge role={matchedInvite.role} />}
                          </div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>{m.serverName}</span>
                            {matchedInvite?.invitedEmail && <span> · {matchedInvite.invitedEmail}</span>}
                            <span> · joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Btn onClick={() => addMemberAsStaff(m)} size="sm">+ Add as Staff</Btn>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Pending Invites */}
          {invites.filter(i => i.status !== "converted").length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "10px" }}>INVITES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invites.filter(i => i.status !== "converted").map(inv => {
                  const statusColor = { pending: "#f59e0b", accepted: "#22c55e", revoked: "#6b7280", expired: "#6b7280", converted: "#22c55e" }[inv.status] ?? "#888";
                  const statusLabel = { pending: "Pending", accepted: "Accepted — click Add as Staff ↑", revoked: "Revoked", expired: "Expired", converted: "Added" }[inv.status] ?? inv.status;
                  return (
                    <div key={inv.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px", padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                          <div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ fontWeight: 600, fontSize: "14px" }}>{inv.invitedName}</span>
                              <RoleBadge role={inv.role} />
                              <span style={{ fontSize: "11px", color: statusColor }}>{statusLabel}</span>
                            </div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                              {inv.serverName} · {inv.invitedEmail && <span>{inv.invitedEmail} · </span>}{inv.invitedDiscord && <span>@{inv.invitedDiscord} · </span>}
                              {inv.status === "accepted" && inv.discordUsername && <span style={{ color: "#22c55e" }}>joined as @{inv.discordUsername}</span>}
                              {inv.status === "pending" && <span>expires {new Date(inv.expiresAt).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {inv.status === "pending" && (
                            <>
                              <Btn onClick={() => copyInvLink(inv.url)} variant="ghost" size="sm">{invCopied ? "✓ Copied" : "Copy Link"}</Btn>
                              <a href={`mailto:${inv.invitedEmail}?subject=You're invited to ${inv.serverName}&body=Hi ${inv.invitedName},%0D%0A%0D%0AYou've been invited to join the ${inv.serverName} Discord server.%0D%0A%0D%0AJoin here: ${inv.url}%0D%0A%0D%0AThis invite expires in 7 days.`}
                                style={{ display: inv.invitedEmail ? "inline-flex" : "none", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "transparent", color: "rgba(255,255,255,0.5)", border: `1px solid ${GOLD_BORDER}`, textDecoration: "none" }}>
                                Email
                              </a>
                              {inv.invitedDiscord && <Btn onClick={() => sendDM(inv.id)} disabled={sendingDM === inv.id} variant="ghost" size="sm">{sendingDM === inv.id ? "Sending…" : "DM"}</Btn>}
                              <Btn onClick={() => revokeInvite(inv.id)} variant="danger" size="sm">Revoke</Btn>
                            </>
                          )}
                          {inv.status === "accepted" && (
                            <Btn onClick={() => convertInvite(inv.id)}>Add as Staff</Btn>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {staff.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.25)" }}>No staff members yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {staff.map(m => (
                <div key={m.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "12px", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: GOLD }}>{m.name.charAt(0)}</div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px" }}>{m.name}</span>
                          <RoleBadge role={m.role} />
                        </div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>@{m.discordUsername}{m.discordId && ` · ${m.discordId}`}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(isSuperAdmin(portalUser) || m.role !== "superadmin") && <Btn onClick={() => openStaff(m)} variant="ghost" size="sm">Edit</Btn>}
                      {(isSuperAdmin(portalUser) || m.role !== "superadmin") && <Btn onClick={() => removeStaff(m.id)} variant="danger" size="sm">Remove</Btn>}
                    </div>
                  </div>
                  {m.serverAdmins.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Server Admin:</span>
                      {m.serverAdmins.map(sid => (
                        <span key={sid} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: `${SERVER_COLORS[servers[sid]?.name] ?? "#6366f1"}22`, color: SERVER_COLORS[servers[sid]?.name] ?? "#6366f1" }}>{servers[sid]?.name ?? sid}</span>
                      ))}
                    </div>
                  )}
                  {m.channelAssignments.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Channels:</span>
                      {m.channelAssignments.map(a => (
                        <span key={`${a.serverId}-${a.channelId}`} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>{a.serverName}/{a.channelName}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB — admin+ only ───────────────────────────────────────── */}
      {mainTab === "users" && canManageUsers && (
        <div>
          <div style={{ marginBottom: "12px", padding: "12px 16px", borderRadius: "10px", background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            Portal users log in to <strong style={{ color: "rgba(255,255,255,0.8)" }}>/portal/servers</strong>.{" "}
            <strong style={{ color: GOLD }}>Super Admin</strong> — full access.{" "}
            <strong style={{ color: "#a855f7" }}>Admin</strong> — all except Config.{" "}
            <strong style={{ color: "#3b82f6" }}>Staff</strong> — assigned channels + model changes only.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <Btn onClick={() => openUser("new")}>+ Add Portal User</Btn>
          </div>
          {portalUsers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.25)" }}>No portal users.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {portalUsers.map(u => (
                <div key={u.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "10px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: !canEditUser(u) ? 0.6 : 1 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: 600 }}>{u.username}</span>
                      <RoleBadge role={u.role} />
                      {u.staffId && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>→ {staff.find(s => s.id === u.staffId)?.name}</span>}
                      {u.role === "superadmin" && !isSuperAdmin(portalUser) && (
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>🔒 Super Admin only</span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                      Created: {new Date(u.createdAt).toLocaleDateString()} {u.lastLogin && `· Last login: ${new Date(u.lastLogin).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {canEditUser(u) && <Btn onClick={() => openUser(u)} variant="ghost" size="sm">Edit</Btn>}
                    {canDeleteUser(u) && <Btn onClick={() => removeUser(u.id)} variant="danger" size="sm">Remove</Btn>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB — all roles ───────────────────────────────────────── */}
      {mainTab === "history" && canViewHistory && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.25)" }}>No history yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[...history].reverse().map(h => (
                <div key={h.id} style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "8px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", minWidth: "130px" }}>{new Date(h.timestamp).toLocaleString()}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{h.details}</span>
                    {h.serverId && servers[h.serverId] && <span style={{ marginLeft: "8px", fontSize: "11px", color: SERVER_COLORS[servers[h.serverId].name] ?? "#6366f1" }}>{servers[h.serverId].name}</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{h.performedBy}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INVITE FORM MODAL */}
      {showInviteForm && (
        <Modal onClose={() => setShowInviteForm(false)} title="Send Invite" width={540}>
          {!createdInvite ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Display Name *</label><Input value={invF.name} onChange={v => setInvF(p => ({...p, name: v}))} placeholder="Jane Smith" /></div>
                <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Role</label><Select value={invF.role} onChange={v => setInvF(p => ({...p, role: v}))} options={[{ label: "Super Admin", value: "superadmin" }, { label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }]} /></div>
                <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Email (for email invite)</label><Input value={invF.email} onChange={v => setInvF(p => ({...p, email: v}))} placeholder="jane@company.com" /></div>
                <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Discord Username (for DM)</label><Input value={invF.discord} onChange={v => setInvF(p => ({...p, discord: v}))} placeholder="janesmith" /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Invite to Server *</label><Select value={invF.serverId} onChange={v => setInvF(p => ({...p, serverId: v}))} options={[{ label: "Select server...", value: "" }, ...Object.entries(servers).map(([id, s]) => ({ label: s.name, value: id }))]} /></div>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "16px", padding: "10px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                💡 This creates a unique Discord invite link (max 1 use, expires in 7 days). If you enter an email address, it will be sent automatically from kevin@knoxwebhq.com. Channel assignments can be set once they accept.
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <Btn onClick={() => setShowInviteForm(false)} variant="ghost">Cancel</Btn>
                <Btn onClick={createInvite} disabled={!invF.name || !invF.serverId}>{invF.email ? '📧 Create & Send Invite' : 'Create Invite Link'}</Btn>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>Invite created for {createdInvite.invitedName}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Expires {new Date(createdInvite.expiresAt).toLocaleDateString()} · Max 1 use</div>
                {inviteEmailSent && createdInvite.invitedEmail && (
                  <div style={{ marginTop: "10px", padding: "8px 14px", borderRadius: "8px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", fontSize: "13px", color: "#4ade80" }}>
                    📧 Email sent to {createdInvite.invitedEmail}
                  </div>
                )}
              </div>
              <div style={{ background: PAGE_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontFamily: "monospace", fontSize: "13px", wordBreak: "break-all", color: GOLD }}>
                {createdInvite.url}
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                <button onClick={() => copyInvLink(createdInvite.url)} style={{ flex: 1, padding: "10px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", background: invCopied ? "#22c55e" : GOLD, color: "#000", border: "none", cursor: "pointer" }}>{invCopied ? "✓ Copied!" : "Copy Link"}</button>
                {createdInvite.invitedEmail && !inviteEmailSent && (
                  <a href={`mailto:${createdInvite.invitedEmail}?subject=You're invited to ${createdInvite.serverName}&body=Hi ${createdInvite.invitedName},%0D%0A%0D%0AYou've been invited to join the ${createdInvite.serverName} Discord server.%0D%0A%0D%0AJoin here: ${createdInvite.url}%0D%0A%0D%0AThis invite expires in 7 days.`}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", background: "#3b82f6", color: "#fff", textDecoration: "none", textAlign: "center" }}>
                    📧 Send Email Manually
                  </a>
                )}
                {createdInvite.invitedDiscord && (
                  <button onClick={() => sendDM(createdInvite!.id)} disabled={sendingDM === createdInvite.id} style={{ flex: 1, padding: "10px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", background: "#5865F2", color: "#fff", border: "none", cursor: "pointer" }}>
                    {sendingDM === createdInvite.id ? "Sending…" : "💬 Discord DM"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn onClick={() => { setShowInviteForm(false); setCreatedInvite(null); }} variant="ghost">Done</Btn>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── STAFF MODAL ───────────────────────────────────────────────────── */}
      {staffModal !== null && (
        <Modal onClose={() => setStaffModal(null)} title={staffModal === "new" ? "Add Staff Member" : "Edit Staff Member"} width={620}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Full Name *</label><Input value={sf.name} onChange={v => setSf(p => ({...p, name: v}))} placeholder="Jane Smith" /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Discord Username *</label><Input value={sf.discordUsername} onChange={v => setSf(p => ({...p, discordUsername: v}))} placeholder="janesmith" /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Discord User ID</label><Input value={sf.discordId} onChange={v => setSf(p => ({...p, discordId: v}))} placeholder="123456789012345678" /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Role *</label><Select value={sf.role} onChange={v => setSf(p => ({...p, role: v}))} options={allowedRoleOptions} /></div>
          </div>
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>Discord Server Admin</div>
            <div style={{ fontSize: "10px", color: "rgba(255,100,100,0.6)", marginBottom: "8px" }}>⚠️ Grants access to ALL channels on selected server(s). Only set for trusted admins.</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(servers).map(([id, s]) => (
                <button key={id} onClick={() => toggleServerAdmin(id)} style={{ padding: "5px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: sf.serverAdmins.includes(id) ? `${SERVER_COLORS[s.name] ?? "#6366f1"}33` : "transparent", color: sf.serverAdmins.includes(id) ? SERVER_COLORS[s.name] ?? "#6366f1" : "rgba(255,255,255,0.4)", border: `1px solid ${sf.serverAdmins.includes(id) ? SERVER_COLORS[s.name] ?? "#6366f1" : "rgba(255,255,255,0.15)"}` }}>{s.name}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "8px" }}>Channel Assignments</div>
            {Object.entries(servers).map(([sid, s]) => (
              <div key={sid} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: SERVER_COLORS[s.name] ?? "#6366f1", fontWeight: 700, marginBottom: "6px" }}>{s.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {s.channels.map(ch => {
                    const assigned = sf.channelAssignments.some(a => a.serverId === sid && a.channelId === ch.id);
                    return <button key={ch.id} onClick={() => toggleChannelAssignment(sid, ch.id, ch.name, s.name)} style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "11px", cursor: "pointer", background: assigned ? "rgba(59,130,246,0.2)" : "transparent", color: assigned ? "#3b82f6" : "rgba(255,255,255,0.4)", border: `1px solid ${assigned ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)"}` }}>#{ch.name}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          {staffModal !== "new" && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>INVITE TO ADDITIONAL SERVER</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {Object.entries(servers)
                  .filter(([sid]) => !sf.channelAssignments.some(a => a.serverId === sid))
                  .map(([sid, s]) => (
                    <Btn key={sid} size="sm" variant="ghost" onClick={() => {
                      setStaffModal(null);
                      setShowInviteForm(true);
                      setCreatedInvite(null);
                      setInvF({
                        name: sf.name,
                        email: "",
                        discord: sf.discordUsername,
                        serverId: sid,
                        role: sf.role,
                        channelAssignments: []
                      });
                    }}>
                      + Invite to {(s as {name:string}).name}
                    </Btn>
                  ))}
                {Object.entries(servers).filter(([sid]) => !sf.channelAssignments.some(a => a.serverId === sid)).length === 0 && (
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Already has channel assignments on all servers</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn onClick={() => setStaffModal(null)} variant="ghost">Cancel</Btn>
            <Btn onClick={saveStaff} disabled={!sf.name || !sf.discordUsername}>{staffModal === "new" ? "Add Member" : "Save Changes"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── USER MODAL ────────────────────────────────────────────────────── */}
      {userModal !== null && (
        <Modal onClose={() => setUserModal(null)} title={userModal === "new" ? "Add Portal User" : "Edit Portal User"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Username *</label><Input value={uf.username} onChange={v => setUf(p => ({...p, username: v}))} placeholder="jsmith" /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>{userModal === "new" ? "Password *" : "New Password (leave blank to keep)"}</label><Input value={uf.password} onChange={v => setUf(p => ({...p, password: v}))} placeholder="••••••••" type="password" /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Role</label><Select value={uf.role} onChange={v => setUf(p => ({...p, role: v}))} options={allowedRoleOptions} /></div>
            <div><label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "5px" }}>Link to Staff Member (required for Staff role)</label><Select value={uf.staffId} onChange={v => setUf(p => ({...p, staffId: v}))} options={[{ label: "None", value: "" }, ...staff.map(s => ({ label: s.name, value: s.id }))]} /></div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn onClick={() => setUserModal(null)} variant="ghost">Cancel</Btn>
            <Btn onClick={saveUser} disabled={!uf.username}>{userModal === "new" ? "Create User" : "Save Changes"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── RENAME CHANNEL MODAL ─────────────────────────────────────────── */}
      {channelRename && (
        <Modal onClose={() => setChannelRename(null)} title={`Rename #${channelRename.name}`} width={400}>
          <div style={{ marginBottom: "20px" }}><Input value={newChannelName} onChange={setNewChannelName} placeholder="new-channel-name" /></div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn onClick={() => setChannelRename(null)} variant="ghost">Cancel</Btn>
            <Btn onClick={doRename} disabled={!newChannelName || newChannelName === channelRename.name}>Rename</Btn>
          </div>
        </Modal>
      )}

      {/* ── PROVISION MODAL ──────────────────────────────────────────────── */}
      {provisionModal && (
        <Modal onClose={() => { if (!provisioning) { setProvisionModal(null); setProvisionResult(null); } }} title={`Provision Agents - ${provisionModal.serverName}`} width={540}>
          {!provisionResult && !provisioning && (
            <>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginBottom: "20px" }}>This will SSH into <strong style={{ color: "#fff" }}>{provisionModal.serverName}</strong> and create workspace files for each agent. Already-provisioned agents will be skipped.</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <Btn onClick={() => setProvisionModal(null)} variant="ghost">Cancel</Btn>
                <Btn onClick={async () => {
                  setProvisioning(true);
                  try {
                    const res = await fetch("/api/servers/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: provisionModal.serverId }) });
                    setProvisionResult(await res.json());
                  } catch { setProvisionResult({ provisioned: 0, skipped: 0, results: [{ agent: "", channel: "", status: "error" }] }); }
                  setProvisioning(false);
                }}>Run Provisioning</Btn>
              </div>
            </>
          )}
          {provisioning && <div style={{ textAlign: "center", padding: "40px" }}><div style={{ fontSize: "24px", marginBottom: "12px" }}>⚙️</div><div style={{ color: GOLD, fontWeight: 700 }}>Provisioning agents...</div></div>}
          {provisionResult && !provisioning && (
            <>
              {provisionResult.ok === false ? (
                <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", marginBottom: "20px" }}>Error: {(provisionResult as { error?: string }).error || "Unknown error"}</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                    <div style={{ flex: 1, padding: "16px", borderRadius: "10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#22c55e" }}>{provisionResult.provisioned}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Provisioned</div>
                    </div>
                    <div style={{ flex: 1, padding: "16px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${GOLD_BORDER}`, textAlign: "center" }}>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>{provisionResult.skipped}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Skipped</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "240px", overflowY: "auto" }}>
                    {provisionResult.results.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", borderRadius: "6px", background: r.status === "provisioned" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", fontSize: "12px" }}>
                        <span style={{ color: r.status === "provisioned" ? "#22c55e" : "rgba(255,255,255,0.3)" }}>{r.status === "provisioned" ? "✓" : "-"}</span>
                        <span style={{ color: "rgba(255,255,255,0.7)", minWidth: "140px" }}>{r.agent}</span>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>#{r.channel}</span>
                        {r.model && <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)" }}>{r.model}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => { setProvisionModal(null); setProvisionResult(null); }} variant="ghost">Close</Btn></div>
            </>
          )}
        </Modal>
      )}

      {/* INVITE MODAL removed - replaced by Send Invite form */}

      {/* ── CONFIG MODAL — superadmin only ───────────────────────────────── */}
      {showConfig && canConfig && (
        <Modal onClose={() => setShowConfig(false)} title="Configuration" width={480}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Discord Bot Token</label>
            <Input value={botToken} onChange={setBotToken} placeholder="MTxxxxxxxx..." type="password" />
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>Bot needs MANAGE_CHANNELS permission. Stored in servers.json.</div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn onClick={() => setShowConfig(false)} variant="ghost">Cancel</Btn>
            <Btn onClick={saveConfig} disabled={savingConfig}>{savingConfig ? "Saving..." : "Save Config"}</Btn>
          </div>
        </Modal>
      )}

      {data.lastUpdated && <div style={{ marginTop: "16px", fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "right" }}>Last updated: {new Date(data.lastUpdated).toLocaleString()}</div>}
    </div>
  );
}
