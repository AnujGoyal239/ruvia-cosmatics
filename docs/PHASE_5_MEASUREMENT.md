# Phase 5 — Measurement & Profiling (Make perf work data-driven)

This guide turns “it feels slow” into **measurable bottlenecks** you can assign and fix.

---

## 1) Baseline targets (define success)

### Frontend
- Route transition: < **300–500ms** for cached routes (no first-time compile)
- Total blocking time on transition: minimal (no long JS tasks > 50ms)
- LCP (prod): target < **2.5s** on mid-tier mobile

### Backend
- Typical API p95 < **300ms** for common reads (products, my orders)
- Checkout p95 < **800ms** (includes DB + stock checks)

---

## 2) Frontend: bundle size measurement

### Run bundle analyzer
```bash
cd Frontend
npm run analyze
```

What to look for:
- Biggest route chunks (especially `admin/dashboard`, `orders`, `shop`)
- Libraries that should be dynamically imported:
  - charts (recharts)
  - pdf generation (jspdf)
  - any one-off admin utilities

Deliverable:
- Capture the top 5 largest chunks and open tickets:
  - “Move X to dynamic import”
  - “Replace X with lighter alternative”

---

## 3) Frontend: runtime profiling (React + browser)

### React Profiler
Profile these pages:
- `/shop`
- `/checkout`
- `/orders`
- `/admin/dashboard`

Look for:
- Components re-rendering on every keystroke/scroll
- Large commits (many ms) during navigation
- Context providers causing whole-tree re-renders

Deliverable:
- Screenshot/notes per page with:
  - Top 3 components by render cost
  - Hypothesis for why they re-render

### Chrome Performance tab
Record a route transition (e.g., `/shop` → `/checkout`).
Look for:
- Long tasks (yellow) during transition
- Scripting time spikes
- Layout thrashing

Deliverable:
- Identify whether the delay is:
  - network-bound (slow API)
  - CPU-bound (JS/render)

---

## 4) Backend: request timing logs (dev-safe)

Enable in backend `.env`:
```
LOG_REQUESTS=true
LOG_SLOW_REQUEST_MS=300
```

This prints per-request timing (method, path, status, ms) and highlights slow requests.

Deliverable:
- Hit key flows and capture slow endpoints:
  - `/api/products`
  - `/api/orders/myorders`
  - `/api/admin/dashboard`

---

## 5) What to do with the data (ticket template)

For each perf issue, create a ticket like:
- **Title:** “Perf: /shop route transition > 1.5s due to heavy JS”
- **Evidence:** bundle analyzer screenshot + performance trace
- **Root cause hypothesis:** e.g., large chart lib included globally
- **Fix plan:** dynamic import or remove dependency
- **Acceptance:** route transition p95 < 500ms, bundle reduced by X KB

