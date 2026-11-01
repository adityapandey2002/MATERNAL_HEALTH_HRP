import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const publicDir = path.join(here, "..", "public");
const svg = readFileSync(path.join(publicDir, "logo.svg"), "utf8");

const targets = [
  { file: "pwa-192x192.png", size: 192, maskable: false },
  { file: "pwa-512x512.png", size: 512, maskable: false },
  { file: "maskable-icon-512x512.png", size: 512, maskable: true },
  { file: "apple-touch-icon-180x180.png", size: 180, maskable: false },
];

const browser = await chromium.launch({ channel: "msedge" });
for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  const logoSize = target.maskable ? Math.round(target.size * 0.8) : target.size;
  const background = target.maskable ? "#0d7a73" : "transparent";
  await page.setContent(`
    <style>
      html, body { margin: 0; height: 100%; background: ${background}; }
      body { display: flex; align-items: center; justify-content: center; }
      img { width: ${logoSize}px; height: ${logoSize}px; display: block; }
    </style>
    <img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" alt="" />
  `);
  await page.screenshot({
    path: path.join(publicDir, target.file),
    omitBackground: !target.maskable,
  });
  await page.close();
  console.log("wrote", target.file);
}
await browser.close();
