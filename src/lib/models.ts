/**
 * Dynamic model discovery for AI providers.
 *
 * Each provider exposes a model-listing endpoint. We fetch it with the user's
 * API key from extension pages (host_permissions exempt extension contexts
 * from CORS), normalize the response to { value, label } pairs, and cache
 * the result in chrome.storage.local. The static AI_MODELS list in storage.ts
 * remains the fallback when a provider can't be reached.
 */
import type { ActiveAIProvider } from "./storage";
import { AI_MODELS } from "./storage";

export interface ModelOption {
  value: string;
  label: string;
}

interface ProviderModelAPI {
  /** Build the request for the provider's list-models endpoint */
  request: (apiKey: string) => { url: string; headers: Record<string, string> };
  /** Extract and filter model options from the parsed JSON response */
  parse: (json: unknown) => ModelOption[];
}

interface OpenAIStyleList {
  data?: { id?: string; name?: string }[];
}

interface GeminiStyleList {
  models?: {
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }[];
}

function bearer(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

/** OpenAI returns every model type; keep chat-capable GPT/o-series models. */
function isOpenAIChatModel(id: string): boolean {
  if (!/^(gpt-|chatgpt-|o\d)/.test(id)) return false;
  return !/(audio|realtime|transcribe|tts|image|embedding|moderation|search|instruct|davinci|babbage|dall-e|sora)/.test(
    id,
  );
}

/** Exported for testing */
export const PROVIDER_MODEL_APIS: Record<ActiveAIProvider, ProviderModelAPI> = {
  openai: {
    request: (apiKey) => ({
      url: "https://api.openai.com/v1/models",
      headers: bearer(apiKey),
    }),
    parse: (json) =>
      ((json as OpenAIStyleList).data ?? [])
        .map((m) => m.id ?? "")
        .filter(isOpenAIChatModel)
        .sort()
        .map((id) => ({ value: id, label: id })),
  },
  anthropic: {
    request: (apiKey) => ({
      url: "https://api.anthropic.com/v1/models?limit=100",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    }),
    parse: (json) =>
      ((json as { data?: { id?: string; display_name?: string }[] }).data ?? [])
        .filter((m) => m.id)
        .map((m) => ({ value: m.id!, label: m.display_name || m.id! })),
  },
  gemini: {
    request: (apiKey) => ({
      // Key goes in a header (not the URL) so it can't leak into logs
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      headers: { "x-goog-api-key": apiKey },
    }),
    parse: (json) =>
      ((json as GeminiStyleList).models ?? [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .filter((m) => m.name?.startsWith("models/gemini"))
        .map((m) => ({
          value: m.name!.replace(/^models\//, ""),
          label: m.displayName || m.name!.replace(/^models\//, ""),
        })),
  },
  deepseek: {
    request: (apiKey) => ({
      url: "https://api.deepseek.com/models",
      headers: bearer(apiKey),
    }),
    parse: (json) =>
      ((json as OpenAIStyleList).data ?? [])
        .filter((m) => m.id)
        .map((m) => ({ value: m.id!, label: m.id! })),
  },
  grok: {
    request: (apiKey) => ({
      url: "https://api.x.ai/v1/models",
      headers: bearer(apiKey),
    }),
    parse: (json) =>
      (
        (json as { data?: { id?: string; output_modalities?: string[] }[] })
          .data ?? []
      )
        .filter((m) => m.id && (m.output_modalities?.includes("text") ?? true))
        .map((m) => ({ value: m.id!, label: m.id! })),
  },
  groq: {
    request: (apiKey) => ({
      url: "https://api.groq.com/openai/v1/models",
      headers: bearer(apiKey),
    }),
    parse: (json) =>
      ((json as { data?: { id?: string; active?: boolean }[] }).data ?? [])
        .filter(
          (m) =>
            m.id &&
            m.active !== false &&
            !/whisper|tts|playai|guard/i.test(m.id),
        )
        .map((m) => m.id!)
        .sort()
        .map((id) => ({ value: id, label: id })),
  },
  mistral: {
    request: (apiKey) => ({
      url: "https://api.mistral.ai/v1/models",
      headers: bearer(apiKey),
    }),
    parse: (json) => {
      const seen = new Set<string>();
      return (
        (
          json as {
            data?: {
              id?: string;
              name?: string;
              capabilities?: { completion_chat?: boolean };
            }[];
          }
        ).data ?? []
      )
        .filter((m) => {
          if (!m.id || seen.has(m.id)) return false;
          if (m.capabilities && m.capabilities.completion_chat !== true)
            return false;
          seen.add(m.id);
          return true;
        })
        .sort((a, b) => a.id!.localeCompare(b.id!))
        .map((m) => ({ value: m.id!, label: m.name || m.id! }));
    },
  },
  openrouter: {
    request: () => ({
      // Public endpoint — no auth required
      url: "https://openrouter.ai/api/v1/models",
      headers: {},
    }),
    parse: (json) =>
      (
        (
          json as {
            data?: {
              id?: string;
              name?: string;
              architecture?: { output_modalities?: string[] };
            }[];
          }
        ).data ?? []
      )
        .filter(
          (m) =>
            m.id &&
            (m.architecture?.output_modalities?.includes("text") ?? true),
        )
        .map((m) => ({ value: m.id!, label: m.name || m.id! }))
        .sort((a, b) => a.label.localeCompare(b.label)),
  },
};

/** Cache time-to-live: 24 hours */
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;

interface ModelCacheEntry {
  models: ModelOption[];
  fetchedAt: number;
}

function cacheKey(provider: ActiveAIProvider): string {
  return `modelCache_${provider}`;
}

/**
 * Fetch the live model list for a provider. Must run in an extension
 * context (host_permissions exempt it from CORS).
 * Throws on network/auth errors — callers fall back to the static list.
 */
export async function fetchProviderModels(
  provider: ActiveAIProvider,
  apiKey: string,
): Promise<ModelOption[]> {
  const api = PROVIDER_MODEL_APIS[provider];
  const { url, headers } = api.request(apiKey);

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Model list request failed (HTTP ${response.status})`);
  }

  const models = api.parse(await response.json());
  if (models.length === 0) {
    throw new Error("Provider returned no usable models");
  }
  return models;
}

/**
 * Get models for a provider: fresh cache → live fetch → static fallback.
 * Never throws; always returns a usable list.
 */
export async function getModelsForProvider(
  provider: ActiveAIProvider,
  apiKey: string | undefined,
  options: { forceRefresh?: boolean } = {},
): Promise<{ models: ModelOption[]; source: "live" | "cache" | "static" }> {
  const key = cacheKey(provider);

  if (!options.forceRefresh) {
    const stored = await chrome.storage.local.get(key);
    const entry = stored[key] as ModelCacheEntry | undefined;
    if (entry && Date.now() - entry.fetchedAt < MODEL_CACHE_TTL) {
      return { models: entry.models, source: "cache" };
    }
  }

  // OpenRouter's endpoint is public; all others need the user's key
  if (provider === "openrouter" || apiKey) {
    try {
      const models = await fetchProviderModels(provider, apiKey ?? "");
      const entry: ModelCacheEntry = { models, fetchedAt: Date.now() };
      await chrome.storage.local.set({ [key]: entry });
      return { models, source: "live" };
    } catch {
      // fall through to static list
    }
  }

  return { models: AI_MODELS[provider], source: "static" };
}
