# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-21  
**Current Milestone:** Week 4 Implemented (Admin Panel, Seller Onboarding, Verification Docs & Audit Logs — Ready for VS Code Migration & Test Run)  
**Next Module:** Week 5 — Categories (with Category Commission %) & Product Management + Admin Moderation

---

## 1. Locked Project Decisions (Do Not Change Without Approval)

| Area | Locked Decision |
| :--- | :--- |
| **Workspace Strategy** | Dual-workspace monorepo: React (Vite `.jsx`) at repository root (live preview + `npm run dev`) and Django 5 + DRF + PostgreSQL in `backend/` (run locally in VS Code via `git pull`). |
| **Frontend Stack** | React 19, **Plain JavaScript (`.jsx` / `.js`)**, Tailwind CSS v4, React Router DOM, Axios, Context API, Recharts, Lucide Icons. |
| **Backend Stack** | Python 3.11+, Django 5, Django REST Framework, SimpleJWT, PostgreSQL 15+ (`DecimalField` for all money). |
| **Currency & Market** | India — Indian Rupee (**INR ₹**) formatted with `en-IN` lakh grouping (e.g., `₹2,45,000`). |
| **Commission Model** | Category-based commission percentages (Admin-configurable per category, snapshotted onto every `SellerSuborder` / `OrderItem`). |
| **Payments** | **Razorpay Prepaid** (HMAC signature + idempotent webhook verification) + **Cash on Delivery (COD)** (default cap: ₹5,000). |
| **Shipping & Returns** | Free shipping on orders **≥ ₹999** (₹79 standard below ₹999). **7-day return window** post-delivery (personalized/made-to-order items returnable only if damaged/defective/wrong). |
| **Auth & Token Security** | `/login` shows **only** Username, Password, Forgot Password link, Login button, and Sign Up link (zero role buttons). `/sign-up` always creates a `BUYER`. Short-lived JWT access token stored strictly in JS memory + rotating refresh token in `HttpOnly` cookie (via Vite `/api` same-origin proxy in dev). 5-failure/15-min lockout + DRF rate throttling. |
| **Visual Design System** | Warm parchment storefront & cart (`#FAF6F0`, terracotta `#8B4B28`, Fraunces serif + Plus Jakarta Sans + JetBrains Mono) paired with dark charcoal-slate sidebar dashboards (`#242B33` + teal `#2E9A90` active state + `#F6F7F9` workspace). |

---

## 2. 12-Week Incremental Module Tracker

> **Module Completion Rule (Part 23):** A module is only marked **Done** once Backend models/migrations, API endpoints, Permissions, Frontend integration, and Automated Tests are all verified.

