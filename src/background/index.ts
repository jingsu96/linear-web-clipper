import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createXai } from "@ai-sdk/xai";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import type { AIProvider, AIProviderConfig, SummaryStyle } from "@/lib/storage";
import {
  SUMMARY_STYLE_PROMPTS,
  getDefaultModel,
  getEffectiveModelForConfig,
} from "@/lib/storage";

// Listen for messages from content scripts and sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_CONTENT") {
    handleExtractContent(sender.tab?.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === "CREATE_LINEAR_ISSUE") {
    handleCreateLinearIssue(message.payload)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "SUMMARIZE_CONTENT") {
    handleSummarizeContent(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_LINEAR_DATA") {
    handleGetLinearData()
      .then(sendResponse)
      .catch((error) => {
        console.error("[Background] Error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === "REFORMAT_TRANSCRIPT") {
    handleReformatTranscript(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "VALIDATE_AI_CONFIG") {
    handleValidateAIConfig(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle content extraction
async function handleExtractContent(tabId: number | undefined) {
  // If no tabId provided, try to get the active tab
  if (!tabId) {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!activeTab || !activeTab.id) {
      throw new Error("No active tab found");
    }
    tabId = activeTab.id;
  }

  try {
    // First, inject Readability library
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["public/Readability.js"],
      });
    } catch (e) {
      console.warn(
        "[Background] Could not inject Readability, using fallback:",
        e,
      );
    }

    // Then execute content extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
    });

    return { success: true, data: results[0].result };
  } catch (error) {
    console.error("[Background] Content extraction failed:", error);
    throw error;
  }
}

// Function injected into page to extract content
function extractPageContent() {
  try {
    // Get page metadata
    const title = document.title;
    const url = window.location.href;

    // Check if this is a YouTube video page
    if (url.includes("youtube.com/watch")) {
      // YouTube transcript extraction logic (inline to work with chrome.scripting.executeScript)
      return (async () => {
        try {
          // Helper function to wait for element
          const waitForElement = (
            selector: string,
            timeout = 5000,
          ): Promise<Element | null> => {
            return new Promise((resolve) => {
              const element = document.querySelector(selector);
              if (element) {
                resolve(element);
                return;
              }

              const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                  observer.disconnect();
                  resolve(element);
                }
              });

              observer.observe(document.body, {
                childList: true,
                subtree: true,
              });

              setTimeout(() => {
                observer.disconnect();
                resolve(null);
              }, timeout);
            });
          };

          // Helper function to click and wait
          const clickAndWait = async (
            element: Element,
            delay = 500,
          ): Promise<void> => {
            (element as HTMLElement).click();
            await new Promise((resolve) => setTimeout(resolve, delay));
          };

          // Step 1: Click the expand button to show full description
          const expandButton = document.querySelector("#expand") as HTMLElement;
          if (!expandButton) {
            throw new Error(
              "Could not find expand button. Make sure you are on a YouTube video page.",
            );
          }

          await clickAndWait(expandButton, 1000);

          // Step 2: Find and click the "Show transcript" button
          // Try multiple selectors as YouTube's UI changes
          let transcriptButton: Element | null = null;

          // Try finding by button text content
          const buttons = Array.from(document.querySelectorAll("button"));
          transcriptButton =
            buttons.find(
              (btn) =>
                btn.textContent?.toLowerCase().includes("transcript") ||
                btn.textContent?.toLowerCase().includes("show transcript"),
            ) || null;

          // If not found, try the structural selector
          if (!transcriptButton) {
            transcriptButton = await waitForElement(
              "ytd-video-description-transcript-section-renderer button",
              3000,
            );
          }

          if (!transcriptButton) {
            throw new Error(
              "Could not find transcript button. This video may not have a transcript available.",
            );
          }

          await clickAndWait(transcriptButton, 1500);

          // Step 3: Wait for transcript segments to load
          await waitForElement("ytd-transcript-segment-renderer", 3000);

          // Step 4: Extract transcript data
          const segments = Array.from(
            document.querySelectorAll("ytd-transcript-segment-renderer"),
          );

          if (segments.length === 0) {
            throw new Error(
              "No transcript segments found. This video may not have a transcript available.",
            );
          }

          const transcript = segments
            .map((segment) => {
              const timestamp = segment
                .querySelector(".segment-timestamp")
                ?.textContent?.trim();
              const text = (segment as HTMLElement).innerText.split("\n")[1];

              if (!text?.trim()) return null;

              return { time: timestamp, text: text };
            })
            .filter(
              (entry): entry is { time: string | undefined; text: string } =>
                entry !== null,
            );

          // Format transcript as HTML for markdown conversion
          const transcriptHtml = transcript
            .map(
              (entry) =>
                `<p><strong>${entry.time || "0:00"}</strong> ${entry.text}</p>`,
            )
            .join("\n");

          // Format transcript as plain text
          const transcriptText = transcript
            .map((entry) => `${entry.time || "0:00"} ${entry.text}`)
            .join("\n");

          return {
            title,
            url,
            htmlContent: transcriptHtml,
            textContent: transcriptText,
            metaDescription: "YouTube Video Transcript",
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error("[YouTube Transcript] Extraction error:", error);
          return {
            title: document.title,
            url: window.location.href,
            htmlContent: "",
            textContent: "",
            metaDescription: "",
            timestamp: new Date().toISOString(),
            error:
              error instanceof Error
                ? error.message
                : "Unknown error extracting YouTube transcript",
          };
        }
      })();
    }

    // Use Readability to extract main content
    // @ts-ignore - Readability is imported globally
    const { Readability } = window as any;

    let articleElement: HTMLElement;

    if (Readability) {
      // Clone document for Readability
      const documentClone = document.cloneNode(true) as Document;
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article && article.content) {
        // Create a temporary container for the extracted content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = article.content;
        articleElement = tempDiv;
      } else {
        articleElement = document.body;
      }
    } else {
      // Fallback if Readability is not available
      articleElement = document.body;
    }

    // Clone the content to avoid modifying
    const clonedContent = articleElement.cloneNode(true) as HTMLElement;

    // Remove unwanted elements
    const selectorsToRemove = [
      "script",
      "style",
      "nav",
      "header",
      "footer",
      ".advertisement",
      ".ad",
      ".social-share",
      ".comments",
      ".comment",
      ".comment-section",
      ".comment-list",
      ".comment-area",
      ".comments-section",
      "#comments",
      "#comment",
      "#disqus_thread",
      "#discourse-comments",
      '[id*="comment" i]',
      '[class*="comment" i]',
      "#references",
      ".references",
      '[id*="reference" i]',
      '[class*="reference" i]',
      "#see-also",
      "#external-links",
      "#further-reading",
      "#bibliography",
      ".mw-references-wrap", // Wikipedia references
      ".reflist", // Wikipedia reference list
    ];

    selectorsToRemove.forEach((selector) => {
      clonedContent.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Find conclusion section and remove everything after it
    const allHeadings = Array.from(
      clonedContent.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    );
    let conclusionIndex = -1;

    // First pass: find the conclusion heading
    for (let i = 0; i < allHeadings.length; i++) {
      const heading = allHeadings[i];
      const text = heading.textContent?.toLowerCase() || "";
      if (
        text.includes("conclusion") ||
        text.includes("summary") ||
        text.includes("in summary") ||
        text.includes("to sum up") ||
        text.includes("in conclusion") ||
        text.includes("final thoughts") ||
        text.includes("wrapping up") ||
        text.includes("takeaway") ||
        text.includes("key points")
      ) {
        conclusionIndex = i;
        break;
      }
    }

    // If we found a conclusion, find the next same-level heading and remove everything from there
    if (conclusionIndex >= 0) {
      const conclusionHeading = allHeadings[conclusionIndex] as HTMLElement;
      const conclusionLevel = parseInt(conclusionHeading.tagName.substring(1));

      // Find the next heading at the same level or higher
      for (let i = conclusionIndex + 1; i < allHeadings.length; i++) {
        const nextHeading = allHeadings[i] as HTMLElement;
        const nextLevel = parseInt(nextHeading.tagName.substring(1));

        if (nextLevel <= conclusionLevel) {
          // Remove this heading and everything after it
          let toRemove: Element | null = nextHeading;
          while (toRemove) {
            const nextSibling = toRemove.nextSibling as Element | null;
            toRemove.remove();
            toRemove = nextSibling;
          }
          break;
        }
      }
    }

    // Second pass: Remove other unwanted sections
    const remainingHeadings = clonedContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6",
    );
    remainingHeadings.forEach((heading) => {
      const text = heading.textContent?.toLowerCase() || "";

      if (
        text.includes("reference") ||
        text.includes("see also") ||
        text.includes("external link") ||
        text.includes("further reading") ||
        text.includes("bibliography") ||
        text.includes("citation") ||
        text.includes("notes") ||
        text.includes("comment") ||
        text.includes("discussion") ||
        text.includes("leave a reply") ||
        text.includes("post a comment") ||
        text.includes("add comment")
      ) {
        // Remove the heading and all content until the next heading or end
        let current = heading.nextElementSibling;
        heading.remove();
        while (current && !current.matches("h1, h2, h3, h4, h5, h6")) {
          const next = current.nextElementSibling;
          current.remove();
          current = next;
        }
      }
    });

    // Additional comment detection: Look for elements with "comment" in their text content
    // Only remove if it looks like a comment section (multiple comment elements or large blocks)
    const allElements = clonedContent.querySelectorAll("*");
    allElements.forEach((element) => {
      const text = element.textContent?.toLowerCase() || "";
      const id = element.id?.toLowerCase() || "";
      const className = element.className?.toString().toLowerCase() || "";

      // Check if element or its attributes contain comment-related keywords
      const hasCommentKeyword =
        id.includes("comment") ||
        className.includes("comment") ||
        (text.includes("comment") && text.length < 100); // Short text with "comment"

      // Check if it's a comment form or container
      const isCommentContainer =
        element.tagName === "FORM" ||
        element.querySelector('textarea[placeholder*="comment" i]') !== null ||
        element.querySelector('input[placeholder*="comment" i]') !== null;

      if (hasCommentKeyword || isCommentContainer) {
        element.remove();
      }
    });

    // Get the HTML content
    const htmlContent = clonedContent.innerHTML;

    // Get text content as fallback
    const textContent = clonedContent.innerText;

    // Get meta description
    const metaDescription =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") || "";

    return {
      title,
      url,
      htmlContent,
      textContent,
      metaDescription,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Content extraction error:", error);
    return {
      title: document.title,
      url: window.location.href,
      htmlContent: "",
      textContent: document.body.innerText,
      metaDescription: "",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Handle Linear issue creation
async function handleCreateLinearIssue(payload: {
  teamId: string;
  projectId?: string;
  title: string;
  description: string;
  summary?: string;
  apiKey: string;
}) {
  const { teamId, projectId, title, description, summary, apiKey } = payload;

  try {
    // Truncate description if too long (Linear limit is 250,000 characters)
    const MAX_DESCRIPTION_LENGTH = 250000;
    let finalDescription = description;

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      console.warn(
        `[Background] Description too long (${description.length} chars), truncating to ${MAX_DESCRIPTION_LENGTH}`,
      );
      finalDescription =
        description.slice(0, MAX_DESCRIPTION_LENGTH - 100) +
        "\n\n---\n\n*[Content truncated due to length]*";
    }

    // Build the input object conditionally
    const input: any = {
      teamId,
      title,
      description: finalDescription,
    };

    // Only add projectId if it's provided
    if (projectId) {
      input.projectId = projectId;
    }

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
              }
            }
          }
        `,
        variables: {
          input,
        },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("[Background] GraphQL errors:", result.errors);
      const errorMsg = result.errors[0].extensions?.validationErrors
        ? JSON.stringify(result.errors[0].extensions.validationErrors)
        : result.errors[0].message;
      throw new Error(errorMsg);
    }

    const issue = result.data.issueCreate.issue;

    // If summary exists, add it as a comment
    if (summary) {
      await addCommentToIssue(issue.id, summary, apiKey);
    }

    return { success: true, data: issue };
  } catch (error) {
    console.error("[Background] Linear issue creation failed:", error);
    throw error;
  }
}

// Add a comment to a Linear issue
async function addCommentToIssue(
  issueId: string,
  comment: string,
  apiKey: string,
) {
  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: `
          mutation CreateComment($input: CommentCreateInput!) {
            commentCreate(input: $input) {
              success
              comment {
                id
              }
            }
          }
        `,
        variables: {
          input: {
            issueId,
            body: `## AI Summary\n\n${comment}`,
          },
        },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("[Background] Failed to add comment:", result.errors);
      throw new Error(result.errors[0].message);
    }
  } catch (error) {
    console.error("[Background] Failed to add comment:", error);
    // Don't throw - issue was created successfully, comment is optional
  }
}

