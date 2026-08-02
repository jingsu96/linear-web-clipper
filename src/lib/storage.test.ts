import { describe, it, expect } from "vitest";
import {
  AI_MODELS,
  AI_PROVIDER_META,
  getDefaultModel,
  getEffectiveModelForConfig,
  hasAnyAIConfigured,
  getEnabledConfigs,
  type AIProviderConfig,
  type ActiveAIProvider,
} from "./storage";

function makeConfig(
  overrides: Partial<AIProviderConfig> = {},
): AIProviderConfig {
  return {
    id: "test-id",
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-5.1",
    enabled: true,
    ...overrides,
  };
}

describe("getDefaultModel", () => {
  it("returns the first model for each provider", () => {
    for (const provider of Object.keys(AI_MODELS) as ActiveAIProvider[]) {
      expect(getDefaultModel(provider)).toBe(AI_MODELS[provider][0].value);
    }
  });

  it("returns empty string for 'none'", () => {
    expect(getDefaultModel("none")).toBe("");
  });
});

describe("AI provider metadata", () => {
  it("has metadata and models for every active provider", () => {
    const providers = Object.keys(AI_MODELS) as ActiveAIProvider[];
    for (const provider of providers) {
      expect(AI_PROVIDER_META[provider]).toBeDefined();
      expect(AI_MODELS[provider].length).toBeGreaterThan(0);
      for (const model of AI_MODELS[provider]) {
        expect(model.value).toBeTruthy();
        expect(model.label).toBeTruthy();
      }
    }
  });
});

describe("getEffectiveModelForConfig", () => {
  it("returns the configured model", () => {
    expect(getEffectiveModelForConfig(makeConfig({ model: "gpt-5.2" }))).toBe(
      "gpt-5.2",
    );
  });

  it("falls back to provider default when model is empty", () => {
    expect(getEffectiveModelForConfig(makeConfig({ model: "" }))).toBe(
      getDefaultModel("openai"),
    );
  });

  it("prefers trimmed customModel for openrouter", () => {
    const config = makeConfig({
      provider: "openrouter",
      model: "meta-llama/llama-3.3-70b-instruct",
      customModel: "  my/custom-model  ",
    });
    expect(getEffectiveModelForConfig(config)).toBe("my/custom-model");
  });

  it("ignores customModel for non-openrouter providers", () => {
    const config = makeConfig({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      customModel: "should-be-ignored",
    });
    expect(getEffectiveModelForConfig(config)).toBe("claude-sonnet-4-5");
  });

  it("ignores whitespace-only customModel", () => {
    const config = makeConfig({
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      customModel: "   ",
    });
    expect(getEffectiveModelForConfig(config)).toBe("google/gemini-2.5-flash");
  });
});

describe("hasAnyAIConfigured", () => {
  it("returns false for undefined or empty configs", () => {
    expect(hasAnyAIConfigured(undefined)).toBe(false);
    expect(hasAnyAIConfigured([])).toBe(false);
  });

  it("returns false when all configs are disabled or missing keys", () => {
    expect(
      hasAnyAIConfigured([
        makeConfig({ enabled: false }),
        makeConfig({ apiKey: "" }),
      ]),
    ).toBe(false);
  });

  it("returns true when at least one config is enabled with a key", () => {
    expect(
      hasAnyAIConfigured([makeConfig({ enabled: false }), makeConfig()]),
    ).toBe(true);
  });
});

describe("getEnabledConfigs", () => {
  it("returns empty array for undefined", () => {
    expect(getEnabledConfigs(undefined)).toEqual([]);
  });

  it("filters out disabled configs and configs without keys, preserving order", () => {
    const first = makeConfig({ id: "1" });
    const second = makeConfig({ id: "2", provider: "anthropic" });
    const configs = [
      first,
      makeConfig({ id: "disabled", enabled: false }),
      makeConfig({ id: "no-key", apiKey: "" }),
      second,
    ];
    expect(getEnabledConfigs(configs)).toEqual([first, second]);
  });
});