| Week | Module | Backend | Frontend | Tests Verified | Overall Status |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | SRS, Architecture, ERD, API Docs & UI/UX Blueprint | N/A | N/A | Reviewed | **Done** |
| **2** | React (`.jsx`), Django 5 & PostgreSQL Starter Setup | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **3** | Full Auth (In-Memory JWT + `HttpOnly` Refresh, Email Verification, Password Reset/Change, Brute-Force Lockout, Logout-All) | Live & Verified | Live & Verified | 9/9 Django Tests OK + Build/Lint OK | **Done** |
| **4** | Admin Panel & Seller Onboarding (`SellerApplication`, Verification Docs, Approval, `SellerProfile`, `AuditLog`) | Implemented | Live & Wired | 6 New Django Tests Added (Run in VS Code) | **Ready to Verify** |
| **5** | Categories (with Commission %) & Product Management + Admin Moderation | Not Started | UI Shell / Empty State | Not Started | **Next Up** |
| **6** | Customer Shopping Storefront (Live Search, Filters, Sorting, PDP) | Not Started | Starter Catalog Ready | Not Started | Pending |
| **7** | Cart, Wishlist, Coupons & Buyer Addresses | Not Started | Client Cart Ready | Not Started | Pending |
| **8** | Multi-Vendor Order Splitting, Stock Locking, Razorpay & COD | Not Started | Empty State Ready | Not Started | Pending |
| **9** | Shipping, Courier Tracking, Shipment Events & 7-Day Returns | Not Started | Empty State Ready | Not Started | Pending |
| **10** | Financial Ledger, Category Commissions, Refunds & Seller Payouts | Not Started | Empty State Ready | Not Started | Pending |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Baseline Charts Ready | Not Started | Pending |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–4)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`. Strict live Django auth (zero offline fake fallbacks).
- **Seller Onboarding & Shop Profile (`apps/sellers`)**:
  - `POST /api/v1/sellers/apply/` — Verified Buyer-only application with Indian PAN/GSTIN/IFSC/Pincode validation, masked bank storage, and optional verification document upload (`.pdf`/`.jpg`/`.png`, max 5 MB).
  - `GET /api/v1/sellers/application-status/` — Live application status (`PENDING` / `APPROVED` / `REJECTED` with Admin review notes).
  - `GET/PATCH /api/v1/sellers/shop/` — Approved Seller studio profile management.
  - `GET /api/v1/sellers/documents/<uuid>/` — RBAC-protected document download (strictly Admin or uploading applicant).
- **Admin Governance & Audit Trail (`apps/sellers`, `apps/audit`)**:
  - `GET /api/v1/admin/dashboard/` — Live PostgreSQL Buyer/Seller counts, pending seller application counts, and recent audit activity.
  - `GET /api/v1/admin/seller-applications/` & `POST /api/v1/admin/seller-applications/<uuid>/review/` — Atomic approve (promotes Buyer → `SELLER` and creates `SellerProfile`) or reject (with required review reason).
  - `GET /api/v1/admin/sellers/` & `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/` — Suspend or reinstate seller studios.
  - `GET /api/v1/admin/buyers/` & `POST /api/v1/admin/users/<uuid>/toggle-active/` — Manage Buyer accounts and revoke sessions on suspension.
  - `GET /api/v1/admin/audit-logs/` — Immutable PostgreSQL governance audit log.

### Scheduled Upcoming Modules (Weeks 5–11)
- Categories with commission % & Product upload/moderation (`apps/categories`, `apps/products` — **Weeks 5–6**).
- Persistent Cart, Wishlist, Coupons & Buyer Addresses (`apps/cart`, `apps/coupons` — **Week 7**).
- Multi-vendor order splitting, inventory locking, Razorpay HMAC/webhook & COD (`apps/orders`, `apps/payments` — **Week 8**).
- Shipping, tracking events, 7-day returns & financial ledger/payouts (`apps/shipping`, `apps/finance` — **Weeks 9–10**).

---

## 4. VS Code Local Verification Checklist (Week 4)

After pushing to GitHub and running `git pull origin main` in VS Code:

- [ ] Generate and apply the new `audit` and `sellers` database migrations:
  ```powershell
  cd backend
  python manage.py makemigrations audit sellers
  python manage.py migrate
  ```
- [ ] Run the full test suite (15 total tests: 9 Week 3 auth tests + 6 Week 4 seller/admin tests):
  ```powershell
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and test the end-to-end flow:
  1. Sign up or log in as a Buyer → open the `/verify-email?token=...` link printed in your Django terminal so your Buyer email is verified.
  2. Click **Become a Seller** → fill out the studio details + optional PDF/PNG doc → click **Submit Application**.
  3. Log in as your **Admin** → open **Sellers → Seller Applications** → see the real application from PostgreSQL → click **Approve & Promote**.
  4. Log back in as that Buyer → confirm Django automatically redirects you to **`/seller/dashboard`** with your real studio name and working **My Shop** profile editor!

---

## 5. How to Start the Next Session / Module

Once Week 4 tests pass in VS Code, tell the AI:
> *"Check `PROJECT_PROGRESS.md` — Week 4 tests passed in VS Code. Let's start Week 5 (Categories with Commission % & Product Management + Admin Moderation)."*
