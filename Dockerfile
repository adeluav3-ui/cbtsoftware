# ── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# better-sqlite3 compiles a native addon and needs these tools at build time
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Workspace manifests first — this layer is cached until lock/manifest files change
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Every package.json pnpm needs to understand the full workspace graph.
# We copy only package.json files here (not source) so that the expensive
# `pnpm install` layer is not invalidated by source-only changes.
COPY lib/db/package.json                   lib/db/
COPY lib/api-zod/package.json              lib/api-zod/
COPY lib/api-client-react/package.json     lib/api-client-react/
COPY lib/api-spec/package.json             lib/api-spec/
COPY artifacts/api-server/package.json     artifacts/api-server/
COPY artifacts/cbt-app/package.json        artifacts/cbt-app/
COPY artifacts/desktop-app/package.json    artifacts/desktop-app/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY scripts/package.json                  scripts/

# Install all deps (dev included — tsc needs them to compile)
RUN pnpm install --frozen-lockfile

# Copy tsconfigs and source for the three packages we actually need to build
COPY lib/db/tsconfig.json      lib/db/
COPY lib/db/src                lib/db/src/
COPY lib/api-zod/tsconfig.json lib/api-zod/
COPY lib/api-zod/src           lib/api-zod/src/
COPY artifacts/api-server/tsconfig.json artifacts/api-server/
COPY artifacts/api-server/src           artifacts/api-server/src/

# Build in dependency order: db → api-zod → api-server
RUN cd lib/db && pnpm build && \
    cd ../../lib/api-zod && pnpm build && \
    cd ../../artifacts/api-server && pnpm build

# pnpm deploy creates /deploy with production node_modules and the api-server
# package files, inlining @workspace/db and @workspace/api-zod directly into
# node_modules (no workspace symlinks, no devDependencies).
# dist/ is in .gitignore so pnpm deploy skips it — we copy the three dist
# directories explicitly afterwards to guarantee they are present.
RUN pnpm --filter @workspace/api-server deploy --legacy /deploy && \
    cp -r artifacts/api-server/dist         /deploy/dist && \
    cp -r lib/db/dist                       /deploy/node_modules/@workspace/db/dist && \
    cp -r lib/api-zod/dist                  /deploy/node_modules/@workspace/api-zod/dist

# ── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /deploy ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
