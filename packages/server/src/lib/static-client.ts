import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/**
 * The built client is a single-page app. Anything that is not an API route
 * must return index.html so client-side routes survive a hard refresh.
 */
const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const NO_CACHE_FILES = new Set([
  "index.html",
  "sw.js",
  "registerSW.js",
  "manifest.json",
  "manifest.webmanifest",
]);

export interface ClientStaticOptions {
  root: string;
  enabled: boolean;
}

function isApiRequest(url: string): boolean {
  const pathname = url.split("?")[0] ?? "/";
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/health" ||
    pathname === "/ready"
  );
}

function cacheControlFor(relativePath: string): string | undefined {
  if (NO_CACHE_FILES.has(relativePath)) return "no-cache";
  if (relativePath.startsWith("assets/")) return "public, max-age=31536000, immutable";
  return undefined;
}

/**
 * Serves the built PWA from the API origin and falls back to index.html for
 * client-side routes. Returns false when the build is absent, in which case
 * the server keeps running as an API-only service.
 */
export function registerClientStatic(app: FastifyInstance, options: ClientStaticOptions): boolean {
  if (!options.enabled) return false;

  const root = path.resolve(options.root);
  const indexFile = path.join(root, "index.html");
  if (!existsSync(indexFile)) {
    app.log.warn({ root }, "Client build not found; serving API only");
    return false;
  }

  const indexHtml = readFileSync(indexFile, "utf8");

  void app.register(fastifyStatic, {
    root,
    index: ["index.html"],
    maxAge: "1h",
    setHeaders(res, filePath) {
      const relative = path.relative(root, filePath).split(path.sep).join("/");
      const cacheControl = cacheControlFor(relative);
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      if (relative === "index.html") {
        res.setHeader("Content-Security-Policy", HTML_CSP);
      }
    },
  });

  app.setNotFoundHandler((request, reply) => {
    const acceptsHtml = (request.headers.accept ?? "").includes("text/html");
    if (request.method === "GET" && acceptsHtml && !isApiRequest(request.url)) {
      return reply
        .header("Cache-Control", "no-cache")
        .header("Content-Security-Policy", HTML_CSP)
        .type("text/html; charset=utf-8")
        .send(indexHtml);
    }

    return reply.code(404).send({ message: "Not found" });
  });

  return true;
}
