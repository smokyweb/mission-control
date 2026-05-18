"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";

const BLUE = "#2563eb";
const BLUE_DIM = "rgba(37,99,235,0.12)";
const BLUE_BORDER = "rgba(37,99,235,0.3)";

type TaskType = "sheet" | "research" | "marketing" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sheetUrl?: string;
  taskId?: string;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/archer-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) { onLogin(); }
    else { setError("Invalid email or password"); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Bluestone Apps</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Outreach Portal</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Sign in to continue</div>
        </div>
        <form onSubmit={submit} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 16, padding: 32 }}>
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="archer@bluestoneapps.com"
            style={{ width: "100%", background: "#0f172a", border: `1px solid ${error ? "#ef4444" : "#1e293b"}`, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 16 }}
            autoFocus
          />
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ width: "100%", background: "#0f172a", border: `1px solid ${error ? "#ef4444" : "#1e293b"}`, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none" }}
          />
          {error && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{ width: "100%", marginTop: 20, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: (!email || !password) ? 0.5 : 1 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ArcherPortalClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [taskType, setTaskType] = useState<TaskType>("chat");
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi Archer! I'm here to help with your outreach tasks. You can:\n\n• **Create a Google Sheet** — I'll build and share it with you instantly\n• **Request research** — I'll research any topic and deliver a report\n• **Marketing task** — submit marketing requests for the team\n• **Just chat** — ask me anything\n\nWhat do you need today?", timestamp: Date.now() }
  ]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/archer-auth").then(r => r.json()).then(d => setAuthed(d.authenticated));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const msg = taskType === "sheet" ? (title || input).trim() : input.trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = { role: "user", content: taskType === "sheet" ? `Create a Google Sheet: "${msg}"` : taskType === "research" ? `Research request: ${msg}` : taskType === "marketing" ? `Marketing task: ${msg}` : msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setTitle("");
    setSending(true);

    const res = await fetch("/api/archer-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, type: taskType }),
    });
    const data = await res.json();
    setSending(false);

    setMessages(prev => [...prev, {
      role: "assistant",
      content: data.reply || "Done!",
      timestamp: Date.now(),
      sheetUrl: data.sheetUrl,
      taskId: data.taskId,
    }]);
  }, [input, title, taskType, sending]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const logout = async () => {
    await fetch("/api/archer-auth", { method: "DELETE" });
    setAuthed(false);
  };

  if (authed === null) return <div style={{ minHeight: "100vh", background: "#08080f" }} />;
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const taskOptions: { value: TaskType; label: string; icon: string; desc: string }[] = [
    { value: "sheet", label: "Google Sheet", icon: "📊", desc: "Create & share a spreadsheet" },
    { value: "research", label: "Research", icon: "🔍", desc: "Research any topic" },
    { value: "marketing", label: "Marketing", icon: "📣", desc: "Marketing task or request" },
    { value: "chat", label: "Chat", icon: "💬", desc: "Ask anything" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📣</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Outreach Portal</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Archer Bagley · Bluestone Apps</div>
          </div>
        </div>
        <button onClick={logout} style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 14px", color: "#64748b", fontSize: 13, cursor: "pointer" }}>Sign out</button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left sidebar — task type selector */}
        <div style={{ width: 220, borderRight: "1px solid #1e293b", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Request type</div>
          {taskOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTaskType(opt.value)}
              style={{
                background: taskType === opt.value ? BLUE_DIM : "transparent",
                border: `1px solid ${taskType === opt.value ? BLUE_BORDER : "transparent"}`,
                borderRadius: 10,
                padding: "10px 14px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: taskType === opt.value ? "#93c5fd" : "#cbd5e1" }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10, flexShrink: 0, alignSelf: "flex-end" }}>⚙️</div>
                )}
                <div style={{
                  maxWidth: "70%",
                  background: msg.role === "user" ? BLUE : "#111827",
                  border: `1px solid ${msg.role === "user" ? BLUE : "#1e293b"}`,
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "#e2e8f0",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                  {msg.sheetUrl && (
                    <div style={{ marginTop: 10 }}>
                      <a href={msg.sheetUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#4ade80", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                        📊 Open Google Sheet ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚙️</div>
                <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 16px", display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#475569", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ borderTop: "1px solid #1e293b", padding: 20 }}>
            {taskType === "sheet" && (
              <div style={{ marginBottom: 12 }}>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Sheet title (e.g. HVAC Companies - Knoxville TN)"
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  taskType === "sheet" ? "Describe what columns or data you need in the sheet..." :
                  taskType === "research" ? "Describe what you need researched..." :
                  taskType === "marketing" ? "Describe the marketing task..." :
                  "Ask anything..."
                }
                rows={2}
                style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={send}
                disabled={sending || (!input.trim() && !title.trim())}
                style={{ background: BLUE, border: "none", borderRadius: 10, padding: "0 20px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: sending ? "wait" : "pointer", opacity: (!input.trim() && !title.trim()) ? 0.4 : 1, flexShrink: 0 }}
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#475569" }}>Press Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>
    </div>
  );
}
