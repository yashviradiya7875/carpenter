# Architecture

How the Surus Studio API is put together: the request path, identity, errors,
storage, the AI pipeline and the data model. For individual endpoints see
[api-reference.md](api-reference.md).

## Stack

| | |
|---|---|
| Runtime | Node.js 20, TypeScript (compiled to `dist/`) |
| HTTP | Express 4 — helmet, cors, compression, express-rate-limit |
| Database | MySQL 8 through Sequelize 6 (MySQL 8 is required: folder trees use a recursive CTE) |
| Images | Local disk (`LOCAL_UPLOAD_DIR`), served by Express at `/<LOCAL_UPLOAD_DIR>/…`; thumbnails and WebP re-encoding by `sharp` |
| AI | Google Gemini (`@google/genai`) or OpenAI Images — switchable at runtime from the Admin Panel |
| Payments | Razorpay |
| Mail | Nodemailer over SMTP (signup verification, password reset) |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashes |

The server is a port of a Firebase build (Firestore + Cloud Functions). That
history explains its one unusual trait: **every endpoint is a "callable"** that
keeps the Firebase wire format, so the React client did not need rewriting.

## Source layout

```
src/
├── index.ts            boot: config check → DB connect → listen (16-min request timeout for renders)
├── app.ts              Express app: helmet, CORS, JSON (32 MB), rate limit, auth, /uploads, /health, /api
├── config/
│   ├── env.ts          every environment variable, parsed and defaulted in one place
│   ├── db.ts           Sequelize connection
│   ├── storage.ts      write / delete / thumbnail files on local disk
│   ├── gemini.ts, openai.ts, imageProvider.ts, systemSettings.ts
├── lib/
│   ├── callable.ts     callable() registry + Express adapter + error handler
│   ├── auth.ts         JWT issue/verify, attachAuth middleware, resolveActor, requireRole
│   ├── errors.ts       HttpsError and the code → HTTP status map
│   ├── cache.ts        small in-memory TTL cache (packages, tile sizes, prompts)
│   └── mailer.ts
├── middleware/rateLimit.ts   authLimiter, generateLimiter, globalLimiter
├── models/             one file per table; index.ts registers them + associations
├── routes/             one file per feature; each callable() self-registers
├── services/           logic shared across routes (AI pipeline, credits, permissions, publishing…)
├── prompts/            every model-facing prompt string (content, not code — see README)
├── db/                 sync.ts (schema), seed.ts (admin + packages), backfillThumbs.ts
└── migrate/            one-off Firebase export tooling
```

## Request lifecycle

```
client ──POST /api/<name> { data }──► helmet → cors → compression → express.json(32mb)
                                      → globalLimiter (600/min/IP)
                                      → attachAuth  (Bearer JWT → req.auth, never rejects)
                                      → routes/index.ts router
                                          ├─ /uploadProducts  (multer, multipart)
                                          └─ /<name> → [per-route limiter] → handler({ data, auth })
                                      → 200 { result }  |  callableErrorHandler → 4xx/5xx { error }
```

`routes/index.ts` imports every route module; each `callable("name", handler,
[middleware])` call adds itself to a registry, and the router is built from
that registry. Adding an endpoint is one `callable()` call — there is no second
list to keep in sync. `GET /api/__callables` prints what a running deployment
actually serves.

## The callable contract

```http
POST /api/login
Content-Type: application/json
Authorization: Bearer <jwt>          (optional — see Identity)

{ "data": { "username": "…", "password": "…" } }
```

| Outcome | Status | Body |
|---|---|---|
| Success | 200 | `{ "result": <anything> }` (`null` when the handler returns nothing) |
| Failure | mapped from the code | `{ "error": { "status": "<code>", "message": "…", "details"?: … } }` |

The body may also be the payload itself without the `data` wrapper — the
adapter accepts both — but clients should send `{ data }`.

### Error codes

`status` is a Firebase-style code; `lib/errors.ts` maps it to HTTP:

| Code | HTTP | Typical cause |
|---|---|---|
| `invalid-argument` | 400 | Missing / malformed field |
| `failed-precondition` | 400 | Valid request, wrong state (insufficient credits, provider not configured) |
| `out-of-range` | 400 | |
| `unauthenticated` | 401 | Wrong password; no token under `AUTH_STRICT` |
| `permission-denied` | 403 | Role or ownership check failed; token/payload user mismatch |
| `not-found` | 404 | Unknown record, or an unknown endpoint |
| `already-exists` | 409 | Duplicate username / product name |
| `aborted` | 409 | |
| `resource-exhausted` | 429 | Rate limit hit |
| `cancelled` | 499 | |
| `unimplemented` | 501 | |
| `internal`, `unknown`, `data-loss` | 500 | Unhandled error (message is passed through) — logged server-side |
| `unavailable` | 503 | |
| `deadline-exceeded` | 504 | |

