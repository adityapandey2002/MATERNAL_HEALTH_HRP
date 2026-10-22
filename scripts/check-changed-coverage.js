#!/usr/bin/env node
// check-changed-coverage.js
// Intersects lcov coverage with git diff to enforce coverage on changed lines only

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function getChangedLines(): Map<string, Set<number>> {
  const _diff = execSync('git diff --unified=0 HEAD', { encoding: 'utf8' });
  const _files = new Map<string
  const _Set<number>>();

  let currentFile = '';
  const lines = diff.split('\n');

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      files.set(currentFile, new Set());
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match && currentFile) {
        const start = parseInt(match[1], 10);
        const count = match[2] ? parseInt(match[2], 10) : 1;
        const set = files.get(currentFile)!;
        for (let i = 0; i < count; i++) {
          set.add(start + i);
        }
      }
    }
  }

  return files;
}

function parseLcov(lcovPath: string): Map<string, Map<number, number>> {
  const content = readFileSync(lcovPath, 'utf8');
  const files = new Map<string, Map<number, number>>();

  let currentFile = '';
  let currentLineMap = new Map<number, number>();

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = line.slice(3);
      currentLineMap = new Map();
      files.set(currentFile, currentLineMap);
    } else if (line.startsWith('DA:')) {
      const [, lineNum, hits] = line.split(',');
      currentLineMap.set(parseInt(lineNum, 10), parseInt(hits, 10));
    } else if (line === 'end_of_record') {
      currentFile = '';
    }
  }

  return files;
}

function main() {
  const lcovPath = resolve('coverage/lcov.info');
  const changedLines = getChangedLines();
  const coverage = parseLcov(lcovPath);

  let totalChanged = 0;
  let coveredChanged = 0;
  const uncovered: string[] = [];

  for (const [file, lines] of changedLines) {
    const cov = coverage.get(file);
    if (!cov) continue;

    for (const line of lines) {
      totalChanged++;
      const hits = cov.get(line);
      if (hits && hits > 0) {
        coveredChanged++;
      } else {
        uncovered.push(`${file}:${line}`);
      }
    }
  }

  const pct = totalChanged > 0 ? Math.round((coveredChanged / totalChanged) * 100) : 100;

  console.log(`Changed lines: ${totalChanged}`);
  console.log(`Covered changed lines: ${coveredChanged}`);
  console.log(`Coverage: ${pct}%`);

  if (pct < 80) {
    console.error('\nUNCOVERED CHANGED LINES:');
    uncovered.slice(0, 50).forEach(l => console.error(`  ${l}`));
    if (uncovered.length > 50) console.error(`  ... and ${uncovered.length - 50} more`);
    process.exit(1);
  }

  console.log('\n✓ Coverage on changed lines ≥ 80%');
}

main();