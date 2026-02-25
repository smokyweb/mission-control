const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL!;
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!;

export interface GatewayResponse<T = unknown> {
  ok: boolean;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    details?: unknown;
  };
  error?: string;
}

export async function invokeTool<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({ tool, args }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Gateway error: ${res.status} ${res.statusText}`);
  }

  const envelope: GatewayResponse = await res.json();

  if (!envelope.ok) {
    throw new Error(`Tool error: ${envelope.error ?? "unknown"}`);
  }

  // Unwrap: result.content[0].text contains JSON string
  const content = envelope.result?.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (first.type === "text" && first.text) {
      try {
        return JSON.parse(first.text) as T;
      } catch {
        return first.text as unknown as T;
      }
    }
  }

  return envelope.result as unknown as T;
}

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
