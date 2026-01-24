import { useState, useEffect } from "react";
import {
  getSettings,
  saveSettings,
  hasLinearApiKey,
  getDefaultModel,
  AI_MODELS,
  SUMMARY_STYLE_PROMPTS,
} from "@/lib/storage";
import type { StorageSettings, AIProvider, SummaryStyle } from "@/lib/storage";
import "./App.css";

type SettingsTab = "linear" | "ai" | "summary" | "preferences";

const AI_PROVIDERS: {
  value: AIProvider;
  label: string;
  placeholder: string;
}[] = [
  { value: "none", label: "None", placeholder: "" },
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { value: "gemini", label: "Google Gemini", placeholder: "AIzaSy..." },
  { value: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
  { value: "grok", label: "Grok (xAI)", placeholder: "xai-..." },
];

export default function App() {
  const [settings, setSettings] = useState<StorageSettings>({});
  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("linear");
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
    const configured = await hasLinearApiKey();
    setIsConfigured(configured);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      await saveSettings(settings);
      setMessage("Settings saved successfully!");
      setIsConfigured(!!settings.linearApiKey);

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(
        `Error: ${error instanceof Error ? error.message : "Failed to save"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function openSidePanel() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  }

  function toggleApiKeyVisibility(key: string) {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function getProviderPlaceholder(provider: string | undefined): string {
    const found = AI_PROVIDERS.find((p) => p.value === provider);
    return found?.placeholder || "";
  }

  function getProviderLabel(provider: string | undefined): string {
    const found = AI_PROVIDERS.find((p) => p.value === provider);
    return found?.label || "";
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "linear", label: "Linear" },
    { id: "ai", label: "AI" },
    { id: "summary", label: "Summary" },
    { id: "preferences", label: "Prefs" },
  ];

  if (isConfigured) {
    return (
      <div className="popup-wrapper">
        <div className="popup-card">
          <div className="card-header">
            <h1>Linear Web Clipper</h1>
          </div>
          <div className="card-content">
            <div className="status-card">
              <span className="status-icon">✓</span>
              <span className="status-text">Extension configured</span>
            </div>
            <div className="action-buttons">
              <button
                type="button"
                className="primary-button"
                onClick={openSidePanel}
              >
                Open Clipper
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsConfigured(false)}
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-wrapper">
      <div className="popup-card settings-card">
        <div className="card-header">
          <h1>Settings</h1>
        </div>

        <div className="tabs-container">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tab-panels">
          <div
            className="tab-panel"
            role="tabpanel"
            data-active={activeTab === "linear"}
          >
            <div className="section-header">
              <h2>Linear Integration</h2>
              <p className="section-description">
                Connect your Linear workspace to create issues.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="linearApiKey">
                API Key <span className="required">*</span>
              </label>
              <div className="input-with-toggle">
                <input
                  id="linearApiKey"
                  type={showApiKeys.linear ? "text" : "password"}
                  placeholder="lin_api_xxxxxxxxxxxxxxxxxxxx"
                  value={settings.linearApiKey || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      linearApiKey: e.target.value.trim(),
                    })
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => toggleApiKeyVisibility("linear")}
                  aria-label={
                    showApiKeys.linear ? "Hide API key" : "Show API key"
                  }
                >
                  {showApiKeys.linear ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <small>
                Get your API key from{" "}
                <a
                  href="https://linear.app/settings/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Linear Settings → API
                </a>
              </small>
            </div>
          </div>

          <div
            className="tab-panel"
            role="tabpanel"
            data-active={activeTab === "ai"}
          >
            <div className="section-header">
              <h2>AI Summarization</h2>
              <p className="section-description">
                Generate summaries and reformat transcripts.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="aiProvider">Provider</label>
              <select
                id="aiProvider"
                value={settings.aiProvider || "none"}
                onChange={(e) => {
                  const newProvider = e.target.value as AIProvider;
                  setSettings({
                    ...settings,
                    aiProvider: newProvider,
                    aiApiKey: newProvider === "none" ? "" : settings.aiApiKey,
                    aiModel: getDefaultModel(newProvider),
                  });
                }}
              >
                {AI_PROVIDERS.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>

            {settings.aiProvider && settings.aiProvider !== "none" && (
              <>
                <div className="form-group">
                  <label htmlFor="aiModel">Model</label>
                  <select
                    id="aiModel"
                    value={
                      settings.aiModel || getDefaultModel(settings.aiProvider)
                    }
                    onChange={(e) =>
                      setSettings({ ...settings, aiModel: e.target.value })
                    }
                  >
                    {AI_MODELS[settings.aiProvider].map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="aiApiKey">
                    {getProviderLabel(settings.aiProvider)} API Key
                  </label>
                  <div className="input-with-toggle">
                    <input
                      id="aiApiKey"
                      type={showApiKeys.ai ? "text" : "password"}
                      placeholder={getProviderPlaceholder(settings.aiProvider)}
                      value={settings.aiApiKey || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, aiApiKey: e.target.value })
                      }
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      onClick={() => toggleApiKeyVisibility("ai")}
                      aria-label={
                        showApiKeys.ai ? "Hide API key" : "Show API key"
                      }
                    >
                      {showApiKeys.ai ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <small>
                    {settings.aiProvider === "openai" && (
                      <>
                        Get your key from{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                        >
                          OpenAI Dashboard
                        </a>
                      </>
                    )}
                    {settings.aiProvider === "anthropic" && (
                      <>
                        Get your key from{" "}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Anthropic Console
                        </a>
                      </>
                    )}
                    {settings.aiProvider === "gemini" && (
                      <>
                        Get your key from{" "}
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google AI Studio
                        </a>
                      </>
                    )}
                    {settings.aiProvider === "deepseek" && (
                      <>
                        Get your key from{" "}
                        <a
                          href="https://platform.deepseek.com/api_keys"
                          target="_blank"
                          rel="noreferrer"
                        >
                          DeepSeek Platform
                        </a>
                      </>
                    )}
                    {settings.aiProvider === "grok" && (
                      <>
                        Get your key from{" "}
                        <a
                          href="https://console.x.ai"
                          target="_blank"
                          rel="noreferrer"
                        >
                          xAI Console
                        </a>
                      </>
                    )}
                  </small>
                </div>
              </>
            )}
          </div>

          <div
            className="tab-panel"
            role="tabpanel"
            data-active={activeTab === "summary"}
          >
            <div className="section-header">
              <h2>Summary Style</h2>
              <p className="section-description">
                Choose how summaries are formatted.
              </p>
            </div>

            <div className="form-group">
              <div className="style-options">
                {(
                  Object.keys(SUMMARY_STYLE_PROMPTS) as Exclude<
                    SummaryStyle,
                    "custom"
                  >[]
                ).map((style) => (
                  <label
                    key={style}
                    className={`style-option ${settings.summaryStyle === style ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="summaryStyle"
                      value={style}
                      checked={settings.summaryStyle === style}
                      onChange={() =>
                        setSettings({ ...settings, summaryStyle: style })
                      }
                    />
                    <span className="style-content">
                      <span className="style-label">
                        {SUMMARY_STYLE_PROMPTS[style].label}
                      </span>
                      <span className="style-description">
                        {SUMMARY_STYLE_PROMPTS[style].description}
                      </span>
                    </span>
                  </label>
                ))}
                <label
                  className={`style-option ${settings.summaryStyle === "custom" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="summaryStyle"
                    value="custom"
                    checked={settings.summaryStyle === "custom"}
                    onChange={() =>
                      setSettings({ ...settings, summaryStyle: "custom" })
                    }
                  />
                  <span className="style-content">
                    <span className="style-label">Custom</span>
                    <span className="style-description">
                      Write your own prompt
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {settings.summaryStyle === "custom" && (
              <div className="form-group">
                <label htmlFor="customPrompt">Custom Prompt</label>
                <textarea
                  id="customPrompt"
                  value={settings.customSummaryPrompt || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      customSummaryPrompt: e.target.value,
                    })
                  }
                  placeholder="Write your summary instructions here…"
                  rows={4}
                />
                <small>
                  The content to summarize will be appended after your prompt.
                </small>
              </div>
            )}
          </div>

          <div
            className="tab-panel"
            role="tabpanel"
            data-active={activeTab === "preferences"}
          >
            <div className="section-header">
              <h2>Preferences</h2>
              <p className="section-description">Customize clipper behavior.</p>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeMetadata !== false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      includeMetadata: e.target.checked,
                    })
                  }
                />
                <span className="checkbox-label">
                  <span className="checkbox-title">Include page metadata</span>
                  <span className="checkbox-description">
                    Add URL, date, and description
                  </span>
                </span>
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label
                className={
                  !settings.aiProvider || settings.aiProvider === "none"
                    ? "disabled"
                    : ""
                }
              >
                <input
                  type="checkbox"
                  checked={settings.autoSummarize || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoSummarize: e.target.checked,
                    })
                  }
                  disabled={
                    !settings.aiProvider || settings.aiProvider === "none"
                  }
                />
                <span className="checkbox-label">
                  <span className="checkbox-title">Auto-summarize on clip</span>
                  <span className="checkbox-description">
                    {!settings.aiProvider || settings.aiProvider === "none"
                      ? "Configure AI provider first"
                      : "Generate summary automatically"}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`message ${message.includes("Error") ? "error" : "success"}`}
          >
            {message}
          </div>
        )}

        <div className="card-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || !settings.linearApiKey}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