## Identity

`lib/auth.ts#resolveActor` decides who is calling:

1. **Bearer token present** — `attachAuth` verifies it into `req.auth`. The
   token's username wins; a body `username` / `callerUsername` naming anyone
   else is rejected with `permission-denied`.
2. **No token, `AUTH_STRICT=false`** (default) — the body's `username` /
   `callerUsername` is trusted, exactly like the old Cloud Functions. This keeps
   older clients working but means anyone can claim any name.
3. **No token, `AUTH_STRICT=true`** — `unauthenticated`.

Tokens come from `login` and `signup`, are signed with `JWT_SECRET` and last
`JWT_EXPIRES_IN` (default 30 days). Claims: `username`, `role`,
`organizationId`.

> **Production:** set a long random `JWT_SECRET` (boot refuses the default when
> `NODE_ENV=production`) and plan to turn `AUTH_STRICT` on once every client
> sends tokens.

### Roles

| Role | Who | Can |
|---|---|---|
| `admin` | Platform operators | Everything: all users, keys, provider, packages, prompts, tile sizes, any org chat |
| `bootlegar` | Resellers | Create users, transfer its own credits to them, manage tile scenes, view error logs |
| `organization` | A company account (Carpenter: **Manufacturer**) | Create `org_user` members that share its credit pool; own org chat room; view error logs |
| `org_user` | Member of an organization (Carpenter: **Sponsored dealer**) | Use the org's credits; sees the manufacturer's catalog |
| `user` | Individual (Carpenter: **Dealer Pro**) | Own work only |

On top of roles, `allowedApps` on each user gates which apps the client shows
(`SURUSHOT`, `TILEMASTER`, `CARPENTER`, `QR_GEN_PRO`, …), and
`services/capabilities.ts` derives Carpenter-specific capabilities (share,
download, save-to-files, laminate source, files access) from role +
organization. See [../docs/carpenter-onboarding.md](../docs/carpenter-onboarding.md)
for the Carpenter market model.

## Rate limits

| Limiter | Applies to | Window | Max |
|---|---|---|---|
| `authLimiter` | `login`, `signup`, `forgotPassword`, `resetPassword` | 15 min | 30 per IP |
| `generateLimiter` | every `generate*` + `generateCreativeBrief` | 1 min | 20 per IP |
| `globalLimiter` | everything | 1 min | 600 per IP |

`app.set("trust proxy", 1)` makes the IP the one nginx forwards. Outside
production, `DISABLE_RATE_LIMIT=true` turns all three off (handy for Postman /
newman runs).

## Storage

All binary data lives on local disk under `LOCAL_UPLOAD_DIR` (default
`uploads/`), written by `config/storage.ts` and served statically at
`PUBLIC_BASE_URL/<LOCAL_UPLOAD_DIR>/…` with a year-long immutable cache and
`Access-Control-Allow-Origin: *` (the client draws catalog images onto a
canvas; without that header the canvas is tainted).

- Renders and catalog faces are stored as WebP, each with a 400 px
  `.thumb.webp` sibling whose URL is kept on the row (`thumb_url`).
