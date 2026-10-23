import bcrypt from "bcryptjs";
import { db } from "./client.js";
import { assertSeedAllowed } from "./seed-guard.js";

/**
 * Seeds a realistic facility hierarchy, test users, patients, visits, a
 * referral and supervision alerts.
 *
 * Facilities are inserted one level at a time: a single multi-row INSERT
 * cannot see the rows it is inserting, so the parent lookups would all
 * resolve to NULL and the hierarchy would be flat.
 */

interface FacilitySeed {
  code: string;
  name: string;
  level: "VILLAGE" | "HSC" | "HWC" | "PHC" | "CHC" | "BLOCK" | "DISTRICT" | "STATE";
  parentCode: string | null;
  path: string;
  state: string;
  district: string;
  block: string;
}

const FACILITIES: FacilitySeed[] = [
  {
    code: "GJ",
    name: "Gujarat",
    level: "STATE",
    parentCode: null,
    path: "INDIA.GUJARAT",
    state: "Gujarat",
    district: "",
    block: "",
  },
  {
    code: "AHM",
    name: "Ahmedabad",
    level: "DISTRICT",
    parentCode: "GJ",
    path: "INDIA.GUJARAT.AHMEDABAD",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "",
  },
  {
    code: "DSK",
    name: "Daskroi",
    level: "CHC",
    parentCode: "AHM",
    path: "INDIA.GUJARAT.AHMEDABAD.DASKROI",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "Daskroi",
  },
  {
    code: "CHC_BAR",
    name: "CHC Bareja",
    level: "CHC",
    parentCode: "DSK",
    path: "INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "Daskroi",
  },
  {
    code: "PHC_KUH",
    name: "PHC Kuha",
    level: "PHC",
    parentCode: "CHC_BAR",
    path: "INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "Daskroi",
  },
  {
    code: "HWC_PAS",
    name: "HWC Pasunj",
    level: "HWC",
    parentCode: "PHC_KUH",
    path: "INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "Daskroi",
  },
  {
    code: "VIL_PAS",
    name: "Pasunj Village",
    level: "VILLAGE",
    parentCode: "HWC_PAS",
    path: "INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ.VIL_PAS",
    state: "Gujarat",
    district: "Ahmedabad",
    block: "Daskroi",
  },
];

