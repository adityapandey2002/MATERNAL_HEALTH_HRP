import bcrypt from "bcryptjs";
import { sql } from "kysely";
import { db } from "./client.js";

const toJson = (arr: string[]) => JSON.stringify(arr);

export async function seed() {
  console.log("Seeding database...");

  await db.deleteFrom("supervision_alerts").execute();
  await db.deleteFrom("referrals").execute();
  await db.deleteFrom("visits").execute();
  await db.deleteFrom("patients").execute();
  await db.deleteFrom("users").execute();
  await db.deleteFrom("facilities").execute();

  const passwordHash = await bcrypt.hash("password123", 10);

  // Use raw SQL for seeding to avoid Kysely's strict InsertExpression typing
  // The DB has DEFAULT values for id, created_at, updated_at, is_active, acknowledged
  await sql`INSERT INTO facilities (code, name, level, parent_id, path, state, district, block) VALUES
      ('GJ', 'Gujarat', 'STATE', NULL, 'INDIA.GUJARAT', 'Gujarat', '', ''),
      ('AHM', 'Ahmedabad', 'DISTRICT', (SELECT id FROM facilities WHERE code='GJ'), 'INDIA.GUJARAT.AHMEDABAD', 'Gujarat', 'Ahmedabad', ''),
      ('DSK', 'Daskroi', 'CHC', (SELECT id FROM facilities WHERE code='AHM'), 'INDIA.GUJARAT.AHMEDABAD.DASKROI', 'Gujarat', 'Ahmedabad', 'Daskroi'),
      ('CHC_BAR', 'CHC Bareja', 'CHC', (SELECT id FROM facilities WHERE code='DSK'), 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA', 'Gujarat', 'Ahmedabad', 'Daskroi'),
      ('PHC_KUH', 'PHC Kuha', 'PHC', (SELECT id FROM facilities WHERE code='CHC_BAR'), 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA', 'Gujarat', 'Ahmedabad', 'Daskroi'),
      ('HWC_PAS', 'HWC Pasunj', 'HWC', (SELECT id FROM facilities WHERE code='PHC_KUH'), 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ', 'Gujarat', 'Ahmedabad', 'Daskroi'),
      ('VIL_PAS', 'Pasunj Village', 'VILLAGE', (SELECT id FROM facilities WHERE code='HWC_PAS'), 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ.VIL_PAS', 'Gujarat', 'Ahmedabad', 'Daskroi')
    `.execute(db);

  // Get facility IDs
  const facilities = await db.selectFrom("facilities").select(["id", "code"]).execute();
  const getId = (code: string) => facilities.find((f) => f.code === code)?.id;

  const villageId = getId("VIL_PAS");
  const hwcId = getId("HWC_PAS");
  const chcId = getId("CHC_BAR");
  const districtId = getId("AHM");

  // Insert users
  await sql`INSERT INTO users (employee_id, name, phone, password_hash, role, facility_id, language, is_active) VALUES
      ('CHO001', 'Dr. Priya Patel', '9876543210', ${passwordHash}, 'CHO', ${hwcId}, 'hi', true),
      ('ANM001', 'Asha Ben', '9876543211', ${passwordHash}, 'ANM', ${villageId}, 'hi', true),
      ('MO001', 'Dr. Rajesh Kumar', '9876543212', ${passwordHash}, 'MO', ${chcId}, 'hi', true),
      ('ADM001', 'District Admin', '9876543213', ${passwordHash}, 'DISTRICT_ADMIN', ${districtId}, 'hi', true)
    `.execute(db);

  // Get user IDs
  const users = await db.selectFrom("users").select(["id", "employee_id"]).execute();
  const getUserId = (empId: string) => users.find((u) => u.employee_id === empId)?.id;

  const anmId = getUserId("ANM001");
  const _choId = getUserId("CHO001");

  // Insert patients
  await sql`INSERT INTO patients (facility_id, registered_by, name, age, phone, address, lmp, edd, gravida, para, abortions, risk_factors, risk_level, risk_score, is_high_risk) VALUES
      (${villageId}, ${anmId}, 'Rekha Devi', 26, '9988776655', 'Pasunj Village, Daskroi', '2025-01-15', '2025-10-22', 2, 1, 0, ${toJson(["HYPERTENSION", "SEVERE_ANEMIA"])}::jsonb, 'RED', 65, true),
      (${villageId}, ${anmId}, 'Sunita Patel', 22, '9988776656', 'Pasunj Village, Daskroi', '2025-03-01', '2025-12-06', 1, 0, 0, ${toJson(["GESTATIONAL_DIABETES"])}::jsonb, 'AMBER', 35, true),
      (${villageId}, ${anmId}, 'Meena Sharma', 28, '9988776657', 'Pasunj Village, Daskroi', '2025-02-10', '2025-11-17', 3, 2, 0, ${toJson([])}::jsonb, 'GREEN', 0, false)
    `.execute(db);

  // Get patient IDs
  const patients = await db.selectFrom("patients").select(["id", "name"]).execute();
  const getPatientId = (name: string) => patients.find((p) => p.name === name)?.id;

  const patient1Id = getPatientId("Rekha Devi");
  const patient2Id = getPatientId("Sunita Patel");
  const patient3Id = getPatientId("Meena Sharma");

  // Insert visits
  await sql`INSERT INTO visits (patient_id, facility_id, conducted_by, visit_number, gestational_weeks, visit_date, bp_systolic, bp_diastolic, hb, weight, fundal_height, fetal_heart_rate, danger_signs, ifa_given, calcium_given, albendazole_given, referred) VALUES
      (${patient1Id}, ${villageId}, ${anmId}, 1, 12, '2025-04-01', 150, 95, 6.8, 55, 12, 140, ${toJson(["HYPERTENSION", "SEVERE_ANEMIA"])}::jsonb, true, true, true, false),
      (${patient2Id}, ${villageId}, ${anmId}, 1, 10, '2025-05-10', 110, 70, 11.2, 52, 10, 145, ${toJson(["GESTATIONAL_DIABETES"])}::jsonb, true, true, false, false),
      (${patient3Id}, ${villageId}, ${anmId}, 2, 20, '2025-06-25', 115, 75, 12.5, 60, 20, 142, ${toJson([])}::jsonb, true, true, true, false)
    `.execute(db);

  // Insert referral
  await sql`INSERT INTO referrals (patient_id, from_facility_id, to_facility_id, referred_by, reason, urgency, status) VALUES
      (${patient1Id}, ${villageId}, ${chcId}, ${anmId}, 'Severe hypertension (150/95) with anemia (Hb 6.8). Needs MgSO4 and blood transfusion.', 'RED', 'PENDING')
    `.execute(db);

  // Insert supervision alerts
  await sql`INSERT INTO supervision_alerts (facility_id, type, severity, message, related_entity_id, acknowledged) VALUES
      (${villageId}, 'HIGH_RISK_UNATTENDED', 'RED', 'Patient Rekha Devi (RED risk) has not had follow-up visit in 14 days', ${patient1Id}, false),
      (${villageId}, 'ANM_OFFLINE', 'AMBER', 'ANM Asha Ben has not synced data for 3 days', ${anmId}, false)
    `.execute(db);

  console.log("Seed completed");
  console.log("Test users:");
  console.log("  ANM: ANM001 / password123");
  console.log("  CHO: CHO001 / password123");
  console.log("  MO: MO001 / password123");
  console.log("  Admin: ADM001 / password123");
}

await seed();
await db.destroy();
