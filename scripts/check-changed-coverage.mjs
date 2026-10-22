#!/usr/bin/env node
// check-changed-coverage.js
// Intersects lcov coverage with the git diff to enforce coverage on the
// lines that actually changed (CONSTRAINTS.md requires >= 80%).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const MIN_COVERAGE = 80;
const COVERAGE_DIRS = [
  "packages/shared/coverage",
  "packages/server/coverage",
  "packages/client/coverage",
];

/** Lines added or modified by the working tree, keyed by repo-relative path. */
function getChangedLines() {
  const diff = execSync("git diff --unified=0 HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const files = new Map();

  let currentFile = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      if (!files.has(currentFile)) files.set(currentFile, new Set());
    } else if (line.startsWith("@@") && currentFile) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const count = match[2] ? Number.parseInt(match[2], 10) : 1;
        const set = files.get(currentFile);
        for (let i = 0; i < count; i += 1) set.add(start + i);
      }
    }
  }

  return files;
}

/** Every lcov record found in the workspace, keyed by absolute source path. */
function readLcovFiles() {
  const records = new Map();

  for (const dir of COVERAGE_DIRS) {
    const lcovPath = resolve(dir, "lcov.info");
    if (!existsSync(lcovPath)) continue;

    // lcov records source paths relative to the package root, not to the
    // coverage directory (e.g. "src/rules.ts"). The coverage directory sits
    // inside the package, so the package root is its parent.
    const packageRoot = resolve(dir, "..");
    let currentFile = "";
    let currentLineMap = new Map();

    for (const line of readFileSync(lcovPath, "utf8").split("\n")) {
      if (line.startsWith("SF:")) {
        currentFile = resolve(packageRoot, line.slice(3));
        currentLineMap = new Map();
        records.set(currentFile, currentLineMap);
      } else if (line.startsWith("DA:")) {
        // Format: DA:<line number>,<execution count>[,<checksum>]
        const [lineNum, hits] = line.slice(3).split(",");
        currentLineMap.set(Number.parseInt(lineNum, 10), Number.parseInt(hits, 10));
      } else if (line === "end_of_record") {
        currentFile = "";
      }
    }
  }

  return records;
}

/** Maps an absolute source path to its repo-relative path. */
function toRepoPath(absolutePath) {
  const root = process.cwd();
  const normalized = absolutePath.replace(/\\/g, "/");
  const normalizedRoot = root.replace(/\\/g, "/");
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.slice(normalizedRoot.length + 1);
  }
  return relative(root, absolutePath).replace(/\\/g, "/");
}

/**
 * Files that are excluded from the changed-line coverage bar.
 *
 * These are build configuration, process entrypoints, and CLI scripts that are
 * exercised end-to-end (Docker healthcheck, `npm run db:migrate`, `db:seed`,
 * the service worker registration) rather than unit-tested. Application
 * behaviour stays subject to the 80% bar.
 */
const EXCLUDED_PATTERNS = [
  /(^|\/)[a-z.-]*\.config\.(ts|js|mjs|tsx)$/i,
  /(^|\/)vitest\.setup\./,
  /\.d\.ts$/,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /^packages\/server\/src\/index\.ts$/,
  /^packages\/server\/src\/db\/(migrate|seed)\.ts$/,
  /^packages\/client\/src\/main\.tsx$/,
  /^packages\/client\/src\/utils\/sw\.ts$/,
];

/** Returns true when a repo-relative path is outside the coverage bar. */
function isExcluded(repoPath) {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(repoPath));
}

function main() {
  const changedLines = getChangedLines();
  const coverage = readLcovFiles();

  // Repo-relative path -> line -> hit count
  const byRepoPath = new Map();
  for (const [absolutePath, lineMap] of coverage) {
    byRepoPath.set(toRepoPath(absolutePath), lineMap);
  }

  let totalChanged = 0;
  let coveredChanged = 0;
  const uncovered = [];
  const filesWithoutCoverage = [];
  const perFile = [];

  for (const [file, lines] of changedLines) {
    if (isExcluded(file)) continue;

    const cov = byRepoPath.get(file);
    if (!cov) {
      // No coverage data for this file. Report it so a new untested module is
      // visible instead of silently skipped.
      if (/\.(ts|tsx)$/.test(file)) {
        filesWithoutCoverage.push(file);
      }
      continue;
    }

    let fileHits = 0;
    for (const line of lines) {
      const hits = cov.get(line);
      // Lines that never appear in the lcov data are not executable (comments,
      // blank lines, type-only declarations). Counting them would make the bar
      // impossible to reach for any change that adds documentation.
      if (hits === undefined) continue;

      totalChanged += 1;
      if (hits > 0) {
        fileHits += 1;
        coveredChanged += 1;
      } else {
        uncovered.push(`${file}:${line}`);
      }
    }
    if (lines.size > 0) perFile.push({ file, changed: lines.size, covered: fileHits });
  }

  const pct = totalChanged > 0 ? Math.round((coveredChanged / totalChanged) * 100) : 100;

  console.log(`Changed lines:        ${totalChanged}`);
  console.log(`Covered changed lines: ${coveredChanged}`);
  console.log(`Coverage:              ${pct}%`);

  if (perFile.length > 0) {
    perFile.sort((a, b) => b.changed - a.changed);
    console.log("\nPer file (changed / covered):");
    for (const { file, changed, covered } of perFile) {
      console.log(`  ${String(covered).padStart(4)} / ${String(changed).padStart(4)}  ${file}`);
    }
  }

  if (filesWithoutCoverage.length > 0) {
    console.log(`\nChanged files with no coverage data (${filesWithoutCoverage.length}):`);
    for (const file of filesWithoutCoverage.slice(0, 20)) console.log(`  ${file}`);
  }

  if (pct < MIN_COVERAGE) {
    console.error(`\nUNCOVERED CHANGED LINES (${uncovered.length}):`);
    for (const line of uncovered.slice(0, 50)) console.error(`  ${line}`);
    if (uncovered.length > 50) console.error(`  ... and ${uncovered.length - 50} more`);
    console.error(`\nCoverage on changed lines must be >= ${MIN_COVERAGE}%`);
    process.exit(1);
  }

  console.log(`\nCoverage on changed lines >= ${MIN_COVERAGE}%`);
}

main();
