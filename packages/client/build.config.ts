import { z } from "zod";

const ClientConfigSchema = z.object({
  VITE_API_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith("/") || value.startsWith("https://"),
      "VITE_API_URL must be a relative path or an https URL"
    ),
  VITE_APP_VERSION: z.string().min(1).default("0.0.0"),
  VITE_GIT_SHA: z.string().min(1).default("unknown"),
});

export interface ClientConfig {
  apiUrl: string;
  appVersion: string;
  gitSha: string;
}

export function loadClientConfig(env: Record<string, string | undefined>): ClientConfig {
  const parsed = ClientConfigSchema.safeParse({
    VITE_API_URL: env.VITE_API_URL ?? "/api",
    VITE_APP_VERSION: env.VITE_APP_VERSION,
    VITE_GIT_SHA: env.VITE_GIT_SHA,
  });

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new Error(`Invalid client configuration: ${[...new Set(names)].join(", ")}`);
  }

  return {
    apiUrl: parsed.data.VITE_API_URL,
    appVersion: parsed.data.VITE_APP_VERSION,
    gitSha: parsed.data.VITE_GIT_SHA,
  };
}
