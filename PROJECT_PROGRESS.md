# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-21  
**Current Milestone:** Week 3 Completed & Verified (9/9 Django Auth & Security Tests Passing in VS Code)  
**Next Module:** Week 4 — Admin Panel & Seller Onboarding (`SellerApplication`, Verification Docs, Approval & Role Promotion APIs)

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
| **4** | Admin Panel & Seller Onboarding (`SellerApplication`, Verification Docs, Approval) | Not Started | UI Shell / Preview State | Not Started | **Next Up** |
| **5** | Categories (with Commission %) & Product Management + Admin Moderation | Not Started | UI Shell / Preview State | Not Started | Pending |
| **6** | Customer Shopping Storefront (Live Search, Filters, Sorting, PDP) | Not Started | UI Preview Ready | Not Started | Pending |
| **7** | Cart, Wishlist, Coupons & Buyer Addresses | Not Started | UI Preview Ready | Not Started | Pending |
| **8** | Multi-Vendor Order Splitting, Stock Locking, Razorpay & COD | Not Started | UI Preview Ready | Not Started | Pending |
| **9** | Shipping, Courier Tracking, Shipment Events & 7-Day Returns | Not Started | UI Preview Ready | Not Started | Pending |
| **10** | Financial Ledger, Category Commissions, Refunds & Seller Payouts | Not Started | Not Started | Not Started | Pending |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Preview Charts Ready | Not Started | Pending |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Preview State

### Implemented & Ready for Live Django Connection (Weeks 2–3)
- `GET /api/v1/health/` — Database & service health verification.
- `POST /api/v1/auth/register/` — Public Buyer-only registration + dispatches hashed 24h email verification link + sets `HttpOnly` refresh cookie.
- `POST /api/v1/auth/verify-email/` & `POST /api/v1/auth/resend-verification/` — Single-use SHA-256 verification flow (throttled `5/hour`).
- `POST /api/v1/auth/login/` — Username + password login with 5-failure/15-min lockout, DRF throttling (`5/minute`), suspended account blocking, `HttpOnly` refresh cookie, and DB-resolved `redirect_url`.
- `POST /api/v1/auth/token/refresh/` — Rotates `HttpOnly` refresh cookie, blacklists old token, enforces `is_active`, and returns fresh in-memory access token.
- `POST /api/v1/auth/password/reset/` & `/password/reset/confirm/` — Anti-enumeration reset request + 30-min single-use hashed token confirmation that revokes all existing sessions.
- `POST /api/v1/auth/password/change/` — Verifies current password, updates hash, revokes other active sessions.
- `POST /api/v1/auth/logout/` & `POST /api/v1/auth/logout-all/` — Single-session and all-device refresh token revocation.
- `GET/PATCH /api/v1/auth/me/` — Authenticated user profile (role read-only).
- Frontend pages & controls: `/login`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, dashboard `EmailVerificationBanner`, and shared `AccountSecurityPanel` across Buyer, Seller, and Admin settings.
- **Strict Live Auth & Clean Dashboards Enforced**: Removed all offline preview auth fallbacks (`/login` and `/sign-up` strictly require the running Django backend and show a clear connection error if Django is stopped) and removed fake default orders, cart items, wishlists, addresses, and revenue figures from Buyer, Seller, and Admin dashboards (all dashboards now display honest `₹0` / empty states until their respective backend modules are built).

### Currently Running on Empty/Starter States (Upcoming Weeks 4–11)
- Seller applications, verification documents & Admin approval mutations (`apps/sellers` — **Week 4**).
- Categories with commission % & Product upload/moderation (`apps/categories`, `apps/products` — **Weeks 5–6**).
- Persistent Cart, Wishlist, Coupons & Buyer Addresses (`apps/cart`, `apps/coupons` — **Week 7**).
- Multi-vendor order splitting, inventory locking, Razorpay HMAC/webhook & COD (`apps/orders`, `apps/payments` — **Week 8**).
- Shipping, tracking events, 7-day returns & financial ledger/payouts (`apps/shipping`, `apps/finance` — **Weeks 9–10**).

---

## 4. VS Code Local Verification Checklist (Week 3)

After pushing to GitHub and running `git pull origin main` in VS Code:

- [ ] Ensure your local root `.env` has `VITE_API_BASE_URL="/api/v1"` (uses the new Vite `/api` proxy so `HttpOnly` cookies stay same-origin)
- [ ] Ensure `backend/.env` has `FRONTEND_URL=http://localhost:3000` (keep your real local `DB_PASSWORD` only in `backend/.env`, never `backend/.env.example`)
- [ ] Run migrations for the new `User` lockout fields & `AuthActionToken` model:
  ```bash
  cd backend
  python manage.py makemigrations accounts
  python manage.py migrate
  ```
- [ ] Run the expanded Week 3 security test suite (7 test cases):
  ```bash
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`), then test:
  - Sign up a new Buyer → copy the `/verify-email?token=...` link printed in your VS Code Django terminal → open it in your browser → confirm `Email Verified`.
  - Reload the browser (`F5`) → confirm you stay logged in via the silent `HttpOnly` refresh cookie (and `localStorage` contains zero JWTs).
  - Test `/forgot-password` → copy `/reset-password?token=...` from the Django terminal → set a new password → log in with the new password.
  - Test **Settings → Change Password** and **Sign Out All Devices** inside your dashboard.

---

## 5. How to Start the Next Session / Module

Once Week 3 tests pass in VS Code, tell the AI:
> *"Check `PROJECT_PROGRESS.md` — Week 3 tests passed in VS Code. Let's start Week 4 (Seller Onboarding, Verification Documents & Admin Approval APIs)."*
