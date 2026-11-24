# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-24  
**Current Milestone:** Week 12 Implemented & Ready for Final Verification & Production Launch (OWASP Security Hardening, E2E Test Suite, Live Razorpay HTTPS Webhook, SMTP Email & Vercel/Render Packaging)  
**Project Status:** All 12 Weekly Modules Complete

---

## 1. Locked Project Decisions (Do Not Change Without Approval)

| Area | Locked Decision |
| :--- | :--- |
| **Workspace Strategy** | Dual-workspace monorepo: React (Vite `.jsx`) at repository root (Vercel deploy) and Django 5 + DRF + PostgreSQL in `backend/` (Render deploy + VS Code local dev). |
| **Frontend Stack** | React 19, **Plain JavaScript (`.jsx` / `.js`)**, Tailwind CSS v4, React Router DOM, Axios, Context API, Recharts, Lucide Icons. |
| **Backend Stack** | Python 3.11+, Django 5, Django REST Framework, SimpleJWT, PostgreSQL 15+ (`DecimalField` for all money), Gunicorn, WhiteNoise, Cloudinary (server-side media uploads). |
| **Currency & Market** | India — Indian Rupee (**INR ₹**) formatted with `en-IN` lakh grouping (e.g., `₹2,45,000`). |
| **Commission Model** | Category-based commission percentages (`0.00%–50.00%`, Admin-configurable per category, snapshotted onto every `SellerSuborder` / `OrderItem`). Zero pre-seeded categories — Admin creates categories manually. |
| **Cart, Wishlist & Coupons** | Login required before adding items to Cart or saving to Wishlist (auto-redirects back after sign-in). Platform discount coupons start at zero and are created/managed by Admin in the Admin Dashboard with server-side validation & AuditLog trail. |
| **Payments** | **Razorpay Prepaid** (server-side Order creation, constant-time HMAC-SHA256 verification & idempotent signed HTTPS webhook supporting `payment.captured`, `order.paid`, and `payment.failed`) + **Cash on Delivery (COD)** (server-enforced ₹5,000 cap). |
| **Shipping & Returns** | Free shipping on orders **≥ ₹999** (₹79 standard below ₹999). Sellers select Indian couriers + enter AWB tracking numbers & transit events. **7-day return window** post-delivery with optional buyer Cloudinary photo proof (up to 3 images); personalized/made-to-order items returnable only if damaged/defective/wrong; Sellers approve/reject/complete returns directly with optional restock. |
| **Settlements, Refunds & Payouts** | Delivered suborders append immutable `SALE_CREDIT` (7-day settlement hold aligned with return window) and `PLATFORM_COMMISSION` entries. Completed returns & cancelled prepaid orders queue `RefundRecord` + proportional `REFUND_DEBIT`/`COMMISSION_REVERSAL`. Sellers withdraw cleared balance to verified masked bank/IFSC; Admin approves/pays with UTR reference or rejects (restoring balance via `PAYOUT_REVERSAL`), with optional early hold release. |
| **Reviews, Notifications & Analytics** | Verified-purchase reviews strictly enforced 1-to-1 per delivered `OrderItem`, live studio `rating_avg` recalculation, seller replies, and Admin moderation (`PUBLISHED`/`HIDDEN`). Persistent per-user notification bell inbox wired across Buyer, Seller, and Admin dashboards. Real PostgreSQL analytics charts (GMV vs. Commission, Category Revenue, Payment Mix, Fulfilment Funnel, Top Studios). |
| **Auth, Security & Production Routing** | `/login` shows **only** Username, Password, Forgot Password link, Login button, and Sign Up link (zero role buttons). `/sign-up` always creates a `BUYER` and redirects to `/` (Home Page). Short-lived JWT access token stored strictly in JS memory + rotating refresh token in `HttpOnly` cookie. Vercel proxies `/api/:path*` same-origin to Render so `SameSite=Lax` cookies work in all browsers. Production uses SMTP email (Gmail App Password / Brevo / Resend), strict CSP/HSTS/Permissions-Policy headers, scoped rate throttling, and fail-fast secret checks. |
| **Visual Design System** | Warm parchment storefront & cart (`#FAF6F0`, terracotta `#8B4B28`, Fraunces serif + Plus Jakarta Sans + JetBrains Mono) paired with dark charcoal-slate sidebar dashboards (`#242B33` + teal `#2E9A90` active state + `#F6F7F9` workspace). |

---

## 2. 12-Week Incremental Module Tracker

> **Module Completion Rule (Part 23):** A module is only marked **Done** once Backend models/migrations, API endpoints, Permissions, Frontend integration, and Automated Tests are all verified.

