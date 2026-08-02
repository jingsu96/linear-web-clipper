import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/** Sanitize leaked HTML emphasis/bold tags from URLs (literal, entity-encoded, and percent-encoded) */
function sanitizeUrl(url: string): string {
  return (
    url
      // Literal HTML tags
      .replace(/<\/?(em|i)>/gi, "_")
      .replace(/<\/?(strong|b)>/gi, "__")
      .replace(/<[^>]*>/g, "")
      // HTML entity-encoded tags (&lt;em&gt;, &lt;/em&gt;, etc.)
      .replace(/&lt;\/?(em|i)&gt;/gi, "_")
      .replace(/&lt;\/?(strong|b)&gt;/gi, "__")
      .replace(/&lt;[^&]*?&gt;/g, "")
      // Percent-encoded tags (handle both literal / and %2F-encoded /)
      .replace(/%3C(?:%2F|\/)?(?:em|i)%3E/gi, "_")
      .replace(/%3C(?:%2F|\/)?(?:strong|b)%3E/gi, "__")
      .replace(/%3C(?:%2F|\/)?\w[^%]*?%3E/gi, "")
  );
}

export interface ExtractedContent {
  title: string;
  url: string;
  htmlContent: string;
  textContent: string;
  metaDescription: string;
  timestamp: string;
  error?: string;
}

// Configure Turndown for markdown conversion optimized for Linear
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  linkStyle: "inlined",
  linkReferenceStyle: "full",
});

// Use GitHub Flavored Markdown plugin for tables and strikethrough
turndownService.use(gfm);

// Strikethrough support
turndownService.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`,
});

// Highlight/mark support
turndownService.addRule("highlight", {
  filter: ["mark"],
  replacement: (content) => `==${content}==`,
});

// Enhanced image handling with alt text and figure captions
turndownService.addRule("images", {
  filter: "img",
  replacement: (_content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.alt || "image";
    const src = sanitizeUrl(img.src || img.getAttribute("data-src") || "");

    if (!src || src.startsWith("data:")) return "";

    // Skip tracking pixels and tiny images
    const width = img.width || parseInt(img.getAttribute("width") || "0", 10);
    const height =
      img.height || parseInt(img.getAttribute("height") || "0", 10);
    if ((width > 0 && width < 10) || (height > 0 && height < 10)) return "";

    const title = img.title;
    const figure = node.parentElement;

    let caption = "";
    if (figure && figure.tagName === "FIGURE") {
      const figcaption = figure.querySelector("figcaption");
      if (figcaption) {
        caption = figcaption.textContent?.trim() || "";
      }
    }

    const titlePart = title ? ` "${title}"` : "";
    const imageMarkdown = `![${alt}](${src}${titlePart})`;

    return caption ? `${imageMarkdown}\n*${caption}*` : imageMarkdown;
  },
});

// Sanitize link href URLs (overrides Turndown's default inlined link rule)
turndownService.addRule("links", {
  filter: (node, options) => {
    return !!(
      options.linkStyle === "inlined" &&
      node.nodeName === "A" &&
      node.getAttribute("href")
    );
  },
  replacement: (content, node) => {
    const a = node as HTMLAnchorElement;
    const href = sanitizeUrl(a.getAttribute("href") || "");
    const title = a.title ? ` "${a.title}"` : "";
    return `[${content}](${href}${title})`;
  },
});

// Handle SVG elements - replace with placeholder since they can't be cloned/uploaded
turndownService.addRule("svg", {
  filter: (node) => node.nodeName === "svg" || node.nodeName === "SVG",
  replacement: (_content, node) => {
    const element = node as Element;
    const title =
      element.querySelector("title")?.textContent?.trim() ||
      element.getAttribute("aria-label") ||
      "";
    const description = title ? ` (${title})` : "";
    return `\n\n[SVG Graphic${description}]\n\n`;
  },
});

// Enhanced list item handling for proper nesting
turndownService.addRule("listItems", {
  filter: "li",
  replacement: (content, node, options) => {
    content = content
      .replace(/^\n+/, "")
      .replace(/\n+$/, "\n")
      .replace(/\n/gm, "\n    ");

    let prefix = options.bulletListMarker + " ";
    const parent = node.parentNode as HTMLElement;

    if (parent && parent.nodeName === "OL") {
      const start = parent.getAttribute("start");
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + index : index + 1) + ". ";
    }

    return (
      prefix + content + (node.nextSibling && !/\n$/.test(content) ? "\n" : "")
    );
  },
});

// Code blocks with language detection
turndownService.addRule("fencedCodeBlock", {
  filter: (node, options) => {
    return !!(
      options.codeBlockStyle === "fenced" &&
      node.nodeName === "PRE" &&
      node.firstChild &&
      node.firstChild.nodeName === "CODE"
    );
  },
  replacement: (_content, node) => {
    const code = node.firstChild as HTMLElement;
    const className = code.getAttribute("class") || "";
    const language = extractLanguageFromClass(className);
    const codeContent = code.textContent || "";

    return (
      "\n\n```" + language + "\n" + codeContent.replace(/\n$/, "") + "\n```\n\n"
    );
  },
});

// Inline code - keep as inline backticks (not code blocks)
turndownService.addRule("inlineCode", {
  filter: (node) => {
    return node.nodeName === "CODE" && node.parentNode?.nodeName !== "PRE";
  },
  replacement: (_content, node) => {
    const text = (node as HTMLElement).textContent || "";
    // Use double backticks if content contains backticks
    if (text.includes("`")) {
      return "`` " + text + " ``";
    }
    return "`" + text + "`";
  },
});

