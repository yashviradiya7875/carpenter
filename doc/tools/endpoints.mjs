/**
 * Every API endpoint, described once.
 *
 * `node doc/tools/build.mjs` turns this file into `doc/api-reference.md` and
 * the Postman collection, and fails if an endpoint registered in src/routes is
 * missing here (or listed here but gone from the code). When you add, rename
 * or remove a callable, update this file and re-run the build.
 *
 * Fields per endpoint:
 *   name      callable name — the request is POST /api/<name>
 *   auth      public | user | manager (admin, bootlegar, organization) |
 *             staff (admin, bootlegar) | admin
 *   summary   one line for the reference and the Postman request
 *   required  body fields the handler rejects the call without
 *   body      example `data` payload ({{var}} = Postman variable)
 *   returns   shape of `result` on success
 *   notes     anything a caller must know (optional)
 *   capture   { postmanVariable: "path.in.result" } saved after a 2xx (optional)
 *   cleanup   N — destructive; Postman runs these last, in this order, from a
 *             "Cleanup" folder so a top-to-bottom collection run works
 *   multipart / method / path  for the few non-callable routes
 */

const img = "{{sampleImageBase64}}";
const mime = "image/png";

export const groups = [
  {
    name: "Health & discovery",
    description: "Plain GET routes outside the callable contract. No auth.",
    endpoints: [
      {
        name: "health", method: "GET", path: "/health", auth: "public",
        summary: "Liveness + database check.",
        returns: "`{ ok, db: \"up\" | \"down\", env }` — 503 when MySQL is unreachable.",
      },
      {
        name: "__callables", method: "GET", path: "/api/__callables", auth: "public",
        summary: "Every callable name this deployment serves.",
        returns: "`{ callables: string[] }` (sorted).",
        notes: "Use it to confirm a deploy exposes what the client calls.",
      },
    ],
  },

  {
    name: "Auth",
    description:
      "Sign-in, sign-up and account creation. `login` and `signup` return a JWT that the collection stores in `{{authToken}}` automatically.",
    endpoints: [
      {
        name: "login", auth: "public", summary: "Sign in and receive a JWT.",
        required: ["username", "password"],
        body: { username: "{{username}}", password: "{{password}}" },
        returns: "The user record (`username`, `role`, `credits`, `allowedApps`, `resolution`, …) plus `capabilities`, `carpenterAccount` and `token`.",
        notes: "Rate limited: 30 attempts / 15 min per IP. Errors: `not-found` (unknown user), `unauthenticated` (wrong password).",
      },
      {
        name: "signup", auth: "public", summary: "Self sign-up — creates a `user` pending approval.",
        required: ["username", "password"],
        body: { username: "newuser", password: "a-strong-password", email: "newuser@example.com" },
        returns: "The new user record plus `token`, like `login`.",
        notes: "Account starts `accountStatus: \"pending_approval\"` with `DEFAULT_APPS`. Sends a verification email when SMTP is configured. Rate limited like `login`. In Postman the returned token is *not* stored — the collection stays signed in as `{{username}}`.",
      },
      {
        name: "register", auth: "manager",
        summary: "Admin / bootlegar / organization creates another account.",
        required: ["username", "password"],
        body: {
          callerUsername: "{{username}}", username: "dealer_one", password: "a-strong-password",
          role: "user", displayName: "Dealer One", initialCredits: 20, resolution: "2K",
          allowedApps: ["CARPENTER"], organizationId: null,
        },
        returns: "The created user (`username`, `role`, `credits`, `allowedApps`, `resolution`, `organizationId`, `capabilities`, …).",
        notes: "An organization always creates `org_user` members of itself. A bootlegar pays `initialCredits` from its own balance. Carpenter onboarding: see docs/carpenter-onboarding.md (Manufacturer = `organization`, Dealer Pro = `user`, Sponsored dealer = `org_user` + `organizationId`).",
        capture: { targetUsername: "username" },
      },
      {
        name: "verifyEmail", auth: "public", summary: "Confirm an email address from the signup link.",
        required: ["username", "token"],
        body: { username: "newuser", token: "<token from the email link>" },
        returns: "`{ success, message }`.",
      },
      {
        name: "forgotPassword", auth: "public", summary: "Email a password-reset link.",
        required: ["username"],
        body: { username: "{{username}}" },
        returns: "`{ success, message }`.",
        notes: "Needs SMTP configured. Rate limited.",
      },
      {
        name: "resetPassword", auth: "public", summary: "Set a new password with a reset token.",
        required: ["username", "token", "newPassword"],
        body: { username: "{{username}}", token: "<token from the email link>", newPassword: "a-new-password" },
        returns: "`{ success, message }`.",
        notes: "Errors: `permission-denied` for an invalid or expired token. Rate limited.",
      },
    ],
  },

  {
    name: "Users & credits",
    description: "Profiles, account management and credit balances.",
    endpoints: [
      {
        name: "getCurrentUser", auth: "user", summary: "The signed-in user, with the org's credit pool for org members.",
        body: { username: "{{username}}" },
        returns: "User record + `capabilities` + `carpenterAccount`.",
      },
      {
        name: "getUsers", auth: "manager", summary: "List users — all for an admin, own creations for a bootlegar / organization.",
        body: { callerUsername: "{{username}}" },
        returns: "Array of users (passwords never included).",
      },
      {
        name: "updateUser", auth: "manager", summary: "Change another user's role, credits, apps, resolution or password.",
        required: ["targetUsername"],
        body: { callerUsername: "{{username}}", targetUsername: "{{targetUsername}}", updates: { credits: 50, resolution: "2K", allowedApps: ["CARPENTER", "QR_GEN_PRO"] } },
        returns: "`{ success }`.",
        notes: "Allowed keys: `role`, `credits`, `allowedApps`, `resolution` (`1K` | `2K` | `4K`), `password`. Bootlegars / organizations may only touch accounts they created and never change roles; bootlegars also cannot change apps or resolution.",
      },
      {
        name: "deleteUser", cleanup: 10, auth: "manager", summary: "Delete a user (their generation history is kept).",
        required: ["targetUsername"],
        body: { callerUsername: "{{username}}", targetUsername: "{{targetUsername}}" },
        returns: "`{ success }`.",
        notes: "The super admin cannot be deleted.",
      },
      {
        name: "updateUserProfile", auth: "user", summary: "Own display name, share-message preset and (organization) logo.",
        body: { username: "{{username}}", displayName: "Suru Laminates", shareMessagePreset: "Here is your render from Suru Studio", logoBase64: img, logoMimeType: mime },
        returns: "The updated profile fields.",
        notes: "Only organizations and admins can set a logo.",
      },
      {
        name: "getUserCredits", auth: "user", summary: "Current balance (an org member sees the org's pool).",
        body: { username: "{{username}}" },
        returns: "`{ credits }`.",
      },
      {
        name: "deductCredits", auth: "user", summary: "Spend credits for work done outside the AI routes.",
        required: ["username", "amount"],
        body: { username: "{{username}}", amount: 1 },
        returns: "`{ success }` — `failed-precondition` when the balance is too low.",
      },
      {
        name: "addCredits", auth: "staff", summary: "Grant credits (admin mints; bootlegar transfers its own).",
        required: ["targetUsername", "amount"],
        body: { callerUsername: "{{username}}", targetUsername: "{{targetUsername}}", amount: 10 },
        returns: "`{ success, newCredits }`.",
        notes: "A bootlegar may only top up accounts it created.",
      },
      {
        name: "setUserCredits", auth: "admin", summary: "Set an exact balance.",
        required: ["targetUsername", "amount"],
        body: { callerUsername: "{{username}}", targetUsername: "{{targetUsername}}", amount: 100 },
        returns: "`{ success, credits }`.",
      },
    ],
  },

  {
    name: "AI generation",
    description:
      "Every generate* call prices the account's resolution, spends credits, calls the configured image provider (Gemini or OpenAI), stores the render and saves a generation record — refunding on any failure. **Each successful call costs real credits and provider spend.** Rate limited: 20 / minute per IP. Images travel as base64 (no data: prefix) with a mimeType; catalog images can be sent as `{ \"imageId\": \"<product image id>\" }` instead.",
    endpoints: [
      {
        name: "generateSuruShot", auth: "user", summary: "Product photography from one product photo.",
        required: ["username", "imageBase64"],
        body: { username: "{{username}}", imageBase64: img, imageMimeType: mime, prompt: "On a marble counter, soft window light", aspectRatio: "1:1" },
        returns: "`{ success, imageUrl, generationId }` — `imageUrl` is a data URL of the render.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateTileMaster", auth: "user", summary: "Tile the mapped surfaces of the user's own room photo.",
        required: ["username", "imageBase64", "originalImageBase64"],
        body: {
          username: "{{username}}",
          originalImageBase64: img, originalImageMimeType: mime,
          imageBase64: img, imageMimeType: mime,
          tileImages: [{ imageId: "{{imageId}}" }],
          surfaces: [{ label: "Floor", plane: "floor", tileSize: "600x600", tileImageIds: [1], cols: 8, rows: 6, corners: [{ x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }],
          tileSize: "600x600", groutColor: "#d9d9d9", groutThicknessMm: 2,
          harmonizeDecor: false, creativeMode: false, aspectRatio: "16:9",
          scene: { name: "Living room" },
        },
        returns: "`{ success, imageUrl, generationId }`.",
        notes: "Image order is fixed: [original photo, surfaces-only tile layer (`imageBase64`), ...tileImages]. `tileImageIds` on a surface are 1-based positions in `tileImages`.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateCarpenter", auth: "user", summary: "Laminate on furniture — preset room or the user's own photo.",
        required: ["username", "laminateBase64 or laminateImageId"],
        body: {
          username: "{{username}}", laminateBase64: img, laminateMimeType: mime,
          accentLaminateBase64: null, accentLaminateMimeType: null,
          sceneId: "{{sceneId}}",
          sceneImageBase64: null, sceneImageMimeType: null,
          scene: { name: "Modern wardrobe", prompt: "Floor-to-ceiling wardrobe, handleless shutters" },
          accentRegions: [], decorateRoom: false, creativeMode: false,
          prompt: "", aspectRatio: "4:3",
        },
        returns: "`{ success, imageUrl, generationId, … }` plus Carpenter branding fields for sponsored dealers.",
        notes: "Scene: `sceneId` renders onto a library scene (see Carpenter scenes) — its image is read server-side and its ratio is the default `aspectRatio`; `sceneImageBase64` renders onto an uploaded room photo and wins over `sceneId`; with neither, `scene.name` / `scene.prompt` describe a room to invent. Use `laminateImageId` / `accentLaminateImageId` to render a catalog laminate by product-image id. `accentRegions` (0–1 boxes `{x,y,w,h}`) apply to any real photo (upload or library scene); `decorateRoom` only to uploads.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateMarbleX", auth: "user", summary: "Marble slab on floor / walls, preset room or own photo.",
        required: ["username", "marbleBase64"],
        body: { username: "{{username}}", marbleBase64: img, marbleMimeType: mime, sceneImageBase64: null, sceneImageMimeType: null, target: "floor", flow: "bookmatch", scene: { name: "Lobby" }, prompt: "", creativeMode: false, aspectRatio: "16:9" },
        returns: "`{ success, imageUrl, generationId }`.",
        notes: "`target`: `floor` | `walls` | `both`.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateHardware", auth: "user", summary: "Door hardware installed on a door, optionally in a reference scene.",
        required: ["username", "imageBase64"],
        body: { username: "{{username}}", imageBase64: img, imageMimeType: mime, referenceImageBase64: null, referenceImageMimeType: null, scene: { name: "Modern door" }, prompt: "", creativeMode: false, aspectRatio: "3:4" },
        returns: "`{ success, imageUrl, generationId }`.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateJigsaw", auth: "user", summary: "Product studio shot (Jigsaw AI; BathExpert with tool=BATH_EXPERT).",
        required: ["username", "imageBase64"],
        body: {
          username: "{{username}}", imageBase64: img, imageMimeType: mime, tool: "JIGSAW", productId: "Basin mixer",
          composition: { cameraAngle: "Eye level", zoom: "Medium" },
          atmosphere: { lighting: "Soft daylight", shadows: "Soft" },
          environment: { type: "Preset", preset: "Minimal bathroom", customPrompt: "" },
          decorativeElements: true,
        },
        returns: "`{ success, imageUrl, generationId }`.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateGodPosters", auth: "user", summary: "Devotional poster art.",
        required: ["username"],
        body: { username: "{{username}}", deityCategory: "Ganesha", customDeity: "", posterStyle: "Traditional", blessingText: "Shubh Labh", mantraText: "", prompt: "", imageBase64: null, imageMimeType: null, aspectRatio: "3:4" },
        returns: "`{ success, imageUrl, generationId }`.",
        capture: { generationId: "generationId" },
      },
      {
        name: "generateCreativeBrief", auth: "user", summary: "Text-only prompt helper (\"enhance my prompt\") — no credits.",
        required: ["config"],
        body: { username: "{{username}}", config: { productId: "Basin mixer", composition: { cameraAngle: "Eye level", aspectRatio: "1:1" }, atmosphere: { lighting: "Soft", shadows: "Soft" }, environment: { type: "Preset", preset: "Minimal bathroom" } } },
        returns: "`{ text }` — a stock brief when no Gemini key is configured.",
        notes: "Always uses Gemini's text model. Rate limited like generations.",
      },
    ],
  },

  {
    name: "Generations",
    description: "Stored render records (what Files and the admin records view list).",
    endpoints: [
      {
        name: "saveGeneration", auth: "user", summary: "Save a record for an image the client produced itself.",
        required: ["username", "tool", "imageUrl"],
        body: { username: "{{username}}", tool: "CARPENTER", imageUrl: "https://example.com/render.webp", baseImageUrl: null, prompt: "Saved from editor", settings: "{\"kind\":\"render\"}", creditsUsed: 0 },
        returns: "The saved generation record.",
        capture: { generationId: "id" },
      },
      {
        name: "getGenerations", auth: "user", summary: "Own records, or any user's when the caller is admin.",
        body: { callerUsername: "{{username}}", filterUsername: "{{username}}", limit: 50 },
        returns: "Array of generation records, newest first.",
      },
      {
        name: "updateGenerationImage", auth: "user", summary: "Replace a record's image with a client-side composite.",
        required: ["generationId", "base64Image"],
        body: { username: "{{username}}", generationId: "{{generationId}}", base64Image: img },
        returns: "`{ success, imageUrl }`.",
      },
      {
        name: "deleteGeneration", cleanup: 6, auth: "admin", summary: "Delete a generation record and its files.",
        required: ["generationId"],
        body: { callerUsername: "{{username}}", generationId: "{{generationId}}" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Files (Drive)",
    description: "Folders, files (generations), favorites, sharing and share links.",
    endpoints: [
      {
        name: "createFolder", auth: "user", summary: "Create a folder (at Home when parentId is null).",
        required: ["username", "name"],
        body: { username: "{{username}}", name: "Client renders", parentId: null },
        returns: "The folder, with `myRole: \"owner\"`.",
        capture: { folderId: "id" },
      },
      {
        name: "getFileSystem", auth: "user", summary: "Folders and files visible to the user in one folder, or a search.",
        body: { username: "{{username}}", parentId: null, search: "", favoritesOnly: false },
        returns: "`{ folders, files }`.",
      },
      {
        name: "renameResource", auth: "user", summary: "Rename a file or folder (editor access).",
        required: ["resourceId", "resourceType", "newName"],
        body: { username: "{{username}}", resourceId: "{{folderId}}", resourceType: "folder", newName: "Renamed folder" },
        returns: "`{ success }`.",
      },
      {
        name: "moveFile", auth: "user", summary: "Move a file into a folder (null = Home).",
        required: ["fileId"],
        body: { username: "{{username}}", fileId: "{{generationId}}", folderId: "{{folderId}}" },
        returns: "`{ success }`.",
      },
      {
        name: "moveFolder", auth: "user", summary: "Move a folder under another (cycle-protected).",
        required: ["folderId"],
        body: { username: "{{username}}", folderId: "{{folderId}}", newParentId: null },
        returns: "`{ success }`.",
      },
      {
        name: "toggleFavorite", auth: "user", summary: "Star / unstar a file or folder.",
        required: ["resourceId", "resourceType"],
        body: { username: "{{username}}", resourceId: "{{folderId}}", resourceType: "folder" },
        returns: "`{ success, isFavorite }`.",
      },
      {
        name: "shareResource", auth: "user", summary: "Share with users and/or set visibility (owner / admin role).",
        required: ["resourceId", "resourceType"],
        body: { username: "{{username}}", resourceId: "{{folderId}}", resourceType: "folder", visibility: "private", permissions: { "{{targetUsername}}": "viewer" }, sharedWith: [] },
        returns: "`{ success }`.",
        notes: "`visibility`: `private` | `organization` | `public`. `permissions` maps username → `admin` | `editor` | `viewer`; `sharedWith` is the legacy viewer-only list.",
      },
      {
        name: "getResourceShares", auth: "user", summary: "Who a resource is shared with (share dialog).",
        required: ["resourceId", "resourceType"],
        body: { username: "{{username}}", resourceId: "{{folderId}}", resourceType: "folder" },
        returns: "The share list with roles and visibility.",
      },
      {
        name: "createShareLink", auth: "user", summary: "Create or rotate a public share link.",
        required: ["resourceId", "resourceType"],
        body: { username: "{{username}}", resourceId: "{{folderId}}", resourceType: "folder", linkRole: "viewer" },
        returns: "`{ token, role }` — the SPA link is `APP_PUBLIC_URL/share/<token>`.",
        capture: { shareToken: "token" },
      },
      {
        name: "getSharedResource", auth: "public", summary: "Resolve a share-link token.",
        required: ["token"],
        body: { token: "{{shareToken}}" },
        returns: "`{ resource, resourceType, role }`.",
      },
      {
        name: "revokeShareLink", auth: "user", summary: "Revoke a share link you created.",
        required: ["token"],
        body: { username: "{{username}}", token: "{{shareToken}}" },
        returns: "`{ success }`.",
      },
      {
        name: "getActivity", auth: "user", summary: "Activity for a resource, the caller's recent activity, or Carpenter share attempts.",
        body: { username: "{{username}}", resourceId: null, limit: 50, kind: null },
        returns: "`{ activity: [...] }`.",
        notes: "`kind: \"shareAttempts\"` returns Carpenter share attempts (with client + follow-up date) instead of Drive activity.",
      },
      {
        name: "deleteFolder", cleanup: 5, auth: "user", summary: "Delete a folder subtree; files move to Home unless deleteFiles.",
        required: ["folderId"],
        body: { username: "{{username}}", folderId: "{{folderId}}", deleteFiles: false },
        returns: "`{ success, foldersDeleted }`.",
      },
    ],
  },

  {
    name: "Catalog (collections & products)",
    description: "The tile / laminate library: collections → products → faces (images). Uploading a product auto-publishes its public page and QR.",
    endpoints: [
      {
        name: "createCollection", auth: "user", summary: "Create a tile or laminate collection.",
        required: ["name"],
        body: { username: "{{username}}", name: "Postman Laminates", type: "laminate", description: "Created from Postman", isShared: false },
        returns: "The collection (`id`, `name`, `type`, `owner`, `isShared`, `productCount`, …).",
        capture: { collectionId: "id" },
      },
      {
        name: "listCollections", auth: "user", summary: "Collections visible to the user (own + shared; org members see their manufacturer's).",
        body: { username: "{{username}}", type: "laminate", page: 1, pageSize: 40, search: "" },
        returns: "`{ collections, total, page, pageSize, hasMore }`.",
      },
      {
        name: "updateCollection", auth: "user", summary: "Rename, describe or share a collection you own.",
        required: ["collectionId"],
        body: { username: "{{username}}", collectionId: "{{collectionId}}", name: "Postman Laminates (renamed)", description: "Updated", isShared: false },
        returns: "The updated collection.",
      },
      {
        name: "uploadProducts", auth: "user", method: "POST", path: "/api/uploadProducts", multipart: true,
        summary: "Bulk upload images into a collection (multipart/form-data).",
        form: [
          { key: "files", type: "file", description: "One or more images (repeat the key). Pick files in Postman before sending." },
          { key: "collectionId", value: "{{collectionId}}", description: "Existing collection — or send collectionName instead." },
          { key: "collectionName", value: "", description: "Name to create/reuse when collectionId is empty.", disabled: true },
          { key: "type", value: "laminate", description: "tile | laminate" },
          { key: "paths", value: "[]", description: "JSON array of webkitRelativePath per file (folder uploads → one product per folder)." },
          { key: "autoPublish", value: "1", description: "\"0\" skips creating each product's public page + QR." },
          { key: "username", value: "{{username}}", description: "Ignored when a Bearer token is sent." },
        ],
        returns: "`{ success, collection, productsCreated, productsUpdated, facesStored, skipped, products, publications }`.",
        notes: `Limits: MAX_UPLOAD_MB per file (default 25), MAX_UPLOAD_FILES per request (default 200). Loose files sharing a base name with a trailing token (\`oak_x.png\`, \`oak_y.png\`) become one product with two faces. Re-uploading a name merges into the existing product.`,
        capture: { productId: "products.0.id" },
      },
      {
        name: "listProducts", auth: "user", summary: "Paginated products of a collection (cover thumbnails only).",
        body: { username: "{{username}}", collectionId: "{{collectionId}}", type: "laminate", page: 1, pageSize: 40, search: "" },
        returns: "`{ products, total, page, pageSize, hasMore }`.",
        capture: { productId: "products.0.id" },
      },
      {
        name: "getProduct", auth: "user", summary: "One product with all of its faces.",
        required: ["productId"],
        body: { username: "{{username}}", productId: "{{productId}}" },
        returns: "`{ product: { …, images: [{ id, face, url, thumbUrl, … }] } }`.",
        notes: "An image `id` from here is what generation calls accept as `{ imageId }`.",
        capture: { imageId: "product.images.0.id" },
      },
      {
        name: "getProductImages", auth: "user", summary: "Faces for several products at once.",
        body: { username: "{{username}}", productIds: ["{{productId}}"] },
        returns: "`{ products: [{ id, images }] }`.",
      },
      {
        name: "renameProduct", auth: "user", summary: "Rename a product (unique within its collection).",
        required: ["productId", "name"],
        body: { username: "{{username}}", productId: "{{productId}}", name: "Natural Oak" },
        returns: "The updated product.",
      },
      {
        name: "deleteProduct", cleanup: 3, auth: "user", summary: "Delete a product and its files (its public page stays online).",
        required: ["productId"],
        body: { username: "{{username}}", productId: "{{productId}}" },
        returns: "`{ success }`.",
      },
      {
        name: "deleteCollection", cleanup: 4, auth: "user", summary: "Delete a collection, its products, faces and files.",
        required: ["collectionId"],
        body: { username: "{{username}}", collectionId: "{{collectionId}}" },
        returns: "`{ success, productsDeleted }`.",
      },
    ],
  },

  {
    name: "QR-Gen-Pro",
    description:
      "Public product pages (`/product/<token>`), public collection pages (`/collection/<token>`) and dynamic QR codes (`/q/<code>`) that can be re-pointed at either without reprinting.",
    endpoints: [
      {
        name: "createProductPage", auth: "user", summary: "Publish a product's page (reuses its live page if it has one).",
        required: ["productId"],
        body: { username: "{{username}}", productId: "{{productId}}", title: "Natural Oak", category: "Laminates", size: "8x4 ft", description: "1mm matte finish" },
        returns: "Page summary (`token`, `url`, `name`, `category`, `size`, `coverUrl`, `views`, `revoked`, …) + `reused`.",
        capture: { productPageToken: "token" },
      },
      {
        name: "getProductPublications", auth: "user", summary: "Pages + QRs for a batch of products.",
        body: { username: "{{username}}", productIds: ["{{productId}}"] },
        returns: "`{ publications: [{ productId, page, qrCodes, pageCreated, qrCreated }] }`.",
      },
      {
        name: "publishProducts", auth: "user", summary: "Give each product a page + QR (idempotent).",
        body: { username: "{{username}}", productIds: ["{{productId}}"] },
        returns: "`{ publications }`.",
      },
      {
        name: "getProductPage", auth: "public", summary: "Resolve a product page (counts a view).",
        required: ["token"],
        body: { token: "{{productPageToken}}" },
        returns: "The page snapshot: `name`, `type`, `category`, `size`, `collectionName`, `description`, `images`, `owner`, `views`, …",
      },
      {
        name: "listProductPages", auth: "user", summary: "Your product pages.",
        body: { username: "{{username}}", page: 1, pageSize: 40, search: "" },
        returns: "`{ pages, total, hasMore }`.",
      },
      {
        name: "updateProductPage", auth: "user", summary: "Edit a page's details or disable it.",
        required: ["token"],
        body: { username: "{{username}}", token: "{{productPageToken}}", category: "Premium laminates", size: "8x4 ft", description: "Updated from Postman", revoked: false },
        returns: "Page summary.",
      },
      {
        name: "publishCollectionPage", auth: "user", summary: "Public link + QR for a whole collection (idempotent).",
        required: ["collectionId"],
        body: { username: "{{username}}", collectionId: "{{collectionId}}" },
        returns: "`{ token, url, collectionId, name, views, revoked, reused, qrCodes }`.",
        notes: "Also publishes any product in the collection that has no page yet.",
        capture: { collectionPageToken: "token" },
      },
      {
        name: "getCollectionPage", auth: "public", summary: "Resolve a collection page — every product, live.",
        required: ["token"],
        body: { token: "{{collectionPageToken}}" },
        returns: "`{ token, name, type, description, owner, views, productCount, products: [{ id, token, name, category, size, images, … }] }`.",
      },
      {
        name: "updateCollectionPage", auth: "user", summary: "Disable / re-enable a collection link.",
        required: ["token"],
        body: { username: "{{username}}", token: "{{collectionPageToken}}", revoked: false },
        returns: "Collection page summary.",
      },
      {
        name: "createQrCode", auth: "user", summary: "Create 1–50 QR codes, optionally mapped to a page.",
        body: { username: "{{username}}", label: "Showroom rack 3", count: 1, targetToken: "{{productPageToken}}", targetType: "product" },
        returns: "`{ qrCodes: [{ id, code, url, label, targetToken, targetType, target, collectionTarget, scans, … }] }`.",
        notes: "`targetType`: `product` (default) | `collection` — with `collection`, `targetToken` is a collection page token.",
        capture: { qrId: "qrCodes.0.id", qrCode: "qrCodes.0.code" },
      },
      {
        name: "listQrCodes", auth: "user", summary: "Your QR codes with their targets.",
        body: { username: "{{username}}", page: 1, pageSize: 60, search: "" },
        returns: "`{ qrCodes, total, hasMore }`.",
      },
      {
        name: "updateQrCode", auth: "user", summary: "Re-label or re-map a QR (null targetToken = unmap).",
        required: ["id"],
        body: { username: "{{username}}", id: "{{qrId}}", label: "Showroom rack 3", targetToken: "{{collectionPageToken}}", targetType: "collection" },
        returns: "The QR record.",
      },
      {
        name: "resolveQrCode", auth: "public", summary: "Where a scanned QR lands (counts a scan).",
        required: ["code"],
        body: { code: "{{qrCode}}" },
        returns: "`{ code, mapped, url, token? }` — `url` is null while unmapped.",
      },
      {
        name: "deleteQrCode", cleanup: 1, auth: "user", summary: "Delete a QR (printed copies stop working).",
        required: ["id"],
        body: { username: "{{username}}", id: "{{qrId}}" },
        returns: "`{ success }`.",
      },
      {
        name: "deleteProductPage", cleanup: 2, auth: "user", summary: "Delete a product page; QRs pointing at it become unmapped.",
        required: ["token"],
        body: { username: "{{username}}", token: "{{productPageToken}}" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Product links (render share)",
    description: "Public pages for a finished render at `/p/<token>`. Snapshot-based: they keep working after the render or tiles change.",
    endpoints: [
      {
        name: "createProductLink", auth: "user", summary: "Publish a render (by generationId, or a previewUrl).",
        required: ["generationId or previewUrl"],
        body: { username: "{{username}}", generationId: "{{generationId}}", title: "Natural Oak wardrobe", details: "Laminate: Natural Oak", productIds: [], extraImages: [] },
        returns: "`{ token, url, title }`.",
        capture: { productLinkToken: "token" },
      },
      {
        name: "getProductLink", auth: "public", summary: "Resolve a render link (counts a view).",
        required: ["token"],
        body: { token: "{{productLinkToken}}" },
        returns: "The link snapshot (title, images, details, products, owner branding).",
      },
      {
        name: "listProductLinks", auth: "user", summary: "Your render links.",
        body: { username: "{{username}}", page: 1, pageSize: 40 },
        returns: "`{ links, total, hasMore }`.",
      },
      {
        name: "revokeProductLink", auth: "user", summary: "Disable or re-enable a render link.",
        required: ["token"],
        body: { username: "{{username}}", token: "{{productLinkToken}}", revoked: true },
        returns: "`{ success, revoked }`.",
      },
    ],
  },

  {
    name: "Carpenter sharing",
    description: "Share attempts, clients and follow-ups for the Carpenter Pro flow. Counts are attempts, never confirmed deliveries.",
    endpoints: [
      {
        name: "recordShareAttempt", auth: "user", summary: "Log a share attempt and create / update the client.",
        required: ["clientName or clientId"],
        body: { username: "{{username}}", clientName: "Priya Shah", whatsapp: "+919876543210", notes: "Natural Oak · Kitchen", followUpDate: "2026-10-05", generationId: "{{generationId}}", channel: "device_share", status: "attempted", outgoingMessage: "Here is your render" },
        returns: "`{ success, attemptId, attempt, client, countedAs: \"attempt\" }`.",
        notes: "`channel`: `device_share` | `copy`. `status` on create: `attempted` | `cancelled`. Refused for roles without share capability.",
        capture: { attemptId: "attemptId", clientId: "client.id" },
      },
      {
        name: "updateShareAttempt", auth: "user", summary: "Mark your attempt sent / failed / cancelled (or back to attempted).",
        required: ["attemptId", "status"],
        body: { username: "{{username}}", attemptId: "{{attemptId}}", status: "sent", statusNote: "Client replied" },
        returns: "`{ success, attempt }`.",
      },
      {
        name: "getShareStats", auth: "user", summary: "Sharing stats for Home (manufacturers include sponsored dealers).",
        body: { username: "{{username}}" },
        returns: "`{ total, last7Days, last30Days, uniqueClients, byStatus, byChannel, followUps: { overdue, dueToday, upcoming, horizonDays } }`.",
      },
      {
        name: "listFollowUps", auth: "user", summary: "Clients with a follow-up date, bucketed overdue / today / upcoming.",
        body: { username: "{{username}}", days: 14, limit: 100 },
        returns: "`{ today, horizon, items: [{ bucket, client, canEdit, attemptCount, lastAttemptAt }] }`.",
      },
      {
        name: "listShareClients", auth: "user", summary: "Clients visible to the user.",
        body: { username: "{{username}}", limit: 100 },
        returns: "`{ clients }`.",
      },
      {
        name: "updateShareClient", auth: "user", summary: "Edit your client (null followUpDate clears it).",
        required: ["clientId"],
        body: { username: "{{username}}", clientId: "{{clientId}}", name: "Priya Shah", whatsapp: "+919876543210", notes: "Prefers matte", followUpDate: null },
        returns: "`{ success, client }`.",
      },
    ],
  },

  {
    name: "Carpenter scenes",
    description:
      "Real room photos Carpenter Pro renders a laminate onto (`generateCarpenter` with `sceneId`). Bulk-loaded with `npm run scenes:import -- <folder>` (see setup-production.md); curated in Admin Panel → Carpenter Scenes. Hidden scenes are never offered to users or accepted for generation.",
    endpoints: [
      {
        name: "listCarpenterScenes", auth: "user", summary: "Visible scenes, grouped by category (admins can include hidden ones).",
        body: { username: "{{username}}", category: null, includeHidden: false },
        returns: "`{ categories: [{ id, label, count }], ratios, scenes: [{ id, name, category, categoryLabel, aspectRatio, imageUrl, thumbUrl, width, height }] }` — with `includeHidden` (admin only) each scene also has `active`, `hiddenReason`, `sortOrder`.",
        capture: { sceneId: "scenes.0.id" },
      },
      {
        name: "createCarpenterScene", auth: "admin", summary: "Upload one scene.",
        required: ["imageBase64", "category"],
        body: { username: "{{username}}", imageBase64: img, imageMimeType: mime, category: "kitchen", name: "Postman kitchen", aspectRatio: null },
        returns: "`{ scene, warning }` — `warning` is set (\"low resolution\" / \"mostly blank\") when the importer would have hidden it; the scene is visible either way.",
        notes: "Stored as WebP (longest edge 2048) with a thumbnail. `aspectRatio` defaults to the nearest of 1:1, 3:4, 4:3, 9:16, 16:9; `name` defaults to \"<Category> <n>\". A new category slug is created on the fly.",
        capture: { sceneId: "scene.id" },
      },
      {
        name: "updateCarpenterScene", auth: "admin", summary: "Rename, recategorize, change ratio, reorder, show / hide.",
        required: ["sceneId"],
        body: { username: "{{username}}", sceneId: "{{sceneId}}", name: "Kitchen — island", category: "kitchen", aspectRatio: "4:3", active: true, sortOrder: 0 },
        returns: "`{ scene }` (admin fields included).",
      },
      {
        name: "setCarpenterScenesActive", auth: "admin", summary: "Show or hide many scenes at once.",
        required: ["sceneIds"],
        body: { username: "{{username}}", sceneIds: ["{{sceneId}}"], active: true },
        returns: "`{ success, updated }`.",
      },
      {
        name: "deleteCarpenterScene", cleanup: 11, auth: "admin", summary: "Delete a scene and its image files.",
        required: ["sceneId"],
        body: { username: "{{username}}", sceneId: "{{sceneId}}" },
        returns: "`{ success }` — past renders keep their own copies.",
      },
    ],
  },

  {
    name: "Tile scenes (TileMaster Basic)",
    description: "Admin-authored scenes with pre-mapped surfaces. Not the product catalog.",
    endpoints: [
      {
        name: "saveTileCollection", auth: "staff", summary: "Save a scene with its surfaces.",
        required: ["name", "sceneImageBase64", "surfaces (≥ 1)"],
        body: {
          username: "{{username}}", name: "Postman living room", sceneImageBase64: img, sceneMimeType: mime,
          surfaces: [{ id: "floor-1", label: "Floor", plane: "floor", tileSize: "600x600", tileImageIds: [], corners: [{ x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 1, y: 1 }, { x: 0, y: 1 }], repeatX: 8, repeatY: 6, rotation: 0, opacity: 1, tileScale: 1 }],
        },
        returns: "`{ success, collectionId, sceneImageUrl }`.",
        capture: { tileCollectionId: "collectionId" },
      },
      {
        name: "listTileCollections", auth: "public", summary: "All scenes.",
        body: {},
        returns: "`{ success, collections }` (newest 60).",
      },
      {
        name: "getCollectionScene", auth: "public", summary: "A scene image as base64 (for canvas compositing).",
        required: ["collectionId"],
        body: { collectionId: "{{tileCollectionId}}" },
        returns: "`{ success, base64, mimeType }`.",
      },
      {
        name: "deleteTileCollection", cleanup: 9, auth: "staff", summary: "Delete a scene.",
        required: ["collectionId"],
        body: { username: "{{username}}", collectionId: "{{tileCollectionId}}" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Tile sizes",
    description: "The size list TileMaster offers (built-ins + admin-added).",
    endpoints: [
      { name: "getTileSizes", auth: "public", summary: "Custom sizes and hidden built-in markers.", body: {}, returns: "Array of size records." },
      {
        name: "createTileSize", auth: "admin", summary: "Add a custom size.",
        required: ["width", "height", "unit"],
        body: { callerUsername: "{{username}}", width: 600, height: 1200, unit: "mm", cat: "Floor" },
        returns: "The size record (`id` = its value, e.g. `600x1200`).",
        capture: { tileSizeValue: "id" },
      },
      {
        name: "deleteTileSize", auth: "admin", summary: "Remove a custom size, or hide a built-in.",
        required: ["value"],
        body: { callerUsername: "{{username}}", value: "{{tileSizeValue}}", isBuiltIn: false },
        returns: "`{ success }`.",
      },
      {
        name: "restoreTileSize", auth: "admin", summary: "Un-hide a built-in size.",
        required: ["value"],
        body: { callerUsername: "{{username}}", value: "600x600" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Master prompts",
    description: "Admin-managed prompt templates per tool; one is active per tool.",
    endpoints: [
      {
        name: "createMasterPrompt", auth: "admin", summary: "Add a prompt template.",
        required: ["name", "tool", "template"],
        body: { callerUsername: "{{username}}", name: "Postman prompt", tool: "CARPENTER", template: "Photorealistic interior, soft daylight" },
        returns: "The prompt record.",
        capture: { promptId: "id" },
      },
      {
        name: "getMasterPrompts", auth: "public", summary: "Prompts for a tool, newest first.",
        required: ["tool"],
        body: { tool: "CARPENTER" },
        returns: "Array of prompt records.",
      },
      {
        name: "updateMasterPrompt", auth: "admin", summary: "Edit a prompt.",
        required: ["id", "updates"],
        body: { callerUsername: "{{username}}", id: "{{promptId}}", updates: { name: "Postman prompt (edited)", template: "Photorealistic interior, warm evening light" } },
        returns: "`{ success }`.",
      },
      {
        name: "setActiveMasterPrompt", auth: "admin", summary: "Make a prompt the active one for its tool.",
        required: ["id"],
        body: { callerUsername: "{{username}}", id: "{{promptId}}" },
        returns: "`{ success }`.",
      },
      {
        name: "deleteMasterPrompt", cleanup: 7, auth: "admin", summary: "Delete a prompt.",
        required: ["id"],
        body: { callerUsername: "{{username}}", id: "{{promptId}}" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Shop & payments",
    description: "Credit packages and Razorpay checkout.",
    endpoints: [
      { name: "getPackages", auth: "public", summary: "Credit packages (cached briefly).", body: {}, returns: "Array of packages." , capture: { packageId: "0.id" } },
      {
        name: "createPackage", auth: "admin", summary: "Add a credit package.",
        required: ["credits", "price"],
        body: { callerUsername: "{{username}}", credits: 100, price: 2500, tagline: "Postman pack", color: "#111111", isPopular: false },
        returns: "The package.",
        capture: { packageId: "id" },
      },
      {
        name: "updatePackage", auth: "admin", summary: "Edit a package.",
        required: ["packageId", "updates"],
        body: { callerUsername: "{{username}}", packageId: "{{packageId}}", updates: { price: 2400, tagline: "Postman pack (sale)" } },
        returns: "`{ success }`.",
        notes: "Allowed keys: `credits`, `price`, `isPopular`, `color`, `tagline`.",
      },
      {
        name: "createPaymentOrder", auth: "user", summary: "Create a Razorpay order for a package.",
        required: ["packageId"],
        body: { username: "{{username}}", packageId: "{{packageId}}" },
        returns: "`{ orderId, amount, currency, keyId, credits }`.",
        notes: "Needs RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.",
      },
      {
        name: "verifyPaymentSignature", auth: "user", summary: "Verify Razorpay's signature and credit the account (idempotent).",
        required: ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"],
        body: { username: "{{username}}", packageId: "{{packageId}}", credits: 100, razorpay_order_id: "order_xxx", razorpay_payment_id: "pay_xxx", razorpay_signature: "<from Razorpay checkout>" },
        returns: "`{ success, message }` — a repeated payment id is a no-op.",
      },
      {
        name: "deletePackage", cleanup: 8, auth: "admin", summary: "Delete a package.",
        required: ["packageId"],
        body: { callerUsername: "{{username}}", packageId: "{{packageId}}" },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "Org chat",
    description: "One chat room per organization (organization + its members). The room id is the organization's username: a member's `organizationId`, or an organization account's own username; admins may open any room. In Postman, `login` fills `{{organizationId}}` accordingly when it is empty.",
    endpoints: [
      {
        name: "getChatMessages", auth: "user", summary: "Messages after a cursor (tail of the room when omitted).",
        required: ["organizationId"],
        body: { username: "{{username}}", organizationId: "{{organizationId}}", afterId: null, limit: 50 },
        returns: "`{ messages, typing, cursor }`.",
      },
      {
        name: "sendChatMessage", auth: "user", summary: "Post a text message.",
        required: ["organizationId", "text"],
        body: { username: "{{username}}", organizationId: "{{organizationId}}", text: "Hello from Postman" },
        returns: "`{ success, message }`.",
      },
      {
        name: "sendChatFile", auth: "user", summary: "Attach a file (base64).",
        body: { username: "{{username}}", organizationId: "{{organizationId}}", base64: img, fileName: "pixel.png", fileType: mime },
        returns: "`{ success, message }`.",
      },
      {
        name: "setChatTyping", auth: "user", summary: "Typing indicator on / off.",
        required: ["organizationId"],
        body: { username: "{{username}}", organizationId: "{{organizationId}}", typing: true },
        returns: "`{ success }`.",
      },
    ],
  },

  {
    name: "System (admin)",
    description: "Image-provider configuration from the Admin Panel. Keys saved here are stored in the database; keys in .env take precedence.",
    endpoints: [
      { name: "getSystemStatus", auth: "admin", summary: "Live provider, key presence and masked previews.", body: { username: "{{username}}" }, returns: "Provider + per-key status." },
      {
        name: "setGeminiKey", auth: "admin", summary: "Save the Gemini API key.",
        required: ["apiKey"], body: { username: "{{username}}", apiKey: "<gemini api key>" }, returns: "`{ success }`.",
      },
      {
        name: "setOpenAIKey", auth: "admin", summary: "Save the OpenAI API key.",
        required: ["apiKey"], body: { username: "{{username}}", apiKey: "<openai api key>" }, returns: "`{ success }`.",
      },
      {
        name: "setImageProvider", auth: "admin", summary: "Switch generations between Gemini and OpenAI.",
        required: ["provider"], body: { username: "{{username}}", provider: "gemini" }, returns: "`{ success, provider }`.",
        notes: "Refused while the target provider has no key.",
      },
    ],
  },

  {
    name: "Error log",
    description: "Client + server error capture, viewed in the Admin Panel.",
    endpoints: [
      {
        name: "logClientError", auth: "public", summary: "Report a client-side failure.",
        body: { username: "{{username}}", tool: "CARPENTER", code: "unavailable", message: "Couldn't reach the server", detail: "", url: "https://namelessos.cloud/", userAgent: "Postman" },
        returns: "`{ success }`.",
      },
      {
        name: "getErrorLogs", auth: "manager", summary: "Recent errors, newest first.",
        body: { username: "{{username}}", limit: 100 },
        returns: "`{ success, logs }`.",
        capture: { errorLogId: "logs.0.id" },
      },
      {
        name: "resolveErrorLog", auth: "manager", summary: "Mark an entry resolved / unresolved.",
        required: ["id"],
        body: { username: "{{username}}", id: "{{errorLogId}}", resolved: true },
        returns: "`{ success }`.",
      },
      {
        name: "clearErrorLogs", auth: "manager", summary: "Clear the log (optionally only resolved entries).",
        body: { username: "{{username}}", resolvedOnly: true },
        returns: "`{ success, deleted }`.",
      },
    ],
  },

  {
    name: "Misc",
    description: "",
    endpoints: [
      {
        name: "searchPinterest", auth: "public", summary: "Inspiration search (currently simulated results).",
        required: ["query"],
        body: { query: "walnut wardrobe", limit: 10 },
        returns: "`{ results }`.",
      },
    ],
  },
];
