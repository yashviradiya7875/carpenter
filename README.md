# Carpenter Pro Frontend

Carpenter Pro is the Carpenter-focused React and TypeScript client for the Surus Studio API.

## Source Layout

```text
src/
  main.tsx                  React/Vite bootstrap
  index.css                 Global entry: design-system styles + app shell
  app/                      Composition root: app shell (global header + page), session gate, view state
  shared/
    ui/                     Portable design system: tokens, primitives, components, layout (see shared/ui/README.md)
    components/             Carpenter-specific shared UI: AppHeader (the global header), StepPanel (frame for inline flow steps), RoomSelect (room step), MaterialPlacement (mark where two materials go on the room photo), Brand, Mark
    api/                    Typed callable client and ApiError
    auth/                   Session storage, account types and account rules (role labels, app access)
  features/
    auth/                   Sign-in / sign-up / recovery UI; authService (API), useSession (session lifecycle)
    dashboard/              Studio workspace, laminate library, render result actions (download, share, save to Files); dashboardService (API), materials, renderActions
    files/                  Files (Drive) UI and public share page; filesService (API + normalizers), filesPermissions
    prototype/              Preserved dashboard mock; not part of the app entry
```

### Layers and dependency rules

| Layer | May import | Must not |
|---|---|---|
| `shared/ui` | React only | Anything outside `shared/ui` — it is copied as-is into other projects |
| `shared/components` | `shared/ui` | Features, API calls |
| `shared/api`, `shared/auth` | Each other | UI |
| `features/<name>` | `shared/*` | Another feature — cross-feature composition happens in `app/` (e.g. Dashboard receives a `renderFiles` slot) |
| `app/` | Everything | Business logic of its own |

### App shell, header and theme

`app/App.tsx` renders every page inside the same shell: `AppHeader` (logo, credits, theme toggle, account menu) above the page content. Pages never render their own header, and never contain theme logic. They style themselves with semantic tokens, so light and dark work automatically. App-level state the header shows (credits, current view) lives in the shell. Pages report changes through callbacks such as `onCreditsChange`.

Inside a feature:

- `<Name>Page.tsx` owns screen state and layout; `components/` holds its presentational pieces.
- `<name>Service.ts` is the only place that calls the API; it also normalizes responses.
- Domain rules live in plain modules (`materials.ts`, `filesPermissions.ts`), not in components.
- Styles stay in the feature stylesheet; shared looks come from `shared/ui` tokens and components.

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
