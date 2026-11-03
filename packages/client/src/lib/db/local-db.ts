import Dexie, { type Table } from "dexie";

export type SyncStatus = "synced" | "pending" | "conflict";

export interface LocalPatient {
  id: string;
  abhaId: string | null;
  facilityId: string;
  registeredBy: string;
  anmName: string | null;
  name: string;
  age: number;
  phone: string | null;
  address: string | null;
  hrpReason: string | null;
  hrpComplication: string | null;
  ashaName: string | null;
  ashaPhone: string | null;
  referred: boolean;
  isHrp: boolean;
  followUpTrack: string | null;
  followUpScheduledDate: string | null;
  followUpStatus: string;
  lmp: string | null;
  edd: string | null;
  gravida: number;
  para: number;
  abortions: number;
  riskFactors: string[];
  riskLevel: string;
  riskScore: number;
  isHighRisk: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  /** HMAC of facility + name; populated only while the data key is unlocked. */
  nameIndex?: string | null;
}

export interface LocalVisit {
  id: string;
  patientId: string;
  facilityId: string;
  conductedBy: string;
  visitNumber: number;
  visitDate: string;
  gestationalWeeks: number;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  hemoglobin: number | null;
  weight: number | null;
  dangerSigns: string[];
  supplements: Record<string, boolean>;
  referred: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface LocalFollowUp {
  id: string;
  patientId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  level: string;
  track: string;
  status: "COMPLETE" | "PENDING" | "NOT_REACHABLE";
  scheduledDate: string;
  completedAt: string | null;
  completedByUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface PendingOp {
  seq?: number;
  entityType: "patient" | "visit" | "followUp";
  entityId: string;
  op: "create" | "update";
  payload: unknown;
  clientUpdatedAt: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
  createdAt: string;
}

export interface ConflictRecord {
  id?: number;
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
  seenAt: string;
}

export interface MetaRecord {
  key: string;
  value: string;
}

export class HrpLocalDb extends Dexie {
  patients!: Table<LocalPatient, string>;
  visits!: Table<LocalVisit, string>;
  followUps!: Table<LocalFollowUp, string>;
  pendingOps!: Table<PendingOp, number>;
  conflicts!: Table<ConflictRecord, number>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("hrp-matru-suraksha");
    this.version(1).stores({
      patients: "id, facilityId, updatedAt, syncStatus, isHrp",
      visits: "id, patientId, facilityId, updatedAt, syncStatus",
      followUps: "id, patientId, status, scheduledDate, track, syncStatus",
      pendingOps: "++seq, entityType, entityId, createdAt",
      conflicts: "++id, entityType, entityId, seenAt",
      meta: "key",
    });
    // Additive index only: existing rows get an undefined nameIndex and are
    // rewritten by migrateLocalData() once the PIN unlocks.
    this.version(2).stores({
      patients: "id, facilityId, updatedAt, syncStatus, isHrp, nameIndex",
    });
  }
}

export const db = new HrpLocalDb();

export function resetDbForTests(): void {
  // Used by tests to start from an empty database.
  db.close();
  // Re-open by deleting and recreating. Dexie.delete is async; callers await.
}
