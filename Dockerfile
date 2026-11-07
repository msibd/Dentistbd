# Production image for the clinic app (Next.js + Prisma). One image works on any domain and any
# database: everything site-specific comes from environment variables at run time.
#
#   docker build -t dr-ovi-dental .
#   docker run --env-file .env -p 3000:3000 dr-ovi-dental
#
# Database migrations are a separate one-off step (see DEPLOYMENT.md):
#   docker run --rm --env-file .env dr-ovi-dental node_modules/.bin/prisma migrate deploy

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: needed by Prisma's migration engine; the slim image does not include it.
RUN apt-get update     && apt-get install -y --no-install-recommends openssl ca-certificates     && rm -rf /var/lib/apt/lists/*
# pnpm at the exact version in package.json ("packageManager").
RUN corepack enable
WORKDIR /app

# ---- dependencies (cached until the lockfile changes) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY . .
# The build checks that these are set but never contacts the database (public pages render at
# request time), so placeholders are enough. The real values are given when the container runs.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-run-time" \
    BETTER_AUTH_URL="http://localhost:3000" \
    pnpm build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
# The Prisma CLI (for "migrate deploy") is a dev dependency, so node_modules is copied whole.
# src, scripts and tsconfig.json are for the admin commands (first-admin seed, password reset),
# which run with tsx inside this image.
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/prisma.config.ts /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# next directly (not "pnpm start"): pnpm may try to reinstall dependencies before running a script.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
