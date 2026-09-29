# Surus Studio backend — documentation

The API behind [namelessos.cloud](https://namelessos.cloud): TypeScript,
Express, Sequelize and MySQL 8, with Gemini / OpenAI image generation. Every
endpoint is `POST /api/<name>` with `{ "data": { … } }`.

## Start here

| If you want to… | Read |
|---|---|
| Run the API on your machine | [setup-local.md](setup-local.md) |
| Deploy or operate production | [setup-production.md](setup-production.md) → [deploy/README.md](../deploy/README.md) (full runbook) |
| Understand how it fits together | [architecture.md](architecture.md) |
| Look up an endpoint | [api-reference.md](api-reference.md) — all 114, grouped by feature |
| Call the API from Postman | [postman.md](postman.md) + [`postman/`](postman/) |
| Configure it | [environment.md](environment.md) — every environment variable |
| Onboard Carpenter manufacturers / dealers | [../docs/carpenter-onboarding.md](../docs/carpenter-onboarding.md) |

## Contents of this folder

```
doc/
├── README.md               this index
├── architecture.md         stack, request lifecycle, identity, errors, storage, AI pipeline, data model
├── setup-local.md          install, MySQL, .env, schema + seed, run, troubleshoot
├── setup-production.md     topology, .env checklist, schema changes, backups, operating
├── environment.md          every environment variable with its default
├── api-reference.md        every endpoint (generated)
├── postman.md              importing and using the Postman collection
├── postman/
│   ├── Surus-Studio-API.postman_collection.json          (generated)
│   ├── Surus-Studio-Local.postman_environment.json       (generated)
│   └── Surus-Studio-Production.postman_environment.json  (generated)
└── tools/
    ├── endpoints.mjs       the endpoint spec — edit this when routes change
    └── build.mjs           generates api-reference.md + postman/, checks coverage
```

## Five-minute tour

```bash
npm install && cp .env.example .env
docker compose up -d mysql
npm run db:sync && npm run db:seed
npm run dev                                   # → http://localhost:8081
curl localhost:8081/health
```

Then import `doc/postman/`, set `username` / `password` in the *Local*
environment, and send any request — the collection signs in and stores the
token by itself.

## When you change the API

1. Add / change the `callable(...)` in `src/routes/`.
2. Describe it in `doc/tools/endpoints.mjs`.
3. `node doc/tools/build.mjs` — regenerates the reference and the Postman
   files, and fails if any route is undocumented.
