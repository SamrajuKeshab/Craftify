# Craftify — Project Progress & Continuity Tracker

> **Purpose:** Living tracker for both the project owner (in VS Code / GitHub) and AI sessions. Read this file at the start of every new work session and update it after every completed module.

**Last Updated:** 2026-11-20  
**Current Milestone:** Milestone 1 Completed (Documentation Blueprints + React `.jsx` & Django Starter Foundation)  
**Next Module:** Week 3 — Full Authentication, Email Verification, Password Reset & Rate Limiting

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
| **Strict Auth UI** | `/login` shows **only** Username, Password, Login button, and `"Don't have an account? Sign Up"` (no role buttons). `/sign-up` always creates a `BUYER` account. Backend resolves authoritative role redirect (`/admin/dashboard`, `/seller/dashboard`, `/buyer/dashboard`). |
| **Visual Design System** | Warm parchment storefront & cart (`#FAF6F0`, terracotta `#8B4B28`, Fraunces serif + Plus Jakarta Sans + JetBrains Mono) paired with dark charcoal-slate sidebar dashboards (`#242B33` + teal `#2E9A90` active state + `#F6F7F9` workspace). |

---

## 2. 12-Week Incremental Module Tracker

> **Module Completion Rule (Part 23):** A module is only marked `[x] Done` once Backend models/migrations, API endpoints, Permissions, Frontend integration, and Automated Tests are all verified.

| Week | Module | Backend | Frontend | Tests Verified | Overall Status |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | SRS, Architecture, ERD, API Docs & UI/UX Blueprint | N/A | N/A | Reviewed | **Done** |
| **2** | React (`.jsx`), Django 5 & PostgreSQL Starter Setup | Starter Ready | Starter Ready | Build + Lint OK *(Run Django tests in VS Code)* | **Done (Starter)** |
| **3** | Full Auth (JWT Rotation, Email Verification, Password Reset, Rate Limiting) | Partial (`register`, `login`, `logout`, `me`) | Wired to `/api/v1/auth/` | Starter tests written | **Next Up** |
| **4** | Admin Panel & Seller Onboarding (`SellerApplication`, Verification Docs, Approval) | Not Started | UI Shell / Preview State | Not Started | Pending |
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

To avoid any confusion while developing incrementally:

### Implemented & Ready for Live Django Connection
- `GET /api/v1/health/` — Database & service health verification.
- `POST /api/v1/auth/register/` — Public registration forcing `role="BUYER"` (even if payload tampers with `role`).
- `POST /api/v1/auth/login/` — Username + password authentication returning SimpleJWT `access`, `refresh`, `user`, and DB-resolved `redirect_url`.
- `POST /api/v1/auth/token/refresh/` — Rotating refresh tokens.
- `POST /api/v1/auth/logout/` — Blacklists refresh token.
- `GET/PATCH /api/v1/auth/me/` — Authenticated profile endpoint (role read-only).
- `python manage.py create_initial_admin` — Secure CLI admin creation with zero hardcoded credentials.
- React `AuthContext` + `apiClient` automatically detects if `http://127.0.0.1:8000/api/v1/health/` is reachable and switches seamlessly to real Django JWT auth.

### Currently Running on Local Starter Data (Not Yet Backed by PostgreSQL)
- Storefront product catalog & categories (`src/data/craftifyData.js`) — will move to `apps/categories` & `apps/products` in Weeks 5–6.
- Cart, wishlist, coupon validation & multi-vendor checkout (`src/context/CartContext.jsx`) — will move to `apps/cart`, `apps/coupons`, `apps/orders`, `apps/payments` in Weeks 7–8.
- Admin & Seller dashboard KPIs, Recharts series, and moderation button states — will move to real PostgreSQL aggregations & APIs in Weeks 4, 9, 10, 11.
- Become a Seller application form — will move to `apps/sellers` in Week 4.

---

## 4. Created Files Inventory (Milestone 1)

