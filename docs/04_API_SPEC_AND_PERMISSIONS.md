# 04. API Endpoint Specification (`/api/v1/`) & Role-Permission Matrix

All Craftify REST endpoints are versioned under `/api/v1/`, return JSON, enforce server-side validation, and follow standard HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`).

---

## 1. User-Role & Permission Matrix

| Capability / Resource | Public (Guest) | Buyer | Seller (Approved) | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Browse approved products & categories | Allow | Allow | Allow | Allow |
| Register via `/sign-up` (creates Buyer only) | Allow | — | — | — |
| Login via `/login` (role auto-resolved by backend) | Allow | Allow | Allow | Allow |
| Manage own profile & delivery addresses | Deny | Own Only | Own Only | All |
| Cart, Wishlist, Checkout & Pay | Deny | Own Only | Own Only | View All |
| Apply via "Become a Seller" | Deny | Allow | — | — |
| Manage Shop Profile & Upload Products | Deny | Deny | Own Shop Only | All |
| Approve / Reject Sellers & Products | Deny | Deny | Deny | **Allow** |
| View & Fulfil `SellerSuborders` | Deny | Own Purchases | **Own Suborders Only** | All |
| Configure Categories & Category Commission % | Deny | Deny | Read Only | **Allow** |
| View Financial Ledger & Settlements | Deny | Deny | Own Earnings Only | All |
| Process Refunds & Seller Payouts | Deny | Request Return | View Own | **Allow** |
| Suspend Users / View Audit Logs | Deny | Deny | Deny | **Allow** |

> **Security Rule**: Frontend route guards (`ProtectedRoute.jsx`) exist strictly for navigation UX. Every Django view enforces DRF permission classes (`IsAdminRole`, `IsApprovedSeller`, `IsObjectOwner`) on the backend.

---

## 2. Complete `/api/v1/` Endpoint Plan

### 2.1 System & Authentication (`/api/v1/health/`, `/api/v1/auth/`)
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/` | Public | Health check verifying Django + DB connectivity |
| `POST` | `/api/v1/auth/register/` | Public | Public registration (always creates `BUYER`) |
| `POST` | `/api/v1/auth/login/` | Public | Authenticate with username + password, returns JWT + authoritative role |
| `POST` | `/api/v1/auth/token/refresh/` | Public | Rotate JWT refresh token |
| `POST` | `/api/v1/auth/logout/` | Authenticated | Blacklist active refresh token |
| `GET/PATCH` | `/api/v1/auth/me/` | Authenticated | Fetch or update logged-in user's profile |
| `POST` | `/api/v1/auth/password/reset/` | Public | Request secure password reset email |
| `POST` | `/api/v1/auth/password/reset/confirm/` | Public | Confirm password reset with signed token |

### 2.2 Buyer Account & Seller Onboarding
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET/POST` | `/api/v1/buyer/addresses/` | Buyer+ | List or add delivery addresses |
| `PATCH/DELETE` | `/api/v1/buyer/addresses/{id}/` | Owner | Update or remove own delivery address |
| `POST` | `/api/v1/sellers/apply/` | Buyer | Submit "Become a Seller" application & docs |
| `GET` | `/api/v1/sellers/application-status/` | Buyer/Seller | Check status of own seller application |
| `GET/PATCH` | `/api/v1/sellers/shop/` | Seller | View or update own shop profile, logo & banner |
| `GET` | `/api/v1/sellers/dashboard/` | Seller | Seller KPIs, 6-month sales series, recent suborders |

### 2.3 Categories & Products
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories/` | Public | List active craft categories & subcategories |
| `POST/PATCH/DELETE` | `/api/v1/admin/categories/{id}/` | Admin | Manage categories & per-category commission rates |
| `GET` | `/api/v1/products/` | Public | Paginated approved products (`?search=&category=&min_price=&max_price=&rating=&ordering=`) |
| `GET` | `/api/v1/products/{slug}/` | Public | Product details, images, variants, seller info, reviews |
| `GET/POST` | `/api/v1/seller/products/` | Seller | List own products or create new product (`PENDING_APPROVAL`) |
| `PATCH/DELETE` | `/api/v1/seller/products/{id}/` | Seller (Owner) | Edit or soft-delete own product |

