import { z } from "zod";

const ClientConfigSchema = z
  .object({
    VITE_API_URL: z
      .string()
      .min(1)
      .refine(
        (value) => value.startsWith("/") || value.startsWith("https://"),
        "VITE_API_URL must be a relative path or an https URL"
      ),
    VITE_NATIVE_APP: z.enum(["true", "false"]).default("false"),
    VITE_DEMO_MODE: z.enum(["true", "false"]).default("true"),
    VITE_APP_VERSION: z.string().min(1).default("0.0.0"),
    VITE_GIT_SHA: z.string().min(1).default("unknown"),
  })
  .superRefine((value, ctx) => {
    // The Android WebView is served from https://localhost, so a relative API
    // path would call the app itself instead of the server. Fail the build
    // instead of shipping an APK that can never sign in.
    if (value.VITE_NATIVE_APP === "true" && value.VITE_API_URL.startsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VITE_API_URL"],
        message:
          "VITE_API_URL must be an absolute https URL when VITE_NATIVE_APP=true (the WebView origin is https://localhost)",
      });
    }
  });

export interface ClientConfig {
  apiUrl: string;
  nativeApp: boolean;
  demoMode: boolean;
  appVersion: string;
  gitSha: string;
}

export function loadClientConfig(env: Record<string, string | undefined>): ClientConfig {
  const parsed = ClientConfigSchema.safeParse({
    VITE_API_URL: env.VITE_API_URL ?? "/api",
    VITE_NATIVE_APP: env.VITE_NATIVE_APP,
    VITE_DEMO_MODE: env.VITE_DEMO_MODE,
    VITE_APP_VERSION: env.VITE_APP_VERSION,
    VITE_GIT_SHA: env.VITE_GIT_SHA,
  });

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new Error(`Invalid client configuration: ${[...new Set(names)].join(", ")}`);
  }

  return {
    apiUrl: parsed.data.VITE_API_URL,
    nativeApp: parsed.data.VITE_NATIVE_APP === "true",
    demoMode: parsed.data.VITE_DEMO_MODE === "true",
    appVersion: parsed.data.VITE_APP_VERSION,
    gitSha: parsed.data.VITE_GIT_SHA,
  };
}
