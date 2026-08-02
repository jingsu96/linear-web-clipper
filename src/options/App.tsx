import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSettings,
  saveSettings,
  getDefaultModel,
  getEffectiveModelForConfig,
  hasAnyAIConfigured,
  AI_MODELS,
  AI_PROVIDER_META,
  SUMMARY_STYLE_PROMPTS,
} from "@/lib/storage";
import type {
  StorageSettings,
  AIProviderConfig,
  ActiveAIProvider,
  SummaryStyle,
} from "@/lib/storage";
import { validateAIConfig } from "@/lib/messages";
import "./App.css";

const LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin Chinese (Simplified)",
  "Traditional Chinese",
  "Hindi",
  "French",
  "Standard Arabic",
  "Bengali",
  "Russian",
  "Portuguese",
  "Urdu",
  "Indonesian",
  "German",
  "Japanese",
  "Swahili",
  "Marathi",
  "Telugu",
  "Turkish",
  "Tamil",
  "Punjabi",
  "Korean",
  "Vietnamese",
  "Thai",
  "Italian",
  "Dutch",
];

const ALL_PROVIDERS: ActiveAIProvider[] = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "grok",
  "groq",
  "mistral",
  "openrouter",
];

type SettingsTab = "linear" | "ai" | "summary" | "preferences";

function EyeIcon() {
  return (
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
  );
}

