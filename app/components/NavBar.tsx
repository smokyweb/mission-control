"use client";

import Link from "next/link";
// import Image from "next/image"; // replaced with <img> for Coolify compatibility
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const GOLD = "#f5c200";
const GOLD_DIM = "rgba(245, 194, 0,0.12)";
const GOLD_BORDER = "rgba(245, 194, 0,0.25)";

export default function NavBar() {
  const pathname = usePathname();
  const [healthy, setHealthy] = useState<boolean | null>(null);

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthy(data.ok);
    } catch {
      setHealthy(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Hide NavBar entirely on portal routes
  if (pathname.startsWith("/portal")) return null;

  const MISSIONS = "https://missions.batmanbluestone.com";

  const links = [
    { href: `${MISSIONS}/calendar`,      label: "Calendar",      icon: "/icons/icon-7.png",  external: true },
    { href: `${MISSIONS}/tasks`,         label: "Tasks",         icon: "/icons/icon-17.png", external: true },
    { href: `${MISSIONS}/todos`,         label: "To-Dos",        icon: "/icons/icon-17.png", external: true },
    { href: `${MISSIONS}/conversations`, label: "Conversations", icon: "/icons/icon-5.png",  external: true },
    { href: `${MISSIONS}/search`,        label: "Search",        icon: "/icons/icon-14.png", external: true },
    { href: `${MISSIONS}/feed`,          label: "Feed",          icon: "/icons/icon-4.png",  external: true },
    { href: `${MISSIONS}/content`,       label: "Content",       icon: "/icons/icon-15.png", external: true },
    { href: `${MISSIONS}/memory`,        label: "Memory",        icon: "/icons/icon-8.png",  external: true },
    { href: `${MISSIONS}/brent`,         label: "Brent",         icon: "/icons/icon-10.png", external: true },
    { href: `${MISSIONS}/team`,          label: "Team",          icon: "/icons/icon-10.png", external: true },
    { href: `${MISSIONS}/office`,        label: "Office",        icon: "/icons/icon-16.png", external: true },
    { href: "/servers",                  label: "Servers",       icon: "/icons/icon-14.png", external: false },
    { href: "/servers/cli",             label: "Servers CLI",   icon: "/icons/icon-14.png", external: false },
  ];

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "220px",
        background: "#000",
        borderRight: `1px solid ${GOLD_BORDER}`,
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${GOLD_BORDER}` }}>
        <Link href="/calendar" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src="/batman-logo.jpg"
              alt="Bat Cave"
              width={42}
              height={42}
              style={{ borderRadius: "50%", border: `2px solid ${GOLD}`, display: "block" }}
            />
            <div style={{
              position: "absolute", inset: -3, borderRadius: "50%",
              boxShadow: `0 0 12px ${GOLD}55`, pointerEvents: "none"
            }} />
          </div>
          <div>
            <div style={{ color: GOLD, fontWeight: 800, fontSize: "15px", letterSpacing: "0.08em", lineHeight: 1 }}>
              BAT CAVE
            </div>
            <div style={{ color: "rgba(245, 194, 0,0.45)", fontSize: "10px", letterSpacing: "0.12em", marginTop: "3px" }}>
              COMMAND CENTER
            </div>
          </div>
        </Link>
      </div>

      {/* Nav Links */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {links.map(({ href, label, icon, external }) => {
          const active = !external && (pathname === href || pathname.startsWith(href + "/"));
          const linkStyle = {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 12px",
            borderRadius: "8px",
            marginBottom: "2px",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: active ? 700 : 400,
            color: active ? GOLD : "rgba(255,255,255,0.55)",
            background: active ? GOLD_DIM : "transparent",
            borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
            transition: "all 0.15s",
          };
          const hoverIn = (e: React.MouseEvent<HTMLAnchorElement>) => {
            if (!active) {
              (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.9)";
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
            }
          };
          const hoverOut = (e: React.MouseEvent<HTMLAnchorElement>) => {
            if (!active) {
              (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }
          };
          return external ? (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>

              <img
                src={icon}
                alt={label}
                width={22}
                height={22}
                style={{
                  filter: active
                    ? "invert(82%) sepia(100%) saturate(800%) hue-rotate(5deg) brightness(103%)"
                    : "invert(1) opacity(0.5)",
                  flexShrink: 0,
                }}
              />
              <span style={{ letterSpacing: "0.03em" }}>{label}</span>
            </a>
          ) : (
            <Link key={href} href={href} style={linkStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <img src={icon} alt={label} width={22} height={22} style={{ filter: active ? "invert(82%) sepia(100%) saturate(800%) hue-rotate(5deg) brightness(103%)" : "invert(1) opacity(0.5)", flexShrink: 0 }} />
              <span style={{ letterSpacing: "0.03em" }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Batman Image */}
      <div style={{ padding: "0", overflow: "hidden" }}>
        <img
          src="/batman-face.png"
          alt="Batman"
          width={220}
          height={165}
          style={{ display: "block", width: "100%", height: "auto", opacity: 0.85 }}
        />
      </div>

      {/* Gateway Status */}
      <div style={{
        padding: "16px 20px",
        borderTop: `1px solid ${GOLD_BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}>
        <span style={{
          width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
          background: healthy === null ? GOLD : healthy ? "#22c55e" : "#ef4444",
          boxShadow: healthy ? "0 0 6px #22c55e88" : healthy === false ? "0 0 6px #ef444488" : `0 0 6px ${GOLD}88`,
        }} />
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
          {healthy === null ? "CONNECTING…" : healthy ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}
        </span>
      </div>

      {/* Logout */}
      <div style={{ padding: "10px 20px" }}>
        <button
          onClick={async () => {
            await fetch('/api/batcave-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
            window.location.href = '/batcave-login';
          }}
          style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", fontSize: "11px", cursor: "pointer", letterSpacing: "0.05em" }}
        >
          LOGOUT
        </button>
      </div>

      {/* Gold bottom accent */}
      <div style={{ height: "3px", background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
    </aside>
  );
}
