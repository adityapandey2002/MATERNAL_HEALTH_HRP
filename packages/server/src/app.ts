import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import { sql } from "kysely";
import { AuthzError, createDbActorLookup, resolveActor } from "./authz/scope.js";
import { config } from "./config.js";
import { db } from "./db/client.js";
import { registerClientStatic } from "./lib/static-client.js";
import { authRoutes } from "./routes/auth.js";
import { facilityRoutes } from "./routes/facilities.js";
import { fieldLevelRoutes } from "./routes/field-level.js";
import { followUpRoutes } from "./routes/follow-ups.js";
import { hrpRoutes } from "./routes/hrp.js";
import { nodalRoutes } from "./routes/nodal.js";
import { patientRoutes } from "./routes/patients.js";
import { queueRoutes } from "./routes/queue.js";
import { referralRoutes } from "./routes/referrals.js";
import { staffRoutes } from "./routes/staff.js";
import { supervisionRoutes } from "./routes/supervision.js";
import { syncRoutes } from "./routes/sync.js";
import { visitRoutes } from "./routes/visits.js";

export interface LoggerOptions {
  enabled?: boolean;
  level?: string;
}

export interface BuildAppOptions {
  logger?: boolean | LoggerOptions;
  trustProxy?: boolean;
}

function resolveLogger(option: BuildAppOptions["logger"]): FastifyServerOptions["logger"] {
  if (option === undefined) return { level: config.logLevel };
  if (typeof option === "boolean") return option;
  if (option.enabled === false) return false;
  return { level: option.level ?? config.logLevel };
}

function authzMessage(status: number): string {
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not found";
  return "Internal server error";
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthzError) {
      const status = error.httpStatus;
      if (status === 401 || status === 403 || status === 404) {
        return reply.code(status).send({ message: authzMessage(status) });
      }
      return reply.code(500).send({ message: authzMessage(500) });
    }

    if (error.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error.message,
      });
    }

    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({ message: authzMessage(500) });
  });
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = fastify({
    logger: resolveLogger(options.logger),
    trustProxy: options.trustProxy ?? config.trustProxy,
  });

  app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : config.nodeEnv !== "production",
    credentials: true,
  });

  app.register(cookie);

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (config.nodeEnv === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000");
    }
    return payload;
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const raw = typeof body === "string" ? body.trim() : "";
    if (raw === "") {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: "refreshToken", signed: false },
    sign: { expiresIn: config.jwtAccessTtl },
  });

  app.decorateRequest("actor");

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: authzMessage(401) });
    }

    const userId = request.user.sub;
    if (typeof userId !== "string" || userId.length === 0) {
      return reply.code(401).send({ message: authzMessage(401) });
    }

    try {
      request.actor = await resolveActor(userId, createDbActorLookup(db));
    } catch (error) {
      if (error instanceof AuthzError) {
        const status = error.code === "UNKNOWN_USER" || error.code === "INACTIVE_USER" ? 401 : 403;
        return reply.code(status).send({ message: authzMessage(status) });
      }
      throw error;
    }
  });

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  app.get("/ready", async (_request, reply) => {
    try {
      const result = await sql<{ migration: string | null }>`
        select max(id) as migration from schema_migrations
      `.execute(db);
      const migration = result.rows[0]?.migration ?? null;

      if (!migration) {
        return reply.code(503).send({ status: "not_ready", reason: "migrations" });
      }

      return {
        status: "ready",
        database: "ok",
        migration,
        version: config.appVersion,
        sha: config.gitSha,
      };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(staffRoutes, { prefix: "/api/staff" });
  app.register(patientRoutes, { prefix: "/api/patients" });
  app.register(hrpRoutes, { prefix: "/api/hrp/patients" });
  app.register(followUpRoutes, { prefix: "/api/hrp/follow-ups" });
  app.register(nodalRoutes, { prefix: "/api/hrp/nodal" });
  app.register(fieldLevelRoutes, { prefix: "/api/hrp/field-level" });
  app.register(visitRoutes, { prefix: "/api/visits" });
  app.register(referralRoutes, { prefix: "/api/referrals" });
  app.register(facilityRoutes, { prefix: "/api/facilities" });
  app.register(syncRoutes, { prefix: "/api/sync" });
  app.register(supervisionRoutes, { prefix: "/api/supervision" });
  app.register(queueRoutes, { prefix: "/api/queue" });

  registerClientStatic(app, {
    root: config.clientDistPath,
    enabled: config.nodeEnv === "production" || config.serveClient,
  });

  registerErrorHandler(app);

  return app;
}
