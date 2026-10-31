#!/usr/bin/env node
// Guards the Matru Suraksha rebrand and the 15-day follow-up model.
//
// The old product name, the retired roles and the three-track follow-up engine
// were removed in one sweep. Without a gate they creep back in through copy
// pasted from old docs, seed fixtures or stale branches. This check fails the
// build when a retired identifier reappears in live code or current docs.
//
// Migrations and the supersession spec are allowed to mention the old values:
// they exist precisely to rewrite or document them.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Retired identifier -> why it must not come back. */
const RETIRED = [
  ["IMMEDIATE_7_DAYS", "the 7-day track was replaced by the 15-day cycle"],
  ["PMSMA_SESSION", "the PMSMA track was replaced by the 15-day cycle"],
  ["VHSND_COMMUNITY", "the VHSND track was replaced by the 15-day cycle"],
  ["getNextPmsmaDate", "PMSMA scheduling was replaced by the 15-day cycle"],
  ["getNextVhsndDate", "VHSND scheduling was replaced by the 15-day cycle"],
  ["High-Risk Pregnancy Tracking", 'the product is called "Matru Suraksha"'],
  ["HRP Tracking", 'the product is called "Matru Suraksha"'],
];

/** Bare `HELPDESK` as a role value or type, but not HRP_HELPDESK_BLOCK/DISTRICT. */
const BARE_HELPDESK = /(?<![A-Z_])HELPDESK(?![A-Z_])/;

/** Paths allowed to name retired identifiers. */
const ALLOWED = [
  /packages[\\/]server[\\/]migrations[\\/]/,
  /packages[\\/]server[\\/]src[\\/]db[\\/]seed\.ts$/, // historical demo rows are rewritten by 007
  /docs[\\/]specs[\\/]SPEC-matru-suraksha-roles-and-follow-up\.md$/,
  /docs[\\/]decisions[\\/]/, // ADRs are historical records
  /docs[\\/]ideas[\\/]/, // product briefs are historical records
  /docs[\\/]specs[\\/]SPEC-referral-workflow\.md$/, // superseded banner names the old workflow
  /scripts[\\/]check-retired-identifiers\.mjs$/, // this file names them
];

const SCAN_ROOTS = [
  "packages/shared/src",
  "packages/server/src",
  "packages/client/src",
  "packages/client/index.html",
  "packages/client/public/manifest.json",
  "packages/client/vite.config.ts",
  "README.md",
  "docs/STARTUP.md",
  "docs/specs/CAPABILITY-MAP.md",
];

const TEXT_FILE = /\.(ts|tsx|mts|js|mjs|json|html|md|css)$/;

async function collect(target) {
  const full = path.join(root, target);
  const entries = await readdir(full, { withFileTypes: true }).catch(() => null);
  if (!entries) return TEXT_FILE.test(full) ? [full] : [];
  const files = [];
  for (const entry of entries) {
    const child = path.join(full, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await collect(path.relative(root, child))));
    } else if (TEXT_FILE.test(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

function isAllowed(relativePath) {
  return ALLOWED.some((pattern) => pattern.test(relativePath));
}

const files = [...new Set((await Promise.all(SCAN_ROOTS.map(collect))).flat())];
const failures = [];

for (const file of files) {
  const relativePath = path.relative(root, file);
  if (isAllowed(relativePath)) continue;

  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [token, reason] of RETIRED) {
      if (line.includes(token)) {
        failures.push(`${relativePath}:${index + 1}: "${token}" — ${reason}`);
      }
    }
    if (BARE_HELPDESK.test(line)) {
      failures.push(
        `${relativePath}:${index + 1}: bare "HELPDESK" — use HRP_HELPDESK_BLOCK or HRP_HELPDESK_DISTRICT`
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Retired identifiers found in live code or current docs:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nSee docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md for the current model."
  );
  process.exit(1);
}

console.log(`No retired identifiers in ${files.length} scanned files.`);
