# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-23  
**Current Milestone:** Week 11 Implemented & Ready for VS Code Verification (Verified Purchase Reviews, Persistent In-App Notifications & Real PostgreSQL Analytics Charts)  
**Next Module:** Week 12 — Full Security Audit (OWASP ASVS), Load/E2E Tests, Razorpay Live HTTPS Webhook & Vercel/Render Deployment

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
| **Reviews, Notifications & Analytics** | Verified-purchase reviews strictly enforced 1-to-1 per delivered `OrderItem`, live studio `rating_avg` recalculation, seller replies, and Admin moderation (`PUBLISHED`/`HIDDEN`). Persistent per-user notification bell inbox wired across Buyer, Seller, and Admin dashboards. Real PostgreSQL analytics charts (GMV vs. Commission, Category Revenue, Payment Mix, Fulfilment Funnel, Top Studios). |
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
| **10** | Financial Ledger, Category Commissions Settlement, Refunds & Seller Payouts (`apps/finance`) | Live & Verified | Live & Verified | 41/41 Django Tests OK + Verified Error-Free in VS Code | **Done** |
| **11** | Verified Reviews, In-App Notifications & Real DB Analytics Charts (`apps/reviews`, `apps/notifications`) | Live (Run `makemigrations reviews notifications` + `migrate`) | Live & Wired (Zero Placeholders Remaining) | Build/Lint OK — Run `python manage.py test` in VS Code (46 tests) | **Ready to Verify** |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests, Razorpay Live Webhook & Vercel/Render Deploy | Not Started | Not Started | Not Started | **Next Up** |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–11)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**:
  - `POST /api/v1/sellers/apply/`, `GET /api/v1/sellers/application-status/`, `GET/PATCH /api/v1/sellers/shop/`, `GET /api/v1/sellers/documents/<uuid>/`.
  - `GET /api/v1/admin/dashboard/`, `GET /api/v1/admin/seller-applications/`, `POST /api/v1/admin/seller-applications/<uuid>/review/`, `GET /api/v1/admin/sellers/`, `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/`, `GET /api/v1/admin/buyers/`, `POST /api/v1/admin/users/<uuid>/toggle-active/`, `GET /api/v1/admin/audit-logs/`.
- **Catalog, Cloudinary Media, Moderation & Customer Storefront (`apps/catalog`)**:
  - `GET /api/v1/categories/`, `GET /api/v1/products/`, `GET /api/v1/products/<slug>/`, `GET /api/v1/shops/`, `GET /api/v1/shops/<slug>/`.
  - `GET/POST /api/v1/admin/categories/`, `PATCH/DELETE /api/v1/admin/categories/<uuid>/`, `GET /api/v1/admin/products/`, `POST /api/v1/admin/products/<uuid>/moderate/`.
  - `GET/POST /api/v1/seller/products/`, `GET/PATCH/DELETE /api/v1/seller/products/<uuid>/`, `POST /api/v1/seller/products/<uuid>/images/`, `PATCH/DELETE /api/v1/seller/products/<uuid>/images/<uuid>/`.
- **Persistent Cart, Wishlist, Platform Coupons & Buyer Addresses (`apps/commerce`)**:
  - `GET/POST /api/v1/buyer/addresses/`, `PATCH/DELETE /api/v1/buyer/addresses/<uuid>/`, `POST /api/v1/buyer/addresses/<uuid>/set-default/`.
  - `GET/DELETE /api/v1/cart/`, `POST /api/v1/cart/items/`, `PATCH/DELETE /api/v1/cart/items/<uuid>/`, `POST /api/v1/cart/apply-coupon/`, `DELETE /api/v1/cart/coupon/`, `POST /api/v1/coupons/validate/`.
  - `GET/POST /api/v1/wishlist/`, `POST /api/v1/wishlist/toggle/`, `DELETE /api/v1/wishlist/<uuid>/`, `POST /api/v1/wishlist/<uuid>/move-to-cart/`.
  - `GET/POST /api/v1/admin/coupons/`, `PATCH/DELETE /api/v1/admin/coupons/<uuid>/`.
- **Multi-Vendor Orders, Stock Locking, Razorpay & COD (`apps/orders`)**:
  - `GET /api/v1/checkout/config/`, `POST /api/v1/checkout/`, `POST /api/v1/payments/razorpay/verify/`, `POST /api/v1/payments/razorpay/fail/`, `POST /api/v1/payments/razorpay/webhook/`.
  - `GET /api/v1/buyer/orders/`, `GET /api/v1/buyer/orders/<uuid>/`, `POST /api/v1/buyer/orders/<uuid>/cancel/`.
  - `GET /api/v1/seller/suborders/`, `PATCH /api/v1/seller/suborders/<uuid>/status/`.
  - `GET /api/v1/admin/orders/`, `GET /api/v1/admin/payments/`.
