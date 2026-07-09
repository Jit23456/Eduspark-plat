# Fraser Valley Chess Academy — Platform

Full-stack multi-tenant academy platform (Phase 1) built to the FVCA user-stories document:
franchisor/franchisee ownerships, multi-location catalog, family accounts with member
profiles, configurable discount engine, tokenized payments, loyalty & store credit,
coach scheduling/roster/attendance, trials, and tournaments/camps with automatic
Early Bird → Standard → Rush pricing.

- **Frontend:** Next.js 16 (App Router) + Tailwind CSS 4 — `frontend/`
- **Backend:** Node.js + Express + SQLite (better-sqlite3) — `backend/`
- **Design doc:** `docs/fvca-technical-spec.md`

## Quick start

```bash
# Terminal 1 — API (port 5000). First run seeds demo data automatically.
cd backend
npm install
npm run dev

# Terminal 2 — web app (port 3000)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

### Demo accounts (password: `Password123!`)

| Email | Role |
|---|---|
| `parent@example.com` | Customer / parent (2 members, saved card) |
| `coach@fvca.ca` | Coach (corporate) |
| `admin@fvca.ca` | Franchisor admin |
| `management@fvca.ca` | Franchisor management |
| `surrey.admin@fvca.ca` | Franchisee admin |
| `surrey.mgmt@fvca.ca` | Franchisee management |

## What's implemented (Phase 1)

**Customers** — registration with the two mandatory checkboxes (password fields appear
after both are checked), multi-member family profiles incl. "register me as a member",
nearest + accessible locations, optional card save (mandatory for recurring lessons),
PII masking with SMS step-up 2FA to view/edit, dashboard (schedule, notifications,
coach notes, trial assessments, invoices/receipts, loyalty, store credit),
15-day cancellation notice, event registration with byes/play-up/CFC-ID surcharges.

**Discount engine (configurable by franchisor)** — group frequency (2x → 25%, 3x → 35%),
multi-planet (2 → 5% … 5 → 20%) applied after the frequency discount; private lessons get
their own multi-session discount and never combine with group discounts. One-time $25
member setup fee on first purchase. Live "you may like…" upsell hints in cart.

**Coaches** — session list with pre-generated expected-attendance sheets, attendance
marking (absences notify parents), per-session topic/homework notes, trial assessments
with recommended batch (surfaced on the parent dashboard), 6-month availability that
carries over, leaves.

**Admins / Management** — planets → levels → courses → variants catalog, discount tiers
and global config, ownership creation (management account emailed a temp password that
must be reset on first login), locations, holiday calendars, staff accounts, offerings +
weekly batches with live seat counts, 2-week roster generation honoring holidays /
availability / leaves, customers view + store-credit grants, missed-payment report and
retry-charge, price change requests (franchisee submits → franchisor management
approves; approval applies the local price), IT/Non-IT tickets, revenue reports by
ownership / location / planet / level / month, failed-registration (full slot) report,
event templates + entries report with filters (missing CFC ID, byes, section, play-up)
and inline CFC-ID assignment.

**System actor** — hourly jobs (manual trigger from the admin console): expected
attendance sheets, monthly recurring card charging with dunning notifications,
loyalty accrual ($1 = 100 points, welcome bonus on signup, 10,000 pts = $1 redemption),
15-day cancellation finalization. All automated actions are audit-logged as `SYSTEM`.

**Payments** — mock tokenizing gateway stand-in for Stripe/Square: only gateway tokens +
display metadata (brand/last4/expiry) are stored, never card numbers (SAQ-A posture).
Use a card token containing `fail` to simulate declines.

## API surface

`/api/auth` (register, login, set-password, 2FA), `/api/public` (locations, planets,
catalog, batches, discounts, events + public registration lists, trials),
`/api/customer` (profile, members, cart quote/checkout, enrollments, invoices, cards,
loyalty, event registration), `/api/coach`, `/api/admin`, `/api/events`,
`/api/system/run-jobs`.

## Configuration

Backend env (`backend/.env`, see `.env.example`): `PORT` (default 5000), `JWT_SECRET`.
Frontend env: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:5000/api` in dev).
Business values (setup fee, refund fee, loyalty rates, welcome bonus, notice days) are
editable at runtime in **Admin → Catalog & config**.

## Deployment

Deploy `frontend/` to Vercel with `NEXT_PUBLIC_API_URL` pointing at the hosted backend.
The Express backend needs a persistent host (Render/Railway/Azure App Service — SQLite
requires a persistent disk, or swap the `db.js` layer for Azure SQL per the spec).
