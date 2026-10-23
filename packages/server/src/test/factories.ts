import bcrypt from "bcryptjs";
import { type Kysely, sql } from "kysely";
import type { DB, DbUserRole, Facility, SupervisionAlertRow, SyncQueueRow } from "../db/types.js";

export const TEST_PASSWORD = "password123";

const STATE = "Bihar";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

export interface FacilityFixture {
  id: string;
  code: string;
  name: string;
  level: Facility["level"];
  parentId: string | null;
  path: string;
}

export interface UserFixture {
  id: string;
  employeeId: string;
  role: DbUserRole;
  facilityId: string;
  isActive: boolean;
}

export interface PatientFixture {
  id: string;
  facilityId: string;
  name: string;
}

export interface VisitFixture {
  id: string;
  patientId: string;
  facilityId: string;
}

export interface FacilityFixtures {
  districtA: FacilityFixture;
  blockA: FacilityFixture;
  chcA: FacilityFixture;
  hwcA: FacilityFixture;
  villageA: FacilityFixture;
  villageA2: FacilityFixture;
  districtB: FacilityFixture;
  blockB: FacilityFixture;
  chcB: FacilityFixture;
  hwcB: FacilityFixture;
  villageB: FacilityFixture;
}

export interface UserFixtures {
  anmA: UserFixture;
  choA: UserFixture;
  bhmA: UserFixture;
  dhsA: UserFixture;
  anmB: UserFixture;
}

export interface PatientFixtures {
  patientA: PatientFixture;
  patientA2: PatientFixture;
  patientB: PatientFixture;
  visitA: VisitFixture;
  visitA2: VisitFixture;
  visitB: VisitFixture;
}

export interface SupervisionAlertFixture {
  id: string;
  facilityId: string;
  type: SupervisionAlertRow["type"];
  severity: SupervisionAlertRow["severity"];
  acknowledged: boolean;
}

export interface SyncQueueItemFixture {
  id: string;
  facilityId: string;
  entityType: SyncQueueRow["entity_type"];
  entityId: string;
  operation: SyncQueueRow["operation"];
  status: SyncQueueRow["status"];
  retryCount: number;
}

export interface SeedFixtures {
  facilities: FacilityFixtures;
  users: UserFixtures;
  patients: PatientFixtures;
}

interface FacilityInput {
  code: string;
  name: string;
  level: Facility["level"];
  path: string;
  district: string;
  block: string;
}

async function insertFacility(
  db: Kysely<DB>,
  parent: FacilityFixture | null,
  input: FacilityInput
): Promise<FacilityFixture> {
  const row = await db
    .insertInto("facilities")
    .values({
      code: input.code,
      name: input.name,
      level: input.level,
      parent_id: parent?.id ?? null,
      path: input.path,
      state: STATE,
      district: input.district,
      block: input.block,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    level: row.level,
    parentId: row.parent_id,
    path: row.path,
  };
}

export async function seedFacilityTree(db: Kysely<DB>): Promise<FacilityFixtures> {
  const districtA = await insertFacility(db, null, {
    code: "DIST_ARARIA",
    name: "Araria District",
    level: "DISTRICT",
    path: "INDIA.BIHAR.ARARIA",
    district: "Araria",
    block: "",
  });
  const blockA = await insertFacility(db, districtA, {
    code: "BLOCK_RANIGANJ",
    name: "Raniganj Block",
    level: "BLOCK",
    path: `${districtA.path}.RANIGANJ`,
    district: "Araria",
    block: "Raniganj",
  });
  const chcA = await insertFacility(db, blockA, {
    code: "CHC_RANIGANJ",
    name: "CHC Raniganj",
    level: "CHC",
    path: `${blockA.path}.CHC_RANIGANJ`,
    district: "Araria",
    block: "Raniganj",
  });
  const hwcA = await insertFacility(db, chcA, {
    code: "HWC_PASUNJ",
    name: "HWC Pasunj",
    level: "HWC",
    path: `${chcA.path}.HWC_PASUNJ`,
    district: "Araria",
    block: "Raniganj",
  });
  const villageA = await insertFacility(db, hwcA, {
    code: "VIL_PASUNJ",
    name: "Pasunj Village",
    level: "VILLAGE",
    path: `${hwcA.path}.VIL_PASUNJ`,
    district: "Araria",
    block: "Raniganj",
  });
  const villageA2 = await insertFacility(db, hwcA, {
    code: "VIL_BALUA",
    name: "Balua Village",
    level: "VILLAGE",
    path: `${hwcA.path}.VIL_BALUA`,
    district: "Araria",
    block: "Raniganj",
  });

  const districtB = await insertFacility(db, null, {
    code: "DIST_KISHANGANJ",
    name: "Kishanganj District",
    level: "DISTRICT",
    path: "INDIA.BIHAR.KISHANGANJ",
    district: "Kishanganj",
    block: "",
  });
  const blockB = await insertFacility(db, districtB, {
    code: "BLOCK_THAKURGANJ",
    name: "Thakurganj Block",
    level: "BLOCK",
    path: `${districtB.path}.THAKURGANJ`,
    district: "Kishanganj",
    block: "Thakurganj",
  });
  const chcB = await insertFacility(db, blockB, {
    code: "CHC_THAKURGANJ",
    name: "CHC Thakurganj",
    level: "CHC",
    path: `${blockB.path}.CHC_THAKURGANJ`,
    district: "Kishanganj",
    block: "Thakurganj",
  });
  const hwcB = await insertFacility(db, chcB, {
    code: "HWC_THAKURGANJ",
    name: "HWC Thakurganj",
    level: "HWC",
    path: `${chcB.path}.HWC_THAKURGANJ`,
    district: "Kishanganj",
    block: "Thakurganj",
  });
  const villageB = await insertFacility(db, hwcB, {
    code: "VIL_THAKURGANJ",
    name: "Thakurganj Village",
    level: "VILLAGE",
    path: `${hwcB.path}.VIL_THAKURGANJ`,
    district: "Kishanganj",
    block: "Thakurganj",
  });

  return {
    districtA,
    blockA,
    chcA,
    hwcA,
    villageA,
    villageA2,
    districtB,
    blockB,
    chcB,
    hwcB,
    villageB,
  };
}

interface UserInput {
  employeeId: string;
  name: string;
  phone: string;
  role: DbUserRole;
  facilityId: string;
  isActive?: boolean;
}

async function insertUser(db: Kysely<DB>, input: UserInput): Promise<UserFixture> {
  const row = await db
    .insertInto("users")
    .values({
      employee_id: input.employeeId,
      name: input.name,
      phone: input.phone,
      password_hash: PASSWORD_HASH,
      role: input.role,
      facility_id: input.facilityId,
      language: "hi",
      is_active: input.isActive ?? true,
    })
    .returning(["id", "employee_id", "role", "facility_id", "is_active"])
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    employeeId: row.employee_id,
    role: row.role,
    facilityId: row.facility_id,
    isActive: row.is_active,
  };
}

