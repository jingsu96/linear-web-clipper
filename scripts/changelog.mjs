#!/usr/bin/env node

/**
 * Changelog generator — zero dependencies.
 *
 * Usage:
 *   node scripts/changelog.mjs [version] [--dry-run]
 *
 * Parses conventional commits since the last git tag and groups them.
 * Outputs markdown to stdout. Without --dry-run, also prepends to CHANGELOG.md.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const changelogPath = resolve(root, "CHANGELOG.md");

const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!version) {
  console.error("Usage: node scripts/changelog.mjs <version> [--dry-run]");
  process.exit(1);
}

function exec(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

// Find the previous tag to scope the log
const lastTag = exec("git describe --tags --abbrev=0 2>/dev/null");
const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
const rawLog = exec(`git log ${range} --pretty=format:"%s" --no-merges`);

if (!rawLog) {
  console.error("No commits found since last tag.");
  process.exit(0);
}

const TYPE_MAP = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance",
  refactor: "Refactors",
  docs: "Documentation",
  chore: "Chores",
  style: "Styles",
  test: "Tests",
  ci: "CI",
  build: "Build",
};

const groups = {};

for (const line of rawLog.split("\n")) {
  const match = line.match(/^(\w+)(?:\(.+?\))?:\s*(.+)$/);
  if (match) {
    const [, type, message] = match;
    const heading = TYPE_MAP[type] || "Other";
    (groups[heading] ??= []).push(message.charAt(0).toUpperCase() + message.slice(1));
  } else {
    (groups["Other"] ??= []).push(line.charAt(0).toUpperCase() + line.slice(1));
  }
}

const date = new Date().toISOString().slice(0, 10);
const lines = [`## [${version}] - ${date}`, ""];

// Render in a stable order: Features first, Fixes second, then alphabetical
const ORDER = ["Features", "Bug Fixes", "Performance"];
const sortedHeadings = [
  ...ORDER.filter((h) => groups[h]),
  ...Object.keys(groups)
    .filter((h) => !ORDER.includes(h))
    .sort(),
];

for (const heading of sortedHeadings) {
  lines.push(`### ${heading}`, "");
  for (const msg of groups[heading]) {
    lines.push(`- ${msg}`);
  }
  lines.push("");
}

const entry = lines.join("\n");

if (dryRun) {
  console.log(entry);
  process.exit(0);
}

// Prepend to CHANGELOG.md
let existing = "";
if (existsSync(changelogPath)) {
  existing = readFileSync(changelogPath, "utf-8");
}

const header = "# Changelog\n\n";
const body = existing.startsWith("# Changelog")
  ? existing.replace(/^# Changelog\n+/, "")
  : existing;

writeFileSync(changelogPath, header + entry + body, "utf-8");

// Also print to stdout for the workflow to capture as release notes
console.log(entry);
