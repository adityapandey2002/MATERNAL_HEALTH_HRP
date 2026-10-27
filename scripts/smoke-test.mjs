/**
 * End-to-end smoke test against a running stack.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                 # direct API on :3000
 *   node scripts/smoke-test.mjs --via-proxy     # through the Vite proxy on :5173
 *
 * Requires the API to be running and the database to be migrated and seeded.
 */

import http from "node:http";

const useProxy = process.argv.includes("--via-proxy");
const port = useProxy ? 5173 : 3000;
const base = { hostname: "127.0.0.1", port };
const json = { "Content-Type": "application/json" };

let failures = 0;

function ok(label, condition, detail = "") {
  if (!condition) failures += 1;
  const mark = condition ? "PASS" : "FAIL";
  console.log(`${mark}  ${label.padEnd(44)} ${detail}`);
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let payload = "";
      res.on("data", (chunk) => {
        payload += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, body: payload, headers: res.headers }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const login = await request(
  { ...base, path: "/api/auth/login", method: "POST", headers: json },
  JSON.stringify({ employeeId: "ANM001", password: "password123" })
);
ok("login returns 200", login.status === 200, String(login.status));

const setCookie = login.headers["set-cookie"] ?? [];
ok(
  "login sets an httpOnly refresh cookie",
  setCookie.some((c) => c.includes("refreshToken") && c.includes("HttpOnly"))
);
ok("login body carries no refresh token", !login.body.includes("refreshToken"));

const token = JSON.parse(login.body).accessToken;
const auth = { ...json, Authorization: `Bearer ${token}` };

const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
const refreshed = await request(
  { ...base, path: "/api/auth/refresh", method: "POST", headers: { ...json, Cookie: cookie } },
  "{}"
);
ok("refresh works with the httpOnly cookie", refreshed.status === 200, String(refreshed.status));

const patients = await request({ ...base, path: "/api/patients", method: "GET", headers: auth });
const patientPayload = JSON.parse(patients.body);
ok("list patients returns 200", patients.status === 200, String(patients.status));
ok("patient payload is camelCase", "riskLevel" in (patientPayload.data?.[0] ?? {}));

const search = await request({
  ...base,
  path: "/api/patients?search=Rekha",
  method: "GET",
  headers: auth,
});
ok("search by name works", search.status === 200, String(search.status));
ok("search narrows the result", JSON.parse(search.body).total === 1);

const facilities = await request({
  ...base,
  path: "/api/facilities",
  method: "GET",
  headers: auth,
});
ok(
  "facility hierarchy is linked",
  JSON.parse(facilities.body).some((f) => f.parentId !== null)
);

const created = await request(
  { ...base, path: "/api/patients", method: "POST", headers: auth },
  JSON.stringify({
    name: "Smoke Test Patient",
    age: 27,
    phone: "9000000000",
    address: "Test Address",
    hrpReason: "PREVIOUS_C_SECTION",
    ashaName: "Smoke ASHA",
    ashaPhone: "9000000001",
    referred: true,
    lmp: "2025-06-01",
    gravida: 1,
    para: 0,
    abortions: 0,
    riskFactors: ["HYPERTENSION", "SEVERE_ANEMIA"],
  })
);
ok("create patient returns 201", created.status === 201, String(created.status));

const newPatient = JSON.parse(created.body);
ok("new patient is scored RED", newPatient.riskLevel === "RED", `score=${newPatient.riskScore}`);
ok("new patient is high risk", newPatient.isHighRisk === true);
ok("facility is taken from the token", typeof newPatient.facilityId === "string");
ok("HRP reason is stored", newPatient.hrpReason === "PREVIOUS_C_SECTION");
ok(
  "ASHA details are stored",
  newPatient.ashaName === "Smoke ASHA" && newPatient.ashaPhone === "9000000001"
);
ok("referral flag is stored", newPatient.referred === true);

const rescored = await request(
  { ...base, path: `/api/patients/${newPatient.id}`, method: "PATCH", headers: auth },
  JSON.stringify({ hrpReason: null })
);
ok(
  "clearing the HRP reason rescores the patient",
  JSON.parse(rescored.body).riskScore === 65,
  `score=${JSON.parse(rescored.body).riskScore}`
);

const visit = await request(
  { ...base, path: "/api/visits", method: "POST", headers: auth },
  JSON.stringify({
    patientId: newPatient.id,
    visitNumber: 1,
    gestationalWeeks: 20,
    visitDate: "2025-11-01",
    dangerSigns: ["VAGINAL_BLEEDING"],
    ifaGiven: true,
    calciumGiven: true,
    albendazoleGiven: true,
    referred: false,
  })
);
ok("create visit returns 201", visit.status === 201, String(visit.status));

const afterVisit = await request({
  ...base,
  path: `/api/patients/${newPatient.id}`,
  method: "GET",
  headers: auth,
});
const updated = JSON.parse(afterVisit.body);
ok(
  "visit danger signs changed the risk level",
  updated.riskLevel === "RED" && updated.riskFactors.includes("VAGINAL_BLEEDING"),
  JSON.stringify(updated.riskFactors)
);
ok("patient detail includes the ANM name", updated.anmName === "Asha Ben", updated.anmName);

const byAnm = await request({
  ...base,
  path: `/api/patients?anmName=${encodeURIComponent("Asha")}`,
  method: "GET",
  headers: auth,
});
const byAnmPayload = JSON.parse(byAnm.body);
ok(
  "ANM name filter returns only that ANM's patients",
  byAnm.status === 200 &&
    byAnmPayload.data.length > 0 &&
    byAnmPayload.data.every((p) => (p.anmName ?? "").includes("Asha")),
  `${byAnmPayload.data?.length ?? 0} patients`
);

const invalid = await request(
  { ...base, path: "/api/patients", method: "POST", headers: auth },
  JSON.stringify({ name: "X" })
);
ok("invalid payload is rejected with 400", invalid.status === 400, String(invalid.status));

const unauthenticated = await request({
  ...base,
  path: "/api/patients",
  method: "GET",
  headers: json,
});
ok(
  "unauthenticated request is rejected with 401",
  unauthenticated.status === 401,
  String(unauthenticated.status)
);

const badSort = await request({
  ...base,
  path: `/api/patients?sortBy=${encodeURIComponent("created_at;DROP TABLE patients")}`,
  method: "GET",
  headers: auth,
});
ok("unknown sort column falls back safely", badSort.status === 200, String(badSort.status));

const bigLimit = await request({
  ...base,
  path: "/api/patients?limit=100000",
  method: "GET",
  headers: auth,
});
ok(
  "limit is capped at 100",
  bigLimit.status === 200 && JSON.parse(bigLimit.body).limit <= 100,
  `limit=${JSON.parse(bigLimit.body).limit}`
);

// Hard deletion is denied for every role by design: maternal health records
// need a retention/archive workflow, not a destructive delete. This asserts the
// policy so a future change cannot silently turn DELETE into a data-loss path.
const removed = await request({
  ...base,
  path: `/api/patients/${newPatient.id}`,
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
ok("hard delete is forbidden by policy", removed.status === 403, String(removed.status));

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All smoke checks passed");