/**
 * Linear Auto-Embed Support
 * Linear automatically embeds URLs from these platforms when pasted on their own line.
 * Based on Linear documentation: https://linear.app/docs/editor
 * Supported: YouTube, Descript, Loom (auto), and Figma (requires integration setup)
 */
const LINEAR_EMBED_PLATFORMS = [
  { pattern: /youtube\.com|youtu\.be/i, name: "youtube", note: "Auto-embeds" },
  { pattern: /loom\.com/i, name: "loom", note: "Auto-embeds" },
  { pattern: /descript\.com/i, name: "descript", note: "Auto-embeds" },
  {
    pattern: /figma\.com/i,
    name: "figma",
    note: "Requires Figma integration",
  },
];

/**
 * Extended platforms for content extraction (still useful to extract canonical URLs)
 * These won't auto-embed in Linear but we still want to convert iframes to links
 */
const EXTENDED_EMBED_PLATFORMS = [
  ...LINEAR_EMBED_PLATFORMS,
  // Additional platforms for URL extraction (won't auto-embed in Linear)
  { pattern: /vimeo\.com/i, name: "vimeo", note: null },
  { pattern: /codepen\.io/i, name: "codepen", note: null },
  { pattern: /codesandbox\.io/i, name: "codesandbox", note: null },
  { pattern: /twitter\.com|x\.com/i, name: "twitter", note: null },
  { pattern: /spotify\.com/i, name: "spotify", note: null },
  { pattern: /docs\.google\.com/i, name: "google-docs", note: null },
];

/**
 * Check if a URL is from an embeddable platform (extended list for iframe extraction)
 */
function isEmbeddablePlatform(url: string): boolean {
  return EXTENDED_EMBED_PLATFORMS.some((platform) =>
    platform.pattern.test(url),
  );
}

/**
 * Extract canonical URL from iframe embed src
 */
