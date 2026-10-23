import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { authRoutes } from "./auth.js";

interface MockDb {
  selectFrom: ReturnType<typeof vi.fn>;
}

const mockDb = db as unknown as MockDb;
const passwordHash = bcrypt.hashSync("password123", 4);

const user = {
  id: "user-1",
  employee_id: "ANM001",
  name: "Asha Kumari",
  phone: "9876543210",
  role: "ANM",
  facility_id: "facility-1",
  language: "hi",
  is_active: true,
  password_hash: passwordHash,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function userQuery(result: typeof user | null) {
  const chain = {
    where: vi.fn(() => chain),
    executeTakeFirst: vi.fn(async () => result),
    executeTakeFirstOrThrow: vi.fn(async () => {
      if (!result) throw new Error("Not found");
      return result;
    }),
  };

  return {
    selectAll: vi.fn(() => chain),
    select: vi.fn(() => chain),
  };
}

async function buildAuthApp(): Promise<FastifyInstance> {
  const app = fastify();

  await app.register(cookie);
  await app.register(jwt, {
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
  await app.register(authRoutes, { prefix: "/api/auth" });

  return app;
}

describe("Auth Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.selectFrom.mockReturnValue(userQuery(user) as never);
    app = await buildAuthApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("logs in an active user and sets an httpOnly refresh cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "ANM001", password: "password123" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.employeeId).toBe("ANM001");
    expect(body.user.passwordHash).toBeUndefined();

    const refreshCookie = response.cookies.find((item) => item.name === "refreshToken");
    expect(refreshCookie?.value).toBeTruthy();
    expect(refreshCookie?.httpOnly).toBe(true);
  });

  it("rejects invalid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "ANM001", password: "test-wrong-password" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.cookies).toHaveLength(0);
  });

  it("rejects a missing user without leaking whether the account exists", async () => {
    mockDb.selectFrom.mockReturnValue(userQuery(null) as never);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "UNKNOWN", password: "password123" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Invalid credentials" });
  });

  it("refreshes an access token from the refresh cookie", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "ANM001", password: "password123" },
    });
    const refreshToken = login.cookies.find((item) => item.name === "refreshToken")?.value ?? "";

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTruthy();
    expect(response.cookies.some((item) => item.name === "refreshToken")).toBe(true);
  });

  it("rejects refresh without a cookie", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/refresh" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "No refresh token provided" });
  });

  it("rejects an invalid refresh token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refreshToken: "not-a-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Invalid refresh token" });
  });

  it("returns the current user for a valid access token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "ANM001", password: "password123" },
    });
    const accessToken = login.json().accessToken as string;

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().employeeId).toBe("ANM001");
  });

  it("rejects the current-user endpoint without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });

    expect(response.statusCode).toBe(401);
  });

  it("clears the refresh cookie on logout", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/logout" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Logged out" });
    expect(response.cookies.some((item) => item.name === "refreshToken")).toBe(true);
  });
});
