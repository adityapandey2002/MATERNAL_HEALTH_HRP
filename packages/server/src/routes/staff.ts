import { randomUUID } from "node:crypto";
import { FacilityLevel, UserRole } from "@hrp/shared";
import { CreateStaffSchema, UpdateStaffSchema } from "@hrp/shared/schemas";
import type { CreateStaff, StaffMember, UpdateStaff } from "@hrp/shared/schemas";
import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { type Updateable, sql } from "kysely";
import { assertCan, canProvisionRole } from "../authz/policy.js";
import type { ActorScope } from "../authz/scope.js";
import {
  facilityScopePredicate,
  isFacilityRoleCompatible,
  isPathInSubtree,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import type { DB } from "../db/types.js";
import { validateBody } from "../lib/validate.js";

const BCRYPT_ROUNDS = 10;

/**
 * Account provisioning follows the Matru Suraksha hierarchy:
 *
 *   ANM -> CHO -> HRP_HELPDESK_BLOCK -> BHM -> HRP_HELPDESK_DISTRICT -> DHS
 *
 * DHS appoints BHM (one per block) and the district HRP helpdesk. BHM appoints
 * the ANM/CHO field team and the block HRP helpdesk. Every creator stays inside
 * their own facility subtree, and the target facility must match the target
 * role's level. Role is fixed after creation; deactivate and recreate to move
 * an account to another tier.
 */
const EMPLOYEE_ID_PREFIX: Record<CreateStaff["role"], string> = {
  ANM: "ANM",
  CHO: "CHO",
  HRP_HELPDESK_BLOCK: "HD",
  BHM: "BHM",
  HRP_HELPDESK_DISTRICT: "HD",
};

interface StaffRow {
  id: string;
  employee_id: string;
  email: string | null;
  name: string;
  phone: string;
  role: string;
  facility_id: string;
  is_active: boolean;
  created_at: Date;
}

interface TargetStaffRow extends StaffRow {
  facility_path: string;
  facility_name: string | null;
}

function toStaffMember(row: StaffRow, facilityName: string | null): StaffMember {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: UserRole.parse(row.role),
    facilityId: row.facility_id,
    facilityName,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function provisioningDenial(actorRole: UserRole): string {
  if (actorRole === "DHS") {
    return "DHS may only provision BHM and district HRP helpdesk accounts";
  }
  if (actorRole === "BHM") {
    return "BHM may only provision ANM, CHO and block HRP helpdesk accounts";
  }
  return "Your role cannot provision staff accounts";
}

async function findTargetStaff(id: string): Promise<TargetStaffRow | undefined> {
  return db
    .selectFrom("users")
    .innerJoin("facilities", "facilities.id", "users.facility_id")
    .select([
      "users.id as id",
      "users.employee_id as employee_id",
      "users.email as email",
      "users.name as name",
      "users.phone as phone",
      "users.role as role",
      "users.facility_id as facility_id",
      "users.is_active as is_active",
      "users.created_at as created_at",
      "facilities.path as facility_path",
      "facilities.name as facility_name",
    ])
    .where("users.id", "=", id)
    .executeTakeFirst();
}

type FacilityCheck =
  | { ok: true; id: string; name: string }
  | { ok: false; status: 403 | 404; message: string };

/** The target facility must be inside the actor subtree and fit the role. */
async function checkTargetFacility(
  actor: ActorScope,
  facilityId: string,
  role: UserRole
): Promise<FacilityCheck> {
  const facility = await db
    .selectFrom("facilities")
    .select(["id", "name", "path", "level"])
    .where("id", "=", facilityId)
    .executeTakeFirst();

  if (!facility) {
    return { ok: false, status: 404, message: "Facility not found" };
  }

  if (!isPathInSubtree(actor.facilityPath, facility.path)) {
    return { ok: false, status: 403, message: "Facility is outside your scope" };
  }

  const level = FacilityLevel.safeParse(facility.level);
  if (!level.success) {
    return { ok: false, status: 404, message: "Facility level is not supported" };
  }

  if (!isFacilityRoleCompatible(role, level.data)) {
    return {
      ok: false,
      status: 403,
      message: `${role} accounts cannot be assigned to a ${level.data} facility`,
    };
  }

  return { ok: true, id: facility.id, name: facility.name };
}

async function emailTaken(email: string, excludeUserId?: string): Promise<boolean> {
  let query = db
    .selectFrom("users")
    .select("id")
    .where(sql<boolean>`lower(users.email) = ${email}`);

  if (excludeUserId !== undefined) {
    query = query.where("id", "!=", excludeUserId);
  }

  const existing = await query.executeTakeFirst();
  return existing !== undefined;
}

export const staffRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const actor = request.actor;
    assertCan(actor, "staff:read", {
      type: "facility",
      facilityPath: actor.homeFacilityPath,
    });

    const rows = await db
      .selectFrom("users")
      .innerJoin("facilities", "facilities.id", "users.facility_id")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .select([
        "users.id as id",
        "users.employee_id as employee_id",
        "users.email as email",
        "users.name as name",
        "users.phone as phone",
        "users.role as role",
        "users.facility_id as facility_id",
        "users.is_active as is_active",
        "users.created_at as created_at",
        "facilities.name as facility_name",
      ])
      .orderBy("users.created_at", "asc")
      .execute();

    const data: StaffMember[] = rows.map((row) => toStaffMember(row, row.facility_name));

    return { data, total: data.length };
  });

  app.post("/", { preValidation: validateBody(CreateStaffSchema) }, async (request, reply) => {
    const actor = request.actor;
    const data = request.body as CreateStaff;

    assertCan(actor, "staff:manage", {
      type: "facility",
      facilityPath: actor.homeFacilityPath,
    });

    if (!canProvisionRole(actor.role, data.role)) {
      return reply.code(403).send({ message: provisioningDenial(actor.role) });
    }

    const facility = await checkTargetFacility(actor, data.facilityId, data.role);
    if (!facility.ok) {
      return reply.code(facility.status).send({ message: facility.message });
    }

    const email = data.email.trim().toLowerCase();
    if (await emailTaken(email)) {
      return reply.code(409).send({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const employeeId = `${EMPLOYEE_ID_PREFIX[data.role]}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const inserted = await db
      .insertInto("users")
      .values({
        employee_id: employeeId,
        email,
        name: data.name.trim(),
        phone: data.phone,
        password_hash: passwordHash,
        role: data.role,
        facility_id: facility.id,
        language: "hi",
      })
      .returning([
        "id",
        "employee_id",
        "email",
        "name",
        "phone",
        "role",
        "facility_id",
        "is_active",
        "created_at",
      ])
      .executeTakeFirstOrThrow();

    return reply.code(201).send(toStaffMember(inserted, facility.name));
  });

  app.patch("/:id", { preValidation: validateBody(UpdateStaffSchema) }, async (request, reply) => {
    const actor = request.actor;
    const { id } = request.params as { id: string };
    const data = request.body as UpdateStaff;

    assertCan(actor, "staff:manage", {
      type: "facility",
      facilityPath: actor.homeFacilityPath,
    });

    const target = await findTargetStaff(id);
    if (!target) return reply.code(404).send({ message: "Staff member not found" });

    const targetRole = UserRole.safeParse(target.role);
    if (!targetRole.success || !canProvisionRole(actor.role, targetRole.data)) {
      return reply.code(403).send({ message: provisioningDenial(actor.role) });
    }

    if (!isPathInSubtree(actor.facilityPath, target.facility_path)) {
      return reply.code(403).send({ message: "Staff member's facility is outside your scope" });
    }

    const changes: Updateable<DB["users"]> = { updated_at: new Date() };

    if (data.name !== undefined) changes.name = data.name.trim();
    if (data.phone !== undefined) changes.phone = data.phone;

    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (await emailTaken(email, id)) {
        return reply.code(409).send({ message: "An account with this email already exists" });
      }
      changes.email = email;
    }

    if (data.facilityId !== undefined) {
      const facility = await checkTargetFacility(actor, data.facilityId, targetRole.data);
      if (!facility.ok) {
        return reply.code(facility.status).send({ message: facility.message });
      }
      changes.facility_id = facility.id;
    }

    const updated = await db
      .updateTable("users")
      .set(changes)
      .where("id", "=", id)
      .returning([
        "id",
        "employee_id",
        "email",
        "name",
        "phone",
        "role",
        "facility_id",
        "is_active",
        "created_at",
      ])
      .executeTakeFirstOrThrow();

    const facility = await db
      .selectFrom("facilities")
      .select("name")
      .where("id", "=", updated.facility_id)
      .executeTakeFirst();

    return toStaffMember(updated, facility?.name ?? null);
  });

  app.patch("/:id/deactivate", async (request, reply) => {
    const actor = request.actor;
    const { id } = request.params as { id: string };

    if (id === actor.userId) {
      return reply.code(409).send({ message: "You cannot deactivate your own account" });
    }

    const target = await findTargetStaff(id);
    if (!target) return reply.code(404).send({ message: "Staff member not found" });

    const targetRole = UserRole.safeParse(target.role);
    if (!targetRole.success || !canProvisionRole(actor.role, targetRole.data)) {
      return reply.code(403).send({ message: provisioningDenial(actor.role) });
    }

    if (!isPathInSubtree(actor.facilityPath, target.facility_path)) {
      return reply.code(403).send({ message: "Staff member's facility is outside your scope" });
    }

    await db
      .updateTable("users")
      .set({ is_active: false, updated_at: new Date() })
      .where("id", "=", id)
      .execute();

    return { id, isActive: false };
  });
};
