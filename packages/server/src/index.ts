import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { db } from "./db/client.js";
import { authRoutes } from "./routes/auth.js";
import { facilityRoutes } from "./routes/facilities.js";
import { patientRoutes } from "./routes/patients.js";
import { queueRoutes } from "./routes/queue.js";
import { referralRoutes } from "./routes/referrals.js";
import { supervisionRoutes } from "./routes/supervision.js";
import { syncRoutes } from "./routes/sync.js";
import { visitRoutes } from "./routes/visits.js";

const app = fastify({ logger: true });

app.register(cors, {
  origin: true,
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
  secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  cookie: { cookieName: "refreshToken", signed: false },
  sign: { expiresIn: "15m" },
});

app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

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
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST ?? "0.0.0.0",
    });
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
