#!/usr/bin/env node

/**
 * Version bump helper.
 *
 * Usage:
 *   node scripts/version.mjs <patch|minor|major> [--dry-run]
 *
 * Reads the current version from package.json, calculates the new version,
 * writes it back, and prints the new version to stdout.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "..", "package.json");

const BUMP_TYPES = ["patch", "minor", "major"];

const bumpType = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!bumpType || !BUMP_TYPES.includes(bumpType)) {
  console.error(`Usage: node scripts/version.mjs <${BUMP_TYPES.join("|")}> [--dry-run]`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

let newVersion;
switch (bumpType) {
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case "patch":
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

if (dryRun) {
  console.log(`${pkg.version} → ${newVersion}`);
  process.exit(0);
}

pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
// Print just the version so the workflow can capture it
console.log(newVersion);
