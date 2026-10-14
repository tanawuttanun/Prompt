# Build Prompt — Multi-Store Marketplace (VAULT-style)

> Copy everything below the line into your AI coding tool. UI/UX is intentionally out of scope:
> the prompt asks for working logic, API, database and wiring, with plain unstyled pages only.

---

## Role and goal

You are a senior full-stack engineer. Build a **multi-business marketplace web application** that
aggregates live stock from six independently hosted product APIs, normalizes them into one product
contract, and supports authenticated customer ordering, product claims/warranty, admin management,
and optional AI shopping features.

**Scope:** backend logic, database, integrations, auth, and a frontend that is wired to every
endpoint (state, data fetching, route guards, forms) but has **no visual design**: plain semantic
HTML, no design system, no custom styling beyond what is needed to be usable. I will do the UI/UX
myself, so keep components thin and keep all logic in hooks/services I can reuse.

## Tech stack

- Frontend: React + Vite + TypeScript (React Router). Tailwind installed but unused.
- Backend: Node.js 20+, Express, TypeScript (ESM), `mysql2/promise`, `bcryptjs`, `jsonwebtoken`,
  `cookie-parser`, `multer`, `zod` (or hand-written validators).
- Database: MySQL 8.4. phpMyAdmin for admin.
- Infra: Docker Compose (frontend, backend, mysql, phpmyadmin).
- Tests: Vitest (or node:test) for backend and frontend.

## Project structure

```text
/
|-- frontend/            React app (Vite proxies /api -> backend)
|-- backend/
|   |-- src/
|   |   |-- adapters/<business>/index.ts   one adapter per external API
|   |   |-- adapters/index.ts              registry + businessCatalog
|   |   |-- controllers/  routes/  services/  repositories/
|   |   |-- middleware/   (auth, uploads, rate limit)
|   |   |-- errors/apiError.ts
|   |   |-- types/        (product, order, claim status tables)
|   |   |-- db/pool.ts
|   |   `-- server.ts
|   |-- uploads/{products,profiles,claims}/.gitkeep
|   `-- tests/
|-- database/init.sql           full fresh-install schema + seed
|-- database/migrations/        forward migrations
|-- docs/API_CONTRACT.md
|-- docker-compose.yml
`-- .env.example
```

Layering rule: routes → controllers (HTTP only) → services (business rules) → repositories (SQL
only). No SQL in controllers; no `req`/`res` in services.

## Environment (`.env.example` — I will supply real values)

Read every setting from env. Never hard-code URLs or secrets. Never commit `.env`.

```env
MYSQL_DATABASE=vault_multistore
MYSQL_USER=vault_user
MYSQL_PASSWORD=change_me
MYSQL_ROOT_PASSWORD=change_me_root

DB_HOST=mysql
DB_PORT=3306
BACKEND_PORT=3000

# Secret used to sign login sessions (JWT). Generate a long random string.
JWT_SECRET=change_me_to_a_long_random_string

# Days a customer may raise a claim, from orders.completed_at (or order date if only shipped). 0 = no deadline.
CLAIM_WINDOW_DAYS=90

# External Stock Product APIs (one per business)
DOOR_API_URL=http://<host>:<port>/api/products
BRANDNAME_API_URL=http://<host>:<port>/api/products
PLUG_API_URL=http://<host>:<port>/api/products
CLOTHING_API_URL=http://<host>:<port>/api/products
POWERBANK_API_URL=http://<host>:<port>/api/products
PROJECTOR_API_URL=http://<host>:<port>/api/products

# Optional. Blank = app runs without AI; /api/ai/* returns 503 AI_NOT_CONFIGURED.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
```

Frontend env: `VITE_API_PROXY_TARGET` (default `http://localhost:3000`, `http://backend:3000` in Docker).

`.gitignore` must exclude `.env`, `.env.*` (except `.env.example`), `node_modules`, `dist`,
uploaded files (keep `.gitkeep`), SQL dumps.

## Docker Compose