| Week | Module | Backend | Frontend | Tests Verified | Overall Status |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | SRS, Architecture, ERD, API Docs & UI/UX Blueprint | N/A | N/A | Reviewed | **Done** |
| **2** | React (`.jsx`), Django 5 & PostgreSQL Starter Setup | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **3** | Full Auth (In-Memory JWT + `HttpOnly` Refresh, Email Verification, Password Reset/Change, Brute-Force Lockout, Logout-All) | Live & Verified | Live & Verified | 9/9 Django Tests OK + Build/Lint OK | **Done** |
| **4** | Admin Panel & Seller Onboarding (`SellerApplication`, Verification Docs, Approval, `SellerProfile`, `AuditLog`) | Live & Verified | Live & Verified | 15/15 Django Tests OK + Build/Lint OK | **Done** |
| **5** | Categories (with Commission %), Seller Products + Variants + Cloudinary Images & Admin Moderation | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **6** | Customer Shopping Storefront (Dedicated PDP `/products/:slug`, Price/Craft Filters & Pagination, Artisan Studios `/shops` & `/shops/:slug`) | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **7** | Persistent Cart, Wishlist, Admin Platform Coupons & Buyer Indian Address Book (`apps/commerce`) | Live & Verified | Live & Verified | 25/25 Django Tests OK + Build/Lint OK | **Done** |
| **8** | Multi-Vendor Order Splitting, Atomic Stock Locking, Razorpay & COD (`apps/orders`) | Live & Verified | Live & Verified | 31/31 Django Tests OK + Razorpay Test Keys Active | **Done** |
| **9** | Shipping, Indian Courier Tracking, Shipment Events & 7-Day Returns (`apps/shipping`) | Live & Verified | Live & Verified | 36/36 Django Tests OK + Verified Error-Free | **Done** |
| **10** | Financial Ledger, Category Commissions Settlement, Refunds & Seller Payouts (`apps/finance`) | Live & Verified | Live & Verified | 41/41 Django Tests OK + Verified Error-Free | **Done** |
| **11** | Verified Reviews, In-App Notifications & Real DB Analytics Charts (`apps/reviews`, `apps/notifications`) | Live & Verified | Live & Verified | 46/46 Django Tests OK + Verified Error-Free | **Done** |
| **12** | Full Security Audit (OWASP ASVS), E2E Tests, Live Razorpay Webhook, SMTP Email & Vercel/Render Deploy | Hardened & Packaged | ErrorBoundary + 404 + Vercel Proxy | Build/Lint OK — Run `python manage.py test` in VS Code (52 tests) | **Ready to Deploy** |

---

## 3. Complete Platform Capabilities (Weeks 2–12)

- **Auth & Security (`apps/accounts`, `common/middleware.py`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex & CSRF header check), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`, plus `SecurityHeadersMiddleware`, `Cache-Control: no-store` on sensitive endpoints, and expanded DRF rate throttling.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**: Seller application & document review, studio management, buyer/seller suspension toggles, immutable `AuditLog`, and `python manage.py check_production_readiness`.
- **Catalog, Cloudinary Media, Moderation & Storefront (`apps/catalog`)**: Admin categories with commission rates, seller products/variants/Cloudinary photos, moderation queue, dedicated PDP, filters/pagination, and Artisan Studios directory.
- **Cart, Wishlist, Coupons & Indian Address Book (`apps/commerce`)**: Persistent DB cart/wishlist, Admin platform coupons, Indian pincode/phone address book.
- **Multi-Vendor Orders, Stock Locking, Razorpay & COD (`apps/orders`)**: Split `SellerSuborder`s, atomic `select_for_update()` stock locking, Razorpay Checkout + HMAC-SHA256 verification + hardened webhook (`payment.captured`, `order.paid`, `payment.failed`) + ₹5,000 COD cap.
- **Shipping, Courier Tracking & 7-Day Returns (`apps/shipping`)**: Indian courier dispatch, tracking events, delivery confirmation, 7-day return window with optional Cloudinary proof photos.
- **Financial Ledger, 7-Day Settlements, Refunds & Seller Payouts (`apps/finance`)**: Immutable INR ledger, 7-day settlement holds, refund records, seller bank payouts with UTR tracking.
- **Verified Reviews, Notifications & Real DB Analytics (`apps/reviews`, `apps/notifications`, `apps/finance/analytics.py`)**: Verified-purchase 1-to-1 reviews, studio replies, Admin moderation, persistent notification bell inbox, real PostgreSQL analytics charts.
- **Production Deployment Packaging (`render.yaml`, `backend/build.sh`, `vercel.json`, `DEPLOYMENT.md`)**: One-click Render Blueprint + Managed PostgreSQL, Vercel same-origin `/api/:path*` proxy & CSP/HSTS headers, production SMTP email config, React `ErrorBoundary`, and branded 404 page.

---

## 4. Final VS Code Verification & Production Launch Checklist (Week 12)

After pushing to GitHub and running `git pull origin main` in VS Code:

- [ ] Run the complete **52-test** automated Django suite (46 Weeks 3–11 tests + 6 new Week 12 Security & E2E tests):
  ```powershell
  cd backend
  python manage.py test
  ```
- [ ] Run the built-in production readiness diagnostic CLI:
  ```powershell
  python manage.py check_production_readiness
  ```
- [ ] Follow **`DEPLOYMENT.md`** at the repository root to:
  1. Deploy Django + Managed PostgreSQL on **Render** (`render.yaml`).
  2. Deploy the React storefront on **Vercel** (`vercel.json` same-origin `/api` proxy).
  3. Register the **Razorpay Test Mode live HTTPS webhook** (`https://<render-service>.onrender.com/api/v1/payments/razorpay/webhook/`) and set `RAZORPAY_WEBHOOK_SECRET` in Render.
  4. Configure **SMTP Email** (Gmail App Password, Brevo, or Resend) in Render and verify live email delivery.
