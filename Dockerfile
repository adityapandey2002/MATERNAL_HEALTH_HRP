# syntax=docker/dockerfile:1.7
#
# Single-origin demo image: Fastify serves the API and the built PWA from one
# container, so the refresh cookie stays first-party. This is the free-tier
# demo topology only; it is not a PHI deployment. See
# docs/runbooks/free-demo-deploy.md and ADR-006.

FROM node:22.22-alpine3.24 AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY packages/server/tsconfig.json packages/server/tsconfig.json
COPY packages/server/src packages/server/src
COPY packages/server/migrations packages/server/migrations
COPY packages/client packages/client

RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=packages/client \
 && npm run build --workspace=packages/server \
 && find packages/shared/dist packages/client/dist packages/server/dist -name '*.map' -type f -delete

FROM node:22.22-alpine3.24 AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci --omit=dev

FROM node:22.22-alpine3.24 AS runner
ARG GIT_SHA=unknown
ARG APP_VERSION=0.0.0
LABEL org.opencontainers.image.title="hrp-demo"
LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.version=$APP_VERSION

WORKDIR /app
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV CLIENT_DIST_PATH=/app/packages/client/dist

RUN addgroup -S hrp && adduser -S -G hrp hrp

COPY --from=prod-deps --chown=hrp:hrp /app/node_modules ./node_modules
COPY --from=build --chown=hrp:hrp /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=hrp:hrp /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=hrp:hrp /app/packages/server/package.json ./packages/server/package.json
COPY --from=build --chown=hrp:hrp /app/packages/server/dist ./packages/server/dist
COPY --from=build --chown=hrp:hrp /app/packages/server/migrations ./packages/server/migrations
COPY --from=build --chown=hrp:hrp /app/packages/client/dist ./packages/client/dist
COPY --chown=hrp:hrp docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER hrp
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" >/dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
