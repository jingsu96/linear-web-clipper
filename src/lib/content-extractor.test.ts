import { describe, it, expect } from "vitest";
import {
  htmlToMarkdown,
  stripMarkdown,
  generatePreview,
  estimateReadingTime,
  extractEmbedUrls,
  pickBestSrcsetCandidate,
  getEmbeddableSourceUrl,
} from "./content-extractor";

describe("htmlToMarkdown", () => {
  it("converts basic HTML to markdown", () => {
    const md = htmlToMarkdown(
      "<h1>Title</h1><p>Hello <strong>world</strong></p>",
    );
    expect(md).toContain("Title");
    expect(md).toContain("Hello **world**");
  });

  it("resolves relative link and image URLs against the base URL", () => {
    const md = htmlToMarkdown(
      '<p><a href="/docs">Docs</a> <img src="/img/logo.png" alt="logo"></p>',
      "https://example.com/blog/post",
    );
    expect(md).toContain("https://example.com/docs");
    expect(md).toContain("https://example.com/img/logo.png");
  });

  it("uses data-src for lazy-loaded images", () => {
    const md = htmlToMarkdown(
      '<img data-src="https://example.com/lazy.png" alt="lazy">',
    );
    expect(md).toContain("https://example.com/lazy.png");
  });

  it("removes hidden elements", () => {
    const md = htmlToMarkdown(
      '<p>visible</p><p style="display: none">secret</p><p hidden>gone</p>',
    );
    expect(md).toContain("visible");
    expect(md).not.toContain("secret");
    expect(md).not.toContain("gone");
  });

  it("collapses excessive blank lines", () => {
    const md = htmlToMarkdown("<p>a</p><br><br><br><p>b</p>");
    expect(md).not.toMatch(/\n{3,}/);
  });
});

describe("stripMarkdown", () => {
  it("removes headings, emphasis, and links", () => {
    const text = stripMarkdown(
      "# Heading\n\n**bold** and *italic* and [link](https://example.com)",
    );
    expect(text).toBe("Heading\n\nbold and italic and link");
  });

  it("removes code blocks and images", () => {
    const text = stripMarkdown(
      "```js\nconsole.log(1)\n```\n\n![alt](https://example.com/a.png)\n\ntext",
    );
    expect(text).not.toContain("console.log");
    expect(text).not.toContain("example.com");
    expect(text).toContain("text");
  });

  it("converts list markers to bullets", () => {
    const text = stripMarkdown("- one\n* two\n1. three");
    expect(text).toBe("• one\n• two\n• three");
  });
});

describe("generatePreview", () => {
  it("returns short content unchanged", () => {
    expect(generatePreview("Hello world")).toBe("Hello world");
  });

  it("truncates long content at a word boundary with an ellipsis", () => {
    const long = Array(100).fill("word").join(" ");
    const preview = generatePreview(long, 50);
    expect(preview.length).toBeLessThanOrEqual(51);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview).not.toContain("wor …");
  });

  it("collapses newlines into single spaces", () => {
    expect(generatePreview("a\n\nb\nc")).toBe("a b c");
  });
});

describe("estimateReadingTime", () => {
  it("returns at least 1 minute", () => {
    expect(estimateReadingTime("just a few words")).toBe(1);
    expect(estimateReadingTime("")).toBe(1);
  });

  it("estimates 200 words per minute, rounded up", () => {
    const words = Array(401).fill("word").join(" ");
    expect(estimateReadingTime(words)).toBe(3);
  });
});

describe("extractEmbedUrls", () => {
  it("extracts Linear-supported platform URLs", () => {
    const md = [
      "Watch https://www.youtube.com/watch?v=abc123",
      "Design: https://www.figma.com/file/xyz",
      "Other: https://example.com/page",
    ].join("\n");
    const embeds = extractEmbedUrls(md);
    expect(embeds).toHaveLength(2);
    expect(embeds[0]).toMatchObject({ platform: "youtube" });
    expect(embeds[1]).toMatchObject({ platform: "figma" });
  });

  it("deduplicates repeated URLs", () => {
    const md = "https://youtu.be/abc https://youtu.be/abc https://youtu.be/abc";
    expect(extractEmbedUrls(md)).toHaveLength(1);
  });

  it("returns empty array when no embeddable URLs exist", () => {
    expect(extractEmbedUrls("plain text, no links")).toEqual([]);
  });
});

describe("pickBestSrcsetCandidate", () => {
  it("picks the largest width descriptor", () => {
    expect(
      pickBestSrcsetCandidate(
        "https://ex.com/a-320.jpg 320w, https://ex.com/a-640.jpg 640w, https://ex.com/a-1280.jpg 1280w",
      ),
    ).toBe("https://ex.com/a-1280.jpg");
  });

  it("handles CDN URLs containing literal commas", () => {
    expect(
      pickBestSrcsetCandidate(
        "https://cdn.ex.com/w_424,c_limit/img.png 424w, https://cdn.ex.com/w_848,c_limit/img.png 848w",
      ),
    ).toBe("https://cdn.ex.com/w_848,c_limit/img.png");
  });

  it("handles density descriptors", () => {
    expect(
      pickBestSrcsetCandidate(
        "https://ex.com/a.jpg 1x, https://ex.com/a@2x.jpg 2x",
      ),
    ).toBe("https://ex.com/a@2x.jpg");
  });

  it("returns a lone URL without descriptor", () => {
    expect(pickBestSrcsetCandidate("https://ex.com/only.jpg")).toBe(
      "https://ex.com/only.jpg",
    );
  });

  it("returns null for empty input", () => {
    expect(pickBestSrcsetCandidate("")).toBe(null);
  });
});

describe("srcset handling in htmlToMarkdown", () => {
  it("uses the highest-resolution srcset candidate as the image source", () => {
    const md = htmlToMarkdown(
      '<img src="https://ex.com/small.jpg" srcset="https://ex.com/small.jpg 320w, https://ex.com/large.jpg 1600w" alt="pic">',
    );
    expect(md).toContain("https://ex.com/large.jpg");
    expect(md).not.toContain("small.jpg");
  });
});

describe("getEmbeddableSourceUrl", () => {
  it("returns YouTube watch and short URLs", () => {
    expect(
      getEmbeddableSourceUrl("https://www.youtube.com/watch?v=abc123"),
    ).toBe("https://www.youtube.com/watch?v=abc123");
    expect(getEmbeddableSourceUrl("https://youtu.be/abc123")).toBe(
      "https://youtu.be/abc123",
    );
  });

  it("returns Loom and Descript share URLs", () => {
    expect(getEmbeddableSourceUrl("https://www.loom.com/share/xyz")).toBe(
      "https://www.loom.com/share/xyz",
    );
    expect(getEmbeddableSourceUrl("https://share.descript.com/view/xyz")).toBe(
      "https://share.descript.com/view/xyz",
    );
  });

  it("returns null for non-embeddable pages", () => {
    expect(getEmbeddableSourceUrl("https://example.com/article")).toBe(null);
    expect(getEmbeddableSourceUrl("https://www.youtube.com/@channel")).toBe(
      null,
    );
  });
});
