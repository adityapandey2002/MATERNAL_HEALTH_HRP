export function assertSeedAllowed(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV !== "production") return;
  if (env.ALLOW_PRODUCTION_SEED === "true") return;

  throw new Error(
    "Refusing to seed a production database. Set ALLOW_PRODUCTION_SEED=true only for an approved bootstrap."
  );
}