- `frontend` on 5173 (bind mount + named `node_modules` volume), depends on backend.
- `backend` on `${BACKEND_PORT:-3000}:3000`, receives every env var above, depends on mysql
  `service_healthy`.
- `mysql:8.4` on 3306, mounts `./database/init.sql` to `/docker-entrypoint-initdb.d/01-init.sql:ro`,
  healthcheck `mysqladmin ping`, data in a named volume.
- `phpmyadmin:5-apache` on 8080 using `MYSQL_USER`/`MYSQL_PASSWORD`.

## 1. Product integration (core logic)

### Normalized product contract

Every adapter returns this exact shape; nothing downstream sees raw upstream data:

```ts
type NormalizedProduct = {
  id: string;            // convert numeric ids to string
  business: 'door' | 'plug' | 'brandname' | 'clothing' | 'powerbank' | 'projector';
  business_name: string; // "Door", "Electrical Plug", "Brandname", "Clothing", "Powerbank", "Projector"
  name: string;
  category: string;
  price: number;         // numeric, never a formatted string
  stock: number;
  unit: string;          // default "pcs"
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  image_url: string;     // "" when missing; resolve relative paths against the upstream origin
  updated_at: string;    // ISO 8601 (source time, else normalization time)
  description?: string;
};
```

Shared helper `getStockStatus(stock)`: `0` → Out of Stock, `1–5` → Low Stock, `>5` → In Stock.

### Adapters

- One adapter per business in `adapters/<business>/index.ts`, exporting `business`, `businessName`
  and `fetchProducts(): Promise<NormalizedProduct[]>`.
- Each reads its URL from env (`DOOR_API_URL`, ...). Missing URL → adapter reports `unavailable`.
- `fetch` with `AbortSignal.timeout(10_000)`.
- Accept either a top-level JSON array or `{ data: [...] }`.
- Map that business's own field names (e.g. Door: `product_id→id`, `product_name→name`,
  `category_name→category`, `price` string→number, `total_stock→stock`; Powerbank: `updatedAt→updated_at`,
  `image→image_url`). Make the mapping table easy to edit per adapter.
