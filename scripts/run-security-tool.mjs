#!/usr/bin/env node
// run-security-tool.mjs
// Runs a CI-only security scanner (semgrep, osv-scanner) when it is installed.
//
// CONSTRAINTS.md marks these scanners as "CI (review)". They are not npm
// packages, so developers do not have them by default. Locally we skip with an
// explicit message; in CI (CI=true) a missing scanner is a hard failure so a
// misconfigured pipeline cannot silently drop the security gate.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const [tool, ...args] = process.argv.slice(2);

if (!tool) {
  console.error("usage: node scripts/run-security-tool.mjs <tool> [...args]");
  process.exit(2);
}

function findExecutable(name) {
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);

  for (const extension of extensions) {
    const local = resolve("node_modules", ".bin", `${name}${extension}`);
    if (existsSync(local)) return local;
  }

  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

const executable = findExecutable(tool);

if (!executable) {
  const message = `${tool} is not installed. It runs in CI (see CONSTRAINTS.md).`;

  if (process.env.CI) {
    console.error(`\n[security] FAILED: ${message}`);
    console.error("Install it in the CI job before running this gate.");
    process.exit(1);
  }

  console.warn(`\n[security] skipping ${tool}: ${message}`);
  process.exit(0);
}

const result = spawnSync(executable, args, { stdio: "inherit" });

if (result.error) {
  console.error(`[security] failed to run ${tool}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
