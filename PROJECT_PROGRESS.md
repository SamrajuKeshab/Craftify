# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-23  
**Current Milestone:** Week 10 Implemented & Ready for VS Code Verification (Immutable Financial Ledger, 7-Day Settlement Holds, Automated Refunds & Seller Bank Payouts)  
**Next Module:** Week 11 — Verified Reviews, Notifications & Real DB Analytics Charts

---

## 1. Locked Project Decisions (Do Not Change Without Approval)

| Area | Locked Decision |
| :--- | :--- |
| **Workspace Strategy** | Dual-workspace monorepo: React (Vite `.jsx`) at repository root (live preview + `npm run dev`) and Django 5 + DRF + PostgreSQL in `backend/` (run locally in VS Code via `git pull`). |
| **Frontend Stack** | React 19, **Plain JavaScript (`.jsx` / `.js`)**, Tailwind CSS v4, React Router DOM, Axios, Context API, Recharts, Lucide Icons. |
| **Backend Stack** | Python 3.11+, Django 5, Django REST Framework, SimpleJWT, PostgreSQL 15+ (`DecimalField` for all money), Cloudinary (server-side media uploads via `backend/.env`). |
| **Currency & Market** | India — Indian Rupee (**INR ₹**) formatted with `en-IN` lakh grouping (e.g., `₹2,45,000`). |
| **Commission Model** | Category-based commission percentages (`0.00%–50.00%`, Admin-configurable per category, snapshotted onto every `SellerSuborder` / `OrderItem`). Zero pre-seeded categories — Admin creates categories manually. |
| **Cart, Wishlist & Coupons** | Login required before adding items to Cart or saving to Wishlist (auto-redirects back after sign-in). Platform discount coupons start at zero and are created/managed by Admin in the Admin Dashboard with server-side validation & AuditLog trail. |
| **Payments** | **Razorpay Prepaid** (server-side Order creation, constant-time HMAC-SHA256 verification & idempotent signed webhook; Test Mode keys active locally, live HTTPS webhook URL scheduled for Week 12 Render deploy) + **Cash on Delivery (COD)** (server-enforced ₹5,000 cap). |
| **Shipping & Returns** | Free shipping on orders **≥ ₹999** (₹79 standard below ₹999). Sellers select Indian couriers + enter AWB tracking numbers & transit events. **7-day return window** post-delivery with optional buyer Cloudinary photo proof (up to 3 images); personalized/made-to-order items returnable only if damaged/defective/wrong; Sellers approve/reject/complete returns directly with optional restock. |
| **Settlements, Refunds & Payouts** | Delivered suborders append immutable `SALE_CREDIT` (7-day settlement hold aligned with return window) and `PLATFORM_COMMISSION` entries. Completed returns & cancelled prepaid orders queue `RefundRecord` + proportional `REFUND_DEBIT`/`COMMISSION_REVERSAL`. Sellers withdraw cleared balance to verified masked bank/IFSC; Admin approves/pays with UTR reference or rejects (restoring balance via `PAYOUT_REVERSAL`), with optional early hold release. |
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
| **6** | Customer Shopping Storefront (Dedicated PDP `/products/:slug`, Price/Craft Filters & Pagination, Artisan Studios `/shops` & `/shops/:slug`) | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **7** | Persistent Cart, Wishlist, Admin Platform Coupons & Buyer Indian Address Book (`apps/commerce`) | Live & Verified | Live & Verified | 25/25 Django Tests OK + Build/Lint OK | **Done** |
| **8** | Multi-Vendor Order Splitting, Atomic Stock Locking, Razorpay & COD (`apps/orders`) | Live & Verified | Live & Verified | 31/31 Django Tests OK + Razorpay Test Keys Active (Webhook HTTPS URL in Week 12) | **Done** |
| **9** | Shipping, Indian Courier Tracking, Shipment Events & 7-Day Returns (`apps/shipping`) | Live & Verified | Live & Verified | 36/36 Django Tests OK + Verified Error-Free in VS Code | **Done** |
| **10** | Financial Ledger, Category Commissions Settlement, Refunds & Seller Payouts (`apps/finance`) | Live (Run `makemigrations finance` + `migrate`) | Live & Wired | Build/Lint OK — Run `python manage.py test` in VS Code (41 tests) | **Ready to Verify** |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Baseline Charts Ready | Not Started | **Next Up** |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests, Razorpay Live Webhook & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–10)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**:
  - `POST /api/v1/sellers/apply/`, `GET /api/v1/sellers/application-status/`, `GET/PATCH /api/v1/sellers/shop/`, `GET /api/v1/sellers/documents/<uuid>/`.
  - `GET /api/v1/admin/dashboard/`, `GET /api/v1/admin/seller-applications/`, `POST /api/v1/admin/seller-applications/<uuid>/review/`, `GET /api/v1/admin/sellers/`, `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/`, `GET /api/v1/admin/buyers/`, `POST /api/v1/admin/users/<uuid>/toggle-active/`, `GET /api/v1/admin/audit-logs/`.
