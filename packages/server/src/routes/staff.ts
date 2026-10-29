import { randomUUID } from "node:crypto";
import { UserRole } from "@hrp/shared";
import { CreateStaffSchema } from "@hrp/shared/schemas";
import type { CreateStaff, StaffMember } from "@hrp/shared/schemas";
import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { assertCan } from "../authz/policy.js";
import { facilityScopePredicate } from "../authz/scope.js";
import { db } from "../db/client.js";
import { validateBody } from "../lib/validate.js";

const BCRYPT_ROUNDS = 10;

/**
 * Helpdesk accounts are created by the Block Nodal officer (or the district
 * officer) so that email/password credentials can be handed to a new HRP
 * helpdesk operator without involving the platform team.
 *
 * Only the HELPDESK role is provisionable here. ANM/CHO accounts stay under
 * the district provisioning process because they carry clinical write access
 * tied to a specific HWC/village.
 */
export const staffRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const actor = request.actor;
    assertCan(actor, "staff:manage", {
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

    const data: StaffMember[] = rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: UserRole.parse(row.role),
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    return { data, total: data.length };
  });

  app.post("/", { preValidation: validateBody(CreateStaffSchema) }, async (request, reply) => {
    const actor = request.actor;
    const data = request.body as CreateStaff;

    assertCan(actor, "staff:manage", {
      type: "facility",
      facilityPath: actor.homeFacilityPath,
    });

    const email = data.email.trim().toLowerCase();
    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (existing) {
      return reply.code(409).send({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const employeeId = `HD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const inserted = await db
      .insertInto("users")
      .values({
        employee_id: employeeId,
        email,
        name: data.name.trim(),
        phone: data.phone,
        password_hash: passwordHash,
        role: "HELPDESK",
        facility_id: actor.homeFacilityId,
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

    const facility = await db
      .selectFrom("facilities")
      .select("name")
      .where("id", "=", inserted.facility_id)
      .executeTakeFirst();

    const staff: StaffMember = {
      id: inserted.id,
      employeeId: inserted.employee_id,
      email: inserted.email,
      name: inserted.name,
      phone: inserted.phone,
      role: UserRole.parse(inserted.role),
      facilityId: inserted.facility_id,
      facilityName: facility?.name ?? null,
      isActive: inserted.is_active,
      createdAt: inserted.created_at,
    };

    return reply.code(201).send(staff);
  });

  app.patch("/:id/deactivate", async (request, reply) => {
    const actor = request.actor;
    const { id } = request.params as { id: string };

    if (id === actor.userId) {
      return reply.code(409).send({ message: "You cannot deactivate your own account" });
    }

    const target = await db
      .selectFrom("users")
      .innerJoin("facilities", "facilities.id", "users.facility_id")
      .select([
        "users.id as id",
        "users.role as role",
        "users.is_active as is_active",
        "facilities.path as facility_path",
      ])
      .where("users.id", "=", id)
      .executeTakeFirst();

    if (!target) return reply.code(404).send({ message: "Staff member not found" });

    assertCan(actor, "staff:manage", {
      type: "facility",
      facilityPath: target.facility_path,
    });

    await db
      .updateTable("users")
      .set({ is_active: false, updated_at: new Date() })
      .where("id", "=", id)
      .execute();

    return { id, isActive: false };
  });
};
