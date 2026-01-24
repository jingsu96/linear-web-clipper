import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

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
  emDelimiter: "_",
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
    const src = img.src || img.getAttribute("data-src") || "";

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

// Handle iframes and embeds - extract URL for Linear auto-embedding
turndownService.addRule("embeds", {
  filter: (node) => node.nodeName === "IFRAME" || node.nodeName === "EMBED",
  replacement: (_content, node) => {
    const src = (node as HTMLElement).getAttribute("src") || "";
    if (!src) return "";

    const canonicalUrl = extractCanonicalUrl(src);

    if (canonicalUrl) {
      // Return URL on its own line for Linear auto-embedding
      return "\n\n" + canonicalUrl + "\n\n";
    }

    // For unknown embeds, create a link
    return `\n\n[Embedded content](${src})\n\n`;
  },
});

// Handle standalone links that should be embeddable
turndownService.addRule("embeddableLinks", {
  filter: (node) => {
    if (node.nodeName !== "A") return false;
    const href = (node as HTMLAnchorElement).href;
    // Check if link is to an embeddable platform and is roughly the only content
    const textContent = node.textContent?.trim() || "";
    const isStandaloneish =
      textContent === href ||
      textContent.length < 100 ||
      node.querySelector("img") !== null;
    return isEmbeddablePlatform(href) && isStandaloneish;
  },
  replacement: (_content, node) => {
    const href = (node as HTMLAnchorElement).href;
    // Put embeddable links on their own line for auto-embedding
    return "\n\n" + href + "\n\n";
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
export function htmlToMarkdown(html: string): string {
  try {
    // Pre-process HTML to handle edge cases
    const processedHtml = preprocessHtml(html);
    const markdown = turndownService.turndown(processedHtml);
    return cleanMarkdown(markdown);
  } catch (error) {
    console.error("HTML to Markdown conversion failed:", error);
    return html;
  }
}

/**
 * Pre-process HTML before conversion
 */
function preprocessHtml(html: string): string {
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

  // Convert data-src to src for lazy-loaded images
  doc.querySelectorAll("img[data-src]").forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc && !img.getAttribute("src")) {
      img.setAttribute("src", dataSrc);
    }
  });

  // Handle picture elements - extract best image source
  doc.querySelectorAll("picture").forEach((picture) => {
    const img = picture.querySelector("img");
    if (img) {
      picture.replaceWith(img);
    }
  });

  return doc.body.innerHTML;
}

/**
 * Clean up markdown output for optimal Linear compatibility
 */
function cleanMarkdown(markdown: string): string {
  let cleaned = markdown
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    // Remove excessive blank lines (more than 2)
    .replace(/\n{3,}/g, "\n\n")
    // Clean up spaces before punctuation
    .replace(/ +([.,;:!?])/g, "$1")
    // Remove trailing spaces on lines
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Remove leading/trailing whitespace
    .trim();

  // Post-process: Convert markdown links to Linear-embeddable platforms into standalone URLs
  // Linear auto-embeds URLs on their own line for YouTube, Loom, Descript, and Figma
  const linearEmbedPattern =
    /(youtube\.com|youtu\.be|loom\.com|descript\.com|figma\.com)/i;

  // Replace markdown links [text](url) with standalone URL if it's embeddable
  cleaned = cleaned.replace(
    /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, _text, url) => {
      if (linearEmbedPattern.test(url)) {
        // Return URL on its own line for auto-embedding
        return `\n\n${url}\n\n`;
      }
      return match;
    },
  );

  // Clean up any resulting excessive blank lines again
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
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

    parts.push("---");
    parts.push("");
  }

  const markdownContent = htmlToMarkdown(content.htmlContent);
  parts.push(markdownContent);

  return parts.join("\n");
}

/**
 * Selectors for main content detection, ordered by specificity
 */
const MAIN_CONTENT_SELECTORS = [
  // Semantic HTML5
  'article[role="main"]',
  "main article",
  "article",
  "main",
  '[role="main"]',
  // Common content class patterns
  ".post-content",
  ".article-content",
  ".article-body",
  ".entry-content",
  ".content-body",
  ".post-body",
  ".story-body",
  ".blog-post",
  ".blog-content",
  // CMS-specific
  ".markdown-body", // GitHub
  ".notion-page-content", // Notion
  ".medium-content", // Medium-style
  ".wp-content", // WordPress
  ".prose", // Tailwind prose
  // Generic fallbacks
  "#content",
  "#main-content",
  "#article",
  ".content",
];

/**
 * Selectors for elements to remove from content
 */