- **Catalog, Cloudinary Media, Moderation & Customer Storefront (`apps/catalog`)**:
  - **Public Storefront Discovery**: `GET /api/v1/categories/`, `GET /api/v1/products/`, `GET /api/v1/products/<slug>/`, `GET /api/v1/shops/`, `GET /api/v1/shops/<slug>/`.
  - **Admin Categories & Moderation**: `GET/POST /api/v1/admin/categories/`, `PATCH/DELETE /api/v1/admin/categories/<uuid>/`, `GET /api/v1/admin/products/`, `POST /api/v1/admin/products/<uuid>/moderate/`.
  - **Seller Products & Cloudinary Uploads**: `GET/POST /api/v1/seller/products/`, `GET/PATCH/DELETE /api/v1/seller/products/<uuid>/`, `POST /api/v1/seller/products/<uuid>/images/`, `PATCH/DELETE /api/v1/seller/products/<uuid>/images/<uuid>/`.
- **Persistent Cart, Wishlist, Platform Coupons & Buyer Addresses (`apps/commerce`)**:
  - `GET/POST /api/v1/buyer/addresses/`, `PATCH/DELETE /api/v1/buyer/addresses/<uuid>/`, `POST /api/v1/buyer/addresses/<uuid>/set-default/`.
  - `GET/DELETE /api/v1/cart/`, `POST /api/v1/cart/items/`, `PATCH/DELETE /api/v1/cart/items/<uuid>/`, `POST /api/v1/cart/apply-coupon/`, `DELETE /api/v1/cart/coupon/`, `POST /api/v1/coupons/validate/`.
  - `GET/POST /api/v1/wishlist/`, `POST /api/v1/wishlist/toggle/`, `DELETE /api/v1/wishlist/<uuid>/`, `POST /api/v1/wishlist/<uuid>/move-to-cart/`.
  - `GET/POST /api/v1/admin/coupons/`, `PATCH/DELETE /api/v1/admin/coupons/<uuid>/`.
- **Multi-Vendor Orders, Stock Locking, Razorpay & COD (`apps/orders`)**:
  - **Checkout & Razorpay**: `GET /api/v1/checkout/config/`, `POST /api/v1/checkout/`, `POST /api/v1/payments/razorpay/verify/`, `POST /api/v1/payments/razorpay/fail/`, `POST /api/v1/payments/razorpay/webhook/`.
  - **Buyer Orders**: `GET /api/v1/buyer/orders/`, `GET /api/v1/buyer/orders/<uuid>/`, `POST /api/v1/buyer/orders/<uuid>/cancel/`.
  - **Seller Suborders**: `GET /api/v1/seller/suborders/`, `PATCH /api/v1/seller/suborders/<uuid>/status/`.
  - **Admin Oversight**: `GET /api/v1/admin/orders/`, `GET /api/v1/admin/payments/`.
