import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = "http://localhost:5173";
const routes = [
  "/",
  "/dashboard",
  "/follow-ups",
  "/referrals",
  "/supervision",
  "/settings",
  "/patients/new",
  "/patients/23beaf51-e87d-4e92-bbc2-46bd7f68e8f5",
];

const executablePath = join(
  homedir(),
  "AppData",
  "Local",
  "ms-playwright",
  "chromium-1243",
  "chrome-win64",
  "chrome.exe"
);

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(`${base}/login`);
await page.getByLabel(/employee/i).fill("ANM001");
await page.getByLabel(/password/i).fill("password123");
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(`${base}/`);

const results = [];
for (const route of routes) {
  await page.goto(`${base}${route}`);
  await page.waitForLoadState("networkidle");
  await page.addScriptTag({
    path: join(import.meta.dirname, "..", "..", "node_modules", "axe-core", "axe.min.js"),
  });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target.join(" "),
        html: n.html.slice(0, 120),
        summary: n.failureSummary?.split("\n").slice(0, 2).join(" "),
      })),
    }));
  });
  results.push({ route, violations });
}

await browser.close();
const totals = results.map((r) => `${r.route}: ${r.violations.length} violation type(s), ${r.violations.reduce((n, v) => n + v.nodes.length, 0)} node(s)`);
console.log(totals.join("\n"));
console.log("\nDETAIL\n" + JSON.stringify(results, null, 2));
console.log("\nCONSOLE ERRORS\n" + [...new Set(consoleErrors)].join("\n"));