### 2.4 Cart, Wishlist & Coupons
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cart/` | Authenticated | Get active cart with INR subtotal, shipping (free ≥ ₹999), and total |
| `POST` | `/api/v1/cart/items/` | Authenticated | Add variant + quantity + optional customization note |
| `PATCH/DELETE` | `/api/v1/cart/items/{id}/` | Owner | Update item quantity or remove from cart |
| `GET/POST/DELETE` | `/api/v1/wishlist/` | Authenticated | View, toggle, or move wishlist item to cart |
| `POST` | `/api/v1/coupons/validate/` | Authenticated | Validate coupon code against current cart |

### 2.5 Checkout, Multi-Vendor Orders, Payments & Shipping
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/checkout/` | Authenticated | Atomic stock reservation + create parent `Order` + split `SellerSuborders` |
| `POST` | `/api/v1/payments/razorpay/verify/` | Authenticated | Verify Razorpay signature (`order_id`, `payment_id`, `signature`) on backend |
| `POST` | `/api/v1/payments/razorpay/webhook/` | Razorpay Signed | Idempotent webhook listener (`payment.captured`, `payment.failed`, `refund.processed`) |
| `GET` | `/api/v1/buyer/orders/` | Buyer+ | Unified buyer parent order history with nested suborder tracking |
| `GET` | `/api/v1/seller/suborders/` | Seller | List strictly this seller's suborders |
| `PATCH` | `/api/v1/seller/suborders/{id}/status/` | Seller (Owner) | Accept order, pack, add courier & tracking number |
| `POST` | `/api/v1/orders/returns/` | Buyer (Owner) | Request return within 7-day post-delivery window |

### 2.6 Reviews, Notifications, Support & Admin Governance
| Method | Endpoint | Auth / Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET/POST` | `/api/v1/products/{slug}/reviews/` | Public / Verified Buyer | Read reviews or post verified purchase review |
| `GET/PATCH` | `/api/v1/notifications/` | Authenticated | Fetch notifications & mark read |
| `GET` | `/api/v1/admin/dashboard/` | Admin | Platform KPIs (revenue, orders, buyers, sellers), sales series, pending counts |
| `GET/POST` | `/api/v1/admin/seller-applications/{id}/review/` | Admin | Approve or reject pending seller applications |
| `GET/POST` | `/api/v1/admin/products/{id}/moderate/` | Admin | Approve or reject pending product listings |
| `GET` | `/api/v1/admin/finance/ledger/` | Admin | Inspect financial ledger, commissions, settlements & execute payouts |
| `GET` | `/api/v1/admin/audit-logs/` | Admin | Immutable security and moderation audit history |

---

## 3. Request & Response Examples

### Example 1: Login (`POST /api/v1/auth/login/`)
**Request**
```json
{
  "username": "priya_sharma",
  "password": "StrongPassword@2026"
}
```

**Response (`200 OK`)**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a7f1c2e4-1234-4b21-98ab-001122334455",
    "username": "priya_sharma",
    "full_name": "Priya Sharma",
    "email": "priya@example.com",
    "role": "BUYER",
    "is_email_verified": true
  },
  "redirect_url": "/buyer/dashboard"
}
```

### Example 2: Multi-Vendor Checkout (`POST /api/v1/checkout/`)
**Request**
```json
{
  "address_id": 14,
  "payment_method": "RAZORPAY",
  "coupon_code": "CRAFT10"
}
```

**Response (`201 Created`)**
```json
{
  "order_number": "ORD1234",
  "currency": "INR",
  "subtotal_amount": "3597.00",
  "discount_amount": "359.70",
  "shipping_amount": "0.00",
  "total_amount": "3237.30",
  "payment_method": "RAZORPAY",
  "razorpay": {
    "razorpay_order_id": "order_Q9x7L2k8P1mN0a",
    "amount_paise": 323730,
    "currency": "INR"
  },
  "suborders": [
    {
      "suborder_number": "ORD1234-S1",
      "seller_shop_name": "Artistic Creations",
      "subtotal_amount": "1499.00",
      "commission_rate": "10.00",
      "fulfilment_status": "PENDING_PAYMENT"
    },
    {
      "suborder_number": "ORD1234-S2",
      "seller_shop_name": "Jaipur Looms Studio",
      "subtotal_amount": "2098.00",
      "commission_rate": "12.00",
      "fulfilment_status": "PENDING_PAYMENT"
    }
  ]
}
```

### Example 3: Standardized Error Response (`400 Bad Request` / `403 Forbidden`)
```json
{
  "error": {
    "code": "COD_LIMIT_EXCEEDED",
    "message": "Cash on Delivery is available for orders up to ₹5,000. Please use Razorpay for higher order values.",
    "fields": {
      "payment_method": ["COD not eligible for order total ₹6,450.00"]
    }
  }
}
```
