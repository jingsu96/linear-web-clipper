/**
 * Storage utilities for managing extension settings
 */

export type AIProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "grok"
  | "groq"
  | "mistral"
  | "openrouter"
  | "none";

export type ActiveAIProvider = Exclude<AIProvider, "none">;

export type SummaryStyle =
  "concise" | "educational" | "comprehensive" | "inspired" | "custom";

export interface AIProviderConfig {
  id: string;
  provider: ActiveAIProvider;
  apiKey: string;
  model: string;
  customModel?: string; // openrouter only
  enabled: boolean;
}

export interface StorageSettings {
  linearApiKey?: string;
  defaultTeamId?: string;
  defaultProjectId?: string;
  includeMetadata?: boolean;
  autoSummarize?: boolean;
  summaryStyle?: SummaryStyle;
  summaryLanguage?: string;
  customSummaryPrompt?: string;
  uploadImagesToLinear?: boolean;
  aiProviderConfigs?: AIProviderConfig[];
  // Legacy fields — kept for migration only
  aiProvider?: AIProvider;
  aiApiKey?: string;
  aiModel?: string;
  customAiModel?: string;
}

/**
 * Metadata for each AI provider (label, placeholder, help link)
 */
export const AI_PROVIDER_META: Record<
  ActiveAIProvider,
  { label: string; placeholder: string; helpUrl: string; helpLabel: string }
> = {
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpLabel: "OpenAI Dashboard",
  },
  anthropic: {
    label: "Anthropic",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpLabel: "Anthropic Console",
  },
  gemini: {
    label: "Google Gemini",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpLabel: "Google AI Studio",
  },
  deepseek: {
    label: "DeepSeek",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/api_keys",
    helpLabel: "DeepSeek Platform",
  },
  grok: {
    label: "Grok (xAI)",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai",
    helpLabel: "xAI Console",
  },
  groq: {
    label: "Groq",
    placeholder: "gsk_...",
    helpUrl: "https://console.groq.com/keys",
    helpLabel: "Groq Console",
  },
  mistral: {
    label: "Mistral AI",
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/api-keys",
    helpLabel: "Mistral Console",
  },
  openrouter: {
    label: "OpenRouter",
    placeholder: "sk-or-...",
    helpUrl: "https://openrouter.ai/keys",
    helpLabel: "OpenRouter Dashboard",
  },
};

/**
 * Available models per provider
 */
export const AI_MODELS: Record<
  Exclude<AIProvider, "none">,
  { value: string; label: string }[]
> = {
  openai: [
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5-mini", label: "GPT-5 mini" },
    { value: "gpt-5-nano", label: "GPT-5 nano" },
  ],
  anthropic: [
    {
      value: "claude-haiku-4-5",
      label: "Claude 4.5 Haiku (Fastest)",
    },
    {
      value: "claude-sonnet-4-5",
      label: "Claude 4.5 Sonnet (Balanced)",
    },
    { value: "claude-opus-4-5", label: "Claude 4.5 Opus (Powerful)" },
  ],
  gemini: [
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Powerful)" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)" },
  ],
  deepseek: [
    // Legacy aliases (deepseek-chat/-reasoner) are deprecated as of mid-2026
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash (Fast)" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro (Powerful)" },
  ],
  grok: [
    { value: "grok-4.1-thinking", label: "Grok 4.1 Thinking" },
    { value: "grok-4.1-fast", label: "Grok 4.1 Fast" },
    { value: "grok-4", label: "Grok 4" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Fast)" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  mistral: [
    { value: "mistral-large-latest", label: "Mistral Large (Powerful)" },
    { value: "mistral-small-latest", label: "Mistral Small (Fast)" },
    { value: "pixtral-large-latest", label: "Pixtral Large (Multimodal)" },
  ],
  openrouter: [
    {
      value: "meta-llama/llama-3.3-70b-instruct",
      label: "Llama 3.3 70B Instruct",
    },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
};

/**
 * Summary style prompts
 */
export const SUMMARY_STYLE_PROMPTS: Record<
  Exclude<SummaryStyle, "custom">,
  { label: string; description: string; prompt: string }
