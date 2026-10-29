#!/usr/bin/env node
// Guards the server against subpath imports that TypeScript and Vitest resolve
// through path aliases but Node cannot resolve at runtime. `@hrp/shared/rules.js`
// compiled fine and passed tests, then crashed the production container with
// ERR_PACKAGE_PATH_NOT_EXPORTED because the package "exports" map only lists
// "./rules".
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packagesToCheck = ["packages/server/src", "packages/client/src"];

const sharedPkg = JSON.parse(
  await readFile(path.join(root, "packages/shared/package.json"), "utf8")
);
const exportedSubpaths = new Set(
  Object.keys(sharedPkg.exports ?? {}).map((key) => (key === "." ? "" : key.replace(/^\.\//, "")))
);

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name))
      files.push(full);
  }
  return files;
}

const failures = [];

for (const pkg of packagesToCheck) {
  let files;
  try {
    files = await collect(path.join(root, pkg));
  } catch {
    continue;
  }
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/["'](@hrp\/shared\/[^"']+)["']/g)) {
      const subpath = match[1].replace("@hrp/shared/", "");
      if (!exportedSubpaths.has(subpath)) {
        failures.push(`${path.relative(root, file)}: "${match[1]}" is not exported by @hrp/shared`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Unresolvable @hrp/shared subpath imports:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`\nExported subpaths: ${[...exportedSubpaths].map((s) => `./${s}`).join(", ")}`);
  process.exit(1);
}

console.log("All @hrp/shared subpath imports resolve to a package export.");
