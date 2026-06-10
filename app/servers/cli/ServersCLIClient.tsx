"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const GOLD        = "#f5c200";
const GOLD_BORDER = "rgba(245,194,0,0.20)";
const PAGE_BG     = "#0A0A0F";
const CARD_BG     = "#1A1A2E";

const SERVER_COLORS: Record<string, string> = {
  Stonyx: "#6366f1", Skywork1: "#3b82f6", Skywork2: "#06b6d4", Staxyl: "#10b981", Calyx: "#f97316",
};

// CLI tunnel URLs — no X-Frame-Options, embed directly
const CLI_URLS: Record<string, string> = {
  "1509559190073643060": "https://skywork1-cli.batmanbluestone.com",
  "1509559447041609798": "https://skywork2-cli.batmanbluestone.com",
  "1509246976137629876": "https://staxyl-cli.batmanbluestone.com",
  "1483827032638099528": "https://cli.calyxbluestone.com",
};

interface OutputLine { type: "cmd" | "out" | "err" | "info"; text: string; ts: string; }
interface ServersConfig { servers: Record<string, unknown>; config: { machines?: Record<string, { name: string }> } }

export default function ServersCLIClient() {
  const [config, setConfig]         = useState<ServersConfig | null>(null);
  const [serverId, setServerId]     = useState<string>("");
  const [command, setCommand]       = useState("");
  const [running, setRunning]       = useState(false);
  const [output, setOutput]         = useState<OutputLine[]>([]);
  const [history, setHistory]       = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cliServer, setCliServer]   = useState<string>("");
  const [cliLoaded, setCliLoaded]   = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/servers");
    setConfig(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const now = () => new Date().toLocaleTimeString();
  const addLine = (type: OutputLine["type"], text: string) =>
    setOutput(prev => [...prev, { type, text, ts: now() }]);

  const runCommand = async () => {
    if (!command.trim() || !serverId || running) return;
    const cmd = command.trim();
    setCommand(""); setHistoryIdx(-1);
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setRunning(true);
    const serverName = machines[serverId]?.name ?? serverId;
    addLine("cmd", `[${serverName}] $ ${cmd}`);
    try {
      const res = await fetch("/api/servers/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, command: cmd }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.stdout) addLine("out", data.stdout);
        if (data.stderr) addLine("err", data.stderr);
        if (!data.stdout && !data.stderr) addLine("info", "(no output)");
      } else {
        addLine("err", `Error: ${data.error}`);
      }
    } catch (e) { addLine("err", `Network error: ${String(e)}`); }
    setRunning(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { runCommand(); return; }
    if (e.key === "ArrowUp") {
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx); setCommand(history[idx] ?? ""); e.preventDefault();
    }
    if (e.key === "ArrowDown") {
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx); setCommand(idx === -1 ? "" : history[idx]); e.preventDefault();
    }
    if (e.key === "l" && e.ctrlKey) { setOutput([]); e.preventDefault(); }
  };

  const machines = config?.config?.machines ?? {};
  const machineIds = Object.keys(machines);

  if (!config) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: PAGE_BG, color: GOLD }}>Loading…</div>
  );

  return (
    <div style={{ background: PAGE_BG, minHeight: "100vh", color: "#fff", padding: "28px 36px", display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: GOLD, margin: 0, letterSpacing: "0.04em" }}>SERVERS CLI</h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", marginTop: "4px" }}>Execute commands on remote servers · CLI interface</p>
      </div>

      {/* ── SSH TERMINAL ───────────────────────────────────────────────────── */}
      <div style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "14px", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#22c55e" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              SSH Terminal
              {serverId && machines[serverId] && (
                <span style={{ color: SERVER_COLORS[machines[serverId].name] ?? "#fff", marginLeft: "8px" }}>
                  — {machines[serverId].name}
                </span>
              )}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <select value={serverId} onChange={e => { setServerId(e.target.value); setOutput([]); }}
              style={{ background: PAGE_BG, border: `1px solid ${GOLD_BORDER}`, color: "#fff", padding: "5px 10px", borderRadius: "6px", fontSize: "12px" }}>
              <option value="">Select server…</option>
              {machineIds.map(id => <option key={id} value={id}>{machines[id].name}</option>)}
            </select>
            <button onClick={() => setOutput([])}
              style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
              Clear
            </button>
          </div>
        </div>

        {/* Output */}
        <div ref={outputRef} style={{ height: "400px", overflowY: "auto", padding: "16px 20px", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6 }}
          onClick={() => inputRef.current?.focus()}>
          {output.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.25)" }}>
              {serverId ? `Connected to ${machines[serverId]?.name}. Type a command below.` : "Select a server to begin."}
              <br /><br />
              <span style={{ color: "rgba(255,255,255,0.15)" }}>Tip: Use ↑/↓ for command history · Ctrl+L to clear</span>
            </div>
          )}
          {output.map((line, i) => (
            <div key={i} style={{ marginBottom: "2px" }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", marginRight: "8px" }}>{line.ts}</span>
              <span style={{ color: line.type === "cmd" ? GOLD : line.type === "err" ? "#f87171" : line.type === "info" ? "rgba(255,255,255,0.3)" : "#a3e635", whiteSpace: "pre-wrap" }}>
                {line.text}
              </span>
            </div>
          ))}
          {running && <div style={{ color: GOLD }}>⠋ running…</div>}
        </div>

        {/* Input */}
        <div style={{ borderTop: `1px solid ${GOLD_BORDER}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: GOLD, fontSize: "14px", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
            {serverId && machines[serverId] ? `${machines[serverId].name} $` : "$"}
          </span>
          <input ref={inputRef} value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleKeyDown}
            disabled={!serverId || running}
            placeholder={serverId ? "Type a command… (Enter to run)" : "Select a server first"}
            spellCheck={false} autoComplete="off"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontFamily: "monospace", fontSize: "13px", opacity: serverId ? 1 : 0.4 }}
          />
          <button onClick={runCommand} disabled={!command.trim() || !serverId || running}
            style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, background: (!command.trim() || !serverId || running) ? "#333" : GOLD, color: "#000", border: "none", cursor: (!command.trim() || !serverId || running) ? "not-allowed" : "pointer" }}>
            {running ? "…" : "Run"}
          </button>
        </div>

        {/* Quick commands */}
        {serverId && (
          <div style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, padding: "10px 20px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["uptime", "df -h", "free -h", "pm2 list", "ps aux | grep openclaw | grep -v grep"].map(cmd => (
              <button key={cmd} onClick={() => { setCommand(cmd); inputRef.current?.focus(); }}
                style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "99px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontFamily: "monospace" }}>
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CLI INTERFACE ───────────────────────────────────────────────────── */}
      <div style={{ background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>CLI Interface</span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "10px" }}>Embedded terminal for each server</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {machineIds.filter(id => CLI_URLS[id]).map(id => {
              const color = SERVER_COLORS[machines[id].name] ?? "#888";
              return (
                <button key={id} onClick={() => { setCliServer(id); setCliLoaded(false); }}
                  style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: cliServer === id ? `${color}33` : "transparent", color, border: `1px solid ${cliServer === id ? color : "rgba(255,255,255,0.1)"}` }}>
                  {machines[id].name}
                </button>
              );
            })}
          </div>
        </div>

        {cliServer ? (
          <div style={{ position: "relative" }}>
            {!cliLoaded && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, zIndex: 1, fontSize: "13px", color: "rgba(255,255,255,0.4)", height: "600px" }}>
                Loading {machines[cliServer].name} CLI…
              </div>
            )}
            <iframe key={cliServer} src={CLI_URLS[cliServer]} onLoad={() => setCliLoaded(true)}
              style={{ width: "100%", height: "600px", border: "none", display: "block" }}
              title={`${machines[cliServer].name} CLI`}
            />
          </div>
        ) : (
          <div style={{ padding: "32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "480px", margin: "0 auto" }}>
              {machineIds.filter(id => CLI_URLS[id]).map(id => {
                const color = SERVER_COLORS[machines[id].name] ?? "#888";
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: PAGE_BG, border: `1px solid rgba(255,255,255,0.07)` }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                    <span style={{ color, fontWeight: 600, fontSize: "13px", minWidth: "80px" }}>{machines[id].name}</span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{machines[id].name.toLowerCase()}-cli.batmanbluestone.com</span>
                  </div>
                );
              })}
              {machineIds.filter(id => !CLI_URLS[id]).length > 0 && (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "8px" }}>
                  Stonyx: no CLI tunnel configured yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