- **Shipping, Courier Tracking & 7-Day Returns (`apps/shipping`)**:
  - `GET /api/v1/shipping/couriers/`, `POST /api/v1/seller/suborders/<uuid>/ship/`, `POST /api/v1/seller/suborders/<uuid>/events/`, `POST /api/v1/seller/suborders/<uuid>/deliver/`.
  - `GET/POST /api/v1/buyer/returns/`, `GET /api/v1/seller/returns/`, `PATCH /api/v1/seller/returns/<uuid>/resolve/`, `GET /api/v1/admin/returns/`.
- **Financial Ledger, 7-Day Settlements, Refunds & Seller Payouts (`apps/finance`)**:
  - `GET /api/v1/seller/finance/`, `POST /api/v1/seller/finance/payouts/`, `GET /api/v1/buyer/refunds/`.
  - `GET /api/v1/admin/finance/`, `POST /api/v1/admin/finance/payouts/<uuid>/action/`, `POST /api/v1/admin/finance/refunds/<uuid>/action/`, `POST /api/v1/admin/finance/ledger/<uuid>/release-hold/`.
- **Verified Reviews, Notifications & Real DB Analytics (`apps/reviews`, `apps/notifications`, `apps/finance/analytics.py`)**:
  - **Reviews**: `GET /api/v1/products/<slug>/reviews/`, `GET/POST /api/v1/buyer/reviews/`, `GET /api/v1/seller/reviews/`, `POST /api/v1/seller/reviews/<uuid>/reply/`, `GET /api/v1/admin/reviews/`, `POST /api/v1/admin/reviews/<uuid>/moderate/`.
  - **Notifications**: `GET /api/v1/notifications/`, `POST /api/v1/notifications/<uuid>/read/`, `POST /api/v1/notifications/read-all/` (automatically dispatched on ship, deliver, return request/resolution, payout paid/rejected, refund processed, review posted, and studio reply).
  - **Real DB Analytics**: `GET /api/v1/admin/analytics/`, `GET /api/v1/seller/analytics/`.

### Final Module (Week 12)
- Full OWASP ASVS security audit, load/E2E hardening, live Razorpay HTTPS webhook (`RAZORPAY_WEBHOOK_SECRET`), and Vercel/Render production deployment (**Week 12**).

---

## 4. VS Code Local Verification Checklist (Week 11)

After pushing to GitHub and running `git pull origin main` in VS Code (no extra `pip install` or `npm install` needed):

- [ ] Generate and apply the new `notifications` and `reviews` PostgreSQL migrations:
  ```powershell
  cd backend
  python manage.py makemigrations notifications reviews
  python manage.py migrate
  ```
- [ ] Run the full automated Django test suite (**46 tests total**: 41 existing + 5 new Week 11 tests covering verified-purchase review delivery gate & duplicate prevention, seller reply & cross-seller isolation, Admin review moderation & rating recalculation, per-user notifications inbox & isolation, and Admin/Seller real DB analytics endpoints):
  ```powershell
  python manage.py test
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and verify end-to-end:
  1. **Buyer Verified Review**: Sign in as a Buyer with a `DELIVERED` order → open **Buyer Dashboard → My Orders** → click **Write Review** on a delivered craft → pick 1–5 stars, headline, comment → submit → verify button updates to `Reviewed 5/5`.
  2. **Public Product Detail Page**: Open that craft's `/products/<slug>` page → scroll to **Verified Buyer Reviews** → confirm star average, 5→1 breakdown bar, and verified review appear live.
  3. **Seller Reviews & Notifications**: Sign in as the Seller → click the **Notification Bell** in the top header to see the unread review alert → open **Seller Dashboard → Reviews** → post a studio reply → verify Buyer receives a notification and the reply appears on the Product Detail Page.
  4. **Admin Real DB Analytics & Review Moderation**: Sign in as Admin → open **Admin Dashboard → Reports** → inspect live **6-Month GMV vs. Commission**, **Revenue by Craft Category**, **Payment Mix**, **Fulfilment Funnel**, and **Top Artisan Studios** → switch to **Review Moderation** to test hiding/restoring a review.

---

## 5. How to Start the Final Module (Week 12)

Once Week 11 tests pass in VS Code, tell the AI:
> *"Week 11 tests are error-free — let's move forward to Week 12 (Security Audit, Live Razorpay Webhook & Vercel/Render Production Deployment)."*