// Helper function to create AI model based on provider
// Returns any to handle SDK version differences (LanguageModelV2 vs V3)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAIModel(
  provider: AIProvider,
  apiKey: string,
  modelId?: string,
): any {
  const modelName = modelId || getDefaultModel(provider);

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelName);
    case "anthropic":
      return createAnthropic({
        apiKey,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      })(modelName);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(modelName);
    case "deepseek":
      return createDeepSeek({ apiKey })(modelName);
    case "grok":
      return createXai({ apiKey })(modelName);
    case "groq":
      return createGroq({ apiKey })(modelName);
    case "mistral":
      return createMistral({ apiKey })(modelName);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelName);
    default:
      throw new Error("Unsupported AI provider");
  }
}

/**
 * Classify whether an error is transient (worth retrying with fallback)
 * or permanent (auth error — rethrow immediately).
 */
function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // Auth errors should NOT trigger fallback
  if (
    message.includes("401") ||
    message.includes("Unauthorized") ||
    message.includes("invalid_api_key") ||
    message.includes("403") ||
    message.includes("Forbidden")
  ) {
    return false;
  }
  // These are transient — try next provider
  return true;
}

/**
 * Try each enabled provider config in priority order.
 * Falls back on transient errors; rethrows auth errors immediately.
 */
