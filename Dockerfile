# syntax=docker/dockerfile:1
ARG NODE_VERSION=24

# ---- deps: full install for the build -------------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund

# ---- build ------------------------------------------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ may be absent (git doesn't track empty dirs); the runtime stage copies it.
RUN mkdir -p public && npm run build

# ---- yt-dlp: fetch the standalone binary and verify its checksum -------------
FROM debian:trixie-slim AS ytdlp
ARG TARGETARCH
ARG YTDLP_VERSION=latest
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
  case "${TARGETARCH:-amd64}" in \
    amd64) asset=yt-dlp_linux ;; \
    arm64) asset=yt-dlp_linux_aarch64 ;; \
    *) echo "unsupported arch ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  if [ "$YTDLP_VERSION" = latest ]; then base=https://github.com/yt-dlp/yt-dlp/releases/latest/download; \
  else base="https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}"; fi; \
  mkdir -p /out && cd /out; \
  curl -fsSL --retry 3 -o "$asset" "$base/$asset"; \
  curl -fsSL --retry 3 -o SHA2-256SUMS "$base/SHA2-256SUMS"; \
  grep " ${asset}\$" SHA2-256SUMS | sha256sum -c -; \
  mv "$asset" yt-dlp && chmod 0755 yt-dlp && rm SHA2-256SUMS

# ---- runtime ----------------------------------------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    YTDLP_PATH=/opt/yt-dlp/yt-dlp \
    YTDLP_AUTO_UPDATE=true \
    HOME=/home/node

# yt-dlp lives in a node-owned directory so `yt-dlp -U` can keep it current;
# YouTube changes often enough that a stale binary is the most common failure.
COPY --from=ytdlp --chown=node:node /out/yt-dlp /opt/yt-dlp/yt-dlp
RUN chown node:node /opt/yt-dlp && mkdir -p /data && chown node:node /data

WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
