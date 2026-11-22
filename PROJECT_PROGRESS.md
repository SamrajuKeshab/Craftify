# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-22  
**Current Milestone:** Week 8 Implemented & Ready for VS Code Verification (Multi-Vendor Order Splitting, Atomic Inventory Locking, Razorpay HMAC/Webhook & COD Checkout)  
**Next Module:** Week 9 — Shipping, Courier Tracking, Shipment Events & 7-Day Returns

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
| **Payments** | **Razorpay Prepaid** (server-side Order creation, constant-time HMAC-SHA256 verification & idempotent signed webhook) + **Cash on Delivery (COD)** (server-enforced ₹5,000 cap). |
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
| **6** | Customer Shopping Storefront (Dedicated PDP `/products/:slug`, Price/Craft Filters & Pagination, Artisan Studios `/shops` & `/shops/:slug`) | Live & Verified | Live & Verified | Verified Locally in VS Code | **Done** |
| **7** | Persistent Cart, Wishlist, Admin Platform Coupons & Buyer Indian Address Book (`apps/commerce`) | Live & Verified | Live & Verified | 25/25 Django Tests OK + Build/Lint OK | **Done** |
| **8** | Multi-Vendor Order Splitting, Atomic Stock Locking, Razorpay & COD (`apps/orders`) | Live (Run `makemigrations orders` + `migrate`) | Live & Wired | Build/Lint OK — Run `python manage.py test` in VS Code | **Ready to Verify** |
| **9** | Shipping, Courier Tracking, Shipment Events & 7-Day Returns | Not Started | Empty State Ready | Not Started | **Next Up** |
| **10** | Financial Ledger, Category Commissions, Refunds & Seller Payouts | Not Started | Empty State Ready | Not Started | Pending |
| **11** | Verified Reviews, Notifications & Real DB Analytics Charts | Not Started | Baseline Charts Ready | Not Started | Pending |
| **12** | Full Security Audit (OWASP ASVS), Load/E2E Tests & Vercel/Render Deploy | Not Started | Not Started | Not Started | Pending |

---

## 3. Honest Reality Check: Live Backend vs. Upcoming Modules

### Implemented & Connected to Live Django + PostgreSQL (Weeks 2–8)
- **Auth & Security (`apps/accounts`)**: `/register/`, `/verify-email/`, `/resend-verification/`, `/login/`, `/token/refresh/` (`HttpOnly` cookie with single-flight client mutex), `/logout/`, `/logout-all/`, `/password/reset/`, `/password/reset/confirm/`, `/password/change/`, `/me/`.
- **Seller Onboarding & Admin Governance (`apps/sellers`, `apps/audit`)**:
  - `POST /api/v1/sellers/apply/`, `GET /api/v1/sellers/application-status/`, `GET/PATCH /api/v1/sellers/shop/`, `GET /api/v1/sellers/documents/<uuid>/`.
  - `GET /api/v1/admin/dashboard/` (live GMV, order counts, 6-month sales series, buyers/sellers KPIs), `GET /api/v1/admin/seller-applications/`, `POST /api/v1/admin/seller-applications/<uuid>/review/`, `GET /api/v1/admin/sellers/`, `POST /api/v1/admin/sellers/<uuid>/toggle-suspend/`, `GET /api/v1/admin/buyers/`, `POST /api/v1/admin/users/<uuid>/toggle-active/`, `GET /api/v1/admin/audit-logs/`.
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
  - **Seller Suborders**: `GET /api/v1/seller/suborders/` (strictly studio-isolated + live 6-month sales & net payout KPIs), `PATCH /api/v1/seller/suborders/<uuid>/status/`.
  - **Admin Oversight**: `GET /api/v1/admin/orders/`, `GET /api/v1/admin/payments/`.

### Scheduled Upcoming Modules (Weeks 9–11)
- Shipping, courier tracking, shipment events & 7-day returns (`apps/shipping` — **Week 9**).
- Financial ledger, category commissions settlement, refunds & seller payouts (`apps/finance` — **Week 10**).
- Verified reviews, notifications & deep analytics (`apps/reviews`, `apps/notifications` — **Week 11**).

---

## 4. VS Code Local Verification Checklist (Week 8)

After pushing to GitHub and running `git pull origin main` in VS Code (no extra `pip install` needed — Razorpay client uses Python stdlib!):

- [ ] Generate and apply the new `orders` PostgreSQL migration:
  ```powershell
  cd backend
  python manage.py makemigrations orders
  python manage.py migrate
  ```
- [ ] Run the full automated Django test suite (**31 tests total**: 25 existing + 6 new Week 8 tests covering multi-vendor splitting, COD ₹5,000 cap, oversell prevention, Razorpay HMAC & webhook idempotency, seller isolation, and buyer cancel restock):
  ```powershell
  python manage.py test
  ```
- [ ] *(Optional — for live Razorpay Test Mode modal)* Add your Razorpay Test Mode credentials to `backend/.env` and restart Django:
  ```env
  RAZORPAY_KEY_ID=rzp_test_your_key_id
  RAZORPAY_KEY_SECRET=your_test_key_secret
  RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
  ```
- [ ] Start Django (`python manage.py runserver`) and React (`npm run dev`) and verify end-to-end:
  1. **Multi-Vendor COD Checkout**: Add crafts from 1 or 2 studios to Cart → open **Proceed to Checkout** → choose **Cash on Delivery** → confirm order → verify instant confirmation screen with split studio suborders, cart clears automatically, and product stock decreases in PostgreSQL.
  2. **Buyer Orders & Cancellation**: Open **Buyer Dashboard → My Orders** → verify the new order and nested studio suborders appear → test **Cancel Order** before packing and verify stock is restored.
  3. **Seller Suborder Fulfilment**: Sign in as an approved Seller → open **Seller Dashboard** → verify live **Total Sales**, **Net Earnings**, **Total Orders**, 6-month **Sales Overview**, and **Orders** tab → click **Accept Order** and **Mark Packed**.
  4. **Admin Orders & Payments**: Sign in as Admin → verify live **Total Revenue**, **Total Orders**, 6-month **Sales Overview**, **Orders** (expand **View Split**), and **Payments** ledger tabs.
  5. **Razorpay Test Checkout** *(if Test Keys are set)*: Choose **Razorpay Online** at checkout → complete test UPI/Card in Razorpay modal → confirm server-side HMAC verification marks order `PAID` & `CONFIRMED` (or dismiss modal to verify reserved stock is released cleanly).

---

## 5. How to Start the Next Session / Module

Once Week 8 tests pass in VS Code, tell the AI:
> *"Week 8 tests are error-free — let's move forward to Week 9 (Shipping, Courier Tracking, Shipment Events & 7-Day Returns)."*