async function withFallback<T>(
  configs: AIProviderConfig[],
  operation: (config: AIProviderConfig) => Promise<T>,
): Promise<T> {
  if (configs.length === 0) {
    throw new Error("No AI providers configured. Please add a provider in settings.");
  }

  let lastError: unknown;

  for (const config of configs) {
    try {
      return await operation(config);
    } catch (error) {
      lastError = error;
      if (!isTransientError(error)) {
        // Auth error — don't fallback, throw right away
        throw error;
      }
      console.warn(
        `[Background] Provider ${config.provider} failed, trying next:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // All providers failed
  throw lastError;
}

// Validate AI configuration with a minimal structured-output call
const aiHealthSchema = z.object({
  ok: z.boolean(),
});

async function handleValidateAIConfig(payload: {
  apiKey: string;
  provider: AIProvider;
  model?: string;
}) {
  const { apiKey, provider, model: modelId } = payload;

  if (!apiKey) {
    throw new Error("API key is required");
  }

  if (provider === "none") {
    throw new Error("No AI provider selected");
  }

  try {
    const model = createAIModel(provider, apiKey, modelId);

    const { output } = await generateText({
      model,
      prompt: 'Respond with ok set to true.',
      output: Output.object({ schema: aiHealthSchema }),
      maxOutputTokens: 20,
    });

    if (!output || output.ok !== true) {
      throw new Error("Unexpected response from AI provider");
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("401") || message.includes("Unauthorized") || message.includes("invalid_api_key")) {
      throw new Error("Invalid API key. Please check and try again.");
    }
    if (message.includes("403") || message.includes("Forbidden")) {
      throw new Error("Access denied. Your API key may lack permissions for this model.");
    }
    if (message.includes("429") || message.includes("rate")) {
      throw new Error("Rate limited. Please wait a moment and try again.");
    }
    if (message.includes("404") || message.includes("model_not_found") || message.includes("not found")) {
      throw new Error("Model not found. The selected model may not be available on your plan.");
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("ECONNREFUSED")) {
      throw new Error("Network error. Please check your internet connection.");
    }

    throw new Error(`Validation failed: ${message}`);
  }
}

// Handle transcript reformatting (converts transcript to article format)
async function handleReformatTranscript(payload: {
  content: string;
  providerConfigs: AIProviderConfig[];
}) {
  const { content, providerConfigs } = payload;

  return withFallback(providerConfigs, async (config) => {
    const modelId = getEffectiveModelForConfig(config);
    const model = createAIModel(config.provider, config.apiKey, modelId);

    const MAX_CHARS = 30000;

    if (content.length <= MAX_CHARS) {
      const { text } = await generateText({
        model,
        prompt: `You are given a YouTube video transcript with timestamps. Your task is to rewrite this transcript into a well-structured, flowing article format while keeping ALL the original content intact.

Instructions:
1. Remove the timestamp markers (e.g., "0:00", "1:23")
2. Combine sentence fragments into complete, coherent sentences
3. Organize the content into logical paragraphs based on topic changes
4. Add appropriate section headings (using ##) where there are clear topic transitions
5. Maintain ALL the original information - don't summarize or omit anything
6. Fix any transcription errors or awkward phrasings
7. Use proper punctuation and grammar
8. Keep the tone conversational if the original was conversational

The output should read like a natural article, not a transcript. Here's the transcript:

${content}`,
      });

      return { reformattedContent: text };
    } else {
      // For very long transcripts, process in chunks
      const CHUNK_SIZE = 25000;
      const chunks: string[] = [];
      for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        chunks.push(content.slice(i, i + CHUNK_SIZE));
      }

      const reformattedChunks = await Promise.all(
        chunks.map(async (chunk, index) => {
          const { text } = await generateText({
            model,
            prompt: `This is part ${index + 1} of ${chunks.length} of a YouTube video transcript. Rewrite it into flowing article format while keeping ALL content. Remove timestamps, combine fragments, fix grammar, but don't omit anything:\n\n${chunk}`,
          });
          return text;
        }),
      );

      return { reformattedContent: reformattedChunks.join("\n\n") };
    }
  });
}