const REMOVE_SELECTORS = [
  // Navigation & structure
  "nav",
  "header",
  "footer",
  "aside",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  // Ads & promotions
  ".ad",
  ".ads",
  ".advertisement",
  ".sponsored",
  '[class*="advert"]',
  '[id*="advert"]',
  ".promo",
  ".promotion",
  ".banner",
  // Social & sharing
  ".social-share",
  ".share-buttons",
  ".social-links",
  ".follow-us",
  ".newsletter-signup",
  // Comments
  ".comments",
  ".comment-section",
  "#comments",
  "#disqus_thread",
  '[class*="comment"]',
  '[id*="comment"]',
  // Related content
  ".related-posts",
  ".related-articles",
  ".related-content",
  ".related",
  ".recommended",
  ".recommendations",
  ".more-stories",
  ".more-articles",
  ".read-next",
  ".read-more",
  ".you-might-like",
  ".also-like",
  ".popular-posts",
  ".trending",
  ".latest-posts",
  ".recent-posts",
  '[class*="related"]',
  '[class*="recommend"]',
  // Popups & overlays
  ".modal",
  ".popup",
  ".overlay",
  ".tooltip",
  // Print & accessibility helpers
  ".screen-reader-text",
  ".visually-hidden",
  ".sr-only",
  // Metadata & tags
  ".tags",
  ".categories",
  ".meta",
  ".byline",
  ".author-bio",
  ".author-box",
  // Navigation within article
  ".breadcrumb",
  ".breadcrumbs",
  ".pagination",
  ".table-of-contents",
  ".toc",
];

/**
 * Extract main content from HTML document
 * Uses heuristics to identify the primary content area
 */
export function extractMainContent(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // First, try to find main content using semantic selectors
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const element = doc.querySelector(selector);
    if (element && isSubstantialContent(element)) {
      return cleanContentElement(element.cloneNode(true) as HTMLElement)
        .innerHTML;
    }
  }

  // Fallback: find the element with the most paragraph text content
  const candidates = doc.querySelectorAll("div, section, article");
  let bestCandidate: Element | null = null;
  let bestScore = 0;

  candidates.forEach((candidate) => {
    const score = scoreContentElement(candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  if (bestCandidate !== null && bestScore > 100) {
    return cleanContentElement(
      (bestCandidate as Element).cloneNode(true) as HTMLElement,
    ).innerHTML;
  }

  // Last resort: use body
  return cleanContentElement(doc.body.cloneNode(true) as HTMLElement).innerHTML;
}

/**
 * Check if element contains substantial content
 */
function isSubstantialContent(element: Element): boolean {
  const text = element.textContent || "";
  const wordCount = text.trim().split(/\s+/).length;
  const paragraphs = element.querySelectorAll("p").length;

  return wordCount > 50 || paragraphs > 1;
}

/**
 * Score an element based on content quality indicators
 */
function scoreContentElement(element: Element): number {
  let score = 0;

  // Count paragraphs with substantial text
  element.querySelectorAll("p").forEach((p) => {
    const text = p.textContent?.trim() || "";
    if (text.length > 25) score += text.length / 10;
  });

  // Boost for headings
  score += element.querySelectorAll("h1, h2, h3").length * 10;

  // Boost for code blocks
  score += element.querySelectorAll("pre, code").length * 5;

  // Boost for images with alt text
  element.querySelectorAll("img[alt]").forEach((img) => {
    if ((img as HTMLImageElement).alt.length > 5) score += 5;
  });

  // Penalty for too many links (likely navigation)
  const links = element.querySelectorAll("a").length;
  const text = element.textContent?.length || 1;
  const linkDensity = links / (text / 100);
  if (linkDensity > 0.5) score *= 0.5;

  // Penalty for short content
  if (text < 200) score *= 0.5;

  return score;
}

/**
 * Clean content element by removing unwanted child elements
 */
function cleanContentElement(element: HTMLElement): HTMLElement {
  // Remove unwanted elements
  REMOVE_SELECTORS.forEach((selector) => {
    element.querySelectorAll(selector).forEach((el) => el.remove());
  });

  // Remove elements with certain keywords in class/id
  const keywordPatterns = [
    /sidebar/i,
    /widget/i,
    /popup/i,
    /modal/i,
    /overlay/i,
    /newsletter/i,
    /subscribe/i,
    /signup/i,
    /sign-up/i,
  ];

  element.querySelectorAll("*").forEach((el) => {
    const className = el.className?.toString() || "";
    const id = el.id || "";
    for (const pattern of keywordPatterns) {
      if (pattern.test(className) || pattern.test(id)) {
        el.remove();
        break;
      }
    }
  });

  // Remove empty elements
  element.querySelectorAll("div, span, p").forEach((el) => {
    if (
      !el.textContent?.trim() &&
      !el.querySelector("img, video, iframe, embed, svg")
    ) {
      el.remove();
    }
  });

  // Remove link lists (lists where items are primarily links, often "related posts")
  element.querySelectorAll("ul, ol").forEach((list) => {
    const items = list.querySelectorAll("li");
    if (items.length === 0) return;

    let linkOnlyItems = 0;
    items.forEach((item) => {
      const links = item.querySelectorAll("a");
      const headings = item.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const itemText = item.textContent?.trim() || "";
      const linkText = Array.from(links)
        .map((a) => a.textContent?.trim() || "")
        .join("");

      // Check if item is mostly a link (with optional heading inside)
      if (
        links.length > 0 &&
        (headings.length > 0 ||
          linkText.length > itemText.length * 0.7 ||
          itemText.length < 100)
      ) {
        linkOnlyItems++;
      }
    });

    // If most items are link-only, remove the whole list
    if (linkOnlyItems > items.length * 0.6) {
      list.remove();
    }
  });

  return element;
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
