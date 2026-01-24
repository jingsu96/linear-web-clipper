import { useState, useRef, useEffect, useCallback } from "react";
import "./MarkdownEditor.css";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxHeight?: number;
  placeholder?: string;
  loading?: boolean;
  loadingMessage?: string;
}

type ViewMode = "edit" | "preview" | "split";

/**
 * Editable Markdown Preview Component
 *
 * Features:
 * - Toggle between Edit, Preview, and Split view modes
 * - Live markdown rendering in preview
 * - Syntax highlighting for embeds (YouTube, Figma, etc.)
 * - Character count
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to confirm)
 */
export default function MarkdownEditor({
  value,
  onChange,
  maxHeight = 400,
  placeholder = "Enter markdown content…",
  loading = false,
  loadingMessage = "Loading content…",
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea to content
  useEffect(() => {
    if (textareaRef.current && (viewMode === "edit" || viewMode === "split")) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [value, viewMode, maxHeight]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (viewMode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [viewMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter switches to preview mode
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        setViewMode("preview");
      }
    },
    [],
  );

  const renderMarkdownPreview = useCallback((markdown: string) => {
    return <MarkdownPreview content={markdown} />;
  }, []);

  const charCount = value.length;
  const charCountFormatted = charCount.toLocaleString();

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-toolbar">
        <div className="view-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "edit"}
            className={`view-mode-tab ${viewMode === "edit" ? "active" : ""}`}
            onClick={() => setViewMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "split"}
            className={`view-mode-tab ${viewMode === "split" ? "active" : ""}`}
            onClick={() => setViewMode("split")}
          >
            Split
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "preview"}
            className={`view-mode-tab ${viewMode === "preview" ? "active" : ""}`}
            onClick={() => setViewMode("preview")}
          >
            Preview
          </button>
        </div>
        <div className="char-count" title="Character count">
          {charCountFormatted} chars
        </div>
      </div>

      <div
        className={`markdown-editor-content ${viewMode}`}
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="editor-skeleton">
            <div className="skeleton-header">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-subtitle" />
            </div>
            <div className="skeleton-body">
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-medium" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
            </div>
            <p className="skeleton-message">{loadingMessage}</p>
          </div>
        ) : (
          <>
            {(viewMode === "edit" || viewMode === "split") && (
              <div className="editor-pane">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="markdown-textarea"
                  spellCheck={false}
                  aria-label="Markdown editor"
                />
              </div>
            )}

            {(viewMode === "preview" || viewMode === "split") && (
              <div className="preview-pane" ref={previewRef}>
                {value ? (
                  renderMarkdownPreview(value)
                ) : (
                  <p className="preview-empty">{placeholder}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {viewMode === "edit" && (
        <div className="markdown-editor-hint">
          <kbd>Cmd</kbd>+<kbd>Enter</kbd> to preview
        </div>
      )}
    </div>
  );
}

/**
 * Markdown Preview Component
 * Renders markdown as styled HTML with embed detection
 */
function MarkdownPreview({ content }: { content: string }) {
  const html = markdownToHtml(content);

  return (
    <div
      className="markdown-rendered"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Simple markdown to HTML converter
 * Handles common markdown syntax for preview purposes
 */
function markdownToHtml(markdown: string): string {
  let html = escapeHtml(markdown);

  // Code blocks (must be done before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${langClass}>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" />',
  );

  // Linear-supported embeddable URLs (on their own line) - highlight them
  // Based on Linear docs: YouTube, Loom, Descript auto-embed; Figma requires integration
  const linearEmbedPatterns = [
    { pattern: /youtube\.com|youtu\.be/i, name: "YouTube" },
    { pattern: /loom\.com/i, name: "Loom" },
    { pattern: /descript\.com/i, name: "Descript" },
    { pattern: /figma\.com/i, name: "Figma" },
  ];

  html = html.replace(/^(https?:\/\/[^\s<]+)$/gm, (_match, url) => {
    const embed = linearEmbedPatterns.find((p) => p.pattern.test(url));
    if (embed) {
      return `<div class="embed-link"><span class="embed-badge">${embed.name}</span><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Blockquotes
  html = html.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr />");

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // This is simplified - a real implementation would handle list nesting

  // Paragraphs (lines not already wrapped)
  html = html
    .split("\n\n")
    .map((block) => {
      if (
        block.trim() &&
        !block.startsWith("<h") &&
        !block.startsWith("<ul") &&
        !block.startsWith("<ol") &&
        !block.startsWith("<pre") &&
        !block.startsWith("<blockquote") &&
        !block.startsWith("<hr") &&
        !block.startsWith("<div")
      ) {
        return `<p>${block.replace(/\n/g, "<br />")}</p>`;
      }
      return block;
    })
    .join("\n");

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