// Handle content summarization
async function handleSummarizeContent(payload: {
  content: string;
  providerConfigs: AIProviderConfig[];
  summaryStyle?: SummaryStyle;
  summaryLanguage?: string;
  customPrompt?: string;
}) {
  const {
    content,
    providerConfigs,
    summaryStyle = "concise",
    summaryLanguage = "English",
    customPrompt,
  } = payload;

  // Build the prompt once (shared across fallback attempts)
  let basePrompt: string;
  if (summaryStyle === "custom" && customPrompt) {
    basePrompt = customPrompt;
  } else if (summaryStyle !== "custom") {
    basePrompt = SUMMARY_STYLE_PROMPTS[summaryStyle].prompt;
  } else {
    basePrompt = SUMMARY_STYLE_PROMPTS.concise.prompt;
  }

  basePrompt += `\n\nIMPORTANT: You MUST write the entire summary in ${summaryLanguage} only. Do NOT use the language of the source content - always output in ${summaryLanguage}.`;

  return withFallback(providerConfigs, async (config) => {
    const modelId = getEffectiveModelForConfig(config);
    const model = createAIModel(config.provider, config.apiKey, modelId);

    const MAX_CHARS = 8000;

    if (content.length <= MAX_CHARS) {
      const { text } = await generateText({
        model,
        prompt: `${basePrompt}\n\n${content}`,
      });

      return { success: true, summary: text };
    } else {
      const sections = splitContentBySections(content);
      const importantSections = sections.slice(0, 5);
      const truncatedContent = importantSections
        .map((s) => s.slice(0, 1500))
        .join("\n\n---\n\n");

      const { text } = await generateText({
        model,
        prompt: `${basePrompt}\n\nNote: This is a longer document. Focus on the most important points from the following excerpts:\n\n${truncatedContent}`,
      });

      return { success: true, summary: text };
    }
  });
}