- Skip (don't invent) items missing id/name or with non-numeric price/stock.
- **Never fabricate inventory.** No fallback/mock products in production code.

### Aggregation with failure isolation

`productService.getAllProducts()` runs all six adapters with `Promise.allSettled`. One failing
upstream must not affect the others. Response:

```json
{
  "data": [ /* NormalizedProduct[] from healthy adapters */ ],
  "businesses": [
    { "business": "door", "business_name": "Door", "status": "online", "product_count": 12 },
    { "business": "plug", "business_name": "Electrical Plug", "status": "unavailable", "product_count": 0 }
  ],
  "source": "adapters"
}
```

`online` + `product_count: 0` = upstream answered with no usable items; `unavailable` = request
failed, timed out, non-2xx, or unparseable. Update `businesses.status/last_checked_at` and write a
`sync_logs` row (`success|failed|partial`, `products_received`, `message`) per fetch.

Product identity is the pair `(business, id)` everywhere (cart, orders, recommendations), since ids
can collide across businesses.

## 2. Database (`database/init.sql`)

utf8mb4, InnoDB, `CREATE TABLE IF NOT EXISTS`, seed six `businesses` rows and one admin user
(bcrypt hash; document the dev password in a comment and tell me to change it).

- `businesses(id, name, business_type UNIQUE, api_url, status ENUM('active','inactive','unavailable'), last_checked_at, created_at, updated_at)`
- `products_cache(id, business_id FK, external_product_id, name, category, price DECIMAL(12,2), stock, unit, status, image_url, attributes JSON, updated_at, UNIQUE(business_id, external_product_id))`
- `vault_products(id, business_key, name, category, price, stock, unit, image_url, created_at, updated_at)` — admin-managed local products
- `sync_logs(id, business_id FK, status ENUM('success','failed','partial'), products_received, message, synced_at)`
- `users(id, name, email UNIQUE, password_hash, role ENUM('customer','admin') DEFAULT 'customer', phone, address, city, province, postal_code, country, profile_image_url, created_at, updated_at)`
- `orders(id, user_id FK NULL, order_no UNIQUE, customer_name, customer_email, customer_phone, shipping_address_line1, shipping_address_line2, shipping_district, shipping_province, shipping_postal_code, shipping_country, subtotal, shipping_fee, discount, total, status ENUM('pending','confirmed','processing','shipped','completed','cancelled') DEFAULT 'confirmed', completed_at, created_at, updated_at)`
- `order_items(id, order_id FK CASCADE, product_id, business, business_name, product_name, category, image_url, unit_price, quantity, line_total, created_at)` — a **snapshot** of the product at purchase time
- `claim_number_sequences(sequence_date PK, last_number, updated_at)`
- `claims(id, claim_number UNIQUE, order_id FK, user_id FK, status ENUM('submitted','under_review','approved','rejected','processing','completed','cancelled'), reason ENUM('damaged','defective','wrong_item','missing_parts','other'), description, contact_phone, admin_note, created_at, updated_at, resolved_at)`
- `claim_items(id, claim_id FK CASCADE, order_item_id FK, quantity, product_id, product_name, business, business_name, unit_price, created_at, UNIQUE(claim_id, order_item_id))`
- `claim_evidence(id, claim_id FK CASCADE, file_name, image_url, mime_type, file_size, created_at)`
- `claim_status_history(id, claim_id FK CASCADE, previous_status NULL, new_status, changed_by FK NULL ON DELETE SET NULL, changed_by_role, note, visibility ENUM('customer','internal'), created_at)`

Add indexes for `(user_id, created_at)`, `(status, created_at)`, `(business, product_id)`.

## 3. Authentication

- Register/login with bcrypt (cost 10). Email normalized to lowercase; validate lengths.
- On success sign a JWT `{ sub: userId, role }` with `JWT_SECRET` and set it as an
  **HTTP-only, SameSite=Lax cookie** (Secure in production). No tokens in localStorage.
- `GET /api/auth/me` restores the public profile from the cookie; `POST /api/auth/logout` clears it.
- Middleware: `requireAuth` (401 if missing/invalid) and `requireAdmin` (403 if not admin).
  The backend is the security boundary; frontend route guards are UX only.
- `user_id` is always taken from the verified session, **never from the request body**.

## 4. Cart and checkout

- Cart is client-side (persisted in localStorage), keyed by `(business, id)`, storing quantity only.
- `POST /api/orders` (auth): body = shipping fields + `items: [{ business, product_id, quantity }]`.
  Service must:
  1. Validate input (quantities positive integers, required shipping fields).
  2. Re-fetch **live** inventory for each item's business; reject if the business is unavailable,
     the product no longer exists, or `quantity > stock` (clear error per line).
  3. Use the live price — never a client-supplied price. Compute `line_total`, `subtotal`, `total`
     with integer-safe money math.
  4. In one transaction insert `orders` + `order_items` snapshot.
  5. Generate `order_no` as `MDG-YYYYMMDD-XXXXXX` (UTC date, 6 random hex uppercase), retry on collision.
- `GET /api/orders` — newest first, only the caller's orders.
- `GET /api/orders/:orderNo` — caller's own order; someone else's order → **404**, never 403.

## 5. Product claims and warranty

- `GET /api/orders/:orderNo/warranty-document` — printable data built from the stored order
  snapshot (never today's catalogue prices).
- `GET /api/orders/:orderNo/claimable-items` — lines with `claimable_quantity > 0`, where claimable =
  purchased − units in active claims (`submitted|under_review|approved|processing|completed`).
  `rejected` and `cancelled` release their units.
- `POST /api/claims` (multipart): `order_no`, `reason`, `description` (≤2000), `contact_phone?`,
  `items` (JSON `[{order_item_id, quantity}]`, 1–20, no duplicates), `evidence` 1–5 files.
  Rules: order must be the caller's and `shipped`/`completed`; within `CLAIM_WINDOW_DAYS` of
  `completed_at` (or order date if only shipped; 0 = unlimited); quantities ≤ claimable.
- Evidence: JPEG/PNG/WEBP, ≤5 MB each; verify **magic bytes** match the declared MIME; discard the
  client filename and store as `<uuid>.<ext>` in `uploads/claims`. Not served statically:
  `GET /api/claims/:claimNo/evidence/:id` streams after an owner-or-admin check.
- Claim number `CLM-YYYYMMDD-000001` allocated inside the claim transaction from
  `claim_number_sequences` (`INSERT ... ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`)
  so concurrent submissions never share a number.
- State machine defined once in `types/claim.ts` and enforced server-side:

  ```
  submitted    -> under_review, cancelled
  under_review -> approved, rejected, cancelled
  approved     -> processing
  processing   -> completed
  rejected, completed, cancelled -> terminal
  ```

  Customers may only move to `cancelled`, only from `submitted`/`under_review`
  (`POST /api/claims/:claimNo/cancel`). Every transition writes a `claim_status_history` row.
  Set `resolved_at` on terminal states.
- Notes: `note_visibility` `customer` (default) or `internal`. Customer-visible notes are also copied to
  `claims.admin_note` unless an explicit `admin_note` is sent (`""` clears it). Internal notes and
  `changed_by` ids are **never** serialized to customer endpoints.
- `GET /api/claims?status=&page=&page_size=` (page size clamped to 50), `GET /api/claims/:claimNo`.

## 6. Admin (all under `/api/admin`, `requireAuth + requireAdmin`)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | order count, revenue, customers, orders by status, claim counts |
| GET | `/analytics` | sales over time, by business, top products |
| GET | `/orders` | all orders (filters: status, search, date range, pagination) |
| GET | `/orders/:orderNo` | full order detail |
| PATCH | `/orders/:orderNo/status` | validated status change; set `completed_at` when → completed |
| GET | `/claims` | filters `status`, `business`, `search` (claim no, order no, name, email), `from`/`to` (YYYY-MM-DD, `to` inclusive) |
| GET | `/claims/stats` | counts per status + `open_claims` |
| GET | `/claims/:claimNo` | detail incl. customer, order, full history with internal notes |
| PATCH | `/claims/:claimNo/status` | `{ status, note?, note_visibility?, admin_note? }` via state machine |
| GET/POST/PUT/DELETE | `/products`, `/products/:business/:id` | manage local `vault_products` |
| POST | `/products/upload-image` | product image upload (same file checks) |
| GET | `/product-options` | categories/businesses for forms |
| GET/POST/PUT/DELETE | `/users`, `/users/:id` | user management (cannot delete yourself / last admin) |
| GET/PUT | `/businesses`, `/businesses/:id` | view/edit business status & API URL |

Historical orders with `user_id NULL` are visible to admins only.

## 7. Other public/customer endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | `{ status: "ok", db: "ok"|"down" }` |
| GET | `/api/products` | aggregated products + availability (above) |
| GET | `/api/products/best-sellers` | top products by quantity from `order_items`, joined to live data |
| GET | `/api/businesses` | per-business availability |
| GET | `/api/stock/summary` | totals: products, units, low/out-of-stock counts per business |
| GET/PUT | `/api/profile` | own profile fields |
| POST/DELETE | `/api/profile/image` | profile photo upload/remove |

Static: `/uploads/products` and `/uploads/profiles` with `dotfiles: 'deny'`, `index: false`.

## 8. Optional AI features (Gemini)

- Isolate the provider in `services/ai/geminiClient.ts` (swappable). Model from `GEMINI_MODEL`.
- If `GEMINI_API_KEY` is blank, the app runs normally and every `/api/ai/*` returns `503 AI_NOT_CONFIGURED`.
- Rate limit `/api/ai/*` to 20 requests/minute per IP.
- `POST /api/ai/search` — model converts natural language into **structured filters only**
  (category, business, price range, in-stock); backend applies them to real inventory.
- `POST /api/ai/chat` — Thai shopping assistant; context = trimmed real catalog, plus the caller's own
  orders **only if** a valid session cookie exists (ignore any `userId` in the body). Guests asked to
  sign in for order questions.
- `GET /api/ai/recommend/:productId?business=` — 4 related products; model may only return ids that
  exist in current inventory (filter otherwise).
- `POST /api/ai/describe` — short Thai description, only when a product's description is missing or
  < 30 chars; label it "AI-generated" in the response.
- Validate every JSON the model returns field-by-field; fall back to safe defaults.
- Cache recommend/describe decisions in memory ~1 hour per product; always re-read live price/stock.
- The AI never invents products, orders, or ids.

## 9. Errors and conventions

- Success: `{ "data": ... }`. Failure: `{ "error": { "code": "SNAKE_CASE", "message": "..." } }`.
- Central `ApiError(status, code, message)` + one error middleware; unknown errors → 500 without
  leaking stack traces.
- Use codes such as `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `ORDER_NOT_FOUND`,
  `INSUFFICIENT_STOCK`, `BUSINESS_UNAVAILABLE`, `INVALID_CLAIM_TRANSITION`, `CLAIM_QUANTITY_EXCEEDED`,
  `ORDER_NOT_CLAIMABLE`, `EVIDENCE_REQUIRED`, `INVALID_EVIDENCE`, `EVIDENCE_TOO_LARGE`, `AI_NOT_CONFIGURED`.
- Parameterized SQL only. Transactions for order and claim creation.
- Money as `DECIMAL(12,2)` in DB; serialize as numbers.

## 10. Frontend (logic only, unstyled)

- `api/client.ts`: fetch wrapper with `credentials: 'include'`, parses `{data}` / `{error}` into typed results.
- `AuthContext` (restore via `/api/auth/me` on load), `CartContext` (localStorage), favorites (localStorage).
- Routes: `/`, `/products`, `/products/:business/:id`, `/cart`, `/checkout`, `/login`, `/register`,
  `/orders`, `/orders/:orderNo`, `/orders/:orderNo/warranty`, `/orders/:orderNo/claim`, `/claims`,
  `/claims/:claimNo`, `/profile`, `/admin` (+ `/admin/orders`, `/admin/claims`, `/admin/products`,
  `/admin/users`, `/admin/businesses`, `/admin/analytics`).
- `ProtectedRoute` and `AdminRoute` guards.
- Product list: filter by business/category/price/stock, search, sort; show per-business availability
  from `businesses` (e.g. "Plug store offline").
- Every AI component hides itself silently on any error.
- Keep data hooks (`useProducts`, `useOrders`, `useClaims`, ...) separate from presentational components.

## 11. Tests and CI

- Backend unit tests: each adapter's normalization (array vs `{data}`, string prices, bad items
  skipped), `getStockStatus`, partial-failure isolation (one adapter throws, others still return),
  checkout stock/price validation, claim state machine, claimable-quantity math, ownership → 404.
- Frontend tests for the API client and guards. An optional live-proxy test gated by `VAULT_TEST_API_URL`.
- GitHub Actions: install, build, test backend and frontend on push/PR to `dev` and `main`.

## 12. Deliverables

1. All code above, compiling with `npm run build` in both packages and passing `npm test`.
2. `database/init.sql` that builds the full schema on an empty volume.
3. `docs/API_CONTRACT.md` documenting the normalized product and every endpoint.
4. `README.md`: setup (`cp .env.example .env`, `docker compose up -d --build`), URLs
   (5173 / 3000/api/health / 8080), and how to add a new business adapter.

Work in this order: schema → adapters + aggregation → auth → orders → claims → admin → AI → frontend wiring → tests → docs.
Ask me before inventing any upstream field mapping you cannot infer from a sample response.
