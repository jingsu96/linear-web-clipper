/**
 * Copy Readability.js from the @mozilla/readability npm package into public/
 * so the injected copy always matches the installed dependency version.
 * Runs automatically as part of `pnpm build`.
 */
import { copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(
  root,
  "node_modules/@mozilla/readability/Readability.js",
);
const dest = path.join(root, "public/Readability.js");

const pkg = JSON.parse(
  readFileSync(
    path.join(root, "node_modules/@mozilla/readability/package.json"),
    "utf8",
  ),
);

copyFileSync(source, dest);
console.log(
  `Synced public/Readability.js from @mozilla/readability@${pkg.version}`,
);