function extractCanonicalUrl(iframeSrc: string): string | null {
  try {
    const url = new URL(iframeSrc);

    // YouTube embeds -> watch URL
    if (
      url.hostname.includes("youtube.com") &&
      url.pathname.includes("/embed/")
    ) {
      const videoId = url.pathname.split("/embed/")[1]?.split(/[?/]/)[0];
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // YouTube nocookie embeds
    if (
      url.hostname.includes("youtube-nocookie.com") &&
      url.pathname.includes("/embed/")
    ) {
      const videoId = url.pathname.split("/embed/")[1]?.split(/[?/]/)[0];
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Vimeo embeds
    if (url.hostname.includes("player.vimeo.com")) {
      const videoId = url.pathname.split("/video/")[1]?.split(/[?/]/)[0];
      if (videoId) return `https://vimeo.com/${videoId}`;
    }

    // Loom embeds
    if (url.hostname.includes("loom.com") && url.pathname.includes("/embed/")) {
      const videoId = url.pathname.split("/embed/")[1]?.split(/[?/]/)[0];
      if (videoId) return `https://www.loom.com/share/${videoId}`;
    }

    // Figma embeds
    if (url.hostname.includes("figma.com") && url.pathname.includes("/embed")) {
      const fileUrl = url.searchParams.get("url");
      if (fileUrl) return decodeURIComponent(fileUrl);
      // Try to extract from the path
      const figmaMatch = iframeSrc.match(/figma\.com\/file\/([^/?]+)/);
      if (figmaMatch) return `https://www.figma.com/file/${figmaMatch[1]}`;
    }

    // CodePen embeds
    if (url.hostname.includes("codepen.io")) {
      return iframeSrc.replace("/embed/", "/pen/").split("?")[0];
    }

    // CodeSandbox embeds
    if (url.hostname.includes("codesandbox.io")) {
      const sandboxId = url.pathname
        .replace("/embed/", "/s/")
        .replace("/embed", "");
      return `https://codesandbox.io${sandboxId}`.split("?")[0];
    }

    // Twitter embeds
    if (
      url.hostname.includes("platform.twitter.com") ||
      url.hostname.includes("twitter.com")
    ) {
      const tweetUrl = url.searchParams.get("url");
      if (tweetUrl) return decodeURIComponent(tweetUrl);
    }

    // Spotify embeds
    if (
      url.hostname.includes("open.spotify.com") &&
      url.pathname.includes("/embed/")
    ) {
      return iframeSrc.replace("/embed/", "/").split("?")[0];
    }

    // Google Docs/Sheets/Slides embeds
    if (url.hostname.includes("docs.google.com")) {
      return iframeSrc.split("/pub")[0].split("/edit")[0].split("/preview")[0];
    }

    // For other recognized platforms, return cleaned URL
    if (isEmbeddablePlatform(iframeSrc)) {
      return iframeSrc.split("?")[0];
    }

    return null;
  } catch {
    return null;
  }
}

// Handle iframes and embeds - extract URL and produce markdown links
// Linear auto-embeds bare URLs for supported platforms (YouTube, Loom, Descript, Figma).
// For those, emit the URL on its own line so Linear renders the embed.
// For extended-only platforms, use a markdown link.
turndownService.addRule("embeds", {
  filter: (node) => node.nodeName === "IFRAME" || node.nodeName === "EMBED",
  replacement: (_content, node) => {
    const src = sanitizeUrl((node as HTMLElement).getAttribute("src") || "");
    if (!src) return "";

    const canonicalUrl = extractCanonicalUrl(src);

    if (canonicalUrl) {
      // Check if this is a Linear auto-embed platform first
      const linearPlatform = LINEAR_EMBED_PLATFORMS.find((p) =>
        p.pattern.test(canonicalUrl),
      );
      if (linearPlatform) {
        // Bare URL on its own line — Linear will auto-embed it
        return `\n\n${canonicalUrl}\n\n`;
      }

      // Extended-only platform: use a markdown link
      const platform = EXTENDED_EMBED_PLATFORMS.find((p) =>
        p.pattern.test(canonicalUrl),
      );
      const label = platform
        ? platform.name.charAt(0).toUpperCase() + platform.name.slice(1)
        : "Embedded content";
      return `\n\n[${label}](${canonicalUrl})\n\n`;
    }

    // For unknown embeds, create a link
    return `\n\n[Embedded content](${src})\n\n`;
  },
});

// Remove unwanted elements
turndownService.remove(["script", "style", "noscript", "canvas", "template"]);

/**
 * Extract programming language from code element class name
 */
function extractLanguageFromClass(className: string): string {
  if (!className) return "";

  // Common patterns: language-js, lang-python, highlight-source-ruby, brush: js
  const patterns = [
    /language-(\w+)/,
    /lang-(\w+)/,
    /highlight-source-(\w+)/,
    /brush:\s*(\w+)/,
    /hljs\s+(\w+)/,
    /prism-(\w+)/,
  ];

  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match) return normalizeLanguage(match[1]);
  }

  // Check if class name itself is a known language
  const knownLanguages = new Set([
    "javascript",
    "js",
    "typescript",
    "ts",
    "python",
    "py",
    "java",
    "cpp",
    "c",
    "csharp",
    "cs",
    "ruby",
    "rb",
    "go",
    "golang",
    "rust",
    "php",
    "swift",
    "kotlin",
    "scala",
    "bash",
    "shell",
    "sh",
    "zsh",
    "sql",
    "html",
    "css",
    "scss",
    "sass",
    "less",
    "json",
    "xml",
    "yaml",
    "yml",
    "markdown",
    "md",
    "graphql",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "dockerfile",
    "makefile",
    "nginx",
    "apache",
    "toml",
    "ini",
    "diff",
    "git",
    "http",
    "plaintext",
    "text",
  ]);

  for (const cls of className.toLowerCase().split(/\s+/)) {
    if (knownLanguages.has(cls)) {
      return normalizeLanguage(cls);
    }
  }

  return "";
}

