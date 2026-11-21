# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-21  
**Current Milestone:** Week 5 Implemented & Ready for VS Code Verification (Categories with Commission %, Seller Products + Variants + Cloudinary Uploads, Admin Moderation & Live Storefront Catalog)  
**Next Module:** Week 6 — Customer Shopping Storefront (Dedicated Product Detail Page, Advanced Price/Craft Filters, Seller Studio Pages)

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
| **5** | Categories (with Commission %), Seller Products + Variants + Cloudinary Images & Admin Moderation + Live Home Catalog | Live (Ready to Migrate) | Live & Wired | Build/Lint OK — Run `python manage.py test` in VS Code | **Ready to Verify** |
| **6** | Customer Shopping Storefront (Dedicated PDP Route, Advanced Price/Craft Filters, Seller Studio Storefront) | Not Started | Live Home Catalog Active | Not Started | **Next Up** |
| **7** | Cart, Wishlist, Coupons & Buyer Addresses | Not Started | Client Cart Ready | Not Started | Pending |
| **8** | Multi-Vendor Order Splitting, Stock Locking, Razorpay & COD | Not Started | Empty State Ready | Not Started | Pending |
| **9** | Shipping, Courier Tracking, Shipment Events & 7-Day Returns | Not Started | Empty State Ready | Not Started | Pending |
| **10** | Financial Ledger, Category Commissions, Refunds & Seller Payouts | Not Started | Empty State Ready | Not Started | Pending |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Baseline Charts Ready | Not Started | Pending |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–5)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**:
  - `POST /api/v1/sellers/apply/`, `GET /api/v1/sellers/application-status/`, `GET/PATCH /api/v1/sellers/shop/`, `GET /api/v1/sellers/documents/<uuid>/`.
  - `GET /api/v1/admin/dashboard/`, `GET /api/v1/admin/seller-applications/`, `POST /api/v1/admin/seller-applications/<uuid>/review/`, `GET /api/v1/admin/sellers/`, `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/`, `GET /api/v1/admin/buyers/`, `POST /api/v1/admin/users/<uuid>/toggle-active/`, `GET /api/v1/admin/audit-logs/`.
- **Catalog, Cloudinary Media & Moderation (`apps/catalog`, `common/cloudinary_utils.py`)**:
  - **Public Storefront**: `GET /api/v1/categories/`, `GET /api/v1/products/`, `GET /api/v1/products/<slug>/` (strictly Admin-approved products from active categories and non-suspended sellers).
  - **Admin Categories & Moderation**: `GET/POST /api/v1/admin/categories/`, `PATCH/DELETE /api/v1/admin/categories/<uuid>/`, `GET /api/v1/admin/products/`, `POST /api/v1/admin/products/<uuid>/moderate/` (with atomic `select_for_update()` and immutable `AuditLog`).
  - **Seller Products & Cloudinary Uploads**: `GET/POST /api/v1/seller/products/`, `GET/PATCH/DELETE /api/v1/seller/products/<uuid>/`, `POST /api/v1/seller/products/<uuid>/images/`, `PATCH/DELETE /api/v1/seller/products/<uuid>/images/<uuid>/`. Server-side Pillow image validation (`JPG`/`PNG`/`WEBP`, max 5 MB, max 6 photos per product) and strict Seller ownership isolation.

### Scheduled Upcoming Modules (Weeks 6–11)
- Dedicated Product Detail Pages, Seller Studio pages & advanced price/craft filtering (**Week 6**).
- Persistent Cart, Wishlist, Coupons & Buyer Addresses (**Week 7**).
- Multi-vendor order splitting, inventory locking, Razorpay HMAC/webhook & COD (**Week 8**).
- Shipping, tracking events, 7-day returns & financial ledger/payouts (**Weeks 9–10**).

---

## 4. VS Code Local Verification Checklist (Week 5)

After pushing to GitHub and running `git pull origin main` in VS Code:

- [ ] Add your Cloudinary credentials to your **local** `backend/.env` file (never commit `backend/.env` to Git):
  ```env
  CLOUDINARY_CLOUD_NAME=your_cloud_name_from_cloudinary_dashboard
  CLOUDINARY_API_KEY=your_api_key
  CLOUDINARY_API_SECRET=your_api_secret_from_cloudinary_dashboard
  ```
- [ ] Generate and apply the new `catalog` database migrations:
  ```powershell
  cd backend
  python manage.py makemigrations catalog
  python manage.py migrate
  ```
- [ ] Run the full automated Django test suite (19 tests total: 9 Auth + 6 Seller/Admin + 4 Catalog/Moderation tests — Cloudinary is mocked in tests so they run offline):
  ```powershell
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and verify the full Week 5 end-to-end flow:
  1. Log in as **Admin** → open **Categories** → click **Add Category** (e.g., *Handmade Pottery*, Commission `12.00%`, optional cover image).
  2. Log in as an approved **Seller** → open **Products** → click **Add Product** → enter title, price in ₹, variant stock, and upload 1–2 JPG/PNG/WEBP product photos to Cloudinary → submit (status: `PENDING`).
  3. Confirm the Home Page (`/`) does **not** show the pending product yet.
  4. Log in as **Admin** → open **Products** → inspect the Cloudinary thumbnails → click **Approve & Publish**.
  5. Visit `/` (Home Page) → confirm the live category and approved product appear immediately with its Cloudinary photos and INR price!

---

## 5. How to Start the Next Session / Module

Once Week 5 tests pass in VS Code, tell the AI:
> *"Check `PROJECT_PROGRESS.md` — Week 5 tests passed in VS Code. Let's start Week 6 (Customer Shopping Storefront, Dedicated PDP & Seller Studio Pages)."*
