# syntax=docker/dockerfile:1.7
# Multi-stage production image: Next.js standalone server + background worker.

ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# ---- dependencies (cached separately from source) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM deps AS builder
COPY . .
# Public (browser) configuration is baked in at build time.
ARG NEXT_PUBLIC_ANALYTICS_SCRIPT_URL=""
ARG NEXT_PUBLIC_ANALYTICS_DOMAIN=""
ENV NEXT_PUBLIC_ANALYTICS_SCRIPT_URL=$NEXT_PUBLIC_ANALYTICS_SCRIPT_URL \
    NEXT_PUBLIC_ANALYTICS_DOMAIN=$NEXT_PUBLIC_ANALYTICS_DOMAIN
# No database or secrets are needed to build.
RUN npm run build

# ---- migration / admin tooling image (prisma CLI, tsx) ----
FROM builder AS tools
ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_STORAGE_DIR=/app/storage/media
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/dist ./dist
RUN mkdir -p /app/storage/media && chown -R node:node /app/storage
USER node
EXPOSE 3000
VOLUME ["/app/storage/media"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
