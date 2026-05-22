# PM Codebase Review (Production Readiness)
## Ruvia Cosmetics — Next.js + Express + MongoDB

**Date:** 2026-05-22  
**Reviewer lens:** Product Manager with SDE2–SDE3 production experience (delivery + ops + security)

---

## 1) Executive summary

### What this repo is
A MERN-style e-commerce platform:
- **Frontend:** Next.js App Router (React 19), Tailwind, GSAP, Sonner
- **Backend:** Express 5 + Mongoose (MongoDB), JWT auth, Razorpay payments, Cloudinary uploads, Nodemailer email

### Current state (high confidence)
The architecture is **cleanly separated** (frontend vs backend) and backend follows a **reasonable MVC layout**. Several previously-critical risks appear **partially mitigated** in code (server-side order pricing, cart validation, env validation, request sanitization, order RBAC checks, ErrorBoundary, toast notifications).

### Production readiness verdict
**Not production-ready yet** due to a few **blocking issues** that can cause real financial loss, account compromise, and operational incidents.

**Top blockers (must fix before launch):**
1. **Secrets committed to the repository** (backend `.env` contains live-looking credentials). Must rotate and purge history.
2. **Auth is “hybrid” (cookie + localStorage token)** — frontend still stores tokens in `localStorage` in multiple contexts and uses `Authorization: Bearer` everywhere; this keeps XSS token-theft risk alive.
3. **Payments trust client-provided amount** — `createRazorpayOrder` uses `amount` from client instead of deriving from internal Order. This re-opens price manipulation paths.
4. **Auth middleware doesn’t guard deleted/invalid users** — `protect` sets `req.user` without a null check; downstream controllers may assume a user exists.
5. **Order + stock update is not transactional** — stock decrement happens after order save without MongoDB transaction/rollback; can corrupt inventory under failures/retries.

---

## 2) What users can do today (product capability map)

### Customer flows
- Browse products: `GET /api/products` (Shop + Header search)
- Add to cart (client-side + optional server sync): `CartContext`
- Checkout:
  - Create order: `POST /api/orders` (server recalculates totals & validates stock)
  - For COD: success path looks complete
  - For Razorpay: order is created, then Razorpay order is created & verified
- View orders: `GET /api/orders/myorders` (Orders page UI)

### Admin flows
- Product CRUD (image upload to Cloudinary): `/api/products` (admin-protected)
- View all orders: `/api/orders/all` (admin-protected)
- Update order status: `/api/orders/:id/status` (admin-protected)

### “UI present but backend incomplete / inconsistent”
- Returns/tracking UX exists in `Frontend/app/orders/page.js` but does not appear fully wired to backend return endpoints (backend has `returnController` and routes, but the Orders page currently uses local UI modal + fake submission).

---

## 3) Architecture (how it works)

### Backend (Express)
**Entry:** `backend/server.js`
- Loads env (`dotenv.config`) + validates required env via `config/envValidation.js`
- Security: `helmet`, `cors` whitelist, `express-rate-limit`, `cookie-parser`, request sanitization (`mongo-sanitize`)
- Routes mounted under `/api/*`
- Razorpay webhook uses raw body parsing for signature verification

**Core components**
- `routes/*` → `controllers/*` → `models/*`
- `middleware/authMiddleware.js`: auth via cookie token or Bearer token
- `middleware/errorMiddleware.js`: centralized error response (but most controllers don’t `next(err)` yet)

### Frontend (Next.js App Router)
**Entry:** `Frontend/app/layout.js`
- App-level providers: `AuthProvider`, `CartProvider`, `WishlistProvider`
- `ErrorBoundary` wraps app rendering
- `Toaster` is enabled (Sonner)

**Key implementation note**
Frontend currently uses **direct `fetch()`** almost everywhere; `Frontend/lib/apiClient.js` exists (with retry + error handling) but is **not adopted** across pages/contexts yet.

---

## 4) Production risk register (what will bite us)

### R1 — Secrets committed in repo (CRITICAL)
**Signal:** `backend/.env` exists in repo and includes database URI and email password.  
**Impact:** Immediate account compromise, data breach, and vendor abuse.  
**Mitigation (required):**
- Rotate all leaked secrets (DB, SMTP, Razorpay, Cloudinary, JWT secret).
- Remove `.env` from repo and purge git history (BFG Repo-Cleaner or `git filter-repo`).
- Add secret scanning in CI (GitHub Advanced Security / gitleaks).

### R2 — Client amount trusted in payments (CRITICAL)
**Signal:** `backend/controllers/paymentController.js#createRazorpayOrder` uses `amount` from request body.  
**Impact:** Payment/order mismatch, underpayment, revenue loss, reconciliation nightmare.  
**Mitigation (required):**
- Only accept `orderId`; fetch internal Order; compute payable amount from `order.total`.
- Ensure order belongs to requester (or admin) before creating payment order.
- Persist and reconcile Razorpay orderId ↔ internal orderId.

