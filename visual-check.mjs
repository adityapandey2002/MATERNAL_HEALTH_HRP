import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:4173";
const OUT = "C:/Users/ADITYA/AppData/Local/Temp/opencode/hrp-visual";
fs.mkdirSync(OUT, { recursive: true });

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

const anm = {
  id: "33333333-3333-4333-8333-333333333333",
  employeeId: "ANM001",
  name: "Asha Ben",
  phone: "9988776655",
  role: "ANM",
  facilityId: facility.id,
  language: "en",
  isActive: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const cho = { ...anm, id: "55555555-5555-4555-8555-555555555555", employeeId: "CHO001", name: "Dr Meera Kumari", role: "CHO" };
const bhm = { ...anm, id: "99999999-9999-4999-8999-999999999999", employeeId: "ADM001", name: "Ravi Prasad", role: "BHM" };

function patient(id, name, age, riskLevel, riskScore, hrpReason, extra = {}) {
  return {
    id,
    abhaId: null,
    facilityId: facility.id,
    registeredBy: anm.id,
    anmName: "Asha Ben",
    name,
    age,
    phone: "9988776655",
    address: "Pasunj village, Araria",
    hrpReason,
    hrpComplication: null,
    ashaName: "Sunita Devi",
    ashaPhone: "9876543210",
    referred: riskLevel === "RED",
    isHrp: true,
    followUpTrack: null,
    followUpScheduledDate: null,
    followUpStatus: "PENDING",
    lmp: "2026-05-20T00:00:00.000Z",
    edd: "2027-02-24T00:00:00.000Z",
    gravida: 2,
    para: 1,
    abortions: 0,
    riskFactors: riskLevel === "RED" ? ["HYPERTENSION", "SEVERE_ANEMIA"] : [],
    riskLevel,
    riskScore,
    isHighRisk: riskLevel !== "GREEN",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

const patients = [
  patient("11111111-1111-4111-8111-111111111111", "Rekha Devi", 26, "RED", 65, "PREVIOUS_C_SECTION"),
  patient("11111111-1111-4111-8111-111111111112", "Sita Kumari", 23, "AMBER", 35, "ANEMIA"),
  patient("11111111-1111-4111-8111-111111111113", "Phoolmati Devi", 31, "GREEN", 10, "MULTI_GRAVIDA"),
  patient("11111111-1111-4111-8111-111111111114", "Nirmala Yadav", 19, "RED", 70, "TEENAGE_PREGNANCY"),
];

const visits = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    patientId: patients[0].id,
    facilityId: facility.id,
    conductedBy: anm.id,
    visitNumber: 1,
    gestationalWeeks: 14,
    visitDate: "2026-09-02T00:00:00.000Z",
    bpSystolic: 148,
    bpDiastolic: 96,
    hb: 8.4,
    weight: 54,
    fundalHeight: null,
    fetalHeartRate: 142,
    dangerSigns: ["HYPERTENSION"],
    ifaGiven: true,
    calciumGiven: true,
    albendazoleGiven: false,
    referred: false,
    referralReason: null,
    referralFacilityId: null,
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444442",
    patientId: patients[0].id,
    facilityId: facility.id,
    conductedBy: anm.id,
    visitNumber: 2,
    gestationalWeeks: 22,
    visitDate: "2026-10-20T00:00:00.000Z",
    bpSystolic: 152,
    bpDiastolic: 100,
    hb: 7.8,
    weight: 57,
    fundalHeight: 24,
    fetalHeartRate: 138,
    dangerSigns: ["HYPERTENSION", "SEVERE_ANEMIA"],
    ifaGiven: true,
    calciumGiven: true,
    albendazoleGiven: false,
    referred: true,
    referralReason: "Severe pre-eclampsia with anaemia",
    referralFacilityId: null,
    notes: "Referred to CHC Araria",
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
];

const referrals = [
  {
    id: "66666666-6666-4666-8666-666666666661",
    patientId: patients[0].id,
    fromFacilityId: facility.id,
    toFacilityId: "77777777-7777-4777-8777-777777777771",
    referredBy: anm.id,
    reason: "Severe pre-eclampsia with anaemia",
    urgency: "RED",
    status: "PENDING",
    respondedAt: null,
    respondedBy: null,
    createdAt: "2026-10-20T09:30:00.000Z",
    updatedAt: "2026-10-20T09:30:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666662",
    patientId: patients[1].id,
    fromFacilityId: facility.id,
    toFacilityId: "77777777-7777-4777-8777-777777777771",
    referredBy: anm.id,
    reason: "Moderate anaemia, needs Hb recheck",
    urgency: "AMBER",
    status: "ACCEPTED",
    respondedAt: "2026-10-21T10:00:00.000Z",
    respondedBy: cho.id,
    createdAt: "2026-10-19T11:00:00.000Z",
    updatedAt: "2026-10-21T10:00:00.000Z",
  },
];

const alerts = [
  {
    id: "88888888-8888-4888-8888-888888888881",
    facilityId: facility.id,
    type: "HIGH_RISK_UNATTENDED",
    severity: "RED",
    message: "Rekha Devi (RED risk) has not had a follow-up visit in 14 days",
    relatedEntityId: patients[0].id,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: "2026-10-27T08:00:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888882",
    facilityId: facility.id,
    type: "ANM_OFFLINE",
    severity: "AMBER",
    message: "ANM Asha Ben has not synced data for 3 days",
    relatedEntityId: anm.id,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: "2026-10-26T08:00:00.000Z",
  },
];

function json(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function routeApi(page, role) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const me = role === "CHO" ? cho : role === "BHM" ? bhm : anm;

    if (p === "/api/auth/me") return route.fulfill(json(me));
    if (p === "/api/facilities") return route.fulfill(json([facility]));
    if (p === "/api/patients") return route.fulfill(json({ data: patients, total: patients.length, page: 1, limit: 20 }));
    if (p.startsWith("/api/patients/")) return route.fulfill(json(patients.find((x) => p.endsWith(x.id)) ?? patients[0]));
    if (p === "/api/visits") return route.fulfill(json({ data: visits, total: visits.length, page: 1, limit: 100 }));
    if (p.startsWith("/api/visits/by-patient/")) return route.fulfill(json(visits));
    if (p === "/api/referrals") return route.fulfill(json({ data: referrals, total: referrals.length }));
    if (p === "/api/supervision/alerts") return route.fulfill(json({ data: alerts, total: alerts.length }));
    return route.fulfill(json({}));
  });
}

