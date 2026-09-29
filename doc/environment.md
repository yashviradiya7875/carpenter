# Environment variables

Every setting is read once in `src/config/env.ts` from the process
environment, with `.env` in the working directory loaded first. Copy
[`../.env.example`](../.env.example) to `.env` and edit it. An empty value
means "use the default".

Boot fails fast (`assertBootConfig`) when `DB_NAME` / `DB_USER` are empty, or
when `NODE_ENV=production` and `JWT_SECRET` is still the development default.

## Server

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8081` | HTTP port (binds `0.0.0.0`) |
| `NODE_ENV` | `development` | `production` enables the JWT_SECRET check and always-on rate limits |
| `CORS_ORIGINS` | `*` | Comma-separated browser origins allowed; `*` allows any |
| `DISABLE_RATE_LIMIT` | — | `true` disables every rate limiter **outside production only** |

## Database (MySQL 8)

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `surus_studio` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | *(empty)* | |
| `DB_SYNC` | `false` | `true` runs `sequelize.sync({ alter: true })` at boot — **dev only**; production uses `npm run db:sync` deliberately |
| `DB_LOGGING` | `false` | Log every SQL statement |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `10` / `0` | Connection pool size |

## Auth

| Variable | Default | Meaning |
|---|---|---|
| `JWT_SECRET` | `dev-insecure-secret-change-me` | Signing key. **Must** be set (long, random) in production |
| `JWT_EXPIRES_IN` | `30d` | Token lifetime (`jsonwebtoken` syntax: `12h`, `7d`, …) |
| `AUTH_STRICT` | `false` | `true` requires a Bearer token on every non-public call — no trusting `username` in the body. See [architecture.md](architecture.md#identity) |
| `BCRYPT_ROUNDS` | `10` | Password hash cost |

## Image generation

| Variable | Default | Meaning |
|---|---|---|
| `IMAGE_PROVIDER` | `gemini` | `gemini` or `openai` — default for a fresh install only; the Admin Panel choice (stored in the DB) wins |
| `GEMINI_API_KEY` | — | Overrides the key saved in the Admin Panel |
| `GEMINI_MODEL` | `gemini-3-pro-image-preview` | Image model |
| `GEMINI_TEXT_MODEL` | `gemini-flash-latest` | Text model for `generateCreativeBrief` (always Gemini) |
| `GEMINI_TIMEOUT_MS` | `900000` | Per-request timeout (15 min) |
| `OPENAI_API_KEY` | — | Overrides the key saved in the Admin Panel |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-sunburst` | |
| `OPENAI_IMAGE_QUALITY` | `high` | `low` \| `medium` \| `high` \| `xhigh` \| `max` \| `auto` |
| `OPENAI_INPUT_FIDELITY` | *(empty)* | Only for models that accept it; `gpt-image-2.5-sunburst` rejects it |
| `OPENAI_OUTPUT_FORMAT` | `png` | `png` \| `jpeg` \| `webp` (stored renders are WebP regardless) |
| `OPENAI_OUTPUT_COMPRESSION` | `90` | 0–100, jpeg/webp only |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | |
| `OPENAI_TIMEOUT_MS` | `900000` | |

Resolution is not an env setting: each account has a `1K` / `2K` / `4K` tier
(set by an admin with `updateUser`) that drives both output size and credit
price.

## Storage

| Variable | Default | Meaning |
|---|---|---|
| `LOCAL_UPLOAD_DIR` | `uploads` | Directory (relative to the working dir, or absolute) where every image is written; also the URL prefix it is served under |
| `PUBLIC_BASE_URL` | `http://localhost:$PORT` | Origin used to build stored image URLs — must be the API's public URL in production (`https://api.namelessos.cloud`) |
| `MAX_UPLOAD_MB` | `25` | Largest file accepted by `uploadProducts` |
| `MAX_UPLOAD_FILES` | `200` | Most files in one `uploadProducts` request |

## Payments (Razorpay)

| Variable | Default | Meaning |
|---|---|---|
| `RAZORPAY_KEY_ID` | — | Without both keys, `createPaymentOrder` / `verifyPaymentSignature` refuse |
| `RAZORPAY_KEY_SECRET` | — | |

## Email (SMTP)

| Variable | Default | Meaning |
|---|---|---|
| `SMTP_SERVICE` | `gmail` | Nodemailer service name |
| `SMTP_USER` / `SMTP_PASS` | — | For Gmail, an app password |
| `MAIL_FROM` | `"Surus App" <noreply@surus.app>` | |
| `APP_PUBLIC_URL` | `http://localhost:5173` | The **frontend** origin — used in emailed links and every public page / QR URL (`/product/…`, `/collection/…`, `/q/…`) |

## Housekeeping

| Variable | Default | Meaning |
|---|---|---|
| `GENERATION_CLEANUP` | `true` | Run the retention pass after each saved generation |
| `GENERATION_MAX_AGE_DAYS` | `7` | Delete generations older than this |
| `GENERATION_MAX_RECORDS` | `100` | Then keep only this many generations **in total** |

⚠️ Retention is platform-wide and deletes the image files too — see
[architecture.md](architecture.md#background-work).

## Seed (`npm run db:seed`)

| Variable | Default | Meaning |
|---|---|---|
| `SEED_ADMIN_USERNAME` | `callmesuru` | Admin created on first seed (left untouched if it exists) |
| `SEED_ADMIN_PASSWORD` | *(see `.env.example`)* | **Change it** before seeding anything reachable from the internet |

## Firebase export (migration tooling only)

Read only by `npm run migrate:export`, never by the server:
`FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_SERVICE_ACCOUNT`,
`FIREBASE_EXPORT_DIR`. See the main [README](../README.md#migrating-off-firebase).
