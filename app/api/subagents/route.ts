import { invokeTool } from '@/app/lib/openclaw';
import { NextResponse } from 'next/server';

interface RawSession {
  key?: string;
  label?: string;
  model?: string;
  tokenCount?: number;
  updatedAt?: number;
  messages?: Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
}

interface SessionsListResponse {
  count: number;
  sessions: RawSession[];
}

export async function GET() {
  try {
    const response = await invokeTool<SessionsListResponse>('sessions_list', {
      limit: 50,
      messageLimit: 1,
    });
    const sessions = response.sessions ?? [];
    const subagents = sessions
      .filter((s) => s.key?.includes(':subagent:') || s.key?.includes(':cron:'))
      .map((s) => {
        const now = Date.now();
        const ms = s.updatedAt ? (s.updatedAt > 1e12 ? s.updatedAt : s.updatedAt * 1000) : 0;
        const active = ms > 0 && now - ms < 5 * 60 * 1000;
        let lastMessage: string | null = null;
        if (s.messages && s.messages.length > 0) {
          const msg = s.messages[s.messages.length - 1];
          const textBlock = msg.content?.find((c) => c.type === 'text');
          if (textBlock?.text) {
            lastMessage = textBlock.text.slice(0, 120);
          }
        }
        return { key: s.key, label: s.label, model: s.model, updatedAt: s.updatedAt, active, lastMessage };
      });
    return NextResponse.json({ subagents });
  } catch {
    return NextResponse.json({ subagents: [] });
  }
}
