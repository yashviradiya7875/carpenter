# Deployment runbook — the bundle

This repo builds the React bundle and ships it to
`/var/www/namelessos.cloud`. That is all it does. It starts no service, touches
no database and provisions nothing.

**The server is provisioned from the backend repo.** Run
[`surus-studio-backend/deploy/scripts/provision.sh`](https://github.com/callmesuru/surus-studio-backend/blob/main/deploy/scripts/provision.sh)
once, before the first deploy from here — it creates the web root, installs the
`namelessos.cloud` vhost (a copy lives in `deploy/nginx/` here for reference
only) and puts a placeholder page at `current` so nginx does not start on a
dangling root.

```
/var/www/namelessos.cloud/
├── releases/<id>/          index.html + assets/     (one per deploy)
├── current   -> releases/<id>                        nginx root
├── previous  -> releases/<id>                        rollback target
└── bin/web-release.sh          uploaded by this workflow on every run
```

---

## Setup

Add these secrets under `Settings → Secrets and variables → Actions`. They are
the same values the backend repo uses — one deploy key serves both:

| Secret | Value |
|---|---|
| `SSH_HOST` | server IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | the deploy key's private half, whole file including header and footer |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan -H <SSH_HOST>` |
| `SSH_PORT` | only if SSH is not on 22 |

`SSH_KNOWN_HOSTS` is not optional padding: it pins the host key, so a deploy
cannot be delivered to something else that has taken over the address.

`VITE_API_BASE_URL` is **not** a secret. It is set in the workflow to
`https://api.namelessos.cloud` and baked into the bundle at build time.
Changing which API the site talks to means editing `.github/workflows/deploy.yml`
and redeploying — there is no runtime configuration to flip.

---

## Everyday operation

Deploys happen on every push to `main`, after CI passes.

```bash
/var/www/namelessos.cloud/bin/web-release.sh status      # what is live
/var/www/namelessos.cloud/bin/web-release.sh rollback    # previous release
/var/www/namelessos.cloud/bin/web-release.sh prune 5     # keep the last 5
```

No nginx reload is needed: `root` points at the `current` symlink and nginx
resolves it per request, so flipping the link switches the site instantly.

### Ordering against the API

The two halves ship separately, and a frontend rollback does **not** roll the
API back with it. Sequence changes that cross the boundary:

- **A screen needing a new endpoint:** deploy the API first, this repo after.
- **Dropping use of an endpoint:** deploy this repo first, then the API removal.

`https://api.namelessos.cloud/api/__callables` lists what the live API actually
serves — the quickest way to check a bundle's assumptions before shipping it.

### How a deploy is made safe

1. CI typechecks and builds.
2. The job rsyncs into a **new** `releases/<timestamp>-<sha>` directory —
   nothing live is touched yet.
3. `web-release.sh activate` records the current release as `previous`, then
   flips the symlink and asks nginx for `/index.html`. If the new release does
   not serve the app shell it restores the previous one and fails the job.
4. The workflow then verifies the public URL through TLS. Any failure after
   activation triggers `web-release.sh rollback`.

Only `index.html` is served no-cache; hashed assets are immutable for a year.
That combination is what lets a release switch instantly without visitors
holding a stale bundle.

---

## Troubleshooting

| Symptom | Where to look |
|---|---|
| Deploy fails at "Activate release" | `nginx -t`, then `tail /var/log/nginx/namelessos.cloud.error.log`. Usually the web root was never provisioned |
| Site loads, every API call fails | Version skew or the API is down. Check `https://api.namelessos.cloud/health` and `/api/__callables` |
| Site serves the old bundle | `index.html` was cached. The vhost must send `Cache-Control: no-cache` for it — check the `location = /index.html` block |
| A deep link 404s on refresh | The SPA fallback (`try_files $uri $uri/ /index.html`) is missing from the vhost |
| Calls go to `localhost:8081` in production | The bundle was built without `VITE_API_BASE_URL`. It is baked in at build time; rebuild via the Deploy workflow |
| Still the placeholder page | No frontend deploy has succeeded yet — check Actions |
