#!/usr/bin/env node

/**
 * Chrome Web Store publisher — zero dependencies.
 *
 * Usage:
 *   node scripts/publish-cws.mjs <zip-path> [options]
 *
 * Options:
 *   --target=<default|trustedTesters>  Publish audience (default: default)
 *   --deploy-percentage=<0-100>        Staged rollout percentage (default: full)
 *   --upload-only                      Upload the draft, skip the publish call
 *   --dry-run                          Validate inputs and exit without calling the API
 *
 * Required environment variables:
 *   CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
 *
 * See docs/RELEASING.md for how to obtain these credentials.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://www.googleapis.com/chromewebstore/v1.1/items";
const UPLOAD_API =
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUIRED_ENV = [
  "CWS_EXTENSION_ID",
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
];

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function option(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

// ---------------------------------------------------------------- arguments

const zipArg = process.argv[2];
if (!zipArg || zipArg.startsWith("--")) {
  fail("Usage: node scripts/publish-cws.mjs <zip-path> [options]");
}

const zipPath = resolve(process.cwd(), zipArg);
if (!existsSync(zipPath)) fail(`ZIP not found: ${zipPath}`);

const target = option("target", "default");
if (!["default", "trustedTesters"].includes(target)) {
  fail(`Invalid --target "${target}" (expected: default | trustedTesters)`);
}

const deployPercentageRaw = option("deploy-percentage");
let deployPercentage;
if (deployPercentageRaw !== undefined) {
  deployPercentage = Number(deployPercentageRaw);
  if (
    !Number.isInteger(deployPercentage) ||
    deployPercentage < 0 ||
    deployPercentage > 100
  ) {
    fail(
      `Invalid --deploy-percentage "${deployPercentageRaw}" (expected an integer 0-100)`,
    );
  }
}

const uploadOnly = flag("upload-only");
const dryRun = flag("dry-run");

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  fail(
    `Missing required environment variable(s): ${missing.join(", ")}. ` +
      `Set them as repository secrets — see docs/RELEASING.md.`,
  );
}

const extensionId = process.env.CWS_EXTENSION_ID;
const sizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(2);

console.log(`Extension:  ${extensionId}`);
console.log(`Package:    ${zipPath} (${sizeMb} MB)`);
console.log(`Target:     ${target}`);
if (deployPercentage !== undefined) {
  console.log(`Rollout:    ${deployPercentage}%`);
}
console.log(`Publish:    ${uploadOnly ? "no (upload only)" : "yes"}`);

if (dryRun) {
  console.log(
    "\nDry run — credentials and package validated, no API calls made.",
  );
  process.exit(0);
}

// ------------------------------------------------------------------ helpers

async function readBody(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: undefined };
  }
}

/** Format the itemError array the Web Store returns on a rejected upload. */
function formatItemErrors(json) {
  const errors = json?.itemError;
  if (!Array.isArray(errors) || errors.length === 0) {
    return JSON.stringify(json);
  }
  return errors
    .map((e) => `${e.error_code ?? "ERROR"}: ${e.error_detail ?? ""}`.trim())
    .join("\n");
}

async function getAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.CWS_CLIENT_ID,
      client_secret: process.env.CWS_CLIENT_SECRET,
      refresh_token: process.env.CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const { text, json } = await readBody(response);
  if (!response.ok || !json?.access_token) {
    fail(
      `Failed to exchange the refresh token (HTTP ${response.status}). ` +
        `The token may be expired or revoked — re-run the OAuth flow in docs/RELEASING.md.\n${text}`,
    );
  }
  return json.access_token;
}

async function uploadPackage(token) {
  const response = await fetch(`${UPLOAD_API}/${extensionId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-api-version": "2",
      "Content-Type": "application/zip",
    },
    body: new Uint8Array(readFileSync(zipPath)),
  });

  const { text, json } = await readBody(response);
  if (!response.ok) {
    fail(`Upload failed (HTTP ${response.status}).\n${text}`);
  }
  return json ?? {};
}

/** The upload can settle asynchronously; poll the draft until it leaves IN_PROGRESS. */
async function waitForUpload(token, initial) {
  let state = initial;
  for (
    let attempt = 0;
    attempt < 20 && state.uploadState === "IN_PROGRESS";
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, 5000));
    const response = await fetch(`${API}/${extensionId}?projection=DRAFT`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-api-version": "2",
      },
    });
    const { text, json } = await readBody(response);
    if (!response.ok) {
      fail(`Failed to read draft status (HTTP ${response.status}).\n${text}`);
    }
    state = json ?? {};
    console.log(`  … uploadState=${state.uploadState}`);
  }
  return state;
}

async function publishItem(token) {
  const url = new URL(`${API}/${extensionId}/publish`);
  if (target !== "default") url.searchParams.set("publishTarget", target);

  // An explicit (possibly empty) body keeps Content-Length set, which the
  // publish endpoint requires.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-api-version": "2",
      "Content-Type": "application/json",
    },
    body:
      deployPercentage !== undefined
        ? JSON.stringify({ deployPercentage })
        : "",
  });

  const { text, json } = await readBody(response);
  if (!response.ok) {
    fail(`Publish failed (HTTP ${response.status}).\n${text}`);
  }
  return json ?? {};
}

// --------------------------------------------------------------------- main

const token = await getAccessToken();

console.log("\nUploading package…");
const upload = await waitForUpload(token, await uploadPackage(token));

if (upload.uploadState !== "SUCCESS") {
  fail(
    `Upload finished with uploadState=${upload.uploadState}.\n${formatItemErrors(upload)}`,
  );
}
console.log("Upload succeeded — draft updated.");

if (uploadOnly) {
  console.log(
    "\n--upload-only set: draft is saved but not submitted for review.",
  );
  process.exit(0);
}

console.log("\nSubmitting for review…");
const result = await publishItem(token);
const statuses = Array.isArray(result.status) ? result.status : [];
const details = Array.isArray(result.statusDetail) ? result.statusDetail : [];

for (const [i, status] of statuses.entries()) {
  console.log(`  ${status}${details[i] ? ` — ${details[i]}` : ""}`);
}

// OK and ITEM_PENDING_REVIEW are both successful submissions.
const ok = statuses.every((s) => s === "OK" || s === "ITEM_PENDING_REVIEW");
if (!ok) {
  fail(`Chrome Web Store rejected the publish request: ${statuses.join(", ")}`);
}

console.log(
  `\nSubmitted to the Chrome Web Store (${target}). ` +
    `It goes live once Google's review completes.`,
);
