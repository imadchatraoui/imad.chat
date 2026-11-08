import type { NextRequest } from "next/server";
import { getProvider, UpstreamError, type ChatMessage } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/prompt";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2000;
const PER_IP_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 10);
const GLOBAL_PER_MINUTE = Number(process.env.RATE_LIMIT_GLOBAL_PER_MINUTE ?? 120);

type Parsed = { messages: ChatMessage[]; focus?: string } | { error: "bad_request" | "too_long" };

function parseBody(body: unknown): Parsed {
  if (!body || typeof body !== "object") return { error: "bad_request" };
  const raw = (body as { messages?: unknown; focus?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return { error: "bad_request" };

  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "bad_request" };
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return { error: "bad_request" };
    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_MESSAGE_CHARS) return { error: "too_long" };
    messages.push({ role, content: text });
  }

  const trimmed = messages.slice(-MAX_MESSAGES);
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") return { error: "bad_request" };

  const focusRaw = (body as { focus?: unknown }).focus;
  const focus = typeof focusRaw === "string" && /^[a-z0-9-]{1,80}$/.test(focusRaw) ? focusRaw : undefined;

  return { messages: trimmed, focus };
}

function json(status: number, payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
  const perIp = rateLimit(`ip:${ip}`, PER_IP_PER_MINUTE);
  const global = rateLimit("global", GLOBAL_PER_MINUTE);
  if (!perIp.ok || !global.ok) {
    const retry = Math.max(perIp.retryAfterSeconds, global.retryAfterSeconds);
    return json(429, { error: "rate_limited" }, { "Retry-After": String(retry) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) return json(parsed.error === "too_long" ? 413 : 400, { error: parsed.error });

  const provider = getProvider();
  if (!provider) return json(503, { error: "not_configured" });

  // Per scegliere le pagine guardiamo le ultime due domande: la seconda spesso è un seguito della prima.
  const userTurns = parsed.messages.filter((m) => m.role === "user").map((m) => m.content);
  const query = userTurns.slice(-2).reverse().join(" ");
  const system = buildSystemPrompt(query, parsed.focus);

  try {
    const stream = await provider.stream(system, parsed.messages, req.signal);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        "X-Model": provider.model,
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      console.error(`[chat] ${provider.name} ${err.status}: ${err.detail}`);
      return json(502, { error: err.status === 429 ? "rate_limited" : "upstream" });
    }
    if ((err as Error).name === "AbortError") return new Response(null, { status: 499 });
    console.error("[chat]", err);
    return json(502, { error: "upstream" });
  }
}
