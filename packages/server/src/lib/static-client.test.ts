import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerClientStatic } from "./static-client.js";

const createdRoots: string[] = [];

function createClientBuild(): string {
  const root = mkdtempSync(path.join(tmpdir(), "hrp-client-"));
  createdRoots.push(root);
  mkdirSync(path.join(root, "assets"));
  writeFileSync(
    path.join(root, "index.html"),
    '<!doctype html><html><body><div id="root"></div></body></html>'
  );
  writeFileSync(path.join(root, "assets", "index-abc.js"), "console.log('app');");
  writeFileSync(path.join(root, "sw.js"), "self.addEventListener('fetch', () => {});");
  return root;
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("registerClientStatic", () => {
  it("does nothing when disabled", async () => {
    const app = fastify();

    expect(registerClientStatic(app, { root: "does-not-exist", enabled: false })).toBe(false);
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(404);
  });

  it("returns false when the client build is missing", async () => {
    const app = fastify();

    expect(registerClientStatic(app, { root: "does-not-exist", enabled: true })).toBe(false);
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(404);
  });

  it("serves index.html for the root and client-side routes", async () => {
    const app = fastify();
    registerClientStatic(app, { root: createClientBuild(), enabled: true });

    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");
    expect(root.headers["cache-control"]).toBe("no-cache");
    expect(root.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(root.body).toContain('<div id="root"></div>');

    const deepLink = await app.inject({
      method: "GET",
      url: "/patients/123/visit",
      headers: { accept: "text/html" },
    });
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.body).toContain('<div id="root"></div>');
  });

  it("keeps API and health routes out of the SPA fallback", async () => {
    const app = fastify();
    app.get("/api/ping", async () => ({ pong: true }));
    registerClientStatic(app, { root: createClientBuild(), enabled: true });

    const api = await app.inject({
      method: "GET",
      url: "/api/missing",
      headers: { accept: "text/html" },
    });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ message: "Not found" });

    const health = await app.inject({
      method: "GET",
      url: "/health",
      headers: { accept: "text/html" },
    });
    expect(health.statusCode).toBe(404);

    const ping = await app.inject({ method: "GET", url: "/api/ping" });
    expect(ping.json()).toEqual({ pong: true });
  });

  it("serves assets with immutable caching and the service worker uncached", async () => {
    const app = fastify();
    registerClientStatic(app, { root: createClientBuild(), enabled: true });

    const asset = await app.inject({ method: "GET", url: "/assets/index-abc.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

    const serviceWorker = await app.inject({ method: "GET", url: "/sw.js" });
    expect(serviceWorker.statusCode).toBe(200);
    expect(serviceWorker.headers["cache-control"]).toBe("no-cache");
  });
});