export async function seedUsers(
  db: Kysely<DB>,
  facilities: FacilityFixtures
): Promise<UserFixtures> {
  return {
    anmA: await insertUser(db, {
      employeeId: "ANM001",
      name: "Asha Kumari",
      phone: "9876500001",
      role: "ANM",
      facilityId: facilities.villageA.id,
    }),
    choA: await insertUser(db, {
      employeeId: "CHO001",
      name: "Dr. Priya Sharma",
      phone: "9876500002",
      role: "CHO",
      facilityId: facilities.hwcA.id,
    }),
    bhmA: await insertUser(db, {
      employeeId: "BHM001",
      name: "Ramesh Singh",
      phone: "9876500003",
      role: "BHM",
      facilityId: facilities.blockA.id,
    }),
    dhsA: await insertUser(db, {
      employeeId: "DHS001",
      name: "Dr. Anil Verma",
      phone: "9876500004",
      role: "DHS",
      facilityId: facilities.districtA.id,
    }),
    anmB: await insertUser(db, {
      employeeId: "ANM002",
      name: "Meena Devi",
      phone: "9876500005",
      role: "ANM",
      facilityId: facilities.villageB.id,
    }),
  };
}

export async function seedPatients(
  db: Kysely<DB>,
  facilities: FacilityFixtures,
  users: UserFixtures
): Promise<PatientFixtures> {
  const patientA = await db
    .insertInto("patients")
    .values({
      facility_id: facilities.villageA.id,
      registered_by: users.anmA.id,
      name: "Rekha Devi",
      age: 27,
      phone: "9988700001",
      risk_factors: JSON.stringify([]),
    })
    .returning(["id", "facility_id", "name"])
    .executeTakeFirstOrThrow();

  const patientB = await db
    .insertInto("patients")
    .values({
      facility_id: facilities.villageB.id,
      registered_by: users.anmB.id,
      name: "Sunita Devi",
      age: 24,
      phone: "9988700002",
      risk_factors: JSON.stringify([]),
    })
    .returning(["id", "facility_id", "name"])
    .executeTakeFirstOrThrow();

  const patientA2 = await db
    .insertInto("patients")
    .values({
      facility_id: facilities.villageA2.id,
      registered_by: users.anmA.id,
      name: "Kavita Devi",
      age: 26,
      phone: "9988700003",
      risk_factors: JSON.stringify([]),
    })
    .returning(["id", "facility_id", "name"])
    .executeTakeFirstOrThrow();

  const visitA = await db
    .insertInto("visits")
    .values({
      patient_id: patientA.id,
      facility_id: facilities.villageA.id,
      conducted_by: users.anmA.id,
      visit_number: 1,
      gestational_weeks: 14,
      visit_date: new Date("2026-02-10T00:00:00.000Z"),
      danger_signs: JSON.stringify([]),
    })
    .returning(["id", "patient_id", "facility_id"])
    .executeTakeFirstOrThrow();

  const visitA2 = await db
    .insertInto("visits")
    .values({
      patient_id: patientA2.id,
      facility_id: facilities.villageA2.id,
      conducted_by: users.anmA.id,
      visit_number: 1,
      gestational_weeks: 16,
      visit_date: new Date("2026-02-11T00:00:00.000Z"),
      danger_signs: JSON.stringify([]),
    })
    .returning(["id", "patient_id", "facility_id"])
    .executeTakeFirstOrThrow();

  const visitB = await db
    .insertInto("visits")
    .values({
      patient_id: patientB.id,
      facility_id: facilities.villageB.id,
      conducted_by: users.anmB.id,
      visit_number: 1,
      gestational_weeks: 12,
      visit_date: new Date("2026-02-12T00:00:00.000Z"),
      danger_signs: JSON.stringify([]),
    })
    .returning(["id", "patient_id", "facility_id"])
    .executeTakeFirstOrThrow();

  return {
    patientA: { id: patientA.id, facilityId: patientA.facility_id, name: patientA.name },
    patientA2: { id: patientA2.id, facilityId: patientA2.facility_id, name: patientA2.name },
    patientB: { id: patientB.id, facilityId: patientB.facility_id, name: patientB.name },
    visitA: { id: visitA.id, patientId: visitA.patient_id, facilityId: visitA.facility_id },
    visitA2: { id: visitA2.id, patientId: visitA2.patient_id, facilityId: visitA2.facility_id },
    visitB: { id: visitB.id, patientId: visitB.patient_id, facilityId: visitB.facility_id },
  };
}

