# CrediScore

**CrediScore** is a full-stack platform for business trust and credibility: verified businesses, reviews with receipts and optional M-Pesa verification, AI-assisted document OCR, trust scores, fraud reporting, disputes, leaderboards, and separate experiences for customers, business owners, and administrators.

---

## Full stack at a glance

| Layer | Technology | Role |
|-------|------------|------|
| **Web app** | [Angular](https://angular.dev/) 20, TypeScript 5.9 | SPA with SSR/hydration (`@angular/ssr`), routing, forms, HTTP client |
| **UI** | [Tailwind CSS](https://tailwindcss.com/) 3, [@iconscout/unicons](https://iconscout.com/unicons), [Leaflet](https://leafletjs.com/) | Styling, icons, maps (business discovery / locations) |
| **API** | [NestJS](https://nestjs.com/) 11, Node.js | REST API under global prefix `/api`; OpenAPI/Swagger at `/api` |
| **ORM / DB access** | [Prisma](https://www.prisma.io/) 5, `@prisma/adapter-neon` | Schema, migrations, type-safe queries to PostgreSQL |
| **Database** | [PostgreSQL](https://www.postgresql.org/) (e.g. [Neon](https://neon.tech/) serverless) | Primary datastore (`DATABASE_URL`, `DIRECT_URL`) |
| **Cache / queues** | [Redis](https://redis.io/) via [BullMQ](https://docs.bullmq.io/) ([ioredis](https://github.com/redis/ioredis)) | Background jobs (optional; `DISABLE_QUEUES=true` to run without workers) |
| **Auth** | JWT ([Passport JWT](http://www.passportjs.org/)), [Google OAuth](https://developers.google.com/identity/protocols/oauth2), local email/password, optional 2FA ([otplib](https://github.com/yeojz/otplib)) | Sessions for OAuth flow; API uses bearer tokens |
| **File & media** | [Cloudinary](https://cloudinary.com/) | Uploads (logos, receipts, media) |
| **Email** | [@nestjs-modules/mailer](https://github.com/nest-modules/mailer), [Nodemailer](https://nodemailer.com/) | Verification, notifications (SMTP configurable) |
| **AI / OCR** | [Google Cloud Vision](https://cloud.google.com/vision), [Tesseract.js](https://tesseract.projectnaptha.com/), optional Anthropic / OCR APIs | Document and receipt analysis |
| **Payments (Kenya)** | M-Pesa integration module | Optional; enabled when consumer key/secret are set |
| **Fraud scoring (optional)** | [FastAPI](https://fastapi.tiangolo.com/) + [scikit-learn](https://scikit-learn.org/) ([`backend/fraud-detection-service`](backend/fraud-detection-service)) | Separate Python service; Nest calls `PYTHON_FRAUD_SERVICE_URL` |
| **Observability** | Correlation IDs, [prom-client](https://github.com/siimon/prom-client) | Request tracing hooks, metrics module |
| **Security / ops** | [Helmet](https://helmetjs.github.io/), compression, [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting), `class-validator` | Hardening and rate limits |

---

## Repository layout

```
CrediScore/
├── frontend/                 # Angular application
│   ├── src/app/              # Feature modules (admin, business, user, search, …)
│   ├── src/environments/     # apiUrl, Cloudinary public config per environment
│   └── package.json
├── backend/                  # NestJS API
│   ├── prisma/               # schema.prisma, migrations
│   ├── src/                  # Modules: auth, admin, user, business, shared (AI, mailer, …)
│   ├── fraud-detection-service/   # Optional Python FastAPI microservice
│   └── package.json
└── README.md                 # This file
```

---

## Main product capabilities

- **Users**: Registration, login, Google OAuth, email verification, password reset, optional 2FA, profiles, reputation, bookmarks, notifications, weekly digest preferences.
- **Businesses**: Listings with categories, map/location, onboarding and admin review workflow (`BusinessStatus`), documents with AI/OCR assistance, trust scores and history, M-Pesa payment identifiers, response templates, claims.
- **Reviews**: Ratings, comments, media, receipt data, helpful/not-helpful votes, replies, credibility flags, disputes, M-Pesa verification fields.
- **Trust & safety**: Fraud reports with evidence metadata and case-style fields; admin moderation (users, businesses, reviews, documents, disputes, fraud reports).
- **Discovery**: Search, compare, category browse, map view, leaderboard.

Frontend routes (high level) include: `home`, `auth/*`, `search`, `compare`, `map`, user `dashboard`, `my-reviews`, `bookmarks`, `notifications`, `report-business`, `leaderboard`, `business/:id`, `category/:name`, business owner area under `business/...`, and `admin/...` for operations.

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **PostgreSQL** (or Neon connection strings)
- **Redis** (if background queues are enabled and not using `DISABLE_QUEUES=true`)
- Optional: **Python 3.11+** for `fraud-detection-service`
- Optional: Google Cloud credentials for Vision, Cloudinary account, SMTP, M-Pesa API credentials

---

## Local development

### 1. Database and Prisma (backend)

```bash
cd backend
npm install
# Set DATABASE_URL and DIRECT_URL in .env (see Environment variables)
npx prisma migrate dev
npx prisma generate
```

### 2. API (backend)

```bash
cd backend
npm run start:dev
```

- API base: `http://localhost:3000` (or `PORT` from env)
- REST routes are under **`/api/...`**
- **Swagger UI**: `http://localhost:3000/api` (as configured in `main.ts`)

### 3. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

Dev server defaults to **`http://localhost:4200`** with a larger HTTP header size for auth cookies (see `frontend/package.json` `start` script).

Point the app at your API by setting **`frontend/src/environments/environment.ts`** → `apiUrl` (e.g. `http://localhost:3000`). The backend uses global prefix `api`, so client code should target the same base URL pattern your interceptors expect.

### 4. Optional: fraud detection service

See [`backend/fraud-detection-service/README.md`](backend/fraud-detection-service/README.md). Run on port **8000** and set **`PYTHON_FRAUD_SERVICE_URL`** in the NestJS `.env`.

---

## Environment variables (backend)

Configure a `backend/.env` (never commit secrets). Commonly used keys include:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooled, e.g. Neon) |
| `DIRECT_URL` | Direct PostgreSQL URL for migrations |
| `JWT_SECRET` | Signing key for access tokens |
| `FRONTEND_URL` | OAuth redirects and CORS-related flows |
| `APP_URL` | Public API base URL (health/config checks) |
| `SESSION_SECRET` | Express session for OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Media uploads |
| SMTP (`SMTP_*` or `MAIL_*`) | Outbound email |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | BullMQ / cache |
| `DISABLE_QUEUES` | Set to `true` to skip queue wiring when Redis is unavailable |
| `PYTHON_FRAUD_SERVICE_URL` | FastAPI fraud service base URL |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | M-Pesa features |
| `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS` | Vision OCR |
| `ANTHROPIC_API_KEY`, `OCR_*`, `OCRSPACE_API_KEY` | Alternate OCR paths |

Refer to module code under `backend/src` (e.g. `auth.module.ts`, `cloudinary.service.ts`, `queue.module.ts`) for the exact names your deployment uses.

---

## Production notes (from codebase)

- **Frontend**: CORS allows `https://credi-score.vercel.app` and `FRONTEND_URL` in addition to local dev (`backend/src/main.ts`).
- **Example deployed API** in `frontend/src/environments/environment.prod.ts` points to a Render-style host; replace with your own URL for new deployments.

---

## Testing

| Part | Command |
|------|---------|
| Backend unit tests | `cd backend && npm test` |
| Backend e2e | `cd backend && npm run test:e2e` |
| Frontend unit tests | `cd frontend && npm test` |

---

## Additional documentation

- [`backend/prisma/README.md`](backend/prisma/README.md) — Prisma workflow
- [`backend/src/README.md`](backend/src/README.md) — Backend source layout and conventions
- [`backend/src/shared/cloudinary/README.md`](backend/src/shared/cloudinary/README.md) — Cloudinary env vars
- [`backend/fraud-detection-service/README.md`](backend/fraud-detection-service/README.md) — Python fraud API

---

## License

Package metadata in `backend/package.json` is marked private / `UNLICENSED`. Confirm licensing with the project owners before redistribution.
