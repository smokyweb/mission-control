"use client";

import { useState } from "react";
import ServersClient from "@/app/servers/ServersClient";

const GOLD = "#f5c200";
const GOLD_BORDER = "rgba(245,194,0,0.20)";

type PortalUser = { id: string; username: string; role: "superadmin" | "admin" | "staff"; staffId?: string };

export default function ServersPortalPage() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!username || !password) return;
    setLoading(true); setError("");
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "loginPortalUser", username, password }),
    });
    const json = await res.json();
    if (json.ok) {
      setUser(json.user);
    } else {
      setError("Invalid username or password");
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0A0A0F" }}>
        <div style={{ background: "#1A1A2E", border: `1px solid ${GOLD_BORDER}`, borderRadius: "16px", padding: "40px", width: "360px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ fontSize: "22px", fontWeight: 800, color: GOLD, letterSpacing: "0.06em" }}>SERVER PANEL</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>Bat Cave — Limited Access</div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="username" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "#0A0A0F", border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="••••••••" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "#0A0A0F", border: `1px solid ${GOLD_BORDER}`, color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
          </div>

          {error && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "14px", textAlign: "center" }}>{error}</div>}

          <button onClick={login} disabled={loading || !username || !password} style={{ width: "100%", padding: "12px", borderRadius: "10px", fontWeight: 800, fontSize: "14px", background: loading ? "#333" : GOLD, color: "#000", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Logging in…" : "Log In"}
          </button>
        </div>
      </div>
    );
  }

  const ROLE_COLORS: Record<string, string> = { superadmin: GOLD, admin: "#a855f7", staff: "#3b82f6" };
  const ROLE_LABELS: Record<string, string> = { superadmin: "Super Admin", admin: "Admin", staff: "Staff" };

  return (
    <div>
      <div style={{ background: "#000", borderBottom: "1px solid rgba(245,194,0,0.15)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: GOLD, fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em" }}>SERVER PANEL</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
            @{user.username}{" "}
            <span style={{ padding: "2px 8px", borderRadius: "99px", background: `${ROLE_COLORS[user.role]}22`, color: ROLE_COLORS[user.role], fontWeight: 700, fontSize: "11px" }}>
              {ROLE_LABELS[user.role]}
            </span>
          </span>
          <button onClick={() => setUser(null)} style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "6px", background: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>Log Out</button>
        </div>
      </div>
      <ServersClient portalUser={user} />
    </div>
  );
}
