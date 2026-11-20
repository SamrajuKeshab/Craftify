# 01. Software Requirements Specification (SRS) — Craftify

**Project:** Craftify — Multi-Vendor Handmade Art & Craft Marketplace  
**Target Market:** India (`INR ₹`, Indian lakh/crore number formatting)  
**Version:** 1.0 (Baseline Blueprint)

---

## 1. Purpose & Product Scope

Craftify connects independent Indian artists, craft studios, and handmade product makers directly with buyers across India. Unlike a single-vendor e-commerce site, Craftify manages:
- **Multi-vendor storefronts** where sellers apply, undergo Admin verification, and run independent studios.
- **Admin product moderation** so every handmade listing is vetted before appearing publicly.
- **Multi-seller cart & split order fulfilment**, allowing a buyer to purchase items from multiple artisans in a single checkout while each artisan ships and settles independently.
- **Category-based platform commissions**, **Razorpay prepaid + Cash on Delivery (COD)** payments, **7-day returns**, and an **append-only INR financial ledger**.

---

## 2. User Personas & Three Role-Based Panels

| Role | Entry Point | Core Responsibilities | Account Creation Rule |
| :--- | :--- | :--- | :--- |
| **Buyer** | `/buyer/dashboard`, Storefront (`/`) | Browse crafts, search/filter, manage cart & wishlist, checkout via Razorpay/COD, track orders, submit verified reviews, apply to become a seller. | Public registration via `/sign-up` (always assigns `BUYER`). |
| **Seller** | `/seller/dashboard` | Manage shop profile, upload handmade products & variations, track inventory, fulfil seller-specific suborders, add courier tracking, inspect net earnings & settlements. | Existing Buyer submits **Become a Seller** application → Admin approves. |
| **Admin** | `/admin/dashboard` | Approve/reject seller applications & products, manage categories & commission rates, oversee parent orders/suborders, handle disputes/refunds, manage payouts & audit logs. | Created strictly via secure Django management command (`create_initial_admin`). No public signup. |

---

## 3. Functional Requirements (FR)

### 3.1 Authentication & Access Control
- **FR-AUTH-01**: Login page (`/login`) displays **only** Username, Password, Login button, and `"Don't have an account? Sign Up"`. No role picker or role-specific login links.
- **FR-AUTH-02**: Sign-Up page (`/sign-up`) collects Full Name, Username, Email Address, Password, and Confirm Password, automatically assigning role `BUYER` on the backend.
- **FR-AUTH-03**: After login, backend returns user profile with authoritative `role`, and frontend redirects automatically: `ADMIN → /admin/dashboard`, `SELLER → /seller/dashboard`, `BUYER → /buyer/dashboard`.
- **FR-AUTH-04**: JWT access tokens (short-lived, e.g., 15 min) + rotating refresh tokens (e.g., 7 days) with blacklist revocation on logout.
- **FR-AUTH-05**: Login throttling / brute-force protection, email verification, and secure token-based password reset.

### 3.2 Seller Onboarding & Shop Management
- **FR-SEL-01**: Authenticated buyers can submit a `SellerApplication` with shop name, craft story, pickup address, bank/payout details, and verification documents (PAN / optional GSTIN / ID proof).
- **FR-SEL-02**: Admin reviews applications, records approval or rejection reason, and on approval upgrades the user's role to `SELLER` and initializes their `SellerProfile`.
- **FR-SEL-03**: Sellers customize shop logo, banner, bio, policies, and shipping/processing lead times.

### 3.3 Categories, Products & Inventory
- **FR-CAT-01**: Admin manages categories and subcategories (e.g., Paintings & Artwork, Pottery & Ceramics, Handmade Jewellery, Wooden Crafts, Home Decor, Crochet & Knitting, Handmade Gifts, Traditional Indian Handicrafts, DIY Craft Supplies) along with **per-category commission percentages**.
- **FR-PRD-01**: Sellers upload products with multiple Cloudinary images, INR price, optional discount price, dimensions, weight, processing time (days), stock count, variations (size/color/material/price delta), made-to-order toggle, one-of-a-kind flag, and personalization options.
- **FR-PRD-02**: Every newly created product starts in `PENDING_APPROVAL` status and is invisible to buyers until approved by an Admin.
- **FR-INV-01**: Checkout reserves stock inside an atomic PostgreSQL transaction using row-level locking (`select_for_update`) to prevent overselling, releasing reserved stock automatically on payment failure or timeout.

### 3.4 Shopping Experience, Cart, Wishlist & Coupons
- **FR-SHP-01**: Public storefront displays hero banner, trust bar (Free shipping above ₹999), popular categories, featured/trending/new-arrival products, artist spotlights, and search/filtering by category, price range, rating, and sort order.
- **FR-CRT-01**: Cart supports items from multiple sellers simultaneously, quantity updates, item removal, free-shipping threshold calculation (₹0 shipping when subtotal ≥ ₹999; flat/seller shipping below threshold), and coupon codes (platform or seller-scoped).
- **FR-WSH-01**: Buyers save crafts to a Wishlist and move items directly to Cart.

