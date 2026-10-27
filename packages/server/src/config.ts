import { z } from "zod";

const DEV_JWT_SECRET = "dev-secret-change-in-production-32chars";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-in-production-32chars";
const DEV_DATABASE_URL = "postgresql://hrp:hrp_dev@localhost:5432/hrp";

const booleanString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => (typeof value === "boolean" ? value : value === "true" || value === "1"));

const RawConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_TTL: z.string().min(1).default("7d"),
  CORS_ORIGINS: z.string().default(""),
  COOKIE_SECURE: booleanString.default(false),
  TRUST_PROXY: booleanString.default(false),
  SERVE_CLIENT: booleanString.default(false),
  CLIENT_DIST_PATH: z.string().min(1).default("packages/client/dist"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_API: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_SYNC: z.coerce.number().int().positive().default(60),
  DB_MIGRATION_LOCK_ID: z.coerce.number().int().default(727001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  APP_VERSION: z.string().default("0.0.0"),
  GIT_SHA: z.string().default("unknown"),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  host: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  corsOrigins: string[];
  cookieSecure: boolean;
  trustProxy: boolean;
  serveClient: boolean;
  clientDistPath: string;
  dbPoolMax: number;
  rateLimitAuth: number;
  rateLimitApi: number;
  rateLimitSync: number;
  dbMigrationLockId: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  appVersion: string;
  gitSha: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = RawConfigSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new Error(`Invalid configuration: ${[...new Set(names)].join(", ")}`);
  }

  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === "production";
  const errors: string[] = [];

  const databaseUrl = raw.DATABASE_URL ?? (isProduction ? "" : DEV_DATABASE_URL);
  if (!databaseUrl) errors.push("DATABASE_URL is required");
  if (isProduction && databaseUrl === DEV_DATABASE_URL) {
    errors.push("DATABASE_URL must not use the development default");
  }

  const jwtSecret = raw.JWT_SECRET ?? (isProduction ? "" : DEV_JWT_SECRET);
  const jwtRefreshSecret = raw.JWT_REFRESH_SECRET ?? (isProduction ? "" : DEV_REFRESH_SECRET);

  if (!jwtSecret) errors.push("JWT_SECRET is required in production");
  if (!jwtRefreshSecret) errors.push("JWT_REFRESH_SECRET is required in production");
  if (jwtSecret.length < 32) errors.push("JWT_SECRET must be at least 32 characters");
  if (jwtRefreshSecret.length < 32) {
    errors.push("JWT_REFRESH_SECRET must be at least 32 characters");
  }
  if (isProduction && jwtSecret.includes("dev-secret")) {
    errors.push("JWT_SECRET must not use a development value");
  }
  if (isProduction && jwtRefreshSecret.includes("dev-refresh-secret")) {
    errors.push("JWT_REFRESH_SECRET must not use a development value");
  }
  if (jwtSecret === jwtRefreshSecret) {
    errors.push("JWT_SECRET and JWT_REFRESH_SECRET must differ");
  }

  const corsOrigins = raw.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (isProduction && corsOrigins.includes("*")) {
    errors.push("CORS_ORIGINS must not contain a wildcard in production");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n- ${errors.join("\n- ")}`);
  }

  return {
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    host: raw.HOST,
    databaseUrl,
    jwtSecret,
    jwtRefreshSecret,
    jwtAccessTtl: raw.JWT_ACCESS_TTL,
    jwtRefreshTtl: raw.JWT_REFRESH_TTL,
    corsOrigins,
    cookieSecure: isProduction ? true : raw.COOKIE_SECURE,
    trustProxy: isProduction ? true : raw.TRUST_PROXY,
    serveClient: raw.SERVE_CLIENT,
    clientDistPath: raw.CLIENT_DIST_PATH,
    dbPoolMax: raw.DB_POOL_MAX,
    rateLimitAuth: raw.RATE_LIMIT_AUTH,
    rateLimitApi: raw.RATE_LIMIT_API,
    rateLimitSync: raw.RATE_LIMIT_SYNC,
    dbMigrationLockId: raw.DB_MIGRATION_LOCK_ID,
    logLevel: raw.LOG_LEVEL,
    appVersion: raw.APP_VERSION,
    gitSha: raw.GIT_SHA,
  };
}

export const config = loadConfig();
