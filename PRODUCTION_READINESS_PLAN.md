# Ruvia Cosmetics — Production Readiness Plan (Vercel + Render)

This document is a **complete, implementable checklist** to take the current codebase to **production-grade** with minimal risk and **without breaking existing flows**. It is written from a **Project Manager + Senior Engineer** lens and includes concrete steps, commands, configuration, and acceptance criteria.

---

## 0) Current snapshot (what we have)

**Repo layout**
- `Frontend/` — Next.js 16 (App Router), React 19, Tailwind, GSAP
- `backend/` — Express 5, MongoDB (Mongoose), JWT + httpOnly cookie auth, Razorpay, Cloudinary, SMTP email

**Known high-risk areas**
- Payments: backend currently creates Razorpay orders using **client-provided `amount`**
- Inventory: order creation + stock decrement is **not transactional**
- Ops: no CI/CD, no deploy runbook, limited observability
- Repo hygiene: `Frontend/.next/` exists in the repo folder (should never be committed)

---

## 1) Target deployment architecture (recommended)

### 1.1 Services
- **Frontend**: Vercel (Next.js)
- **Backend API**: Render Web Service (Node/Express)
- **Database**: MongoDB Atlas (recommended)
- **Media**: Cloudinary
- **Payments**: Razorpay (prod keys + webhooks)
- **Email**: Brevo (or equivalent transactional provider)

### 1.2 Environments (minimum)
- **Development** (local)
- **Staging** (public but non-prod data; staging Razorpay keys; staging DB)
- **Production**

**Rule:** Never point staging to production DB/keys. Treat staging as “safe to break”.

---

## 2) Repo hygiene (do this first; lowest risk)

### 2.1 Ensure build artifacts are not committed
**Goal:** remove `.next/` from repo commits and keep it ignored.

Actions:
1. Ensure `Frontend/.gitignore` includes:
   - `.next/`
   - `node_modules/`
   - `.env*` (except examples)
2. Remove `Frontend/.next/` from git history **if it was ever committed** (check in your Git host).
3. Keep only:
   - `Frontend/.env.example`
   - `backend/.env.example`

Acceptance criteria:
- Fresh clone + install works
- Repo size drops materially
- CI is faster and reproducible

---

## 3) Secrets & configuration (security gate)

### 3.1 Rotate and protect secrets
Treat all existing credentials as compromised if they were shared anywhere.

Rotate:
- `MONGO_URI`
- `JWT_SECRET`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- `CLOUDINARY_*`
- `EMAIL_*` credentials

Add guardrails:
- CI secret scanning (e.g., gitleaks)
- Branch protection (no direct pushes to main)
- Pre-commit hooks optional (lint + secret scan)

### 3.2 Required environment variables

#### Frontend (Vercel) — `Frontend/`
Minimum:
- `NEXT_PUBLIC_API_URL` = `https://<your-render-backend-domain>`

Recommended:
- `NEXT_PUBLIC_SITE_URL` = `https://<your-vercel-domain>`

#### Backend (Render) — `backend/`
Minimum:
- `NODE_ENV=production`
- `PORT=10000` (Render sets this; read from `process.env.PORT`)
- `MONGO_URI=...` (Atlas)
- `JWT_SECRET=...` (32+ random bytes)
- `CORS_ORIGINS=https://<your-vercel-domain>,https://<your-staging-vercel-domain>`
- `FRONTEND_URL=https://<your-vercel-domain>` (for email links)

Payments:
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`

Email:
- `EMAIL_HOST=...`
- `EMAIL_PORT=...`
- `EMAIL_USER=...`
- `EMAIL_PASS=...`
- `EMAIL_FROM_EMAIL=...`
- `EMAIL_FROM_NAME=Ruvia Cosmetics`
- `EMAIL_ENABLED=true`

Cloudinary:
- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`

Acceptance criteria:
- No `.env` required in production; all config comes from platform env vars
- Staging and production each have unique secrets and DBs

---

## 4) Backend: production hardening (highest impact)

### 4.1 Payments must be server-authoritative (BLOCKER)
**Current risk:** `POST /api/payments/razorpay` accepts `amount` from client.

Required change:
- Endpoint should accept only `{ orderId }`
- Backend fetches Order from DB
- Backend computes payable amount from DB (`order.total`)
- Backend verifies:
  - requester owns the order OR user is admin
  - order is not already paid / cancelled

Acceptance criteria:
- Client cannot alter payable amount
- Razorpay order is linked to internal order and stored for reconciliation
- Webhook verification is used as the source of truth for “paid”

### 4.2 Lock down order “paid” updates
Required:
- Do not allow clients to arbitrarily call “mark paid”.
- Only mark paid when:
  - Razorpay signature verified (webhook or server-side verification)
  - amount/status match expectations

Acceptance criteria:
- You can’t mark any order as paid without a valid Razorpay event/signature

### 4.3 Inventory consistency & idempotency
Required:
- Wrap “create order + decrement stock” in a MongoDB session transaction, OR implement compensating rollback with idempotency keys.
- Add an **idempotency key** on order creation to prevent duplicate orders on retries.

Acceptance criteria:
- No overselling under concurrent checkouts
- Retry does not create duplicate orders

### 4.4 Rate limiting strategy
Current global limiter exists, but production should add:
- Stricter limiter on `/api/auth/login` and `/api/auth/register`
- Optional: IP-based lockout / backoff

Acceptance criteria:
- Brute force attempts are throttled without impacting normal traffic

### 4.5 Request validation consistency
Required:
- Ensure every write endpoint validates payloads (auth, orders, payments, products, reviews).
- Avoid drift between route-level validators and controller logic.