/**
 * Normalize language aliases to standard names
 */
function normalizeLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    cs: "csharp",
    golang: "go",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    zsh: "bash",
  };
  return aliases[lang.toLowerCase()] || lang.toLowerCase();
}

/**
 * Convert HTML content to clean markdown optimized for Linear
 */
export function htmlToMarkdown(html: string, baseUrl?: string): string {
  try {
    // Pre-process HTML to handle edge cases
    const processedHtml = preprocessHtml(html, baseUrl);
    const markdown = turndownService.turndown(processedHtml);
    return cleanMarkdown(markdown);
  } catch (error) {
    console.error("HTML to Markdown conversion failed:", error);
    return html;
  }
}

/**
 * Pick the highest-resolution candidate from a srcset attribute.
 * Tokenizes on whitespace rather than splitting on commas, because CDN
 * URLs frequently contain literal commas (e.g. `.../w_424,c_limit/...`).
 * Exported for testing.
 */
export function pickBestSrcsetCandidate(srcset: string): string | null {
  // A descriptor-less candidate defaults to 1x density; weight density
  // descriptors so 2x beats explicit widths below ~2560px
  const DENSITY_WEIGHT = 1280;

  let bestUrl: string | null = null;
  let bestScore = -1;
  let pendingUrl: string | null = null;

  const commit = (score: number) => {
    if (pendingUrl && score > bestScore) {
      bestScore = score;
      bestUrl = pendingUrl;
    }
    pendingUrl = null;
  };

  for (const raw of srcset.trim().split(/\s+/)) {
    const token = raw.replace(/,+$/, "");
    if (!token) continue;

    const descriptor = token.match(/^(\d+(?:\.\d+)?)([wx])$/);
    if (descriptor && pendingUrl) {
      const value = parseFloat(descriptor[1]);
      commit(descriptor[2] === "w" ? value : value * DENSITY_WEIGHT);
    } else {
      // New URL token; any pending URL had no descriptor (implicit 1x)
      if (pendingUrl) commit(DENSITY_WEIGHT);
      pendingUrl = token;
    }
  }
  if (pendingUrl) commit(DENSITY_WEIGHT);

  return bestUrl;
}

