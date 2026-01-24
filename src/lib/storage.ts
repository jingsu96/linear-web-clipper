/**
 * Storage utilities for managing extension settings
 */

export type AIProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "grok"
  | "none";

export type SummaryStyle =
  | "concise"
  | "educational"
  | "comprehensive"
  | "inspired"
  | "custom";

export interface StorageSettings {
  linearApiKey?: string;
  aiProvider?: AIProvider;
  aiApiKey?: string;
  aiModel?: string;
  defaultTeamId?: string;
  defaultProjectId?: string;
  includeMetadata?: boolean;
  autoSummarize?: boolean;
  summaryStyle?: SummaryStyle;
  customSummaryPrompt?: string;
}

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
    { value: "gemini-2.5-pro", label: "Gemini 3 Flash (Fast)" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Preview" },
    {
      value: "gemini-2.5-flash-lite-preview-06-17",
      label: "Gemini 2.5 Flash",
    },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek V3 (Compatible)" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner (Reasoning)" },
  ],
  grok: [
    { value: "grok-4.1-thinking", label: "Grok 4.1 Thinking" },
    { value: "grok-4.1-fast", label: "Grok 4.1 Fast" },
    { value: "grok-4", label: "Grok 4" },
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
 * Get all settings from storage
 */
export async function getSettings(): Promise<StorageSettings> {
  const result = await chrome.storage.local.get([
    "linearApiKey",
    "aiProvider",
    "aiApiKey",
    "aiModel",
    "defaultTeamId",
    "defaultProjectId",
    "includeMetadata",
    "autoSummarize",
    "summaryStyle",
    "customSummaryPrompt",
  ]);

  const aiProvider = result.aiProvider || "none";

  return {
    linearApiKey: result.linearApiKey,
    aiProvider,
    aiApiKey: result.aiApiKey,
    aiModel: result.aiModel || getDefaultModel(aiProvider),
    defaultTeamId: result.defaultTeamId,
    defaultProjectId: result.defaultProjectId,
    includeMetadata: result.includeMetadata !== false, // default true
    autoSummarize: result.autoSummarize || false,
    summaryStyle: result.summaryStyle || "concise",
    customSummaryPrompt: result.customSummaryPrompt || "",
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
  const { aiProvider, aiApiKey } = await chrome.storage.local.get([
    "aiProvider",
    "aiApiKey",
  ]);
  return aiProvider !== "none" && !!aiApiKey;
}
