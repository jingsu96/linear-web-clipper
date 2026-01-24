import { useState, useEffect } from "react";
import { getSettings, hasLinearApiKey } from "@/lib/storage";
import {
  extractContent,
  createLinearIssue,
  summarizeContent,
  getLinearData,
  reformatTranscript,
} from "@/lib/messages";
import {
  formatAsMarkdown,
  generatePreview,
  estimateReadingTime,
  extractEmbedUrls,
} from "@/lib/content-extractor";
import type { ExtractedContent } from "@/lib/content-extractor";
import type { StorageSettings } from "@/lib/storage";
import MarkdownEditor from "@/components/MarkdownEditor";
import "./App.css";

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface LinearProject {
  id: string;
  name: string;
  state: string;
  team: {
    id: string;
    name: string;
  };
}

export default function App() {
  const [settings, setSettings] = useState<StorageSettings>({});
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [summary, setSummary] = useState("");
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reformatting, setReformatting] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (content && settings) {
      const md = formatAsMarkdown(content, settings.includeMetadata);

      // Check if this is a YouTube transcript
      const isYouTubeTranscript =
        content.metaDescription === "YouTube Video Transcript";

      if (
        isYouTubeTranscript &&
        settings.aiProvider &&
        settings.aiProvider !== "none" &&
        settings.aiApiKey
      ) {
        // Automatically reformat YouTube transcripts to article format
        handleReformatTranscript(md);
      } else {
        setMarkdown(md);
        setIssueTitle(content.title);

        // Auto-summarize if enabled (for non-YouTube content)
        if (
          settings.autoSummarize &&
          settings.aiProvider &&
          settings.aiProvider !== "none"
        ) {
          handleSummarize(md);
        }
      }
    }
  }, [content, settings]);

  async function initialize() {
    setLoading(true);
    setError("");

    try {
      const stored = await getSettings();
      setSettings(stored);
      const configured = await hasLinearApiKey();
      setIsConfigured(configured);

      if (!configured) {
        setError("Please configure Linear API key in extension settings");
        setLoading(false);
        return;
      }

      // Fetch Linear data
      const linearData = await getLinearData();

      if (linearData.success && linearData.data) {
        const data = linearData.data as {
          teams: LinearTeam[];
          projects: LinearProject[];
        };

        setTeams(data.teams);
        setProjects(data.projects);

        // Set default team if configured
        if (stored.defaultTeamId) {
          setSelectedTeam(stored.defaultTeamId);
        }

        // Set default project if configured
        if (stored.defaultProjectId) {
          setSelectedProject(stored.defaultProjectId);
        }
      } else {
        console.error("[Sidepanel] Failed to fetch Linear data:", linearData);
        setError("Failed to load Linear teams and projects");
      }

      // Extract page content
      try {
        const result = await extractContent();
        if (result.success && result.data) {
          setContent(result.data as ExtractedContent);
        } else {
          setError("Failed to extract page content");
        }
      } catch (extractError) {
        console.error("Content extraction error:", extractError);
        setError(
          extractError instanceof Error
            ? extractError.message
            : "Cannot extract content from this page. Try opening the sidepanel on a regular web page.",
        );
      }
    } catch (err) {
      console.error("Initialization error:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setLoading(false);
    }
  }

  async function handleReformatTranscript(transcriptMarkdown: string) {
    if (
      !settings.aiProvider ||
      settings.aiProvider === "none" ||
      !settings.aiApiKey
    ) {
      // If AI is not configured, just use the raw transcript
      setMarkdown(transcriptMarkdown);
      setIssueTitle(content?.title || "");
      return;
    }

    setReformatting(true);
    setStatus("Reformatting transcript to article format…");
    setError("");

    try {
      const result = await reformatTranscript({
        content: transcriptMarkdown,
        apiKey: settings.aiApiKey,
        provider: settings.aiProvider,
        model: settings.aiModel,
      });

      if (result.success && result.data) {
        const reformattedContent = (
          result.data as { reformattedContent: string }
        ).reformattedContent;
        setMarkdown(reformattedContent);
        setIssueTitle(content?.title || "");
        setStatus("Transcript reformatted successfully!");
        setTimeout(() => setStatus(""), 3000);
      } else {
        const errorMsg = result.error || "Failed to reformat transcript";
        setError(errorMsg);
        // Fall back to raw transcript
        setMarkdown(transcriptMarkdown);
        setIssueTitle(content?.title || "");
      }
    } catch (err) {
      console.error("[Sidepanel] Reformatting error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to reformat transcript",
      );
      // Fall back to raw transcript
      setMarkdown(transcriptMarkdown);
      setIssueTitle(content?.title || "");
    } finally {
      setReformatting(false);
    }
  }

  async function handleSummarize(contentToSummarize?: string) {
    if (
      !settings.aiProvider ||
      settings.aiProvider === "none" ||
      !settings.aiApiKey
    ) {
      setError("AI provider not configured. Please configure in settings.");
      return;
    }

    // Use provided content or fall back to markdown state
    const contentForSummary = contentToSummarize || markdown;

    if (!contentForSummary) {
      setError("No content to summarize");
      return;
    }

    setSummarizing(true);
    setError("");

    try {
      const result = await summarizeContent({
        content: contentForSummary,
        apiKey: settings.aiApiKey,
        provider: settings.aiProvider,
        model: settings.aiModel,
        summaryStyle: settings.summaryStyle,
        customPrompt: settings.customSummaryPrompt,
      });

      if (result.success && result.data) {
        const newSummary = (result.data as { summary: string }).summary;
        setSummary(newSummary);

        // Add summary to the top of the markdown
        const summaryBlock = `## Summary\n\n${newSummary}\n\n---\n\n`;

        // Check if markdown already has a summary block and replace it
        const currentMarkdown = contentToSummarize || markdown;
        const summaryRegex = /^## Summary\n\n[\s\S]*?\n\n---\n\n/;

        if (summaryRegex.test(currentMarkdown)) {
          // Replace existing summary
          setMarkdown(currentMarkdown.replace(summaryRegex, summaryBlock));
        } else {
          // Add summary to the top
          setMarkdown(summaryBlock + currentMarkdown);
        }

        setStatus("Summary generated successfully!");
        setTimeout(() => setStatus(""), 3000);
      } else {
        const errorMsg = result.error || "Failed to generate summary";
        setError(errorMsg);
      }
    } catch (err) {
      console.error("[Sidepanel] Summarization error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to summarize content",
      );
    } finally {
      setSummarizing(false);
    }
  }

  async function handleCreateIssue() {
    if (!selectedTeam) {
      setError("Please select a team");
      return;
    }

    if (!issueTitle.trim()) {
      setError("Please enter an issue title");
      return;
    }

    if (!settings.linearApiKey) {
      setError("Linear API key not configured");
      return;
    }

    setCreating(true);
    setError("");
    setStatus("Creating Linear issue…");

    try {
      const result = await createLinearIssue({
        teamId: selectedTeam,
        projectId: selectedProject || undefined,
        title: issueTitle,
        description: markdown,
        summary: summary || undefined,
        apiKey: settings.linearApiKey,
      });

      if (result.success && result.data) {
        const issue = result.data as { identifier: string; url: string };
        setStatus(`Created ${issue.identifier}`);

        // Open the issue in a new tab
        setTimeout(() => {
          window.open(issue.url, "_blank");
        }, 500);
      } else {
        setError("Failed to create Linear issue");
      }
    } catch (err) {
      console.error("Issue creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create issue");
      setStatus("");
    } finally {
      setCreating(false);
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  const filteredProjects = projects.filter(
    (p) => !selectedTeam || p.team.id === selectedTeam,
  );

  const readingTime = content ? estimateReadingTime(content.textContent) : 0;
  const preview = markdown ? generatePreview(markdown, 150) : "";
  const embedUrls = markdown ? extractEmbedUrls(markdown) : [];

  if (!isConfigured) {
    return (
      <div className="sidepanel-container">
        <div className="sidepanel-header">
          <h1>Linear Web Clipper</h1>
        </div>
        <div className="sidepanel-content">
          <div className="empty-state">
            <h2>Not Configured</h2>
            <p>Please configure your Linear API key to start clipping pages.</p>
            <button
              type="button"
              className="primary-button"
              onClick={openSettings}
            >
              Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || reformatting) {
    return (
      <div className="sidepanel-container">
        <div className="sidepanel-header">
          <h1>Linear Web Clipper</h1>
        </div>
        <div className="sidepanel-content">
          <div className="loading-state">
            <div className="spinner" />
            <p>
              {reformatting
                ? "Reformatting transcript to article format…"
                : "Extracting page content…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-container">
      <div className="sidepanel-header">
        <h1>Linear Web Clipper</h1>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => initialize()}
            disabled={loading}
            aria-label="Refresh content"
            title="Refresh content"
          >
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
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={openSettings}
            aria-label="Open settings"
            title="Open settings"
          >
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="sidepanel-content">
        {error && <div className="alert alert-error">{error}</div>}

        {status && <div className="alert alert-success">{status}</div>}

        {content && (
          <>
            <section className="content-preview">
              <h2>{content.title}</h2>
              <div className="content-meta">
                <span>{readingTime} min read</span>
                <span>·</span>
                <a href={content.url} target="_blank" rel="noreferrer">
                  Open page
                </a>
              </div>
              {preview && <p className="preview-text">{preview}</p>}
            </section>

            {embedUrls.length > 0 && (
              <section className="embeds-section">
                <h3>Detected Embeds ({embedUrls.length})</h3>
                <div className="embeds-list">
                  {embedUrls.slice(0, 5).map((embed, i) => (
                    <div key={i} className="embed-item">
                      <span className="embed-platform">{embed.platform}</span>
                      <span className="embed-url" title={embed.url}>
                        {embed.url.length > 40
                          ? embed.url.slice(0, 40) + "…"
                          : embed.url}
                      </span>
                    </div>
                  ))}
                  {embedUrls.length > 5 && (
                    <div className="embed-more">
                      +{embedUrls.length - 5} more
                    </div>
                  )}
                </div>
              </section>
            )}

            {summary && (
              <section className="summary-section">
                <h3>Summary</h3>
                <div className="summary-content">{summary}</div>
              </section>
            )}

            {settings.aiProvider &&
              settings.aiProvider !== "none" &&
              !summary && (
                <section className="actions-section">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleSummarize()}
                    disabled={summarizing}
                  >
                    {summarizing ? "Summarizing…" : "Generate Summary"}
                  </button>
                </section>
              )}

            <section className="linear-section">
              <h3>Create Linear Issue</h3>

              <div className="form-group">
                <label htmlFor="issueTitle">
                  Title <span className="required">*</span>
                </label>
                <input
                  id="issueTitle"
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Enter issue title…"
                />
              </div>

              <div className="form-group">
                <label htmlFor="team">
                  Team <span className="required">*</span>
                </label>
                <select
                  id="team"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="">Select a team…</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.key})
                    </option>
                  ))}
                </select>
              </div>

              {filteredProjects.length > 0 && (
                <div className="form-group">
                  <label htmlFor="project">Project (Optional)</label>
                  <select
                    id="project"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    disabled={!selectedTeam}
                  >
                    <option value="">No project</option>
                    {filteredProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="primary-button full-width"
                onClick={handleCreateIssue}
                disabled={creating || !selectedTeam || !issueTitle.trim()}
              >
                {creating ? "Creating…" : "Create Issue"}
              </button>
            </section>

            <section className="markdown-section">
              <h3>Content Preview</h3>
              <MarkdownEditor
                value={markdown}
                onChange={setMarkdown}
                maxHeight={400}
                placeholder="Extracted content will appear here…"
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
