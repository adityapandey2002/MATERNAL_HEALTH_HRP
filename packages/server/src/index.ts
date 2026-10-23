import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDb } from "./db/client.js";

const app = buildApp();

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
