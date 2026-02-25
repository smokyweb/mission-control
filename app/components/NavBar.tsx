"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  const links = [
    { href: "/calendar", label: "📅 Calendar" },
    { href: "/tasks", label: "📋 Tasks" },
    { href: "/feed", label: "📡 Feed" },
    { href: "/conversations", label: "💬 Conversations" },
    { href: "/content", label: "🎬 Content" },
    { href: "/memory", label: "🧠 Memory" },
    { href: "/team", label: "👥 Team" },
    { href: "/office", label: "🏢 Office" },
    { href: "/search", label: "🔍 Search" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/90 backdrop-blur-sm border-b border-[#2A2A3E] h-16 flex items-center px-6">
      <div className="flex items-center gap-6 w-full max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🦀</span>
          <span className="font-bold text-white hidden sm:block">
            Mission Control
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex gap-1 ml-4">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-[#1A1A2E] text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Gateway Status */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              healthy === null
                ? "bg-yellow-400 animate-pulse"
                : healthy
                ? "bg-green-400"
                : "bg-red-500 animate-pulse"
            }`}
          />
          <span className="text-gray-400 hidden sm:block">
            {healthy === null ? "Connecting…" : healthy ? "Gateway OK" : "Gateway offline"}
          </span>
        </div>
      </div>
    </nav>
  );
}
