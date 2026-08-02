import { describe, it, expect } from "vitest";
import { PROVIDER_MODEL_APIS } from "./models";

// Fixtures mirror each provider's documented list-models response shape

describe("provider model list parsing", () => {
  it("openai: keeps chat models, drops non-chat model types", () => {
    const models = PROVIDER_MODEL_APIS.openai.parse({
      data: [
        { id: "gpt-5.2" },
        { id: "gpt-4o-audio-preview" },
        { id: "o3" },
        { id: "text-embedding-3-small" },
        { id: "whisper-1" },
        { id: "dall-e-3" },
        { id: "gpt-image-1" },
        { id: "omni-moderation-latest" },
        { id: "gpt-4o-realtime-preview" },
        { id: "chatgpt-4o-latest" },
      ],
    });
    expect(models.map((m) => m.value)).toEqual([
      "chatgpt-4o-latest",
      "gpt-5.2",
      "o3",
    ]);
  });

  it("anthropic: uses display_name as label", () => {
    const models = PROVIDER_MODEL_APIS.anthropic.parse({
      data: [
        { id: "claude-opus-4-5", display_name: "Claude Opus 4.5" },
        { id: "claude-haiku-4-5" },
      ],
    });
    expect(models).toEqual([
      { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
      { value: "claude-haiku-4-5", label: "claude-haiku-4-5" },
    ]);
  });

  it("gemini: filters to generateContent gemini models and strips prefix", () => {
    const models = PROVIDER_MODEL_APIS.gemini.parse({
      models: [
        {
          name: "models/gemini-2.5-pro",
          displayName: "Gemini 2.5 Pro",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
        {
          name: "models/text-embedding-004",
          displayName: "Text Embedding",
          supportedGenerationMethods: ["embedContent"],
        },
        {
          name: "models/gemma-3-27b-it",
          displayName: "Gemma 3",
          supportedGenerationMethods: ["generateContent"],
        },
      ],
    });
    expect(models).toEqual([
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ]);
  });

  it("grok: filters by text output modality", () => {
    const models = PROVIDER_MODEL_APIS.grok.parse({
      data: [
        { id: "grok-4", output_modalities: ["text"] },
        { id: "grok-2-image", output_modalities: ["image"] },
        { id: "grok-legacy" },
      ],
    });
    expect(models.map((m) => m.value)).toEqual(["grok-4", "grok-legacy"]);
  });

  it("groq: drops inactive and audio models", () => {
    const models = PROVIDER_MODEL_APIS.groq.parse({
      data: [
        { id: "llama-3.3-70b-versatile", active: true },
        { id: "whisper-large-v3", active: true },
        { id: "playai-tts", active: true },
        { id: "llama-guard-3-8b", active: true },
        { id: "old-model", active: false },
      ],
    });
    expect(models.map((m) => m.value)).toEqual(["llama-3.3-70b-versatile"]);
  });

  it("mistral: filters on completion_chat capability and dedupes", () => {
    const models = PROVIDER_MODEL_APIS.mistral.parse({
      data: [
        {
          id: "mistral-large-latest",
          name: "Mistral Large",
          capabilities: { completion_chat: true },
        },
        {
          id: "mistral-large-latest",
          capabilities: { completion_chat: true },
        },
        { id: "mistral-embed", capabilities: { completion_chat: false } },
      ],
    });
    expect(models).toEqual([
      { value: "mistral-large-latest", label: "Mistral Large" },
    ]);
  });

  it("openrouter: uses name as label and filters image-only models", () => {
    const models = PROVIDER_MODEL_APIS.openrouter.parse({
      data: [
        {
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          architecture: { output_modalities: ["text"] },
        },
        {
          id: "some/image-model",
          name: "Image Model",
          architecture: { output_modalities: ["image"] },
        },
      ],
    });
    expect(models).toEqual([
      { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    ]);
  });

  it("openrouter: needs no API key", () => {
    const { headers } = PROVIDER_MODEL_APIS.openrouter.request("");
    expect(headers).toEqual({});
  });

  it("anthropic: sends required browser-access headers", () => {
    const { headers } = PROVIDER_MODEL_APIS.anthropic.request("sk-ant-test");
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBeTruthy();
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });

  it("every provider parser tolerates an empty response", () => {
    for (const api of Object.values(PROVIDER_MODEL_APIS)) {
      expect(api.parse({})).toEqual([]);
    }
  });
});
