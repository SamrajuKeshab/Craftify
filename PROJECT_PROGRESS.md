# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-21  
**Current Milestone:** Week 6 Implemented & Ready for VS Code Verification (Dedicated Product Detail Page, Advanced Price/Craft Filters & Pagination, Artisan Studios Directory & Dedicated Seller Studio Storefronts)  
**Next Module:** Week 7 — Persistent Cart, Wishlist, Coupons & Buyer Addresses

---

## 1. Locked Project Decisions (Do Not Change Without Approval)

| Area | Locked Decision |
| :--- | :--- |
| **Workspace Strategy** | Dual-workspace monorepo: React (Vite `.jsx`) at repository root (live preview + `npm run dev`) and Django 5 + DRF + PostgreSQL in `backend/` (run locally in VS Code via `git pull`). |
| **Frontend Stack** | React 19, **Plain JavaScript (`.jsx` / `.js`)**, Tailwind CSS v4, React Router DOM, Axios, Context API, Recharts, Lucide Icons. |
| **Backend Stack** | Python 3.11+, Django 5, Django REST Framework, SimpleJWT, PostgreSQL 15+ (`DecimalField` for all money), Cloudinary (server-side media uploads via `backend/.env`). |
| **Currency & Market** | India — Indian Rupee (**INR ₹**) formatted with `en-IN` lakh grouping (e.g., `₹2,45,000`). |
| **Commission Model** | Category-based commission percentages (`0.00%–50.00%`, Admin-configurable per category, snapshotted onto every `SellerSuborder` / `OrderItem`). Zero pre-seeded categories — Admin creates categories manually. |
| **Payments** | **Razorpay Prepaid** (HMAC signature + idempotent webhook verification) + **Cash on Delivery (COD)** (default cap: ₹5,000). |
| **Shipping & Returns** | Free shipping on orders **≥ ₹999** (₹79 standard below ₹999). **7-day return window** post-delivery (personalized/made-to-order items returnable only if damaged/defective/wrong). |
| **Auth & Token Security** | `/login` shows **only** Username, Password, Forgot Password link, Login button, and Sign Up link (zero role buttons). `/sign-up` always creates a `BUYER` and redirects to `/` (Home Page). Short-lived JWT access token stored strictly in JS memory + rotating refresh token in `HttpOnly` cookie (via Vite `/api` same-origin proxy in dev). 5-failure/15-min lockout + DRF rate throttling. |
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
| **6** | Customer Shopping Storefront (Dedicated PDP `/products/:slug`, Price/Craft Filters & Pagination, Artisan Studios `/shops` & `/shops/:slug`) | Live (No New Migration Needed) | Live & Wired | Build/Lint OK — Run `python manage.py test` in VS Code | **Ready to Verify** |
| **7** | Persistent Cart, Wishlist, Coupons & Buyer Addresses | Not Started | Client Cart Ready | Not Started | **Next Up** |
| **8** | Multi-Vendor Order Splitting, Stock Locking, Razorpay & COD | Not Started | Empty State Ready | Not Started | Pending |
| **9** | Shipping, Courier Tracking, Shipment Events & 7-Day Returns | Not Started | Empty State Ready | Not Started | Pending |
| **10** | Financial Ledger, Category Commissions, Refunds & Seller Payouts | Not Started | Empty State Ready | Not Started | Pending |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Baseline Charts Ready | Not Started | Pending |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–6)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**:
  - `POST /api/v1/sellers/apply/`, `GET /api/v1/sellers/application-status/`, `GET/PATCH /api/v1/sellers/shop/`, `GET /api/v1/sellers/documents/<uuid>/`.
  - `GET /api/v1/admin/dashboard/`, `GET /api/v1/admin/seller-applications/`, `POST /api/v1/admin/seller-applications/<uuid>/review/`, `GET /api/v1/admin/sellers/`, `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/`, `GET /api/v1/admin/buyers/`, `POST /api/v1/admin/users/<uuid>/toggle-active/`, `GET /api/v1/admin/audit-logs/`.
- **Catalog, Cloudinary Media, Moderation & Customer Storefront (`apps/catalog`)**:
  - **Public Storefront Discovery**: `GET /api/v1/categories/`, `GET /api/v1/products/` (supports `category`, `seller`, `search`, `min_price`, `max_price`, `in_stock`, `customizable`, `made_to_order`, `one_of_a_kind`, `ordering`, `page`, `page_size`), `GET /api/v1/products/<slug>/` (includes `related_products`), `GET /api/v1/shops/`, `GET /api/v1/shops/<slug>/` (strictly public studio fields only — zero KYC/bank exposure).
  - **Admin Categories & Moderation**: `GET/POST /api/v1/admin/categories/`, `PATCH/DELETE /api/v1/admin/categories/<uuid>/`, `GET /api/v1/admin/products/`, `POST /api/v1/admin/products/<uuid>/moderate/`.
  - **Seller Products & Cloudinary Uploads**: `GET/POST /api/v1/seller/products/`, `GET/PATCH/DELETE /api/v1/seller/products/<uuid>/`, `POST /api/v1/seller/products/<uuid>/images/`, `PATCH/DELETE /api/v1/seller/products/<uuid>/images/<uuid>/`.

### Scheduled Upcoming Modules (Weeks 7–11)
- Persistent Cart, Wishlist, Coupons & Buyer Addresses (`apps/cart`, `apps/coupons` — **Week 7**).
- Multi-vendor order splitting, inventory locking, Razorpay HMAC/webhook & COD (`apps/orders`, `apps/payments` — **Week 8**).
- Shipping, tracking events, 7-day returns & financial ledger/payouts (`apps/shipping`, `apps/finance` — **Weeks 9–10**).

---

## 4. VS Code Local Verification Checklist (Week 6)

After pushing to GitHub and running `git pull origin main` in VS Code (no new database migration needed for Week 6!):

- [ ] Run the full automated Django test suite (21 tests total: 9 Auth + 6 Seller/Admin + 6 Catalog/Storefront tests):
  ```powershell
  cd backend
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and verify the live shopping storefront:
  1. On `/` (Home Page), click **Filters** → test INR **Min/Max price**, **In Stock Only**, **Customizable / Made to Order / One of a Kind**, and **Sort** options.
  2. Click any approved product card → confirm it opens its dedicated **`/products/<slug>`** page with multi-photo Cloudinary gallery, live variant switcher, stock-bounded quantity stepper, **Add to Cart** / **Buy Now**, and **More Handmade Crafts** below.
  3. Click the studio name (or **Our Artists** in the navbar) → explore **`/shops`** and click into a studio's dedicated **`/shops/<slug>`** storefront page!

---

## 5. How to Start the Next Session / Module

Once Week 6 tests pass in VS Code, tell the AI:
> *"Check `PROJECT_PROGRESS.md` — Week 6 tests passed in VS Code. Let's start Week 7 (Persistent Cart, Wishlist, Coupons & Buyer Addresses)."*