// Split markdown content by h2 headings
function splitContentBySections(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split("\n");
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection.trim()) {
        sections.push(currentSection.trim());
      }
      currentSection = line + "\n";
    } else {
      currentSection += line + "\n";
    }
  }

  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }

  // If no h2 sections found, split by chunks
  if (sections.length <= 1) {
    const CHUNK_SIZE = 5000;
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
      chunks.push(content.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  return sections;
}

// Handle fetching Linear data (teams, projects)
async function handleGetLinearData() {
  try {
    const { linearApiKey } = await chrome.storage.local.get("linearApiKey");

    if (!linearApiKey) {
      throw new Error("Linear API key not configured");
    }

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearApiKey,
      },
      body: JSON.stringify({
        query: `
          query GetTeamsAndProjects {
            teams {
              nodes {
                id
                name
                key
                projects {
                  nodes {
                    id
                    name
                    state
                  }
                }
              }
            }
          }
        `,
      }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    // Transform the nested structure to flat lists
    const teams = result.data.teams.nodes;

    const projects = teams.flatMap((team: any) =>
      team.projects.nodes.map((project: any) => ({
        ...project,
        team: {
          id: team.id,
          name: team.name,
        },
      })),
    );

    const teamsData = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      key: team.key,
    }));

    return {
      success: true,
      data: {
        teams: teamsData,
        projects,
      },
    };
  } catch (error) {
    console.error("[Background] Failed to fetch Linear data:", error);
    throw error;
  }
}