### R3 — Token storage in localStorage (HIGH)
**Signal:** `Frontend/context/AuthContext.js`, `AdminContext.js`, `CartContext.js` still read/write tokens in localStorage.  
**Impact:** XSS → token theft → account takeover / admin takeover.  
**Mitigation (required):**
- Move fully to **HTTP-only cookies** with `credentials: 'include'` on frontend.
- Remove token persistence in localStorage for auth/admin.
- Add CSRF strategy (SameSite=strict helps, but design explicitly; consider double-submit token if needed).

### R4 — Auth middleware null-user handling (HIGH)
**Signal:** `protect` sets `req.user = await User.findById(...)` and calls `next()` even if user is null.  
**Impact:** Controllers crash or authorization bypass if they don’t check `req.user`.  
**Mitigation:**
- If user not found → `401` and return.

### R5 — No transactional integrity for order+inventory (HIGH)
**Signal:** Order is saved, then stock decremented in a loop without a transaction.  
**Impact:** Overselling, negative inventory, mismatched order/stock under failures.  
**Mitigation:**
- Use MongoDB sessions/transactions for: validate stock → create order → decrement stock → commit.
- Idempotency keys for order creation (avoid double-orders on retries).

### R6 — Validation inconsistencies (MEDIUM-HIGH)
**Signal:** `orderRoutes.js` validates `total` even though server recalculates; `paymentMethod` mapping differs between route and controller.  
**Impact:** Bugs, unpredictable behavior, client/server disagreements.  
**Mitigation:**
- Define a single request schema (zod/openapi) and generate validators consistently.

### R7 — Observability and operations gaps (MEDIUM)
**Signal:** No structured logging, request IDs, metrics, tracing, error monitoring.  
**Impact:** Slow incident response; “works on my machine” deployments.  
**Mitigation:**
- Add `pino` (or winston) + request-id middleware.
- Add Sentry (FE + BE) and basic dashboards (uptime + error rate).

### R8 — Test coverage essentially absent (MEDIUM)
**Impact:** Regression risk during refactor (especially auth + checkout).  
**Mitigation:**
- Backend: Jest + supertest (auth/order/payment happy + unhappy paths)
- Frontend: Playwright smoke tests (login, add to cart, checkout COD, checkout Razorpay mocked)

---

## 5) Recommended delivery plan (prioritized roadmap)

### Phase 0 — Stop the bleeding (1–2 days)
1. Remove committed `.env` files; rotate credentials; purge git history.
2. Add `.env` handling rules: `.env.example` only, CI check to prevent commits.

### Phase 1 — “Secure checkout” milestone (3–5 days)
1. Fix Razorpay order creation:
   - Backend derives `amount` from internal Order, not request.
   - Ownership check: only order owner/admin can initiate payment for that order.
2. Fix `protect` middleware null-user case.
3. Add basic transaction for order+stock (or at least compensate on failure).

### Phase 2 — “Auth hardening” milestone (5–8 days)
1. Move frontend to cookie-based auth only:
   - All authenticated calls use `credentials: 'include'`
   - Remove localStorage for auth/admin
2. CSRF posture decision:
   - If only same-site: strict SameSite + no cross-site embedding
   - If cross-site integrations: implement CSRF token

### Phase 3 — “Operational readiness” milestone (1–2 weeks)
1. Introduce structured logging + error monitoring (Sentry).
2. Add API contract documentation (OpenAPI/Swagger).
3. Add tests (backend API + frontend smoke).
4. Performance & UX: replace remaining “silent failures”, ensure consistent loading/error states, and adopt `apiClient` everywhere (single error handling strategy).

---

## 6) Engineering backlog (concrete tickets you can assign)

**Security**
- [ ] Purge secrets from git history; rotate all credentials; add secret scanning in CI
- [ ] Remove localStorage token usage; use httpOnly cookie auth end-to-end
- [ ] Add auth endpoint rate limiting (login/register) separately from global limiter

**Payments**
- [ ] `POST /api/payments/razorpay`: accept only `orderId`, derive amount from DB, validate owner
- [ ] Add reconciliation fields: `razorpayOrderId`, payment status transitions, idempotency key

**Orders & inventory**
- [ ] Transactional order placement + stock decrement
- [ ] Prevent duplicate order creation on retries (idempotency token)

**Quality**
- [ ] Standardize validation (single schema source)
- [ ] Adopt `apiClient` in contexts/pages; ensure retries + friendly errors
- [ ] Add unit/integration tests for checkout and auth paths

---

## 7) Notes / “gotchas” for whoever takes this to production
- Don’t deploy with committed `.env` artifacts — treat the repo as compromised until rotated.
- Decide a single auth strategy (cookie vs token header). Mixed mode increases surface area and bugs.
- Payments must be fully server-authoritative: **order total is a backend fact**, never a client suggestion.
- Add at least one staging environment with test Razorpay keys + webhook testing.

