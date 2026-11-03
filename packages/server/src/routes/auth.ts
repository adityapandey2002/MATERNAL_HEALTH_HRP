import { UserRole } from "@hrp/shared";
import { LoginSchema } from "@hrp/shared/schemas";
import bcrypt from "bcryptjs";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { serializeUser } from "../lib/serializers.js";
import { validateBody } from "../lib/validate.js";
import {
  DEVICE_HEADER,
  isDeviceRevoked,
  parseDeviceId,
  parsePlatform,
  registerDevice,
} from "../services/devices.js";

const REFRESH_COOKIE = "refreshToken";

/**
 * The bundled Android app is served from `https://localhost`, so the httpOnly
 * refresh cookie is cross-site and is never sent. Native builds therefore ask
 * for the refresh token in the response body and present it on refresh.
 */
function isNativeRequest(request: FastifyRequest): boolean {
  return request.headers["x-client-platform"] === "native";
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { preValidation: validateBody(LoginSchema) }, async (request, reply) => {
    const { employeeId, password } = request.body as {
      employeeId: string;
      password: string;
    };

    // Field staff sign in with the employee ID issued by their facility.
    // Helpdesk accounts provisioned by a nodal officer sign in with email.
    const identifier = employeeId.trim();
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("employee_id", "=", identifier),
          sql<boolean>`lower(users.email) = ${identifier.toLowerCase()}`,
        ])
      )
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const serializedUser = serializeUser(user);
    const deviceId = parseDeviceId(request.headers[DEVICE_HEADER]);

    if (deviceId) {
      // A phone the district has cut off must not get a new session, even with
      // the right password. The account stays usable on a replacement device.
      if (await isDeviceRevoked(db, deviceId)) {
        return reply.code(401).send({ message: "Device revoked", code: "DEVICE_REVOKED" });
      }
      await registerDevice(db, {
        deviceId,
        userId: user.id,
        platform: parsePlatform(isNativeRequest(request) ? "android" : "web"),
      });
    }

    const accessToken = app.jwt.sign({
      sub: user.id,
      role: serializedUser.role,
      facilityId: user.facility_id,
      ...(deviceId ? { dev: deviceId } : {}),
    });
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: "refresh", ...(deviceId ? { dev: deviceId } : {}) },
      { expiresIn: config.jwtRefreshTtl, key: config.jwtRefreshSecret }
    );

    if (isNativeRequest(request)) {
      return { accessToken, refreshToken, user: serializedUser };
    }

    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return { accessToken, user: serializedUser };
  });

  app.post("/refresh", async (request, reply) => {
    const native = isNativeRequest(request);
    const bodyToken = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
    const refreshToken = native ? bodyToken : request.cookies[REFRESH_COOKIE];

    if (!refreshToken) {
      return reply.code(401).send({ message: "No refresh token provided" });
    }

    try {
      const decoded = app.jwt.verify<{ sub: string; type: string; dev?: string }>(refreshToken, {
        key: config.jwtRefreshSecret,
      });
      if (decoded.type !== "refresh") throw new Error("Invalid token type");

      // The refresh token names the install it was issued to. A token lifted
      // from a phone cannot be replayed from another device, and a revoked
      // install cannot rotate its way back in.
      const headerDeviceId = parseDeviceId(request.headers[DEVICE_HEADER]);
      if (decoded.dev) {
        if (headerDeviceId !== decoded.dev) throw new Error("Device mismatch");
        if (await isDeviceRevoked(db, decoded.dev)) {
          return reply.code(401).send({ message: "Device revoked", code: "DEVICE_REVOKED" });
        }
      } else if (headerDeviceId && (await isDeviceRevoked(db, headerDeviceId))) {
        return reply.code(401).send({ message: "Device revoked", code: "DEVICE_REVOKED" });
      }

      const user = await db
        .selectFrom("users")
        .select(["id", "employee_id", "name", "role", "facility_id", "language", "is_active"])
        .where("id", "=", decoded.sub)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!user) throw new Error("User not found");

      const newAccessToken = app.jwt.sign({
        sub: user.id,
        role: UserRole.parse(user.role),
        facilityId: user.facility_id,
        ...(decoded.dev ? { dev: decoded.dev } : {}),
      });
      const newRefreshToken = app.jwt.sign(
        { sub: user.id, type: "refresh", ...(decoded.dev ? { dev: decoded.dev } : {}) },
        { expiresIn: config.jwtRefreshTtl, key: config.jwtRefreshSecret }
      );

      if (native) {
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      }

      reply.setCookie(REFRESH_COOKIE, newRefreshToken, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      return { accessToken: newAccessToken };
    } catch {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", request.user.sub)
      .executeTakeFirstOrThrow();
    return serializeUser(user);
  });

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { message: "Logged out" };
  });
};