- Catalog originals are kept untouched alongside the WebP (`original_url`).
- Deleting a file deletes its thumbnail.
- **The uploads directory is the only copy** of every image — back it up with
  the database (see [setup-production.md](setup-production.md#backups)).

## AI generation pipeline

The seven `generate*` routes (`routes/ai.ts`) only validate the payload and
assemble the images **in the order the prompt expects**; everything else is
`services/ai.ts#runGeneration`:

1. Read the account's resolution tier (`1K` / `2K` / `4K`) and the active
   provider — before any credit is spent.
2. Price the tier and deduct credits (an org member spends the org's pool).
3. Call Gemini or OpenAI with the prompt from `src/prompts/` and the image parts.
4. Store the returned image (WebP + thumbnail) and save a `generations` row.
5. On **any** failure: refund, record the error in `error_logs`, rethrow.

Catalog images can be passed as `{ imageId }` instead of base64;
`services/imageRefs.ts` reads them from disk and keeps their position.
Carpenter scenes work the same way: `generateCarpenter` with a `sceneId`
reads that `carpenter_scenes` image from disk and renders the laminate onto it
through the same "refinish this photo" prompt an uploaded room uses.

The provider (`gemini` / `openai`) and its API keys are set from the Admin
Panel (`setImageProvider`, `setGeminiKey`, `setOpenAIKey`) and stored in
`system_config`; keys in `.env` take precedence. `IMAGE_PROVIDER` is only the
default for a fresh install.

## Public pages

Four things are reachable without an account. The API serves their data; the
SPA (`APP_PUBLIC_URL`) renders them:

| SPA route | Data from | Stored as |
|---|---|---|
| `/p/<token>` | `getProductLink` | Snapshot of a finished render (`product_links`) |
| `/product/<token>` | `getProductPage` | Snapshot of one catalog product (`product_pages`) |
| `/collection/<token>` | `getCollectionPage` | **Live** view of a collection's products (`collection_pages`) |
| `/q/<code>` | `resolveQrCode` | A QR identity pointing at a product or collection page (`qr_codes.target_type`) |
| `/share/<token>` | `getSharedResource` | Files share link (`share_links`) |

Snapshots keep printed QR codes and sent links working after a product is
renamed or deleted. A QR encodes only `/q/<code>`, so it can be re-pointed
without reprinting. Uploading products auto-publishes a page + QR for each.

## Data model

26 tables, created from the models by `npm run db:sync`
(`sequelize.sync({ alter: true })`). Associations are declared with
`constraints: false`: they exist for `include` joins, not as database foreign
keys, so deleting a user keeps their history and folder deletes decide for
themselves what happens to the files inside. Every join column is indexed.

| Table | Holds |
|---|---|
| `users` | Accounts. **Primary key is `username`** — every other table stores that string |
| `transactions` | Credit purchases; `payment_id` UNIQUE makes payment verification idempotent |
| `packages` | Credit packages sold in the Shop |
| `generations` | One rendered image each — also the "file" of the Files app |
| `folders` | Files app folders (tree via `parent_id`) |
| `resource_shares` | Per-user roles on a file/folder (`admin` / `editor` / `viewer`) |
| `favorites` | Starred files/folders |
| `share_links` | Public Files share links with a role |
| `file_activity` | Files app activity feed |
| `collections` | Tile / laminate catalogs (`type`), private or shared |
| `products` | One tile or laminate; `(collection_id, slug)` UNIQUE so re-uploads merge |
| `product_images` | Faces of a product; `(product_id, face)` UNIQUE |
| `product_pages` | Public page for one product (snapshot) |
| `collection_pages` | Public page for one collection (live) |
| `qr_codes` | Dynamic QR: `code` + `target_token` + `target_type` |
| `product_links` | Public page for a render (snapshot) |
| `share_clients` | Carpenter clients (name, WhatsApp, notes, follow-up date) |
| `share_attempts` | Carpenter share attempts (never confirmed deliveries) |
| `carpenter_scenes` | Room photos Carpenter Pro renders laminate onto (`generateCarpenter` with `sceneId`); `source` is internal only |
| `tile_collections` | Admin-authored TileMaster Basic scenes with mapped surfaces |
| `tile_sizes` | Admin additions to / hidden markers on the built-in size list |
| `master_prompts` | Admin prompt templates; one active per tool |
| `system_config` | Key/value settings owned by the Admin Panel (provider, keys) |
| `error_logs` | Client + server errors for the Admin Panel |
| `org_chat_messages`, `org_chat_typing` | Organization chat |

## Background work

**Generation retention is global and deletes files.** With
`GENERATION_CLEANUP=true` (the default), every time a generation is saved
`services/generations.ts#cleanupOldRecords` runs two passes over the **whole**
`generations` table — not per user:

1. delete every generation older than `GENERATION_MAX_AGE_DAYS` (default 7);
2. if more than `GENERATION_MAX_RECORDS` (default 100) remain, delete all but
   the newest 100.

Each deleted row takes its image and thumbnail off disk with it. With the
defaults, the platform as a whole keeps at most 100 renders from the last
week — including renders users filed into Files folders. Raise the limits or
set `GENERATION_CLEANUP=false` in production unless that is intended.

## Tests

```bash
npm test          # node:test via tsx — capabilities and OpenAI adapter
npm run typecheck
node doc/tools/build.mjs --check   # every route documented
```
