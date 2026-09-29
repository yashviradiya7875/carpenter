# Carpenter Pro Frontend

Carpenter Pro is the Carpenter-focused React and TypeScript client for the Surus Studio API.

## Source Layout

```text
src/
  App.tsx                   Root component composition
  main.tsx                  React/Vite bootstrap
  index.css                 Global styles and resets
  assets/                   Shared static assets
  features/
    auth/                   Sign-in, signup, recovery, and auth styling
      assets/               Auth-specific imagery
    prototype/              Preserved dashboard mock; not part of the app entry
  shared/
    api/                    Typed API client and callable error handling
    auth/                   Browser session and token persistence
```

Keep feature-specific UI, state, and styles together under `features/<name>`. Put reusable infrastructure under `shared`; keep `App.tsx` focused on composing top-level features.

## Product Workflow

The Carpenter workflow is based on the shared "Carpenter Pro: Scalable Product Flow" diagram:

1. Create an account or sign in, then continue into the account's assigned onboarding.
2. Enter the common workspace and configure the share message.
3. In the Common Workspace, choose an asset source: upload custom artwork/texture, browse laminate collections visible to the account, or use sponsored-dealer assets when available. Manufacturers can curate collections; organization members can see their manufacturer's collections when shared by the API.
4. Select and configure the material, generate the rendered scene, and preview the output. Material upload can be bulk, but one render accepts a primary laminate and an optional accent laminate.
5. For a Sponsored Dealer, add the branded strip; otherwise keep the standard render. Select or add a CTA, then add a follow-up message.
6. Save the client and render record, then choose an output action: download/save to Files or share the render/branded render.
7. Open the share menu and choose WhatsApp or copy message/link. Log the share activity, update dashboard activity, show follow-up reminders, and update basic sharing statistics.

Future integrations for sales-website leads/customer data and other external systems are separate from the core workflow.

### Account and Permission Rules

The API is authoritative for roles, `allowedApps`, and Carpenter capabilities. A public signup creates a generic `user` pending approval; it must not let the visitor grant themselves Manufacturer or Sponsored Dealer access. Manufacturer accounts use the `organization` role, and Sponsored Dealers use `org_user` membership created through authorized organization flows. Only accounts with `CARPENTER` in `allowedApps` should enter this frontend.

The API records a share attempt, not confirmed delivery. Keep that distinction in activity and reporting UI.

## Local Development

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the backend origin. The local API defaults to `http://localhost:8081`; its CORS configuration must allow the Vite origin.

## Checks

```powershell
npm run build
npm run lint
```

## API Contract

The shared client sends callable requests as `POST /api/<name>` with `{ "data": ... }`, attaches the stored Bearer token when present, and unwraps `{ "result": ... }`. See [doc/api-reference.md](doc/api-reference.md) for endpoint details.

The documented `login` and `forgotPassword` endpoints require a `username` field. The current sign-in identifier is sent as that field, so email-based login depends on the backend recognizing an email there.