/**
 * Pre-process HTML before conversion
 */
function preprocessHtml(html: string, baseUrl?: string): string {
  // Sanitize URL attribute values in raw HTML before DOMParser can mishandle them.
  // CMS markdown processing can convert underscores to <em>/<strong> tags inside URLs.
  // Handles both double-quoted and single-quoted attributes, and both literal
  // (<em>) and entity-encoded (&lt;em&gt;) tag corruption.
  const urlAttrReplacer = (
    match: string,
    pre: string,
    value: string,
    post: string,
  ) => {
    if (
      /<\/?(?:em|i|strong|b)\b/i.test(value) ||
      /&lt;\/?(em|i|strong|b)/i.test(value)
    ) {
      return pre + sanitizeUrl(value) + post;
    }
    return match;
  };
  html = html.replace(
    /((?:src|href|data-src)\s*=\s*")([^"]*?)(")/gi,
    urlAttrReplacer,
  );
  html = html.replace(
    /((?:src|href|data-src)\s*=\s*')([^']*?)(')/gi,
    urlAttrReplacer,
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove hidden elements
  doc
    .querySelectorAll(
      '[hidden], [style*="display: none"], [style*="display:none"]',
    )
    .forEach((el) => el.remove());

  // Remove empty paragraphs and divs
  doc.querySelectorAll("p, div, span").forEach((el) => {
    if (
      !el.textContent?.trim() &&
      !el.querySelector("img, video, iframe, embed")
    ) {
      el.remove();
    }
  });

  // Unwrap unnecessary wrapper divs that only contain a single block element
  doc.querySelectorAll("div").forEach((div) => {
    const children = Array.from(div.children);
    if (
      children.length === 1 &&
      ["P", "DIV", "ARTICLE", "SECTION"].includes(children[0].tagName)
    ) {
      div.replaceWith(...Array.from(div.childNodes));
    }
  });

  // Normalize image sources: lazy-load attributes and best srcset candidate
  doc.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("src")) {
      const lazySrc =
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original");
      if (lazySrc) img.setAttribute("src", lazySrc);
    }

    const srcset =
      img.getAttribute("srcset") || img.getAttribute("data-srcset");
    if (srcset) {
      const best = pickBestSrcsetCandidate(srcset);
      if (best) img.setAttribute("src", best);
    }
  });

  // Handle picture elements - extract best image source
  doc.querySelectorAll("picture").forEach((picture) => {
    const img = picture.querySelector("img");
    if (img) {
      picture.replaceWith(img);
    }
  });

  // Resolve relative URLs to absolute using the page URL
  if (baseUrl) {
    const resolve = (rel: string) => {
      try {
        return new URL(rel, baseUrl).href;
      } catch {
        return rel;
      }
    };
    doc.querySelectorAll("img[src]").forEach((el) => {
      el.setAttribute("src", resolve(el.getAttribute("src")!));
    });
    doc.querySelectorAll("img[data-src]").forEach((el) => {
      el.setAttribute("data-src", resolve(el.getAttribute("data-src")!));
    });
    doc.querySelectorAll("a[href]").forEach((el) => {
      const href = el.getAttribute("href")!;
      if (
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("javascript:")
      ) {
        el.setAttribute("href", resolve(href));
      }
    });
    doc.querySelectorAll("iframe[src], embed[src]").forEach((el) => {
      el.setAttribute("src", resolve(el.getAttribute("src")!));
    });
  }

  return doc.body.innerHTML;
}

/**
 * Clean up markdown output for optimal Linear compatibility
 */
function cleanMarkdown(markdown: string): string {
  const cleaned = markdown
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    // Clean up spaces before punctuation
    .replace(/ +([.,;:!?])/g, "$1")
    // Remove trailing spaces on lines (before collapsing blank lines,
    // so whitespace-only lines count as blank)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Remove excessive blank lines (more than 2)
    .replace(/\n{3,}/g, "\n\n")
    // Remove leading/trailing whitespace
    .trim();

  return cleaned;
}

