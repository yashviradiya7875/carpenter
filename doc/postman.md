# Postman collection

`doc/postman/` holds a collection with **every endpoint** (114 requests in
20 folders) and two environments:

| File | What |
|---|---|
| `Surus-Studio-API.postman_collection.json` | All requests, scripts and variables |
| `Surus-Studio-Local.postman_environment.json` | `baseUrl = http://localhost:8081` |
| `Surus-Studio-Production.postman_environment.json` | `baseUrl = https://api.namelessos.cloud` |

All three are generated — edit `doc/tools/endpoints.mjs` and run
`node doc/tools/build.mjs` rather than editing the JSON (see
[Keeping it current](#keeping-it-current)).

## Import

1. Postman → **Import** → drop the three files from `doc/postman/`.
2. Select the **Surus Studio — Local** (or Production) environment, top right.
3. In that environment set **`username`** and **`password`** (password is a
   secret-type variable, so it is masked and not synced in plain text).
4. Send any request.

## Authentication — automatic

The collection uses **Bearer `{{authToken}}`** for every request, and two
scripts keep that token valid without you copying anything:

- **`Auth → login`** — its test script stores `result.token` in the
  `authToken` **collection variable**, with its expiry
  (`authTokenExpiresAt`, read from the JWT's `exp`) and the account's `role`.
  It also fills `organizationId` (for Org chat) when that is empty.
- **Collection pre-request script (auto-login)** — before any request that is
  not marked *No Auth*, if `authToken` is missing or expires within a minute
  and `username` / `password` are set, it calls `/api/login` itself and stores
  the new token. So on a fresh import you never have to run `login` first.
- **Collection test script** — checks every response is JSON, logs the error
  code and message of a failed call to the Postman console, and clears
  `authToken` on a `401` so the next request signs in again.

Public endpoints (`login`, `signup`, `getProductPage`, `resolveQrCode`, …) are
set to **No Auth** and never trigger auto-login.

`signup` does **not** replace the stored token — the collection stays signed
in as `{{username}}`. To act as another account, change `username` /
`password` in the environment and clear `authToken` (or just run `login`).

## Chained variables

Requests that create something save its id for the requests after them, so
the folders can be run top to bottom:

| Saved by | Variable(s) |
|---|---|
| `register` | `targetUsername` |
| `generate*`, `saveGeneration` | `generationId` |
| `createFolder` | `folderId` |
| `createShareLink` | `shareToken` |
| `listCarpenterScenes`, `createCarpenterScene` | `sceneId` (used by `generateCarpenter`) |
| `createCollection` | `collectionId` |
| `uploadProducts`, `listProducts` | `productId` |
| `getProduct` | `imageId` (a face id, usable as `{ "imageId": … }` in generation calls) |
| `createProductPage` | `productPageToken` |
| `publishCollectionPage` | `collectionPageToken` |
| `createQrCode` | `qrId`, `qrCode` |
| `createProductLink` | `productLinkToken` |
| `recordShareAttempt` | `attemptId`, `clientId` |
| `saveTileCollection` | `tileCollectionId` |
| `createTileSize` | `tileSizeValue` |
| `createMasterPrompt` | `promptId` |
| `getPackages`, `createPackage` | `packageId` |
| `getErrorLogs` | `errorLogId` |

Each request's description lists what it saves. `sampleImageBase64` is a 1×1
PNG used wherever a body needs image bytes.

## Folders

Grouped by feature — Health & discovery, Auth, Users & credits, AI
generation, Generations, Files, Catalog, QR-Gen-Pro, Product links, Carpenter
sharing, Carpenter scenes, Tile scenes, Tile sizes, Master prompts, Shop & payments, Org chat,
System, Error log, Misc — plus **Cleanup (run last)**, which holds every
delete request so a full run creates everything first and removes it at the
end. The [API reference](api-reference.md) lists each delete under its own
feature.

Each request's description (the *Docs* pane) repeats the reference: auth,
required fields, response shape and notes.

## Running the whole collection

Use the Collection Runner (or `newman`) against a **local or throwaway**
database — the run creates and deletes real records:

```bash
npx newman run doc/postman/Surus-Studio-API.postman_collection.json \
  -e doc/postman/Surus-Studio-Local.postman_environment.json \
  --env-var username=youradmin --env-var password='…'
```

Things to know:

- **Sign in as an admin.** Many folders (users, packages, prompts, tile sizes,
  system) are admin-only.
- **AI generation spends credits and provider quota** on every success.
  Exclude the folder, or run it against an account and key you are happy to
  spend. Without a provider key each call fails with "API key not configured"
  and refunds.
- **System (admin)** would overwrite the stored Gemini / OpenAI keys with the
  placeholder text — exclude it unless you put real keys in the bodies.
- **`uploadProducts` needs a file.** Pick one in the request's `files` field
  (Postman can't ship a file inside a collection); without it the request
  fails and the product requests after it have no `productId`.
- Expected failures on a plain local setup: `verifyEmail` / `resetPassword`
  (need a token from a real email), `createPaymentOrder` /
  `verifyPaymentSignature` (need Razorpay keys), and `signup` on a second run
  (the user already exists).
- Set `DISABLE_RATE_LIMIT=true` on a local server if a run trips the 30 / 15
  min auth limit.

A full run (minus AI generation and System, with an image picked for
`uploadProducts`) was verified against a fresh MySQL 8 database: every
request except the expected failures above returned `200`, with all script
assertions passing.

## Keeping it current

The collection, the environments and [api-reference.md](api-reference.md) are
all generated from `doc/tools/endpoints.mjs`:

```bash
node doc/tools/build.mjs          # regenerate everything
node doc/tools/build.mjs --check  # fail if a route in src/routes is not documented
```

`--check` compares the spec with every `callable("…")` and router route in
`src/routes`, so a new, renamed or deleted endpoint is caught. Re-import the
collection in Postman after regenerating (Import → *Replace*).