function EyeOffIcon() {
  return (
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
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="8" y2="6" />
      <line x1="16" y1="6" x2="16" y2="6" />
      <line x1="8" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="16" y2="12" />
      <line x1="8" y1="18" x2="8" y2="18" />
      <line x1="16" y1="18" x2="16" y2="18" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function App() {
  const [settings, setSettings] = useState<StorageSettings>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("linear");
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  // AI provider card state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const savedSettingsRef = useRef<string>("");

  const providerConfigs = settings.aiProviderConfigs || [];

  const updateConfigs = useCallback((newConfigs: AIProviderConfig[]) => {
    setSettings((prev) => ({ ...prev, aiProviderConfigs: newConfigs }));
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
    savedSettingsRef.current = JSON.stringify(stored);
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(settings) !== savedSettingsRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      await saveSettings(settings);
      savedSettingsRef.current = JSON.stringify(settings);
      setMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleApiKeyVisibility(key: string) {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // --- Provider card handlers ---

  function handleAddProvider(provider: ActiveAIProvider) {
    const newConfig: AIProviderConfig = {
      id: crypto.randomUUID(),
      provider,
      apiKey: "",
      model: getDefaultModel(provider),
      enabled: true,
    };
    updateConfigs([...providerConfigs, newConfig]);
    setExpandedCardId(newConfig.id);
  }

  function handleRemoveProvider(id: string) {
    const config = providerConfigs.find((c) => c.id === id);
    const label = config
      ? AI_PROVIDER_META[config.provider].label
      : "this provider";
    if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;

    updateConfigs(providerConfigs.filter((c) => c.id !== id));
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedCardId === id) setExpandedCardId(null);
  }

  function handleUpdateConfig(id: string, patch: Partial<AIProviderConfig>) {
    updateConfigs(
      providerConfigs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    if (
      patch.apiKey !== undefined ||
      patch.model !== undefined ||
      patch.customModel !== undefined
    ) {
      setValidationResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function handleToggleEnabled(id: string) {
    updateConfigs(
      providerConfigs.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c,
      ),
    );
  }

  async function handleTestConnection(config: AIProviderConfig) {
    if (!config.apiKey) return;

    setValidatingId(config.id);
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[config.id];
      return next;
    });

    try {
      const result = await validateAIConfig({
        apiKey: config.apiKey,
        provider: config.provider,
        model: getEffectiveModelForConfig(config),
      });

      if (result.success) {
        setValidationResults((prev) => ({
          ...prev,
          [config.id]: { ok: true, message: "Connection successful!" },
        }));
      } else {
        setValidationResults((prev) => ({
          ...prev,
          [config.id]: {
            ok: false,
            message: result.error || "Connection failed.",
          },
        }));
      }
    } catch (err) {
      setValidationResults((prev) => ({
        ...prev,
        [config.id]: {
          ok: false,
          message: err instanceof Error ? err.message : "Connection failed.",
        },
      }));
    } finally {
      setValidatingId(null);
    }
  }

  // --- Drag and drop ---

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    document.body.classList.add("is-dragging");
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) {
      setDragOverId(id);
    }
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDragOverId(null);
      return;
    }

    const fromIndex = providerConfigs.findIndex((c) => c.id === draggedId);
    const toIndex = providerConfigs.findIndex((c) => c.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newConfigs = [...providerConfigs];
    const [moved] = newConfigs.splice(fromIndex, 1);
    newConfigs.splice(toIndex, 0, moved);
    updateConfigs(newConfigs);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
    document.body.classList.remove("is-dragging");
  }

  function handleKeyboardReorder(e: React.KeyboardEvent, id: string) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();

    const index = providerConfigs.findIndex((c) => c.id === id);
    if (index === -1) return;

    const newIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= providerConfigs.length) return;

    const newConfigs = [...providerConfigs];
    const [moved] = newConfigs.splice(index, 1);
    newConfigs.splice(newIndex, 0, moved);
    updateConfigs(newConfigs);
  }

  const usedProviders = new Set(providerConfigs.map((c) => c.provider));
  const availableProviders = ALL_PROVIDERS.filter((p) => !usedProviders.has(p));

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "linear", label: "Linear" },
    { id: "ai", label: "AI" },
    { id: "summary", label: "Summary" },
    { id: "preferences", label: "Preferences" },
  ];

  return (
    <div className="options-wrapper">
      <div className="options-card">
        <div className="card-header">
          <h1>Linear Web Clipper Settings</h1>
        </div>

        <div className="tabs-container">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tab-panels">
          {/* Linear tab */}
          <div
            id="panel-linear"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-linear"
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
                  {showApiKeys.linear ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <small>
                Get your API key from{" "}
                <a
                  href="https://linear.app/settings/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Linear Settings &rarr; API
                </a>
              </small>
            </div>
          </div>

          {/* AI tab */}
          <div
            id="panel-ai"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-ai"
            data-active={activeTab === "ai"}
          >
            <div className="section-header">
              <h2>AI Providers</h2>
              <p className="section-description">
                Add providers in priority order. If one fails, the next is tried
                automatically.
              </p>
            </div>

            {providerConfigs.length === 0 ? (
              <div className="ai-empty-state">
                <p>No AI providers configured yet.</p>
              </div>
            ) : (
              <div className="provider-list" role="list">
                {providerConfigs.map((config, index) => {
                  const meta = AI_PROVIDER_META[config.provider];
                  const isExpanded = expandedCardId === config.id;
                  const isDragging = draggedId === config.id;
                  const isDragOver = dragOverId === config.id;
                  const isValidating = validatingId === config.id;
                  const validation = validationResults[config.id];

                  return (
                    <div
                      key={config.id}
                      role="listitem"
                      className={`provider-card${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}${!config.enabled ? " disabled-card" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, config.id)}
                      onDragOver={(e) => handleDragOver(e, config.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, config.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div
                        className="provider-card-header"
                        onClick={() =>
                          setExpandedCardId(isExpanded ? null : config.id)
                        }
                      >
                        <button
                          type="button"
                          className="drag-handle"
                          aria-label={`Reorder ${meta.label}. Use arrow keys.`}
                          onKeyDown={(e) => handleKeyboardReorder(e, config.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DragHandleIcon />
                        </button>

                        <span className="provider-priority">{index + 1}</span>

                        <span className="provider-name">{meta.label}</span>

                        <span className="provider-model-badge">
                          {config.provider === "openrouter" &&
                          config.customModel?.trim()
                            ? config.customModel.trim()
                            : AI_MODELS[config.provider].find(
                                (m) => m.value === config.model,
                              )?.label || config.model}
                        </span>

                        <div className="provider-card-actions">
                          <button
                            type="button"
                            className="toggle-enabled"
                            role="switch"
                            aria-checked={config.enabled}
                            aria-label={`${config.enabled ? "Disable" : "Enable"} ${meta.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEnabled(config.id);
                            }}
                          >
                            <span className="toggle-track">
                              <span className="toggle-thumb" />
                            </span>
                          </button>

                          <ChevronDownIcon
                            className={`expand-chevron${isExpanded ? " expanded" : ""}`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="provider-card-detail">
                          <div className="form-group">
                            <label htmlFor={`model-${config.id}`}>Model</label>
                            <select
                              id={`model-${config.id}`}
                              value={config.model}
                              onChange={(e) =>
                                handleUpdateConfig(config.id, {
                                  model: e.target.value,
                                })
                              }
                            >
                              {AI_MODELS[config.provider].map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {config.provider === "openrouter" && (
                            <div className="form-group">
                              <label htmlFor={`custom-model-${config.id}`}>
                                Custom Model ID (optional)
                              </label>
                              <input
                                id={`custom-model-${config.id}`}
                                type="text"
                                placeholder="e.g., openai/gpt-4o, mistralai/mistral-large..."
                                value={config.customModel || ""}
                                onChange={(e) =>
                                  handleUpdateConfig(config.id, {
                                    customModel: e.target.value,
                                  })
                                }
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <small>
                                Overrides the dropdown above. Browse models at{" "}
                                <a
                                  href="https://openrouter.ai/models"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  openrouter.ai/models
                                </a>
                              </small>
                            </div>
                          )}

                          <div className="form-group">
                            <label htmlFor={`apikey-${config.id}`}>
                              API Key
                            </label>
                            <div className="input-with-toggle">
                              <input
                                id={`apikey-${config.id}`}
                                type={
                                  showApiKeys[config.id] ? "text" : "password"
                                }
                                placeholder={meta.placeholder}
                                value={config.apiKey}
                                onChange={(e) =>
                                  handleUpdateConfig(config.id, {
                                    apiKey: e.target.value.trim(),
                                  })
                                }
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <button
                                type="button"
                                className="toggle-visibility"
                                onClick={() =>
                                  toggleApiKeyVisibility(config.id)
                                }
                                aria-label={
                                  showApiKeys[config.id]
                                    ? "Hide API key"
                                    : "Show API key"
                                }
                              >
                                {showApiKeys[config.id] ? (
                                  <EyeOffIcon />
                                ) : (
                                  <EyeIcon />
                                )}
                              </button>
                            </div>
                            <small>
                              Get your key from{" "}
                              <a
                                href={meta.helpUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {meta.helpLabel}
                              </a>
                            </small>
                          </div>

                          <div className="provider-card-footer">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleTestConnection(config)}
                              disabled={isValidating || !config.apiKey}
                            >
                              {isValidating && (
                                <span
                                  className="button-spinner"
                                  aria-hidden="true"
                                />
                              )}
                              Test Connection
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => handleRemoveProvider(config.id)}
                            >
                              Remove
                            </button>
                          </div>

                          <div
                            role="status"
                            aria-live="polite"
                            className="validation-status"
                          >
                            {validation && (
                              <div
                                className={`validation-result ${validation.ok ? "success" : "error"}`}
                              >
                                {validation.ok ? <CheckIcon /> : <XIcon />}
                                {validation.message}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {availableProviders.length > 0 && (
              <div className="form-group add-provider-group">
                <label htmlFor="addProvider">Add Provider</label>
                <select
                  id="addProvider"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddProvider(e.target.value as ActiveAIProvider);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Select a provider to add...</option>
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {AI_PROVIDER_META[p].label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Summary tab */}
          <div
            id="panel-summary"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-summary"
            data-active={activeTab === "summary"}
          >
            <div className="section-header">
              <h2>Language</h2>
              <p className="section-description">
                Select the language for generated summaries.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="summaryLanguage">Output Language</label>
              <select
                id="summaryLanguage"
                value={settings.summaryLanguage || "English"}
                onChange={(e) =>
                  setSettings({ ...settings, summaryLanguage: e.target.value })
                }
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="section-divider" />

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
                  placeholder="Write your summary instructions here..."
                  rows={4}
                />
                <small>
                  The content to summarize will be appended after your prompt.
                </small>
              </div>
            )}
          </div>

          {/* Preferences tab */}
          <div
            id="panel-preferences"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-preferences"
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
                  !hasAnyAIConfigured(providerConfigs) ? "disabled" : ""
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
                  disabled={!hasAnyAIConfigured(providerConfigs)}
                />
                <span className="checkbox-label">
                  <span className="checkbox-title">Auto-summarize on clip</span>
                  <span className="checkbox-description">
                    {!hasAnyAIConfigured(providerConfigs)
                      ? "Configure AI provider first"
                      : "Generate summary automatically"}
                  </span>
                </span>
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.uploadImagesToLinear || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      uploadImagesToLinear: e.target.checked,
                    })
                  }
                />
                <span className="checkbox-label">
                  <span className="checkbox-title">
                    Upload images to Linear
                    <span className="beta-badge">Beta</span>
                  </span>
                  <span className="checkbox-description">
                    Re-host images on Linear's CDN so they always load
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`message ${message.type}`}
            role="status"
            aria-live="polite"
          >
            {message.text}
          </div>
        )}

        <div className="card-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || !settings.linearApiKey}
          >
            {saving && <span className="button-spinner" aria-hidden="true" />}
            {saving ? "Saving\u2026" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