- **Shipping, Courier Tracking & 7-Day Returns (`apps/shipping`)**:
  - `GET /api/v1/shipping/couriers/`, `POST /api/v1/seller/suborders/<uuid>/ship/`, `POST /api/v1/seller/suborders/<uuid>/events/`, `POST /api/v1/seller/suborders/<uuid>/deliver/`.
  - `GET/POST /api/v1/buyer/returns/`, `GET /api/v1/seller/returns/`, `POST /api/v1/seller/returns/<uuid>/resolve/`, `GET /api/v1/admin/returns/`.
- **Financial Ledger, 7-Day Settlements, Refunds & Seller Payouts (`apps/finance`)**:
  - **Seller Earnings & Payouts**: `GET /api/v1/seller/finance/`, `POST /api/v1/seller/finance/payouts/` (atomic balance lock preventing double-withdrawal, snapshotted masked bank & IFSC).
  - **Buyer Refunds**: `GET /api/v1/buyer/refunds/`.
  - **Admin Finance Governance**: `GET /api/v1/admin/finance/`, `POST /api/v1/admin/finance/payouts/<uuid>/action/` (`PROCESSING` / `PAID` with UTR / `REJECTED` with automatic `PAYOUT_REVERSAL`), `POST /api/v1/admin/finance/refunds/<uuid>/action/` (`PROCESSED` with gateway/UPI ref / `FAILED`), `POST /api/v1/admin/finance/ledger/<uuid>/release-hold/` (audited early release of 7-day settlement hold).

### Scheduled Upcoming Modules (Weeks 11–12)
- Verified reviews, notifications & deep analytics (`apps/reviews`, `apps/notifications` — **Week 11**).
- Full OWASP ASVS security audit, load/E2E tests, live Razorpay HTTPS webhook (`RAZORPAY_WEBHOOK_SECRET`), and Vercel/Render deployment (**Week 12**).

---

## 4. VS Code Local Verification Checklist (Week 10)

After pushing to GitHub and running `git pull origin main` in VS Code (no extra `pip install` or `npm install` needed):

- [ ] Generate and apply the new `finance` PostgreSQL migration:
  ```powershell
  cd backend
  python manage.py makemigrations finance
  python manage.py migrate
  ```
- [ ] Run the full automated Django test suite (**41 tests total**: 36 existing + 5 new Week 10 tests covering delivery ledger credits & 7-day settlement holds, completed return refund & proportional commission reversal, seller payout withdrawal + overspend/double-withdrawal blocking + UTR paid & rejected balance restoration, prepaid order cancellation refund, and RBAC/cross-seller isolation):
  ```powershell
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and verify end-to-end:
  1. **Delivery Settlement Credit**: Deliver a suborder in **Seller Dashboard → Orders** → open **Seller Dashboard → Earnings** → verify **Pending Settlement Hold** shows the exact net INR amount (after category commission) with `Hold · Releases <date + 7 days>` in the ledger.
  2. **Admin Early Hold Release (for instant local testing)**: Sign in as **Admin → Finance & Payouts → Platform Ledger** → click **Release Hold** on the held `SALE_CREDIT` row → switch back to Seller → verify the amount moved into **Available to Withdraw**.
  3. **Seller Payout Request & Admin UTR Disbursement**: In **Seller Dashboard → Earnings**, enter an amount (or click **Full**) and click **Request Payout** → switch to **Admin → Finance & Payouts → Seller Payouts** → enter a NEFT/UTR reference (e.g., `UTR261123NEFT1001`) and click **Mark Paid** (or test **Reject** with a reason to verify funds return to the seller's available balance).
  4. **Return Refund Processing**: Complete a buyer return in **Seller Dashboard → Returns** → open **Admin → Finance & Payouts → Buyer Refunds** → verify proportional commission reversal & seller debit → enter a refund reference ID and click **Mark Processed**.

---

## 5. How to Start the Next Session / Module

Once Week 10 tests pass in VS Code, tell the AI:
> *"Week 10 tests are error-free — let's move forward to Week 11 (Verified Reviews, Notifications & Real DB Analytics Charts)."*
