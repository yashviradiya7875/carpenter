# Local setup

Get the API running on your machine, seeded with an admin, and answering
Postman.

## Prerequisites

- **Node.js 20** (`node -v`). `sharp` ships prebuilt binaries for glibc Linux,
  macOS and Windows.
- **MySQL 8.0+** — either installed locally or via Docker (below). MySQL 5.7 /
  MariaDB will not work: folder trees use a recursive CTE.
- Optional: a Gemini or OpenAI API key to actually generate images; SMTP
  credentials for signup / reset emails; Razorpay test keys for the Shop.

## 1. Install

```bash
git clone https://github.com/callmesuru/surus-studio-backend.git
cd surus-studio-backend
npm install
cp .env.example .env
```

## 2. Database

**Option A — Docker (recommended).** The compose file runs MySQL 8 with the
right charset, using the `DB_*` values from `.env`:

```bash
docker compose up -d mysql
docker compose ps          # wait for "healthy"
```

**Option B — an existing MySQL 8.** Create the database and a user, then put
them in `.env`:

```sql
CREATE DATABASE surus_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'surus'@'localhost' IDENTIFIED BY 'surus';
GRANT ALL PRIVILEGES ON surus_studio.* TO 'surus'@'localhost';
```

## 3. Configure `.env`

The defaults in `.env.example` work for local development. At minimum check:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=surus_studio
DB_USER=surus
DB_PASSWORD=surus
CORS_ORIGINS=http://localhost:5173
APP_PUBLIC_URL=http://localhost:5173      # the frontend dev server
SEED_ADMIN_USERNAME=youradmin
SEED_ADMIN_PASSWORD=choose-a-password
```

Leave `GEMINI_API_KEY` / `OPENAI_API_KEY` empty if you only need the
non-generation endpoints — keys can also be set later from the Admin Panel.
Every variable is described in [environment.md](environment.md).

## 4. Create the schema and seed

```bash
npm run db:sync     # create / alter every table from the models
npm run db:seed     # admin account + three starter credit packages (idempotent)
```

## 5. Run

```bash
npm run dev         # tsx watch on :8081, restarts on save
```

Check it:

```bash
curl http://localhost:8081/health
# {"ok":true,"db":"up","env":"development"}

curl -s http://localhost:8081/api/login \
  -H 'Content-Type: application/json' \
  -d '{"data":{"username":"youradmin","password":"choose-a-password"}}'
# {"result":{"username":"youradmin","role":"admin",…,"token":"eyJ…"}}
```

## 6. Point the frontend at it

In `surus-studio-frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8081
```

then `npm run dev` there (port 5173, which is already in `CORS_ORIGINS`).

## 7. Explore with Postman

Import `doc/postman/` — see [postman.md](postman.md). Set `username` /
`password` in the *Local* environment and every request signs in by itself.

## Everyday commands

| Command | What |
|---|---|
| `npm run dev` | Watch mode on `:8081` |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (`node:test` via tsx) |
| `npm run db:sync` | Create / alter tables after a model change |
| `npm run db:seed` | Admin + packages (safe to re-run) |
| `npm run db:thumbs` | Backfill missing thumbnails (`--dry-run`, `--force`) |
| `npm run scenes:import -- <folder>` | Import Carpenter scenes (`--dry-run` to preview) — see [setup-production.md](setup-production.md#carpenter-scenes) |
| `node doc/tools/build.mjs` | Regenerate the API reference + Postman collection |
| `node doc/tools/build.mjs --check` | Fail if any route is undocumented |

## Running everything in Docker

```bash
docker compose up -d --build     # MySQL + the API image, config from .env
docker compose exec backend node dist/db/sync.js
docker compose exec backend node dist/db/seed.js
```

Uploaded images persist in the `uploads` volume, MySQL data in `mysql_data`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid configuration: DB_NAME is empty` | `.env` missing or not in the working directory |
| `ER_ACCESS_DENIED_ERROR` / `ECONNREFUSED 3306` | MySQL not running, or `DB_*` wrong; with Docker wait for `healthy` |
| `Unknown column …` after pulling | Run `npm run db:sync` — a model changed |
| Browser shows a CORS error | Add the frontend origin to `CORS_ORIGINS`; a very large upload can also surface as "CORS" (body > 32 MB) |
| Generation fails with "API key not configured" | Set `GEMINI_API_KEY` / `OPENAI_API_KEY`, or save one from the Admin Panel (`setGeminiKey`) |
| `429 resource-exhausted` while testing | Rate limit — `DISABLE_RATE_LIMIT=true` (ignored in production) |
| `sharp` fails to load | Reinstall on the target platform: `rm -rf node_modules && npm install` |