### Documentation (`docs/` & root)
- `README.md` — GitHub ↔ VS Code dual-terminal local workflow guide
- `PROJECT_PROGRESS.md` — This living progress tracker
- `docs/01_SRS_AND_REQUIREMENTS.md` — SRS, FR/NFR, user stories, Indian compliance, open decisions
- `docs/02_SYSTEM_ARCHITECTURE_AND_WORKFLOWS.md` — Architecture, Mermaid workflows, folder trees, ADRs
- `docs/03_DATABASE_ERD_AND_SCHEMA.md` — Full Mermaid ERD, table specs, constraints, locking policy
- `docs/04_API_SPEC_AND_PERMISSIONS.md` — Complete `/api/v1/` plan, JSON examples, RBAC matrix
- `docs/05_SECURITY_TESTING_DEPLOYMENT_ROADMAP.md` — OWASP security, testing, deployment, 12-week roadmap

### Django Backend (`backend/`)
- `backend/manage.py`, `backend/.env.example`, `backend/README.md`
- `backend/requirements/{base.txt, dev.txt, prod.txt}`
- `backend/config/{urls.py, wsgi.py, asgi.py}` & `backend/config/settings/{base.py, dev.py, prod.py}`
- `backend/common/{models.py, permissions.py, pagination.py, views.py}`
- `backend/apps/accounts/{apps.py, models.py, serializers.py, views.py, urls.py, admin.py, tests.py}`
- `backend/apps/accounts/management/commands/create_initial_admin.py`

### React Frontend (`src/` & root)
- `index.html`, `metadata.json`, `.env.example`, `.gitignore`, `src/index.css`
- `src/main.jsx`, `src/App.jsx`, `src/routes/ProtectedRoute.jsx`
- `src/services/{apiClient.js, authService.js}`, `src/utils/formatters.js`, `src/data/craftifyData.js`
- `src/context/{AuthContext.jsx, CartContext.jsx}`
- `src/components/common/{CraftifyLogo.jsx, ToastBanner.jsx}`
- `src/components/storefront/{StorefrontNavbar.jsx, ProductDetailModal.jsx}`
- `src/components/dashboards/DashboardShell.jsx`
- `src/pages/{StorefrontPage.jsx, CartPage.jsx, LoginPage.jsx, SignUpPage.jsx, BecomeSellerPage.jsx}`
- `src/admin/AdminDashboard.jsx`, `src/seller/SellerDashboard.jsx`, `src/buyer/BuyerDashboard.jsx`
- `src/assets/images/*` — 8 generated Indian craft photographs (hero + 7 craft categories/products)

---

## 5. VS Code Local Verification Checklist (Your Action Before Week 3)

Run these commands after pulling from GitHub in VS Code and check each box once verified:

- [ ] `git pull origin main` succeeds cleanly in VS Code
- [ ] PostgreSQL database `craftify_db` created (or `USE_SQLITE_FALLBACK=True` set temporarily in `backend/.env`)
- [ ] `cd backend` → virtual environment activated → `pip install -r requirements/dev.txt`
- [ ] `python manage.py makemigrations accounts && python manage.py migrate` succeeds
- [ ] `python manage.py create_initial_admin` creates your Admin account
- [ ] `python manage.py test` passes all 4 starter auth/security tests
- [ ] `python manage.py runserver` serves `http://127.0.0.1:8000/api/v1/health/` returning `200 OK`
- [ ] Root terminal: `npm install && npm run dev` opens Craftify on `http://localhost:3000`
- [ ] Logging in via `/login` with your newly created Admin credentials redirects automatically to `/admin/dashboard`

---

## 6. Known Issues & Notes
- **Environment Variable Prompt**: AI Studio's preview prompts for variables listed in root `.env.example` (`VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`, `VITE_RAZORPAY_KEY_ID=rzp_test_demo12345` until Week 8).
- **Migrations Not Pre-Generated**: Because Django runs locally in VS Code (not inside the Node preview container), always run `python manage.py makemigrations <app> && python manage.py migrate` locally after pulling new Django models.

---

## 7. How to Start the Next Session / Module

When you're ready to build the next module, simply tell the AI:
> *"Check `PROJECT_PROGRESS.md` and let's start Week 3 (Full Authentication: email verification, password reset, account suspension checks, and auth tests)."*
