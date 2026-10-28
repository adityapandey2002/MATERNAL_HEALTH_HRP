import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173";

const facility = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "HSC_PASUNJ",
  name: "Pasunj HSC",
  level: "HSC",
  parentId: null,
  path: "INDIA.BIHAR.ARARIA.PASUNJ.HSC_PASUNJ",
  state: "Bihar",
  district: "Araria",
  block: "Pasunj",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const bhm = {
  id: "99999999-9999-4999-8999-999999999999",
  employeeId: "ADM001",
  name: "Ravi Prasad",
  phone: "9988776655",
  role: "BHM",
  facilityId: facility.id,
  language: "en",
  isActive: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const patients = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    abhaId: null,
    facilityId: facility.id,
    registeredBy: bhm.id,
    anmName: "Asha Ben",
    name: "Rekha Devi",
    age: 26,
    phone: "9988776655",
    address: "Pasunj",
    hrpReason: "PREVIOUS_C_SECTION",
    hrpComplication: null,
    ashaName: "Sunita Devi",
    ashaPhone: "9876543210",
    referred: true,
    isHrp: true,
    followUpTrack: null,
    followUpScheduledDate: null,
    followUpStatus: "PENDING",
    lmp: "2026-05-20T00:00:00.000Z",
    edd: "2027-02-24T00:00:00.000Z",
    gravida: 2,
    para: 1,
    abortions: 0,
    riskFactors: ["HYPERTENSION"],
    riskLevel: "RED",
    riskScore: 65,
    isHighRisk: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

function json(body) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
}

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
await context.addInitScript(() => localStorage.setItem("accessToken", "visual-token"));
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
await page.route("**/api/**", async (route) => {
  const p = new URL(route.request().url()).pathname;
  console.log("REQ", p);
  if (p === "/api/auth/me") return route.fulfill(json(bhm));
  if (p === "/api/facilities") return route.fulfill(json([facility]));
  if (p === "/api/patients") return route.fulfill(json({ data: patients, total: 1, page: 1, limit: 20 }));
  if (p === "/api/visits") return route.fulfill(json({ data: [], total: 0, page: 1, limit: 100 }));
  if (p === "/api/supervision/alerts") return route.fulfill(json({ data: [], total: 0 }));
  return route.fulfill(json({}));
});
console.log("goto");
await page.goto(`${BASE}/patients`, { waitUntil: "domcontentloaded", timeout: 20000 });
console.log("loaded");
await page.waitForTimeout(1500);
console.log("text:", (await page.locator("body").innerText()).slice(0, 400));
await page.screenshot({ path: "C:/Users/ADITYA/AppData/Local/Temp/opencode/hrp-visual/probe-768-patients-bhm.png", fullPage: true });
console.log("shot done");
await browser.close();
