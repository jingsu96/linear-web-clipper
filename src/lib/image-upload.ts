/**
 * Upload markdown images to Linear's CDN.
 *
 * Images are fetched from the **page's JavaScript context** using
 * chrome.scripting.executeScript({ world: 'MAIN' }) so that the request
 * carries the page's own origin, cookies, and referrer — bypassing
 * hotlink protection that would reject chrome-extension:// origins.
 *
 * The Linear fileUpload mutation + S3 PUT stays in the sidepanel.
 */

/** Per-image size limit (10 MB). */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
/** Cumulative upload budget per clip (50 MB). */
const MAX_TOTAL_UPLOAD = 50 * 1024 * 1024;

/**
 * Fetch images from the active tab's page context.
 * Returns a map of original URL → data URL for every image that was
 * successfully fetched (skips failures silently).
 */
async function fetchImagesFromPage(
  imageUrls: string[],
): Promise<Record<string, string>> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) return {};

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: async (urls: string[]) => {
      const map: Record<string, string> = {};
      await Promise.all(
        urls.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) return;
            const blob = await res.blob();
            const dataUrl: string = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            map[url] = dataUrl;
          } catch {
            // skip images that can't be fetched
          }
        }),
      );
      return map;
    },
    args: [imageUrls],
  });

  // executeScript returns an array of InjectionResult; we want the first frame's result
  return (results?.[0]?.result as Record<string, string>) ?? {};
}

/** Convert a data URL to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a single image blob to Linear's CDN via the fileUpload mutation.
 * Returns the hosted asset URL, or null on failure.
 */
async function uploadBlobToLinear(
  blob: Blob,
  filename: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const contentType = blob.type || "image/jpeg";

    const uploadResponse = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: `
          mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
            fileUpload(contentType: $contentType, filename: $filename, size: $size) {
              uploadFile {
                uploadUrl
                assetUrl
                headers {
                  key
                  value
                }
              }
            }
          }
        `,
        variables: { contentType, filename, size: blob.size },
      }),
    });

    const uploadResult = await uploadResponse.json();
    const uploadFile = uploadResult.data?.fileUpload?.uploadFile;
    if (!uploadFile) return null;

    const putHeaders: Record<string, string> = {};
    for (const { key, value } of uploadFile.headers) {
      putHeaders[key] = value;
    }

    const putResponse = await fetch(uploadFile.uploadUrl, {
      method: "PUT",
      headers: putHeaders,
      body: blob,
    });

    if (!putResponse.ok) return null;

    return uploadFile.assetUrl;
  } catch {
    return null;
  }
}

/**
 * Find all markdown image URLs, fetch them from the page context,
 * upload to Linear's CDN, and replace with hosted URLs.
 * Falls back to the original URL if an individual upload fails.
 */
export async function uploadMarkdownImages(
  markdown: string,
  apiKey: string,
): Promise<string> {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...markdown.matchAll(imageRegex)];
  if (matches.length === 0) return markdown;

  // Deduplicate URLs
  const uniqueUrls = [...new Set(matches.map((m) => m[2]))];

  // Fetch all images from the page's JS context
  const dataUrlMap = await fetchImagesFromPage(uniqueUrls);

  // Upload each fetched image to Linear sequentially with size limits
  const assetUrlMap: Record<string, string> = {};
  let totalUploaded = 0;

  for (const url of uniqueUrls) {
    const dataUrl = dataUrlMap[url];
    if (!dataUrl) continue;

    const blob = dataUrlToBlob(dataUrl);

    if (blob.size > MAX_IMAGE_SIZE) continue;
    if (totalUploaded + blob.size > MAX_TOTAL_UPLOAD) break;

    const filename = url.split("/").pop()?.split("?")[0] || "image.jpg";
    const assetUrl = await uploadBlobToLinear(blob, filename, apiKey);
    if (assetUrl) {
      assetUrlMap[url] = assetUrl;
      totalUploaded += blob.size;
    }
  }

  // Single-pass replacement of original URLs with Linear CDN URLs
  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (full, alt: string, src: string) => {
      const assetUrl = assetUrlMap[src];
      return assetUrl ? `![${alt}](${assetUrl})` : full;
    },
  );
}