const pages = [
  { name: "dashboard", path: "/", role: "ANM" },
  { name: "dashboard-cho", path: "/", role: "CHO" },
  { name: "dashboard-bhm", path: "/", role: "BHM" },
  { name: "patients-bhm", path: "/patients", role: "BHM" },
  { name: "patients", path: "/patients", role: "CHO" },
  { name: "patient-detail", path: `/patients/${patients[0].id}`, role: "ANM" },
  { name: "new-visit", path: `/patients/${patients[0].id}/visit`, role: "ANM" },
  { name: "add-patient", path: "/patients/new", role: "ANM" },
  { name: "follow-ups", path: "/follow-ups", role: "ANM" },
  { name: "referrals", path: "/referrals", role: "CHO" },
  { name: "supervision", path: "/supervision", role: "CHO" },
  { name: "settings", path: "/settings", role: "ANM" },
];

const viewports = [
  { name: "320", width: 320, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ channel: "msedge" });
const errors = [];

for (const vp of viewports) {
  for (const spec of pages) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    await context.addInitScript(() => localStorage.setItem("accessToken", "visual-token"));
    const page = await context.newPage();
    page.on("pageerror", (err) => errors.push(`${vp.name} ${spec.name}: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`${vp.name} ${spec.name} console: ${msg.text()}`);
    });
    await routeApi(page, spec.role);
    await page.goto(`${BASE}${spec.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-${spec.name}.png`), fullPage: true });
    await context.close();
  }
}

// Login screen has no session.
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => route.fulfill(json({ message: "Unauthorized" })));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-login.png`), fullPage: true });
  await context.close();
}

// Offline screen.
for (const vp of [{ name: "320", width: 320, height: 800 }, { name: "1440", width: 1440, height: 900 }]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, offline: true });
  await context.addInitScript(() => {
    localStorage.setItem("accessToken", "visual-token");
    localStorage.setItem("lastSyncTime", String(Date.now() - 3600_000));
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-offline.png`), fullPage: true });
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "errors.txt"), errors.join("\n"));
console.log(`Screenshots: ${fs.readdirSync(OUT).length}`);
console.log(errors.length ? `Errors:\n${errors.join("\n")}` : "No page errors");
