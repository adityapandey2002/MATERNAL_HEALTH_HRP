import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { sql } from "kysely";
import { config } from "./config.js";
import { closeDb, db } from "./db/client.js";
import { authRoutes } from "./routes/auth.js";
import { facilityRoutes } from "./routes/facilities.js";
import { patientRoutes } from "./routes/patients.js";
import { queueRoutes } from "./routes/queue.js";
import { referralRoutes } from "./routes/referrals.js";
import { supervisionRoutes } from "./routes/supervision.js";
import { syncRoutes } from "./routes/sync.js";
import { visitRoutes } from "./routes/visits.js";

const app = fastify({
  logger: { level: config.logLevel },
  trustProxy: config.trustProxy,
});

app.register(cors, {
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : config.nodeEnv !== "production",
  credentials: true,
});

app.register(cookie);

// Tolerate an empty JSON body. Fastify's default parser rejects a request
// that declares a JSON content type but sends no body, which would turn a
// bodyless DELETE into a 400.
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

app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
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
app.register(patientRoutes, { prefix: "/api/patients" });
app.register(visitRoutes, { prefix: "/api/visits" });
app.register(referralRoutes, { prefix: "/api/referrals" });
app.register(facilityRoutes, { prefix: "/api/facilities" });
app.register(syncRoutes, { prefix: "/api/sync" });
app.register(supervisionRoutes, { prefix: "/api/supervision" });
app.register(queueRoutes, { prefix: "/api/queue" });

const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info({ port: config.port, env: config.nodeEnv }, "Server running");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await closeDb();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start();