/**
 * If the source URL itself is Linear-embeddable media (a YouTube video,
 * Loom recording, or Descript share), return it so it can be placed on its
 * own line — Linear renders bare URLs from these platforms as embeds,
 * while markdown links suppress embedding.
 */
export function getEmbeddableSourceUrl(url: string): string | null {
  const embeddablePatterns = [
    /youtube\.com\/watch/i,
    /youtu\.be\//i,
    /loom\.com\/share\//i,
    /share\.descript\.com\//i,
  ];
  return embeddablePatterns.some((p) => p.test(url)) ? url : null;
}

/**
 * Format extracted content as markdown with optional metadata header
 */
export function formatAsMarkdown(
  content: ExtractedContent,
  includeMetadata = true,
): string {
  const parts: string[] = [];

  if (includeMetadata) {
    parts.push(`**Source:** ${content.url}`);
    parts.push(`**Clipped:** ${new Date(content.timestamp).toLocaleString()}`);
    parts.push("");

    if (content.metaDescription) {
      parts.push(`> ${content.metaDescription}`);
      parts.push("");
    }

    // Bare URL on its own line so Linear embeds the source video player
    const embeddableSource = getEmbeddableSourceUrl(content.url);
    if (embeddableSource) {
      parts.push(embeddableSource);
      parts.push("");
    }

    parts.push("---");
    parts.push("");
  }

  const markdownContent = htmlToMarkdown(content.htmlContent, content.url);
  parts.push(markdownContent);

  return parts.join("\n");
}

/**
 * Strip markdown formatting from text, preserving the plain text content
 */
export function stripMarkdown(content: string): string {
  return (
    content
      // Remove markdown formatting
      .replace(/^#{1,6}\s+/gm, "") // headings
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1") // bold italic
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1") // italic
      .replace(/_([^_]+)_/g, "$1") // italic underscore
      .replace(/~~([^~]+)~~/g, "$1") // strikethrough
      .replace(/`{3}[\s\S]*?`{3}/g, "") // code blocks
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
      .replace(/^[-*+]\s+/gm, "• ") // list items to bullets
      .replace(/^\d+\.\s+/gm, "• ") // numbered lists to bullets
      .replace(/^>\s+/gm, "") // blockquotes
      .replace(/---+/g, "") // horizontal rules
      .replace(/\n{3,}/g, "\n\n") // normalize multiple newlines
      .trim()
  );
}

/**
 * Generate a text preview of markdown content
 */
export function generatePreview(content: string, maxLength = 200): string {
  const cleaned = stripMarkdown(content)
    .replace(/\n{2,}/g, " ") // multiple newlines to space
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Cut at word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (
    (lastSpace > maxLength * 0.8
      ? truncated.slice(0, lastSpace)
      : truncated
    ).trim() + "…"
  );
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Extract Linear-supported embeddable URLs from markdown content
 * Only returns URLs that will auto-embed in Linear (YouTube, Loom, Descript, Figma)
 */
export function extractEmbedUrls(
  markdown: string,
): Array<{ url: string; platform: string; note: string | null }> {
  const urlPattern = /https?:\/\/[^\s<>)\]]+/g;
  const urls: Array<{ url: string; platform: string; note: string | null }> =
    [];
  const seenUrls = new Set<string>();

  let match;
  while ((match = urlPattern.exec(markdown)) !== null) {
    const url = match[0];
    // Only include Linear-supported platforms
    const platform = LINEAR_EMBED_PLATFORMS.find((p) => p.pattern.test(url));
    if (platform && !seenUrls.has(url)) {
      seenUrls.add(url);
      urls.push({ url, platform: platform.name, note: platform.note });
    }
  }

  return urls;
}
