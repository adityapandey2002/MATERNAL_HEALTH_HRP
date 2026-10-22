#!/usr/bin/env node
/**
 * Local secret scanner.
 *
 * CONSTRAINTS.md puts gitleaks in CI only, so this script provides the same
 * floor locally without an external binary. It scans the tracked working tree
 * for patterns that indicate a committed credential, and ignores the obvious
 * placeholders that appear in seed data, fixtures and documentation.
 *
 * Usage: node scripts/scan-secrets.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Patterns that indicate a real credential leaking into the repository. */
const RULES = [
  { name: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: "AWS secret access key",
    pattern: /\baws_secret_access_key\s*[:=]\s*["'][^"']{40}["']/gi,
  },
  {
    name: "Private key block",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { name: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "Stripe live secret key", pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { name: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/g },
  {
    name: "JSON web token",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: "Generic assigned secret",
    pattern:
      /\b(?:api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|password|passwd)\b\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
    capture: 1,
  },
];

/** Values that are clearly placeholders and must not be reported. */
const PLACEHOLDER = [
  /^password123$/i,
  /^dev-secret/i,
  /^change[-_]?me/i,
  /^placeholder/i,
  /^example/i,
  /^your[-_]/i,
  /^xxx+$/i,
  /^\$\{/,
  /^<[^>]+>$/,
  /^process\.env/,
  /^redacted$/i,
  /^\*+$/,
  /^dummy/i,
  /^test[-_]/i,
  /^mock[-_]/i,
  /^fake[-_]/i,
  /^sample/i,
  /^xxxx/i,
  /^TODO/i,
  /^replace[-_]/i,
  /^\$\{?[A-Z_]+\}?$/,
];

function isPlaceholder(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER.some((pattern) => pattern.test(trimmed));
}

function listTrackedFiles() {
  const output = execSync("git ls-files", { encoding: "utf8" });
  return output.split("\n").filter(Boolean);
}

function isBinary(path) {
  try {
    const buffer = readFileSync(path);
    return buffer.includes(0);
  } catch {
    return true;
  }
}

const findings = [];

for (const file of listTrackedFiles()) {
  if (file.includes("node_modules") || file.startsWith("dist/")) continue;
  if (isBinary(file)) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match = pattern.exec(content);
    while (match !== null) {
      const value = rule.capture ? match[rule.capture] : match[0];
      if (!isPlaceholder(value)) {
        const line = content.slice(0, match.index).split("\n").length;
        findings.push({ file, line, rule: rule.name });
      }
      match = pattern.exec(content);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found:\n");
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  ${finding.rule}`);
  }
  console.error(`\n${findings.length} finding(s). Remove the secret and rotate it.`);
  process.exit(1);
}

console.log("No secrets detected in tracked files");