export interface SupervisionAlertInput {
  facilityId: string;
  type?: SupervisionAlertRow["type"];
  severity?: SupervisionAlertRow["severity"];
  message?: string;
  relatedEntityId?: string | null;
  acknowledged?: boolean;
  createdAt?: Date;
}

export async function seedSupervisionAlert(
  db: Kysely<DB>,
  input: SupervisionAlertInput
): Promise<SupervisionAlertFixture> {
  const row = await db
    .insertInto("supervision_alerts")
    .values({
      facility_id: input.facilityId,
      type: input.type ?? "ANM_OFFLINE",
      severity: input.severity ?? "AMBER",
      message: input.message ?? "Test supervision alert",
      related_entity_id: input.relatedEntityId ?? null,
      acknowledged: input.acknowledged ?? false,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    })
    .returning(["id", "facility_id", "type", "severity", "acknowledged"])
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    facilityId: row.facility_id,
    type: row.type,
    severity: row.severity,
    acknowledged: row.acknowledged,
  };
}

export interface SyncQueueItemInput {
  facilityId: string;
  entityId: string;
  entityType?: SyncQueueRow["entity_type"];
  operation?: SyncQueueRow["operation"];
  status?: SyncQueueRow["status"];
  retryCount?: number;
  lastError?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: Date;
}

export async function seedSyncQueueItem(
  db: Kysely<DB>,
  input: SyncQueueItemInput
): Promise<SyncQueueItemFixture> {
  const row = await db
    .insertInto("sync_queue")
    .values({
      facility_id: input.facilityId,
      entity_type: input.entityType ?? "PATIENT",
      entity_id: input.entityId,
      operation: input.operation ?? "CREATE",
      payload: JSON.stringify(input.payload ?? {}),
      status: input.status ?? "PENDING",
      retry_count: input.retryCount ?? 0,
      last_error: input.lastError ?? null,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    })
    .returning([
      "id",
      "facility_id",
      "entity_type",
      "entity_id",
      "operation",
      "status",
      "retry_count",
    ])
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    facilityId: row.facility_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    status: row.status,
    retryCount: row.retry_count,
  };
}

export async function seedBaseFixtures(db: Kysely<DB>): Promise<SeedFixtures> {
  const facilities = await seedFacilityTree(db);
  const users = await seedUsers(db, facilities);
  const patients = await seedPatients(db, facilities, users);

  return { facilities, users, patients };
}

export async function seedInactiveUser(
  db: Kysely<DB>,
  facilities: FacilityFixtures
): Promise<UserFixture> {
  return insertUser(db, {
    employeeId: "INACTIVE001",
    name: "Inactive ANM",
    phone: "9876500010",
    role: "ANM",
    facilityId: facilities.villageA.id,
    isActive: false,
  });
}

export async function seedLegacyRoleUser(
  db: Kysely<DB>,
  facilities: FacilityFixtures
): Promise<UserFixture> {
  await sql`alter table users drop constraint if exists users_role_check`.execute(db);

  return insertUser(db, {
    employeeId: "LEGACY001",
    name: "Legacy ASHA",
    phone: "9876500011",
    role: "ASHA",
    facilityId: facilities.villageA.id,
  });
}

export async function seedRoleFacilityMismatchUser(
  db: Kysely<DB>,
  facilities: FacilityFixtures
): Promise<UserFixture> {
  return insertUser(db, {
    employeeId: "MISMATCH001",
    name: "Misplaced CHO",
    phone: "9876500012",
    role: "CHO",
    facilityId: facilities.villageA.id,
  });
}
