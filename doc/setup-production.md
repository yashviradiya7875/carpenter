# Production setup

The step-by-step runbook — DNS, provisioning, deploy keys, GitHub secrets,
releases, rollback — is [`deploy/README.md`](../deploy/README.md). This page
is the overview and the checklist to go through before real users arrive.

## Topology

| | |
|---|---|
| API | `https://api.namelessos.cloud` — nginx → `127.0.0.1:8081` |
| Frontend | `https://namelessos.cloud` — static bundle served by nginx |
| Process | systemd unit `surus-api`, user `deploy`, runs `/opt/surus-api/current/dist/index.js` |
| Config | `/opt/surus-api/shared/.env` (never deployed, never overwritten) |
| Images | `/opt/surus-api/shared/uploads` (served by nginx at `/uploads/`) |
| Database | MySQL 8 on localhost |

Releases are directories under `/opt/surus-api/releases/<id>` with `current`
and `previous` symlinks; `bin/release.sh` activates, health-checks and rolls
back. Deploy the **API before the frontend** whenever both change, so the live
bundle never calls an endpoint the API does not serve yet
(`GET /api/__callables` shows what is live).

## First install, in short

1. Point `namelessos.cloud`, `www.` and `api.` at the server.
2. `sudo bash deploy/scripts/provision.sh --with-tls` — nginx, MySQL 8, Node 20,
   certbot, the `deploy` user, directories, database, `.env`, systemd unit,
   vhosts, firewall. Safe to re-run.
3. Fill in `/opt/surus-api/shared/.env` (checklist below).
4. Add the deploy key + secrets to both GitHub repos and run the API deploy
   workflow, then the frontend's. Each API deploy runs the schema sync itself.
5. Once, after the first deploy: `sudo -u deploy /opt/surus-api/bin/release.sh seed`
   (admin + starter packages; idempotent).

## `.env` checklist

| Setting | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 64+ random characters (`openssl rand -base64 48`). Boot refuses the default |
| `AUTH_STRICT` | `true` once you have confirmed every client sends a Bearer token — until then anyone can act as any username by naming it in the body |
| `CORS_ORIGINS` | `https://namelessos.cloud,https://www.namelessos.cloud` — not `*` |
| `PUBLIC_BASE_URL` | `https://api.namelessos.cloud` — baked into every stored image URL |
| `APP_PUBLIC_URL` | `https://namelessos.cloud` — used in emails, public pages and QR codes; changing it later breaks printed QRs |
| `LOCAL_UPLOAD_DIR` | `uploads` (the default) — every release symlinks `./uploads` to `/opt/surus-api/shared/uploads`, and nginx serves that at `/uploads/` |
| `DB_*` | The database + user the provision script created |
| `DB_SYNC` | `false` — run `npm run db:sync` deliberately after model changes |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Here or via the Admin Panel (env wins) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Live keys |
| `SMTP_*`, `MAIL_FROM` | A real mailbox (Gmail needs an app password) |
| `SEED_ADMIN_PASSWORD` | A strong password **before** the first `db:seed`; change it again in the app afterwards |
| `GENERATION_CLEANUP` / `GENERATION_MAX_*` | Decide deliberately — the defaults keep only the newest 100 renders platform-wide and delete older files ([details](architecture.md#background-work)) |

## Carpenter scenes

The room photos Carpenter Pro renders onto live in `carpenter_scenes`, with
their images under `uploads/carpenter-scenes/`. Load them from the Drive
export once, then curate in **Admin Panel → Carpenter Scenes**:

```bash
# Unzip the Drive download so the layout is <category>/<ratio>/<image>,
# e.g. extracted_scenes/kitchen/4x3/foo.jpg, and copy it to the server.
cd /opt/surus-api/current
sudo -u deploy npm run scenes:import -- /path/to/extracted_scenes --dry-run   # preview
sudo -u deploy npm run scenes:import -- /path/to/extracted_scenes             # import
```

- The ratio folder (`1x1`, `3x4`, `4x3`, `9x16`, `16x9`) becomes the scene's
  aspect ratio; renders default to it.
- Scenes are named `<Category> <n>`. The source file path is stored only as
  internal `source` — it is never sent to clients.
- Images that look unusable start **hidden**, not deleted: shorter side under
  600 px, mostly blank page, or a near-duplicate of one already imported.
  The run prints a count per reason; review them in the Admin Panel's
  *Hidden* filter.
- Re-running is safe: files already imported (same path) are skipped, so a
  later Drive export with extra images only adds the new ones.
- Each scene is stored once as WebP (longest edge 2048) plus a thumbnail — the
  first import of ~1,000 scenes adds a few hundred MB to `uploads/`.

Until any scenes exist, the app falls back to its built-in text presets.

## Long requests

A 4K render can take minutes. The Node server allows 16 minutes per request;
nginx's `proxy_read_timeout` in the API vhost is 960 s to match. Keep them in
step if either changes. JSON bodies are capped at 32 MB in both nginx
(`client_max_body_size`) and Express. `/api/uploadProducts` has its own nginx
location: 1 GB bodies, streamed (`proxy_request_buffering off`), 900 s
timeouts — the per-file and per-request caps are `MAX_UPLOAD_MB` /
`MAX_UPLOAD_FILES`.

## Schema changes

Models are the schema. `release.sh activate` runs `dist/db/sync.js`
(`sequelize.sync({ alter: true })`) on every deploy: it adds tables, columns
and indexes but never drops a column removed from a model.

- **Back up before deploying a model change** — `alter` can rewrite (and lock)
  a large table.
- To deploy without touching the schema, run the deploy workflow manually with
  **run_migrations** unchecked.

## Backups

Two things hold state, and a restore needs both:

```bash
mysqldump -u root surus_studio | gzip > ~/surus-$(date +%F).sql.gz
tar czf ~/surus-uploads-$(date +%F).tar.gz -C /opt/surus-api/shared uploads
```

The uploads directory is the only copy of every render, base photo and
catalog image — a database dump alone restores rows pointing at missing files.

## Operating

| Task | Command |
|---|---|
| Status / logs | `systemctl status surus-api` · `journalctl -u surus-api -f` |
| Health | `curl https://api.namelessos.cloud/health` |
| What is deployed | `curl https://api.namelessos.cloud/api/__callables` |
| Release status | `/opt/surus-api/bin/release.sh status` |
| Roll back | `/opt/surus-api/bin/release.sh rollback` |
| Error log | Admin Panel → Errors (`getErrorLogs`) — client and server failures |

The runbook's troubleshooting table covers 502 / 504, CORS-looking upload
failures, 403s under `AUTH_STRICT` and missing images.

## Docker alternative

`docker-compose.yml` runs MySQL 8 and the API image with `.env`, persisting
`mysql_data` and `uploads` volumes. Put it behind a TLS-terminating proxy with
the same timeouts and body limit as above, and run
`docker compose exec backend node dist/db/sync.js` /
`… dist/db/seed.js` once.
