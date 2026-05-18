import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";

const DISCORD_TOKEN = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(
      path.join(process.env.USERPROFILE || process.env.HOME || "", ".openclaw", "openclaw.json"), "utf8"
    ));
    return cfg.channels?.discord?.token;
  } catch { return null; }
})();

const OUTREACH_CHANNEL = "1494447493818089493";

function sendDiscord(channelId: string, message: string): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ content: message });
    const req = https.request({
      hostname: "discord.com",
      path: `/api/v10/channels/${channelId}/messages`,
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ id: "" }); } });
    });
    req.on("error", reject);
    req.write(body); req.end();
  });
}

function getDiscordMessages(channelId: string, limit = 20): Promise<Array<{ id: string; content: string; author: { id: string; username: string; bot?: boolean }; timestamp: string }>> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "discord.com",
      path: `/api/v10/channels/${channelId}/messages?limit=${limit}`,
      method: "GET",
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    });
    req.on("error", reject);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { message, type } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

    // Handle Google Sheet creation
    if (type === "sheet") {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const sheetRes = await fetch(`${baseUrl}/api/create-sheet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: message, shareEmail: "archer@bluestoneapps.com" }),
        });
        const sheet = await sheetRes.json();
        if (sheet.shareUrl) {
          // Also post to Discord
          await sendDiscord(OUTREACH_CHANNEL, `📊 Google Sheet created for Archer: **${message}**\n${sheet.shareUrl}`);
          return NextResponse.json({
            reply: `✅ Google Sheet created and shared with you!\n\n📊 **[${message}](${sheet.shareUrl})**\n\nYou also have editor access — the link has been sent to archer@bluestoneapps.com.`,
            sheetUrl: sheet.shareUrl,
          });
        }
      } catch (e) {
        console.error("[archer-chat] sheet error", e);
      }
    }

    // For research/marketing tasks — create a task and route to agent
    if (type === "task") {
      const taskBody = JSON.stringify({
        title: message,
        description: `Request from Archer Bagley via Mission Control portal.\n\n${message}`,
        difficulty: "sonnet",
        assignedAgent: "axeloutreach",
        assignedModel: "anthropic/claude-sonnet-4-6",
      });
      const taskRes = await fetch("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: taskBody,
      });
      const task = await taskRes.json();
      await sendDiscord(OUTREACH_CHANNEL, `📋 New task from Archer: **${message}** (task ID: \`${task.id}\`)`);
      return NextResponse.json({
        reply: `✅ Task created! Your request has been sent to the outreach team. Task ID: \`${task.id}\`\n\nYou'll see updates here as work progresses.`,
        taskId: task.id,
      });
    }

    // General chat — send to Discord outreach channel and wait for reply
    const sentMsg = await sendDiscord(OUTREACH_CHANNEL, `💬 **Archer (via portal):** ${message}`);
    
    // Wait a few seconds for agent to respond
    await new Promise(r => setTimeout(r, 8000));
    
    // Get recent messages
    const messages = await getDiscordMessages(OUTREACH_CHANNEL, 10);
    const botMessages = messages
      .filter(m => m.author.bot && new Date(m.timestamp).getTime() > Date.now() - 30000)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (botMessages.length > 0) {
      return NextResponse.json({ reply: botMessages[botMessages.length - 1].content });
    }

    return NextResponse.json({ reply: "Your message has been sent to the outreach team. They'll respond shortly." });
  } catch (e) {
    console.error("[archer-chat]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
