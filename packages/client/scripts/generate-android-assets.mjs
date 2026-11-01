import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Generates the Android launcher icons and splash screens from `public/logo.svg`.
 *
 * `@capacitor/assets` is the usual tool, but it depends on `sharp`, which does
 * not install on every Windows box. Playwright is already a dev dependency and
 * renders the SVG identically, so this keeps the assets reproducible.
 */

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const clientDir = path.join(here, "..");
const resDir = path.join(clientDir, "android", "app", "src", "main", "res");
const sourceSvg = readFileSync(path.join(clientDir, "public", "logo.svg"), "utf8");

const BRAND = "#0d7a73";
const BRAND_DARK = "#005f5a";

const MARK_PATHS = `
  <path stroke-width="1.7" d="M12 20.6s-6.4-4-8.3-7.6C2.1 10.4 3.3 6.9 6.4 5.1c2.2-1.3 4.8-.6 5.6 1.7.8-2.3 3.4-3 5.6-1.7 3.1 1.8 4.3 5.3 2.7 7.9-1.9 3.6-8.3 7.6-8.3 7.6z"/>
  <path stroke-width="1.9" d="M5.5 12.5h3l1.5-3 2.3 6 1.9-3.6 1.3 1.9h2.2"/>
`;

/** The white mark alone, for adaptive-icon foregrounds and splash. */
function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <g transform="translate(8.8 7.2)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${MARK_PATHS}</g>
  </svg>`;
}

/** Full brand tile: mark on the teal rounded square. */
function tileSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BRAND}"/>
        <stop offset="100%" stop-color="${BRAND_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="9" fill="url(#g)"/>
    <g transform="translate(8.8 7.2)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${MARK_PATHS}</g>
  </svg>`;
}

/** Full brand tile with square corners, for round masks. */
function roundTileSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BRAND}"/>
        <stop offset="100%" stop-color="${BRAND_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" fill="url(#g)"/>
    <g transform="translate(8.8 7.2)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${MARK_PATHS}</g>
  </svg>`;
}

function dataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DENSITIES = [
  { bucket: "mdpi", scale: 1 },
  { bucket: "hdpi", scale: 1.5 },
  { bucket: "xhdpi", scale: 2 },
  { bucket: "xxhdpi", scale: 3 },
  { bucket: "xxxhdpi", scale: 4 },
];

/** Legacy launcher icon: 48dp. */
const LEGACY_DP = 48;
/** Adaptive foreground: 108dp canvas with the mark inside the 66dp safe zone. */
const FOREGROUND_DP = 108;
const FOREGROUND_MARK_RATIO = 0.55;

const SCREENSHOTS = [];

for (const { bucket, scale } of DENSITIES) {
  const legacy = Math.round(LEGACY_DP * scale);
  SCREENSHOTS.push(
    { dir: `mipmap-${bucket}`, file: "ic_launcher.png", size: legacy, svg: tileSvg(), radius: 0 },
    {
      dir: `mipmap-${bucket}`,
      file: "ic_launcher_round.png",
      size: legacy,
      svg: roundTileSvg(),
      radius: 0.5,
    },
    {
      dir: `mipmap-${bucket}`,
      file: "ic_launcher_foreground.png",
      size: Math.round(FOREGROUND_DP * scale),
      svg: markSvg(),
      radius: 0,
      markRatio: FOREGROUND_MARK_RATIO,
      transparent: true,
    }
  );
}

/**
 * Splash artwork mirrors the buckets Capacitor scaffolds: portrait, landscape
 * and the orientation-agnostic fallback.
 */
const SPLASHES = [
  { dir: "drawable", width: 480, height: 320 },
  { dir: "drawable-land-mdpi", width: 320, height: 480 },
  { dir: "drawable-land-hdpi", width: 480, height: 800 },
  { dir: "drawable-land-xhdpi", width: 720, height: 1280 },
  { dir: "drawable-land-xxhdpi", width: 960, height: 1600 },
  { dir: "drawable-land-xxxhdpi", width: 1280, height: 1920 },
  { dir: "drawable-port-mdpi", width: 320, height: 480 },
  { dir: "drawable-port-hdpi", width: 480, height: 800 },
  { dir: "drawable-port-xhdpi", width: 720, height: 1280 },
  { dir: "drawable-port-xxhdpi", width: 960, height: 1600 },
  { dir: "drawable-port-xxxhdpi", width: 1280, height: 1920 },
];

for (const splash of SPLASHES) {
  const logoSize = Math.round(Math.min(splash.width, splash.height) * 0.28);
  SCREENSHOTS.push({
    dir: splash.dir,
    file: "splash.png",
    size: null,
    width: splash.width,
    height: splash.height,
    svg: markSvg(),
    logoSize,
    background: `linear-gradient(180deg, ${BRAND}, ${BRAND_DARK})`,
  });
}

const browser = await chromium.launch({ channel: "msedge" });
try {
  for (const shot of SCREENSHOTS) {
    const width = shot.width ?? shot.size;
    const height = shot.height ?? shot.size;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const logoSize = shot.logoSize ?? Math.round(width * (shot.markRatio ?? 1));
    await page.setContent(`
      <style>
        html, body { margin: 0; height: 100%; }
        body {
          display: flex; align-items: center; justify-content: center;
          background: ${shot.background ?? "transparent"};
          border-radius: ${shot.radius ? "50%" : "0"};
          overflow: hidden;
        }
        img { width: ${logoSize}px; height: ${logoSize}px; display: block; }
      </style>
      <img src="${dataUri(shot.svg)}" alt="" />
    `);
    await page.screenshot({
      path: path.join(resDir, shot.dir, shot.file),
      omitBackground: shot.transparent === true,
    });
    await page.close();
    console.log("wrote", path.join(shot.dir, shot.file), `${width}x${height}`);
  }
} finally {
  await browser.close();
}

console.log("source logo:", sourceSvg.length, "bytes");
