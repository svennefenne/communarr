# syntax=docker/dockerfile:1.7
# Communarr: a closed community place for friends. One container: the Next.js server with SQLite,
# live updates and voice signalling built in. Everything it keeps lives in /data.
#
# Build stages use the full node image (python3, make, g++ in case better-sqlite3 has to compile);
# the runtime uses -slim. Both are Debian bookworm / glibc, so native modules move across.
ARG NODE_BUILD_IMAGE=node:22-bookworm
ARG NODE_RUN_IMAGE=node:22-bookworm-slim

# ───────────── 1. dependencies ─────────────
FROM ${NODE_BUILD_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ───────────── 2. build ─────────────
FROM ${NODE_BUILD_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ───────────── 3. runtime ─────────────
FROM ${NODE_RUN_IMAGE} AS run
ARG COMMUNARR_VERSION=dev
LABEL org.opencontainers.image.title="Communarr" \
      org.opencontainers.image.description="A closed community place for friends: feed, forum, chat with voice, calendar, polls, groups" \
      org.opencontainers.image.source="https://github.com/svennefenne/communarr"
RUN apt-get update && apt-get install -y --no-install-recommends gosu tini tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    COMMUNARR_VERSION=${COMMUNARR_VERSION} \
    PUID=99 PGID=100 UMASK=002 \
    TZ=Europe/Stockholm
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY docker/entrypoint.sh /entrypoint.sh
# Next's runtime cache must be writable even with a read-only image: keep it on /data
RUN chmod 755 /entrypoint.sh \
 && mkdir -p /data \
 && rm -rf /app/.next/cache && ln -s /data/cache/next /app/.next/cache
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
