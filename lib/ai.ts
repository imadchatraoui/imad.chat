import Anthropic from "@anthropic-ai/sdk";

/**
 * Il bot parla con un modello linguistico attraverso uno di questi provider.
 * Basta una variabile d'ambiente, la prima trovata vince:
 *
 *   ANTHROPIC_API_KEY   → Claude (a pagamento, qualità massima)
 *   AI_API_KEY + AI_BASE_URL → qualsiasi endpoint compatibile OpenAI
 *   GROQ_API_KEY        → Groq (gratis, veloce)
 *   GEMINI_API_KEY      → Google AI Studio (gratis)
 *   OPENROUTER_API_KEY  → OpenRouter (modelli gratuiti con suffisso :free)
 *
 * AI_MODEL sovrascrive il modello predefinito del provider scelto.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Provider = {
  name: string;
  model: string;
  stream: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
};

export class UpstreamError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`upstream ${status}`);
  }
}

const MAX_OUTPUT_TOKENS = 700;

/** Converte lo stream SSE di un endpoint compatibile OpenAI in testo puro. */
function sseToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> };
      const text = json.choices?.[0]?.delta?.content;
      if (typeof text === "string" && text) controller.enqueue(encoder.encode(text));
    } catch {
      /* riga incompleta o commento keep-alive */
    }
  };

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          handleLine(line, controller);
        }
      },
      flush(controller) {
        if (buffer) handleLine(buffer, controller);
      },
    }),
  );
}

function openAICompatible(
  name: string,
  baseURL: string,
  apiKey: string,
  model: string,
  extra: Record<string, unknown> = {},
): Provider {
  return {
    name,
    model,
    async stream(system, messages, signal) {
      const res = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.6,
          messages: [{ role: "system", content: system }, ...messages],
          ...extra,
        }),
        signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new UpstreamError(res.status, detail.slice(0, 500));
      }
      return sseToText(res.body);
    },
  };
}

function anthropic(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey });
  return {
    name: "anthropic",
    model,
    async stream(system, messages, signal) {
      const encoder = new TextEncoder();
      // Fallback lato server: se il modello declina per policy, risponde un modello sostitutivo.
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal },
      );
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }
            controller.close();
          } catch (err) {
            if (err instanceof Anthropic.APIError) {
              controller.error(new UpstreamError(err.status ?? 502, err.message));
            } else {
              controller.error(err);
            }
          }
        },
        cancel() {
          stream.abort();
        },
      });
    },
  };
}

export function getProvider(): Provider | null {
  const env = process.env;
  const model = env.AI_MODEL?.trim();

  if (env.ANTHROPIC_API_KEY) {
    return anthropic(env.ANTHROPIC_API_KEY, model || "claude-opus-5-5");
  }
  if (env.AI_API_KEY && env.AI_BASE_URL) {
    return openAICompatible("custom", env.AI_BASE_URL, env.AI_API_KEY, model || "");
  }
  if (env.GROQ_API_KEY) {
    const m = model || "openai/gpt-oss-120b";
    return openAICompatible(
      "groq",
      "https://api.groq.com/openai/v1",
      env.GROQ_API_KEY,
      m,
      m.includes("gpt-oss") ? { reasoning_effort: "low" } : {},
    );
  }
  if (env.GEMINI_API_KEY) {
    return openAICompatible(
      "gemini",
      "https://generativelanguage.googleapis.com/v1beta/openai",
      env.GEMINI_API_KEY,
      model || "gemini-2.5-flash-lite",
    );
  }
  if (env.OPENROUTER_API_KEY) {
    return openAICompatible(
      "openrouter",
      "https://openrouter.ai/api/v1",
      env.OPENROUTER_API_KEY,
      model || "meta-llama/llama-3.3-70b-instruct:free",
    );
  }
  return null;
}