/** Date columns are written as Date values. */
const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export async function seed() {
  assertSeedAllowed(process.env);
  console.log("Seeding database...");

  await db.deleteFrom("responsibilities").execute();
  await db.deleteFrom("supervision_alerts").execute();
  await db.deleteFrom("referrals").execute();
  await db.deleteFrom("visits").execute();
  await db.deleteFrom("patients").execute();
  await db.deleteFrom("users").execute();
  await db.deleteFrom("facilities").execute();

  const passwordHash = await bcrypt.hash("password123", 10);

  // Insert facilities level by level so each parent already exists.
  const facilityIds = new Map<string, string>();
  for (const facility of FACILITIES) {
    const parentId = facility.parentCode ? facilityIds.get(facility.parentCode) : undefined;
    if (facility.parentCode && !parentId) {
      throw new Error(`Missing parent facility ${facility.parentCode} for ${facility.code}`);
    }

    const inserted = await db
      .insertInto("facilities")
      .values({
        code: facility.code,
        name: facility.name,
        level: facility.level,
        parent_id: parentId ?? null,
        path: facility.path,
        state: facility.state,
        district: facility.district,
        block: facility.block,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    facilityIds.set(facility.code, inserted.id);
  }

  const getId = (code: string): string => {
    const id = facilityIds.get(code);
    if (!id) throw new Error(`Unknown facility code ${code}`);
    return id;
  };

  const villageId = getId("VIL_PAS");
  const hwcId = getId("HWC_PAS");
  const chcId = getId("CHC_BAR");
  const districtId = getId("AHM");

  // Insert users
  const users = await db
    .insertInto("users")
    .values([
      {
        employee_id: "CHO001",
        name: "Dr. Priya Patel",
        phone: "9876543210",
        password_hash: passwordHash,
        role: "CHO",
        facility_id: hwcId,
        language: "hi",
      },
      {
        employee_id: "ANM001",
        name: "Asha Ben",
        phone: "9876543211",
        password_hash: passwordHash,
        role: "ANM",
        facility_id: villageId,
        language: "hi",
      },
      {
        employee_id: "MO001",
        name: "Dr. Rajesh Kumar",
        phone: "9876543212",
        password_hash: passwordHash,
        role: "BHM",
        facility_id: chcId,
        language: "hi",
      },
      {
        employee_id: "ADM001",
        name: "District Admin",
        phone: "9876543213",
        password_hash: passwordHash,
        role: "DHS",
        facility_id: districtId,
        language: "hi",
      },
    ])
    .returning(["id", "employee_id"])
    .execute();

  const getUserId = (empId: string): string => {
    const user = users.find((u) => u.employee_id === empId);
    if (!user) throw new Error(`Unknown employee ${empId}`);
    return user.id;
  };

  const anmId = getUserId("ANM001");

  // Insert patients
  const patients = await db
    .insertInto("patients")
    .values([
      {
        facility_id: villageId,
        registered_by: anmId,
        name: "Rekha Devi",
        age: 26,
        phone: "9988776655",
        address: "Pasunj Village, Daskroi",
        hrp_reason: "PREVIOUS_C_SECTION",
        asha_name: "Sunita Devi",
        asha_phone: "9988776601",
        referred: true,
        lmp: date("2025-01-15"),
        edd: date("2025-10-22"),
        gravida: 2,
        para: 1,
        abortions: 0,
        risk_factors: JSON.stringify(["HYPERTENSION", "SEVERE_ANEMIA"]),
        risk_level: "RED",
        risk_score: 95,
        is_high_risk: true,
      },
      {
        facility_id: villageId,
        registered_by: anmId,
        name: "Sunita Patel",
        age: 22,
        phone: "9988776656",
        address: "Pasunj Village, Daskroi",
        hrp_reason: "RH_NEGATIVE",
        asha_name: "Kavita Patel",
        asha_phone: "9988776602",
        referred: false,
        lmp: date("2025-03-01"),
        edd: date("2025-12-06"),
        gravida: 1,
        para: 0,
        abortions: 0,
        risk_factors: JSON.stringify(["GESTATIONAL_DIABETES"]),
        risk_level: "AMBER",
        risk_score: 55,
        is_high_risk: true,
      },
      {
        facility_id: villageId,
        registered_by: anmId,
        name: "Meena Sharma",
        age: 28,
        phone: "9988776657",
        address: "Pasunj Village, Daskroi",
        hrp_reason: null,
        asha_name: "Rekha Ben",
        asha_phone: "9988776603",
        referred: false,
        lmp: date("2025-02-10"),
        edd: date("2025-11-17"),
        gravida: 3,
        para: 2,
        abortions: 0,
        risk_factors: JSON.stringify([]),
        risk_level: "GREEN",
        risk_score: 0,
        is_high_risk: false,
      },
    ])
    .returning(["id", "name"])
    .execute();

  const getPatientId = (name: string): string => {
    const patient = patients.find((p) => p.name === name);
    if (!patient) throw new Error(`Unknown patient ${name}`);
    return patient.id;
  };

  const patient1Id = getPatientId("Rekha Devi");
  const patient2Id = getPatientId("Sunita Patel");
  const patient3Id = getPatientId("Meena Sharma");

  // Insert visits
  await db
    .insertInto("visits")
    .values([
      {
        patient_id: patient1Id,
        facility_id: villageId,
        conducted_by: anmId,
        visit_number: 1,
        gestational_weeks: 12,
        visit_date: date("2025-04-01"),
        bp_systolic: 150,
        bp_diastolic: 95,
        hb: 6.8,
        weight: 55,
        fundal_height: 12,
        fetal_heart_rate: 140,
        danger_signs: JSON.stringify(["HYPERTENSION", "SEVERE_ANEMIA"]),
        ifa_given: true,
        calcium_given: true,
        albendazole_given: true,
        referred: false,
      },
      {
        patient_id: patient2Id,
        facility_id: villageId,
        conducted_by: anmId,
        visit_number: 1,
        gestational_weeks: 10,
        visit_date: date("2025-05-10"),
        bp_systolic: 110,
        bp_diastolic: 70,
        hb: 11.2,
        weight: 52,
        fundal_height: 10,
        fetal_heart_rate: 145,
        danger_signs: JSON.stringify(["GESTATIONAL_DIABETES"]),
        ifa_given: true,
        calcium_given: true,
        albendazole_given: false,
        referred: false,
      },
      {
        patient_id: patient3Id,
        facility_id: villageId,
        conducted_by: anmId,
        visit_number: 2,
        gestational_weeks: 20,
        visit_date: date("2025-06-25"),
        bp_systolic: 115,
        bp_diastolic: 75,
        hb: 12.5,
        weight: 60,
        fundal_height: 20,
        fetal_heart_rate: 142,
        danger_signs: JSON.stringify([]),
        ifa_given: true,
        calcium_given: true,
        albendazole_given: true,
        referred: false,
      },
    ])
    .execute();

  // Insert referral
  await db
    .insertInto("referrals")
    .values({
      patient_id: patient1Id,
      from_facility_id: villageId,
      to_facility_id: chcId,
      referred_by: anmId,
      reason:
        "Severe hypertension (150/95) with anemia (Hb 6.8). Needs MgSO4 and blood transfusion.",
      urgency: "RED",
      status: "PENDING",
    })
    .execute();

  // Insert supervision alerts
  await db
    .insertInto("supervision_alerts")
    .values([
      {
        facility_id: villageId,
        type: "HIGH_RISK_UNATTENDED",
        severity: "RED",
        message: "Patient Rekha Devi (RED risk) has not had follow-up visit in 14 days",
        related_entity_id: patient1Id,
        acknowledged: false,
      },
      {
        facility_id: villageId,
        type: "ANM_OFFLINE",
        severity: "AMBER",
        message: "ANM Asha Ben has not synced data for 3 days",
        related_entity_id: anmId,
        acknowledged: false,
      },
    ])
    .execute();

  console.log("Seed completed");
  console.log("Test users:");
  console.log("  ANM: ANM001 / password123");
  console.log("  CHO: CHO001 / password123");
  console.log("  BHM: MO001 / password123");
  console.log("  DHS: ADM001 / password123");
}

await seed();
await db.destroy();
