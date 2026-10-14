# Delux Sport Club — premium sports equipment store

A full-stack demo store: React + Vite frontend, Express + TypeScript backend.
**No database needed** — all data lives in the backend's memory and resets to the seed on every restart.

## Run

```bash
npm run install:all   # first time only
npm run dev           # backend on :3000, frontend on :5173
```

Open http://localhost:5173. `npm run build` builds both packages, `npm test` runs the backend tests.

`backend/.env` is created from `backend/.env.example` (it holds `JWT_SECRET`; never commit it).

## Demo accounts

Recreated on every start. The emails and passwords are in
[`backend/src/store/seed.ts`](backend/src/store/seed.ts) (`SEED_ACCOUNTS`): one admin, one customer
with four sample orders (two completed, so claims can be tried immediately). Dev-only — change them
before using the app anywhere real.

## Features

| Area | What it does |
| --- | --- |
| Brand & motion | Navy-and-gold Delux crest (SVG, draws itself in), gold shimmer text, twinkling sparkles, sparkle bursts on key actions, toast pop-ups and a welcome popup (`components/Crest.tsx`, `components/sparkle.tsx`, `context/ToastContext.tsx`, `motion.css`). All motion stops under reduced-motion settings |
| Landing | Animated hero with a 3D card carousel (`frontend/src/landing`) |
| Shop | Search, filter by category/store/price/stock, sort, favourites, per-store availability |
| Cart & checkout | Cart in localStorage; the server re-checks live stock and sets every price; free shipping from ฿1,500 |
| Orders | History, detail, printable claim & warranty document built from the order snapshot |
| Claims | Pick items + quantities, reason, up to 5 photos (JPEG/PNG/WEBP ≤ 5 MB, checked by magic bytes); status timeline; cancel while submitted/under review |
| Profile | Contact/address fields (prefill checkout), profile photo |
| Admin | Dashboard, analytics, orders (status changes, cancel restocks), claims (state machine, customer vs internal notes), products CRUD + image upload, users, stores |
| AI (optional) | Set `GEMINI_API_KEY` to enable natural-language search, a Thai shopping chat, related products and auto descriptions; without a key the AI UI simply hides |
| Partner stores (optional) | `PARTNER_APIS=key|Name|https://host/api/products` pulls external stock through a normalizing adapter; a failing partner never hides other products |

## Rules enforced by the backend

- Session is an HTTP-only JWT cookie; the user id always comes from the token, never the request body.
- Another customer's order or claim answers **404**, not 403. Every `/api/admin/*` route needs the admin role.
- Claim transitions: `submitted → under_review → approved → processing → completed`, with `rejected` from
  under_review and `cancelled` from submitted/under_review. Claim numbers `CLM-YYYYMMDD-000001`, order numbers `DLX-YYYYMMDD-XXXXXX`.
- Claim evidence is never public: it streams only to its owner or an admin.

## Structure

```text
backend/src
  adapters/       store catalogue + partner API adapter (field mapping)
  routes/         HTTP layer        services/   business rules
  repositories/   data access       store/      in-memory data + seed
  middleware/     auth, uploads, rate limit
frontend/src
  landing/        hero page         pages/      shop, cart, orders, claims, profile, admin
  context/        auth, cart        components/ layout, guards, AI widgets
```

To move to MySQL later, replace the functions in `backend/src/repositories/` — nothing else touches the data.
