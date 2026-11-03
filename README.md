# Later Listener

Self-hosted service that turns YouTube videos into a private, Apple Podcasts–compatible feed.
Share a video from your iPhone → an Apple Shortcut POSTs it here → [yt-dlp](https://github.com/yt-dlp/yt-dlp)
converts it to MP3 → it appears in your podcast feed.

**Stack:** Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript · MongoDB 8 · shadcn/ui (Base UI) ·
Tailwind CSS 4 · Vite+ (Oxlint, Oxfmt, Vitest) · Husky · Docker Compose.

## Run it

```bash
cp .env.example .env      # then fill in the secrets (openssl rand -hex 32)
docker compose up -d --build
```

Open `http://localhost:${PORT}` (default 3000), sign in with `ADMIN_PASSWORD`, then under
**Feed & Shortcut**:

1. **Create API token** and copy it into the Shortcut (it's shown once).
2. Copy the **Feed URL** into Apple Podcasts → Library → ⋯ → _Follow a Show by URL_.

The app binds to `127.0.0.1:${PORT}` by default. Put your reverse proxy or tunnel (Caddy, Traefik,
Cloudflare Tunnel, Tailscale Funnel…) in front for HTTPS and set `PUBLIC_URL` to the public address.
If the proxy runs on another machine, set `BIND_ADDRESS=0.0.0.0`. Set `TRUST_PROXY=true` only when the
proxy sets `X-Forwarded-For`, which turns on per-client rate limits.

## Apple Shortcut

Shortcuts → **+** → name it _Listen Later_. In ⓘ, enable **Show in Share Sheet** and accept **URLs** and **Text**.

| Action               | Settings                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get Contents of URL  | URL: `https://<PUBLIC_URL>/api/episodes` · Method **POST** · Header `Authorization: Bearer ytll_…` · Request Body **JSON**, `url` = _Shortcut Input_ |
| Get Dictionary Value | Key `message` from _Contents of URL_                                                                                                                 |
| Show Notification    | _Dictionary Value_                                                                                                                                   |

The endpoint also accepts a plain-text body or a form field `url`, and pulls the link out of shared text
(e.g. `"Title https://youtu.be/…"`). Responses:
`201 {status:"created"}`, `200 {status:"duplicate"|"requeued"}`, `400` not a YouTube video,
`401` bad token, `429` rate limited.

## How it works

- **Dedupe:** the YouTube video id is the document `_id`, so every URL form (`youtu.be`, `shorts/`,
  `watch?v=…&t=…`, `music.`) maps to one episode. Re-sending a failed video retries it.
- **Worker:** started from `src/instrumentation.ts` in the same Node process. It claims jobs atomically
  from MongoDB, re-queues jobs interrupted by a restart, and reports phase and progress, which the UI
  polls. yt-dlp self-updates at startup and daily (`YTDLP_AUTO_UPDATE`).
- **Feed:** `/feed/<secret>/podcast.xml` is RSS 2.0 with iTunes tags, ETag/304 support and
  `<itunes:block>Yes</itunes:block>`, which keeps it out of the Apple directory. MP3s are served from
  `/feed/<secret>/media/<id>.mp3` with HTTP Range support, which Apple Podcasts requires.

## Security

- The feed and media can't use auth, because Apple Podcasts can't send it. They're protected by a
  256-bit random path token instead. A wrong token returns `404`, and you can rotate it from the UI.
  `Referrer-Policy: no-referrer` keeps it from leaking.
- The web UI uses a password and an HS256-signed, HttpOnly, SameSite=Lax session cookie. State-changing
  requests also require a same-origin `Origin` header (CSRF). Login and ingest are rate-limited.
- The Shortcut's bearer token is stored only as a SHA-256 hash. It can add and list episodes, but it
  can't edit, delete, or change settings.
- Only YouTube hosts and 11-character video ids are accepted. yt-dlp is spawned without a shell, always
  gets the canonical `https://www.youtube.com/watch?v=<id>` after `--`, and runs with `--ignore-config`.
  Videos longer than `MAX_DURATION_MINUTES` and live streams are rejected.
- Security headers: CSP, `X-Frame-Options: DENY`, `nosniff`, and HSTS.
- Containers run as non-root with `cap_drop: ALL` and `no-new-privileges`. MongoDB requires
  auth, publishes no ports, and sits on an internal-only network. The yt-dlp binary's SHA-256 is
  verified at build time.

## Development

Requires Node 24 (`nvm use`) and a MongoDB (e.g. `docker compose up -d mongo` with a published port, or a
local install). yt-dlp and ffmpeg must be on `PATH`.

```bash
npm install            # also installs the Husky pre-commit hook (runs `vp staged`)
cp .env.example .env.local   # set PUBLIC_URL=http://localhost:3000, MONGODB_URI, secrets
npm run dev
npm run check          # Oxfmt + Oxlint (type-aware) + type check
npm test               # Vitest via Vite+
npm run build
```

Configuration lives in `.env.example`. Config is validated at startup (`src/lib/config.ts`).