> = {
  concise: {
    label: "Concise",
    description: "Brief bullet points of key takeaways",
    prompt:
      "Summarize the following content in a concise format. Use bullet points to highlight 3-5 key takeaways. Be direct and avoid unnecessary details.",
  },
  educational: {
    label: "Educational",
    description: "Structured explanation with context",
    prompt:
      "Summarize the following content in an educational format. Explain the main concepts clearly, provide context where helpful, and organize the information in a logical structure that aids understanding.",
  },
  comprehensive: {
    label: "Comprehensive",
    description: "Detailed summary with all important points",
    prompt:
      "Provide a comprehensive summary of the following content. Cover all important points, include relevant details, and organize the summary with clear sections. Don't omit significant information.",
  },
  inspired: {
    label: "Inspired",
    description: "Extract insights and actionable ideas",
    prompt:
      "Summarize the following content focusing on insights and inspiration. Highlight the most thought-provoking ideas, extract actionable takeaways, and frame them in a way that sparks further thinking or action.",
  },
};

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProvider): string {
  if (provider === "none") return "";
  const models = AI_MODELS[provider];
  return models[0]?.value || "";
}

/**
 * Get the effective model ID for a provider config
 */
export function getEffectiveModelForConfig(config: AIProviderConfig): string {
  if (config.provider === "openrouter" && config.customModel?.trim()) {
    return config.customModel.trim();
  }
  return config.model || getDefaultModel(config.provider);
}

/**
 * Check if any AI provider is configured and enabled
 */
export function hasAnyAIConfigured(
  configs: AIProviderConfig[] | undefined,
): boolean {
  if (!configs || configs.length === 0) return false;
  return configs.some((c) => c.enabled && !!c.apiKey);
}

/**
 * Get enabled provider configs with API keys, in priority order
 */
export function getEnabledConfigs(
  configs: AIProviderConfig[] | undefined,
): AIProviderConfig[] {
  if (!configs) return [];
  return configs.filter((c) => c.enabled && !!c.apiKey);
}

/**
 * Get all settings from storage
 */
export async function getSettings(): Promise<StorageSettings> {
  const result = await chrome.storage.local.get([
    "linearApiKey",
    "defaultTeamId",
    "defaultProjectId",
    "includeMetadata",
    "autoSummarize",
    "uploadImagesToLinear",
    "summaryStyle",
    "summaryLanguage",
    "customSummaryPrompt",
    "aiProviderConfigs",
    // Legacy fields for migration
    "aiProvider",
    "aiApiKey",
    "aiModel",
    "customAiModel",
  ]);

  // Migrate legacy single-provider to configs array
  let aiProviderConfigs: AIProviderConfig[] | undefined =
    result.aiProviderConfigs;

  if (
    !aiProviderConfigs &&
    result.aiProvider &&
    result.aiProvider !== "none" &&
    result.aiApiKey
  ) {
    aiProviderConfigs = [
      {
        id: crypto.randomUUID(),
        provider: result.aiProvider as ActiveAIProvider,
        apiKey: result.aiApiKey,
        model: result.aiModel || getDefaultModel(result.aiProvider),
        customModel: result.customAiModel || undefined,
        enabled: true,
      },
    ];
    // Persist migration
    await chrome.storage.local.set({ aiProviderConfigs });
  }

  return {
    linearApiKey: result.linearApiKey,
    defaultTeamId: result.defaultTeamId,
    defaultProjectId: result.defaultProjectId,
    includeMetadata: result.includeMetadata !== false, // default true
    autoSummarize: result.autoSummarize || false,
    uploadImagesToLinear: result.uploadImagesToLinear || false,
    summaryStyle: result.summaryStyle || "concise",
    summaryLanguage: result.summaryLanguage || "English",
    customSummaryPrompt: result.customSummaryPrompt || "",
    aiProviderConfigs: aiProviderConfigs || [],
  };
}

/**
 * Save settings to storage
 */
export async function saveSettings(
  settings: Partial<StorageSettings>,
): Promise<void> {
  await chrome.storage.local.set(settings);
}

/**
 * Clear all settings
 */
export async function clearSettings(): Promise<void> {
  await chrome.storage.local.clear();
}

/**
 * Check if Linear API key is configured
 */
export async function hasLinearApiKey(): Promise<boolean> {
  const { linearApiKey } = await chrome.storage.local.get("linearApiKey");
  return !!linearApiKey;
}

/**
 * Check if AI is configured
 */
export async function hasAIConfigured(): Promise<boolean> {
  const settings = await getSettings();
  return hasAnyAIConfigured(settings.aiProviderConfigs);
}