Acceptance criteria:
- Invalid payloads fail fast with consistent 4xx responses

### 4.6 Observability (minimum viable)
Required:
- Structured logging (pino/winston)
- Request ID middleware
- Health endpoints:
  - `/health` (basic “process up”)
  - `/ready` (DB connectivity ok)
- Error monitoring (Sentry recommended)

Acceptance criteria:
- On incident, you can correlate a user request across logs with requestId
- Render health checks can verify readiness

---

## 5) Frontend: production optimization & safety

### 5.1 Auth posture (cookie-only)
Goal:
- Use **httpOnly cookies** end-to-end
- All authenticated requests must use `credentials: "include"`
- Remove any remaining localStorage token logic (keep only backward-compat cleanup if unavoidable)

Acceptance criteria:
- No tokens stored in localStorage
- Login works on Vercel domain against Render API domain

### 5.2 API client standardization
Required:
- Adopt one `apiClient` (base URL, credentials, error handling, retries, timeouts).
- Replace scattered `fetch()` usage over time (start with auth + checkout flows).

Acceptance criteria:
- Consistent error UX and fewer “silent failures”
- Reduced duplicated code

### 5.3 Performance improvements
Required:
- Use `next/image` for images
- Lazy-load heavy libraries (PDF generation, charts) with dynamic import
- Ensure only necessary components are `"use client"`

Acceptance criteria:
- Lighthouse improvement (especially LCP, INP)
- Smaller initial JS bundle

---

## 6) CI/CD (must-have for safe releases)

### 6.1 GitHub Actions (recommended)
Pipelines:
- Frontend: install → lint → build
- Backend: install → basic node checks → (tests when added)
- Secret scanning: gitleaks
- Dependency vulnerability scanning (optional but recommended)

Branch protections:
- Require CI green before merge
- Require code review

Acceptance criteria:
- Every PR proves “it builds”
- Secrets are prevented from re-entering the repo

### 6.2 Release strategy (do not break anything)
Use feature flags and staged rollout:
1. Deploy to **staging**
2. Run smoke tests
3. Promote to production

Minimum smoke tests:
- Signup/login
- Add to cart
- Checkout COD
- Checkout Razorpay (staging keys)
- View my orders
- Admin login + view orders

---

## 7) Vercel deployment checklist (Frontend)

1. Create a Vercel project from `Frontend/` directory (root set to `Frontend`)
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` to Render backend URL
3. Confirm Next build command:
   - `npm run build`
4. Confirm output:
   - Next.js default (no static-only constraints)

Acceptance criteria:
- App loads on Vercel
- Calls backend successfully with cookies enabled

---

## 8) Render deployment checklist (Backend)

1. Create Render **Web Service** pointing to `backend/`
2. Build command:
   - `npm ci` (or `npm install`)
3. Start command:
   - Add backend scripts if missing (recommended): `node server.js`
4. Environment:
   - Set all required backend env vars (Section 3.2)
5. Health check:
   - Configure Render health check path to `/health` (once implemented)

Acceptance criteria:
- API responds at public URL
- DB connectivity stable
- CORS allows only Vercel domains

---

## 9) Post-launch operational checklist

### 9.1 Monitoring & alerts
Set up alerts for:
- 5xx rate
- auth failure spikes
- payment verification failures/webhook signature failures
- latency p95

### 9.2 Backups & data safety
- MongoDB Atlas backups enabled
- Restore drills documented

### 9.3 Security operations
- Rotate secrets on schedule
- Vulnerability scanning weekly
- Incident response runbook: who, how, rollback, comms

---

## 10) Suggested implementation order (min-risk sequencing)

**Phase A (safe, low-risk)**
1. Repo hygiene: remove `.next/` from commits + ensure ignores
2. CI: build/lint + secret scanning
3. Add health endpoints + structured logging (non-breaking)

**Phase B (secure checkout, higher risk but highest ROI)**
4. Server-authoritative Razorpay amount derivation
5. Lock down “paid” transitions to verified flows only
6. Add idempotency and transactional stock decrement

**Phase C (quality + scalability)**
7. API client adoption frontend
8. Tests (backend + Playwright smoke)
9. Observability (Sentry) + dashboards

---

## 11) Definition of Done (go/no-go gate for production)

**Security**
- [ ] No secrets in repo; secret scan enforced in CI
- [ ] Payments are server-authoritative (client cannot set amount)
- [ ] Orders cannot be marked paid without verification
- [ ] Cookie-only auth; no localStorage tokens

**Reliability**
- [ ] Inventory/order consistency protected (transaction or compensating + idempotency)
- [ ] Health/readiness endpoints exist and used by Render

**Delivery**
- [ ] CI green required for merges
- [ ] Staging environment exists and mirrors prod config
- [ ] Smoke tests pass on staging before prod

**Ops**
- [ ] Structured logs + request IDs
- [ ] Error monitoring enabled (Sentry or equivalent)

---

## 12) Backlog (ticket templates you can copy)

### P0 — Blockers
- P0: Change Razorpay order creation to derive amount from DB order total
- P0: Restrict paid status updates to verified Razorpay webhook/signature flows
- P0: Rotate all secrets; enforce secret scanning in CI

### P1 — Reliability
- P1: Implement Mongo transaction/idempotency for order + stock decrement
- P1: Add readiness/health endpoints and Render health check config

### P2 — Delivery/Quality
- P2: Add GitHub Actions: lint/build + secret scanning
- P2: Add minimal backend tests (auth + order + payment)
- P2: Add Playwright smoke tests (core customer journey)

### P3 — Observability
- P3: Add structured logging + request IDs
- P3: Add Sentry (frontend + backend), alerts and dashboards

