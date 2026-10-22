import { db } from "./client.js";

export async function migrate() {
  console.log("Running migrations...");

  await db.schema
    .createTable("facilities")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("code", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("level", "varchar(20)", (col) => col.notNull())
    .addColumn("parent_id", "uuid", (col) => col.references("facilities.id"))
    .addColumn("path", "text", (col) => col.notNull())
    .addColumn("state", "varchar(100)", (col) => col.notNull())
    .addColumn("district", "varchar(100)", (col) => col.notNull())
    .addColumn("block", "varchar(100)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("employee_id", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("phone", "varchar(20)", (col) => col.notNull())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .addColumn("role", "varchar(30)", (col) => col.notNull())
    .addColumn("facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("language", "varchar(10)", (col) => col.notNull().defaultTo("hi"))
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("patients")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("abha_id", "varchar(14)", (col) => col.unique())
    .addColumn("facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("registered_by", "uuid", (col) => col.notNull().references("users.id"))
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("age", "integer", (col) => col.notNull())
    .addColumn("phone", "varchar(20)")
    .addColumn("address", "text")
    .addColumn("lmp", "date")
    .addColumn("edd", "date")
    .addColumn("gravida", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("para", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("abortions", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("risk_factors", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("risk_level", "varchar(10)", (col) => col.notNull().defaultTo("GREEN"))
    .addColumn("risk_score", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_high_risk", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("visits")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id").onDelete("cascade")
    )
    .addColumn("facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("conducted_by", "uuid", (col) => col.notNull().references("users.id"))
    .addColumn("visit_number", "integer", (col) => col.notNull())
    .addColumn("gestational_weeks", "integer", (col) => col.notNull())
    .addColumn("visit_date", "date", (col) => col.notNull())
    .addColumn("bp_systolic", "integer")
    .addColumn("bp_diastolic", "integer")
    .addColumn("hb", "real")
    .addColumn("weight", "real")
    .addColumn("fundal_height", "integer")
    .addColumn("fetal_heart_rate", "integer")
    .addColumn("danger_signs", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("ifa_given", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("calcium_given", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("albendazole_given", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("referred", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("referral_reason", "text")
    .addColumn("referral_facility_id", "uuid", (col) => col.references("facilities.id"))
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("referrals")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id").onDelete("cascade")
    )
    .addColumn("from_facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("to_facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("referred_by", "uuid", (col) => col.notNull().references("users.id"))
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("urgency", "varchar(10)", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("PENDING"))
    .addColumn("responded_at", "timestamptz")
    .addColumn("responded_by", "uuid", (col) => col.references("users.id"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("sync_queue")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("entity_type", "varchar(20)", (col) => col.notNull())
    .addColumn("entity_id", "uuid", (col) => col.notNull())
    .addColumn("operation", "varchar(10)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("PENDING"))
    .addColumn("retry_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("supervision_alerts")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("facility_id", "uuid", (col) => col.notNull().references("facilities.id"))
    .addColumn("type", "varchar(30)", (col) => col.notNull())
    .addColumn("severity", "varchar(10)", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("related_entity_id", "uuid")
    .addColumn("acknowledged", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("acknowledged_by", "uuid", (col) => col.references("users.id"))
    .addColumn("acknowledged_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("idx_patients_facility")
    .ifNotExists()
    .on("patients")
    .column("facility_id")
    .execute();

  await db.schema
    .createIndex("idx_patients_risk_level")
    .ifNotExists()
    .on("patients")
    .column("risk_level")
    .execute();

  await db.schema
    .createIndex("idx_visits_patient")
    .ifNotExists()
    .on("visits")
    .column("patient_id")
    .execute();

  await db.schema
    .createIndex("idx_referrals_status")
    .ifNotExists()
    .on("referrals")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_sync_queue_status")
    .ifNotExists()
    .on("sync_queue")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_supervision_facility")
    .ifNotExists()
    .on("supervision_alerts")
    .column("facility_id")
    .execute();

  console.log("Migrations completed");
}

import { sql } from "kysely";

await migrate();
await db.destroy();