### 3.5 Multi-Vendor Orders, Payments & Shipping
- **FR-ORD-01**: A single checkout creates **1 parent `Order`** and **N `SellerSuborder`** records (one per seller in the cart), saving immutable snapshots of product titles, prices, seller names, shipping address, and category commission rates.
- **FR-PAY-01**: Support both **Razorpay prepaid** (HMAC signature verification + idempotent webhooks) and **Cash on Delivery (COD)** (subject to configurable order cap, default ₹5,000).
- **FR-SHP-02**: Sellers see and manage **only** their own `SellerSuborder` records: accept order, pack, enter courier name, tracking number, tracking URL, and shipment events.
- **FR-RET-01**: Buyers may request returns within **7 days of delivery** for eligible standard items (personalized/made-to-order items are returnable only for damage/defect/wrong item).

### 3.6 Financial Ledger, Commissions & Payouts
- **FR-FIN-01**: All monetary values use `DecimalField(max_digits=12, decimal_places=2)` — zero floating-point math.
- **FR-FIN-02**: Every payment capture, category commission deduction, refund, commission reversal, and seller payout writes an immutable entry to `FinancialLedgerEntry`.
- **FR-FIN-03**: Seller earnings mature into `READY_FOR_PAYOUT` after the 7-day post-delivery return window closes with no open dispute.

---

## 4. Non-Functional Requirements (NFR)

| Category | Requirement |
| :--- | :--- |
| **Security** | OWASP ASVS aligned; Argon2/PBKDF2 password hashing; backend RBAC & object-level IDOR checks; HMAC Razorpay verification; strict CORS & CSP headers; zero hardcoded secrets. |
| **Performance** | API P95 response time < 300ms for catalog listings; PostgreSQL indexes on slug, category, seller, status, and created_at; `select_related`/`prefetch_related` to eliminate N+1 queries; paginated API responses. |
| **Reliability & Integrity** | Atomic database transactions (`transaction.atomic()`) for checkout, stock reservation, and ledger posting; webhook idempotency keys preventing double processing. |
| **Usability & Accessibility** | WCAG AA contrast, keyboard focus states, responsive desktop (1440px) & mobile layouts, Indian INR formatting (`en-IN`), explicit loading/empty/error states. |
| **Maintainability** | Modular Django apps with thin views + service/selector layers; clean `.jsx` React components; automated unit & integration tests before module sign-off. |

---

## 5. Core User Stories & Use Cases

- **US-01 (Buyer Discovery)**: *As a buyer*, I want to filter handmade pottery and jewellery by price and rating so I can discover authentic gifts within my budget.
- **US-02 (Multi-Seller Checkout)**: *As a buyer*, I want to buy a hand-painted vase from Studio A and a macramé wall hanging from Studio B in a single payment, and track each parcel separately.
- **US-03 (Buyer → Seller Upgrade)**: *As a craft artist*, I want to register normally, apply via "Become a Seller" with my studio details, and start uploading products once Admin approves my account.
- **US-04 (Seller Order Fulfilment)**: *As a seller*, I want to view only the orders containing my crafts, update packing/shipping status with tracking details, and see my net earnings after category commission.
- **US-05 (Admin Governance)**: *As an admin*, I want to review pending seller applications and product listings, adjust category commission percentages, monitor parent/suborders, and approve seller payouts with a complete audit trail.

---

## 6. Indian Privacy, Tax & E-Commerce Compliance Notes

> **Important Legal Disclaimer**: The following engineering provisions prepare Craftify for Indian compliance, but **qualified Indian legal and Chartered Accountant (CA) review is required before public commercial launch**.

- **Digital Personal Data Protection (DPDP) Act**: Collect explicit consent at sign-up and seller onboarding, store minimal PII, support account data export/deletion requests (while retaining legally mandated financial/invoice records via anonymization), and publish a clear Privacy Policy and Grievance Officer contact.
- **Consumer Protection (E-Commerce) Rules, India**: Display seller legal/trade name, city/state, return/refund eligibility, country of origin ("India"), and grievance redressal timeline on product pages.
- **GST, TCS & Seller Tax Info**: Capture optional GSTIN and mandatory PAN during seller verification. Marketplace operators in India may have GST registration and **TCS (Tax Collected at Source)** / **TDS (Section 194-O)** obligations depending on seller turnover and goods category. Prices in Craftify display inclusive of GST by default, with structured tax-line placeholders ready for CA-verified invoice rules.

---

## 7. Confirmed & Unresolved Business Decisions Tracker

| Topic | Current Baseline Decision | Status |
| :--- | :--- | :--- |
| Commission Model | Category-based commission % (configured by Admin per category) | **Confirmed** |
| Payment Methods | Razorpay Prepaid + Cash on Delivery (COD) | **Confirmed** |
| Return Window | 7 days post-delivery for standard items | **Confirmed** |
| Free Shipping Threshold | Free shipping on orders ≥ ₹999 (₹79 standard below ₹999) | **Confirmed (UI Mockup)** |
| Personalized / Made-to-Order Returns | Non-returnable unless damaged, defective, or wrong item delivered | *Recommended Default — Review before Week 9* |
| COD Maximum Order Cap | ₹5,000 max per parent order for COD | *Recommended Default — Review before Week 8* |
| Seller Payout Settlement Hold | 7 days post-delivery (aligned with return window) | *Recommended Default — Review before Week 10* |
| Razorpay Route vs Manual Payouts | Start with Razorpay Standard + Admin Ledger Payouts; upgrade to Razorpay Route after KYC approval | *Recommended Default — Review before Week 8* |
