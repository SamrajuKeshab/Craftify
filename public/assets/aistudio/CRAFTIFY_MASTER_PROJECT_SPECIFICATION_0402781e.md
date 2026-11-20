# CRAFTIFY --- Master Project Specification & AI Development Prompt

**Project:** Craftify\
**Project type:** Multi-vendor handmade art & craft e-commerce
marketplace\
**Target market:** India\
**Currency:** Indian Rupee (INR ₹)\
**Development approach:** Full-stack, modular, incremental development\
**Document purpose:** Master instructions for AI-assisted software
development

------------------------------------------------------------------------

## Part 1 --- AI Role and Responsibilities

Act as a Senior Full-Stack Software Engineer, Software Architect, UI/UX
Designer, Database Engineer, Cybersecurity Engineer, DevOps Engineer, QA
Engineer, and Technical Project Manager.

Your responsibility is to help design, develop, test, document, and
deploy Craftify as a real-world, production-quality multi-vendor
e-commerce marketplace.

The project owner is learning Python Full Stack Development. Therefore:

-   Explain technical concepts in simple English.
-   Explain important architectural decisions.
-   Provide complete working code.
-   Explain where each file should be created.
-   Explain installation commands and dependencies.
-   Help understand errors and debug them.
-   Avoid unnecessary complexity.
-   Never sacrifice security or code quality for simplicity.
-   Do not generate the entire application in one response.
-   Work incrementally, one module at a time.

## Part 2 --- Project Overview

### 2.1 Project identity

Craftify is a multi-vendor marketplace connecting independent artists,
craftsmen, handmade-product businesses, and customers.

The platform must allow:

-   Independent sellers to create shops.
-   Sellers to upload and manage products.
-   Admins to approve sellers and products.
-   Buyers to discover and purchase handmade products.
-   Sellers to fulfil their own orders.
-   Admins to manage commissions, payments, refunds, and payouts.

The final application must be a genuinely functional full-stack
marketplace, not merely a static frontend demonstration.

### 2.2 Three separate role-based panels

1.  Admin Panel
2.  Seller Panel
3.  Buyer Panel

Each role must have its own dashboard, navigation, permissions, and
functionality.

## Part 3 --- Technology Stack

Use the following technologies.

### Frontend

-   React.js
-   JavaScript
-   HTML5
-   CSS3
-   Tailwind CSS
-   React Router DOM
-   Axios
-   Context API

### Backend

-   Python
-   Django
-   Django REST Framework
-   JWT Authentication
-   REST APIs

### Database

-   PostgreSQL

### Integrations

-   Razorpay for payments
-   Cloudinary for image storage
-   Email notifications
-   Git and GitHub
-   Vercel for frontend hosting
-   Render or another compatible provider for Django hosting

### Additional technologies

Use additional technologies only when justified.

Possible additions:

-   Redis for caching and background-job support.
-   Celery for asynchronous tasks.
-   Docker for consistent development environments.
-   A suitable task scheduler for scheduled operations.

Do not introduce microservices, Kubernetes, or unnecessary frameworks
during initial development.

## Part 4 --- User Roles and Authentication

### 4.1 Admin

-   Complete platform access.
-   Only authorized system administrators.
-   No public admin registration.
-   Admin accounts created through secure management procedures.
-   Admin can manage buyers, sellers, products, orders, and finances.
-   Create the initial administrator through a secure Django management
    command or equivalent administrative process.
-   Never hardcode admin credentials.

### 4.2 Seller

Craftify must support multiple independent seller accounts. Sellers
cannot register through the public buyer Sign-Up page.

Seller onboarding:

1.  An existing buyer applies to become a seller through a separate
    **Become a Seller** workflow.
2.  The applicant submits required shop and verification information.
3.  Admin reviews the application.
4.  Admin approves or rejects it.
5.  Approved applicants receive seller permissions.
6.  The system associates the seller profile with the existing user
    account.

Seller accounts must not be created through public role selection.

### 4.3 Buyer

-   Unlimited public registrations.
-   Automatically assigned the Buyer role.
-   Can browse, purchase, and review products.
-   Can apply to become a seller separately.

### 4.4 Simplified authentication UI

**Login page --- display only:**

-   Username
-   Password
-   Login button

Below the button:

> Don't have an account? Sign Up

Sign Up must navigate to `/sign-up`.

Do not display account-type selection, seller login, admin login, or
buyer login options.

**Sign-Up page --- display:**

-   Full Name
-   Username
-   Email Address
-   Password
-   Confirm Password
-   Sign Up button

Below the button:

> Already have an account? Sign In

Sign In must navigate to `/login`.

Every public registration must automatically create a Buyer account.

### Automatic role-based redirection

After successful authentication:

-   Admin → `/admin/dashboard`
-   Seller → `/seller/dashboard`
-   Buyer → `/buyer/dashboard`

The backend must determine the actual role using stored user
information. Never trust a role supplied by the frontend.

### Authentication security

Implement:

-   Secure password hashing.
-   JWT access tokens.
-   Refresh token handling.
-   Token expiration.
-   Token rotation and revocation where appropriate.
-   Secure password reset.
-   Email verification.
-   Login rate limiting.
-   Brute-force protection.
-   Session management.
-   Logout functionality.
-   Protected routes.
-   Backend role and object-level permissions.

Use secure cookie settings where applicable and document the chosen
token-storage approach.

## Part 5 --- Admin Panel

Create a professional admin dashboard.

### Dashboard

Display:

-   Total revenue.
-   Total orders.
-   Total buyers.
-   Total sellers.
-   Pending seller applications.
-   Pending product approvals.
-   Recent orders.
-   Monthly revenue charts.
-   Sales analytics.
-   Platform performance.

### Seller management

-   View sellers and seller profiles.
-   Approve and reject applications.
-   Suspend and reactivate sellers.
-   View seller products and performance.
-   Review verification documents.
-   Manage seller agreements.

### Buyer management

-   View buyers and account details.
-   Suspend and reactivate accounts.
-   Review customer activity.

### Product management

-   View all products.
-   Approve and reject products.
-   Edit product information.
-   Remove inappropriate products.
-   Manage product moderation.
-   Filter by category and seller.

### Category management

-   Create, edit, and delete categories.
-   Manage subcategories.

### Order management

-   View all parent orders.
-   View seller-specific suborders.
-   Monitor fulfilment.
-   Handle cancellations.
-   Handle disputes.
-   Monitor returns and refunds.

### Financial management

-   Monitor payments.
-   Configure platform commissions.
-   Track refunds.
-   Monitor seller settlements.
-   Track payouts.
-   Generate financial reports.

### Additional administration

-   Coupon management.
-   Website configuration.
-   Notification management.
-   Customer support management.
-   Audit logs.
-   Admin profile and settings.

## Part 6 --- Seller Panel

### Seller dashboard

Display:

-   Total sales.
-   Gross revenue.
-   Net earnings.
-   Total orders.
-   Pending orders.
-   Completed orders.
-   Product inventory.
-   Monthly sales charts.

### Shop management

Sellers can:

-   Edit shop name and description.
-   Upload shop logo and banner.
-   Update address.
-   Manage shop information.

### Product management

Sellers can:

-   Add, edit, and delete products.
-   Upload multiple images.
-   Add descriptions.
-   Select categories.
-   Set prices and discount prices.
-   Manage inventory.
-   Add dimensions and weight.
-   Set processing times.
-   Enable customized product requests.

Support:

-   Product variations.
-   Different sizes and colors.
-   Materials.
-   Customization charges.
-   Personalized messages.
-   Made-to-order products.
-   One-of-a-kind products.

Every new product must be approved by the admin before public listing.

### Order management

Sellers can:

-   View seller-specific orders.
-   Accept and process orders.
-   Update fulfilment status.
-   Add courier details and tracking numbers.
-   Manage partial shipments.
-   Handle eligible cancellations and returns.

Sellers must never access another seller's private orders or customer
information beyond what is necessary to fulfil their own orders.

### Financial dashboard

Display:

-   Gross sales.
-   Platform commission.
-   Refund deductions.
-   Net earnings.
-   Pending settlements.
-   Completed payouts.
-   Transaction history.

## Part 7 --- Buyer Panel and Shopping Website

Create a premium, customer-facing shopping experience.

### Homepage

Include:

-   Navigation bar.
-   Craftify branding.
-   Search bar.
-   Hero banner.
-   Featured products.
-   Trending products.
-   Popular categories.
-   Best-selling products.
-   Featured artists.
-   New arrivals.
-   Promotional banners.
-   Customer testimonials.
-   Footer.

### Categories

-   Paintings and artwork.
-   Pottery and ceramics.
-   Handmade jewellery.
-   Wooden crafts.
-   Home decorations.
-   Crochet and knitting.
-   Handmade gifts.
-   Traditional Indian handicrafts.
-   DIY craft supplies.

### Product listing

Display:

-   Product image.
-   Product name.
-   Price and discount.
-   Seller name.
-   Rating.
-   Wishlist button.

### Search and filters

-   Product-name search.
-   Category filter.
-   Price filter.
-   Rating filter.
-   Price sorting.
-   Popularity sorting.
-   Newest arrivals.

### Product details

Include:

-   Multiple product images.
-   Description.
-   Price and discount.
-   Stock availability.
-   Seller information.
-   Product specifications.
-   Delivery information.
-   Customer reviews.
-   Related products.
-   Add to Cart.
-   Buy Now.

### Cart

-   Add products.
-   Remove products.
-   Update quantities.
-   Calculate subtotal.
-   Calculate shipping.
-   Apply coupons.
-   Display final total.

### Wishlist

-   Add products.
-   Remove products.
-   Move products to cart.

### Checkout

-   Select delivery address.
-   Add new address.
-   Display order summary.
-   Apply coupons.
-   Select payment method.
-   Confirm purchase.

### Customer account

-   Personal profile.
-   Delivery addresses.
-   Order history.
-   Order tracking.
-   Wishlist.
-   Reviews.
-   Notifications.
-   Password management.

## Part 8 --- Multi-Vendor Order Architecture

This is a critical business requirement.

A single buyer checkout may contain products from multiple sellers.

Example:

-   Product A belongs to Seller 1.
-   Product B belongs to Seller 2.
-   Buyer adds both products to one cart.
-   Buyer makes one checkout and payment.

The system must:

1.  Create one parent order.
2.  Create separate seller-specific suborders.
3.  Associate order items with the correct seller.
4.  Calculate each seller's subtotal.
5.  Calculate platform commissions.
6.  Track fulfilment independently.
7.  Support separate shipments.
8.  Support partial cancellations.
9.  Support partial refunds.
10. Maintain a unified buyer order history.
11. Allow sellers to manage only their suborders.
12. Allow admins to monitor the complete parent order.
13. Maintain historical product names, prices, quantities, and seller
    information in order records.

Do not rely on current product information to reconstruct historical
orders.

## Part 9 --- Database Architecture

Use PostgreSQL and Django models.

### Models to plan

**User and identity**

-   Users
-   SellerProfiles
-   BuyerAddresses
-   SellerApplications
-   SellerVerificationDocuments

**Products**

-   Categories
-   Products
-   ProductImages
-   ProductVariants
-   Inventory
-   InventoryTransactions

**Shopping**

-   Carts
-   CartItems
-   Wishlists
-   WishlistItems
-   Coupons
-   CouponUsages

**Orders**

-   Orders
-   SellerSuborders
-   OrderItems
-   Shipments
-   ShipmentEvents
-   Returns
-   Refunds

**Financial management**

-   Payments
-   PaymentTransactions
-   Commissions
-   FinancialLedgerEntries
-   Payouts
-   SellerSettlements
-   ReconciliationRecords

**Customer engagement**

-   Reviews
-   Notifications
-   SupportTickets
-   Disputes

**Administration**

-   AuditLogs
-   WebsiteSettings

### Database requirements

-   Proper primary keys.
-   Foreign keys.
-   One-to-one relationships.
-   One-to-many relationships.
-   Many-to-many relationships where appropriate.
-   Unique constraints.
-   Check constraints.
-   Database indexes.
-   Historical order records.
-   Proper deletion policies.
-   Database migrations.
-   Atomic transactions.
-   Concurrency protection.

Use `DecimalField` for financial calculations, never floating-point
arithmetic.

Evaluate soft deletion only where it makes sense. Preserve financial and
order history.

Provide a complete ER diagram before implementation.

## Part 10 --- Payment and Financial Architecture

Use Razorpay for online payments.

Implement:

-   Payment creation.
-   Backend payment verification.
-   Signature verification.
-   Webhook verification.
-   Duplicate webhook protection.
-   Idempotency.
-   Payment failure handling.
-   Payment status tracking.
-   Refund processing.
-   Partial refunds.
-   Transaction history.
-   Payment reconciliation.

Evaluate Razorpay Route or another suitable marketplace settlement
solution, subject to eligibility and regulatory requirements.

### Financial integrity

Maintain clear financial records for:

-   Buyer payments.
-   Seller gross sales.
-   Platform commissions.
-   Refunds.
-   Commission reversals.
-   Seller balances.
-   Seller settlements.
-   Payouts.

Implement a traceable financial ledger.

Never mark a payment successful based only on frontend confirmation.

Never process the same payment or financial event twice.

## Part 11 --- Shipping and Delivery

Implement:

-   Shipping charges.
-   Free shipping conditions.
-   Seller-specific shipping.
-   Estimated delivery dates.
-   Handmade product processing times.
-   Courier information.
-   Tracking numbers.
-   Tracking URLs.
-   Shipment status history.
-   Partial shipment support.
-   Delivery confirmation.
-   Failed delivery handling.
-   Return pickup management.
-   Exchange workflows.

Keep shipping integration modular so courier integrations can be added
later.

## Part 12 --- Business Logic

### Seller workflow

Application → Admin approval → Shop setup → Product upload → Product
approval → Product listing → Order processing → Shipping → Settlement.

### Buyer workflow

Registration → Browse → Product details → Cart → Checkout → Payment →
Order confirmation → Tracking → Delivery → Review.

### Admin workflow

Login → Seller verification → Product approval → Order monitoring →
Payment monitoring → Commission management → Refund management →
Reports.

Also implement:

-   Inventory reservation.
-   Stock release after failed checkout.
-   Overselling prevention.
-   Order status transitions.
-   Coupon validation.
-   Return eligibility.
-   Refund eligibility.
-   Commission calculations.
-   Seller settlement eligibility.
-   Notification handling.

All important business rules must be enforced on the backend.

## Part 13 --- Security and Production Engineering

### 13.1 Application security

Follow OWASP security recommendations and use OWASP ASVS as a
verification reference.

Protect against:

-   SQL injection.
-   Cross-Site Scripting (XSS).
-   Cross-Site Request Forgery (CSRF).
-   Server-Side Request Forgery (SSRF).
-   Open redirects.
-   Path traversal.
-   Command injection.
-   Clickjacking.
-   Mass assignment.
-   Insecure Direct Object References (IDOR).
-   Privilege escalation.
-   Brute-force attacks.
-   Account enumeration.
-   Malicious file uploads.

Implement:

-   Authentication.
-   Authorization.
-   Role-based access control.
-   Object-level permissions.
-   Input validation.
-   Server-side validation.
-   Secure password hashing and salting.
-   Token expiration and refresh.
-   Secure cookies.
-   HTTPS/TLS.
-   Security headers.
-   Content Security Policy.
-   Rate limiting.
-   Login protection.
-   Email verification.
-   Secure password recovery.
-   Audit logging.
-   Secret rotation procedures.
-   Dependency vulnerability scanning.

Follow the principle of least privilege.

### 13.2 Database engineering

Implement:

-   Database normalization.
-   Database indexing.
-   Database constraints.
-   Database migrations.
-   Transaction isolation.
-   Concurrency control.
-   Deadlock handling.
-   Connection pooling.
-   Query optimization.
-   N+1 query prevention.
-   Backup encryption.
-   Automated backups.
-   Restore testing.
-   Point-in-time recovery where supported.
-   Data retention policies.

### 13.3 Performance and scalability

Consider:

-   Caching.
-   Cache invalidation.
-   Redis.
-   CDN.
-   Image optimization.
-   Lazy loading.
-   Code splitting.
-   Database query optimization.
-   Pagination.
-   Search optimization.
-   Connection pool monitoring.
-   Performance budgets.
-   Core Web Vitals.
-   Load testing.
-   Capacity planning.

### 13.4 Reliability

Implement appropriate:

-   Timeouts.
-   Retry policies.
-   Exponential backoff.
-   Idempotency.
-   Circuit breakers where justified.
-   Graceful error handling.
-   Graceful shutdown.
-   Health checks.
-   Background job recovery.
-   Dead-letter queues where appropriate.
-   Third-party integration failure handling.

### 13.5 Logging and monitoring

Implement:

-   Structured logging.
-   Application logs.
-   Security audit logs.
-   Error tracking.
-   Uptime monitoring.
-   API performance monitoring.
-   Database monitoring.
-   Background job monitoring.
-   Alerting.
-   Incident response documentation.
-   Root cause analysis.

Never log passwords, access tokens, payment secrets, or unnecessary
sensitive personal information.

### 13.6 DevOps

Use:

-   Git.
-   GitHub.
-   Meaningful commits.
-   Branching strategies.
-   Code reviews.
-   Semantic versioning where appropriate.
-   Docker where beneficial.
-   CI/CD.
-   Automated testing.
-   Development environment.
-   Staging environment.
-   Production environment.
-   Deployment rollback procedures.
-   Environment variables.
-   Secrets management.
-   Infrastructure documentation.

Use infrastructure as code when deployment complexity justifies it.

### 13.7 Scalability architecture

Initially prefer a modular monolith.

Evaluate the need for:

-   Load balancing.
-   Reverse proxies.
-   API gateways.
-   Message queues.
-   Read replicas.
-   Horizontal scaling.
-   Distributed tracing.
-   Microservices.

Do not implement advanced infrastructure without a genuine requirement.

## Part 14 --- Privacy and Indian Compliance

Craftify targets Indian customers and sellers.

Consider applicable requirements relating to:

-   Digital Personal Data Protection legislation and applicable rules.
-   Personal data privacy.
-   Consent management.
-   Privacy policies.
-   Consumer protection.
-   E-commerce regulations.
-   GST applicability.
-   Tax calculations.
-   Seller tax information.
-   Applicable TDS/TCS obligations.
-   Payment gateway requirements.
-   Grievance handling.
-   Seller agreements.
-   Data retention and deletion.

Do not assume every legal requirement applies identically to every
seller.

Identify areas requiring review by qualified Indian legal and tax
professionals.

## Part 15 --- Frontend Architecture

Use reusable React components.

Suggested structure:

``` text
frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── admin/
│   ├── seller/
│   ├── buyer/
│   ├── services/
│   ├── context/
│   ├── hooks/
│   ├── routes/
│   ├── utils/
│   ├── validations/
│   ├── constants/
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── package.json
└── README.md
```

Implement:

-   Protected routes.
-   Role-based navigation.
-   Centralized Axios configuration.
-   Authentication context.
-   Reusable forms.
-   Reusable product cards.
-   Reusable dashboard layouts.
-   Form validation.
-   Loading indicators.
-   Empty states.
-   Error messages.
-   Success notifications.
-   Responsive layouts.

Keep frontend role checks for navigation and user experience only.
Backend permissions remain authoritative.

## Part 16 --- Backend Architecture

Suggested structure:

``` text
backend/
├── config/
├── apps/
│   ├── accounts/
│   ├── sellers/
│   ├── products/
│   ├── categories/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── shipping/
│   ├── reviews/
│   ├── notifications/
│   ├── coupons/
│   ├── finance/
│   └── support/
├── common/
├── media/
├── static/
├── tests/
├── requirements/
├── manage.py
├── .env.example
└── README.md
```

Each Django application should use appropriate separation of
responsibilities:

-   Models.
-   Serializers.
-   Views.
-   URLs.
-   Permissions.
-   Services.
-   Selectors.
-   Validators.
-   Tests.

Use thin views and reusable business logic.

Implement API versioning using `/api/v1/`.

Provide pagination, filtering, searching, validation, and appropriate
HTTP status codes.

## Part 17 --- API Documentation

Create an API endpoint plan before implementation.

Organize endpoints into:

-   Authentication APIs.
-   User APIs.
-   Seller application APIs.
-   Seller management APIs.
-   Product APIs.
-   Category APIs.
-   Cart APIs.
-   Wishlist APIs.
-   Checkout APIs.
-   Order APIs.
-   Payment APIs.
-   Shipping APIs.
-   Review APIs.
-   Coupon APIs.
-   Notification APIs.
-   Admin APIs.
-   Financial APIs.

For every endpoint, document:

-   HTTP method.
-   Endpoint URL.
-   Purpose.
-   Authentication requirement.
-   Required role.
-   Request parameters.
-   Request body.
-   Response format.
-   HTTP status codes.
-   Validation rules.
-   Error scenarios.

Provide example API requests and responses.

## Part 18 --- UI/UX Design Requirements

The design should feel like a premium handmade marketplace.

### Visual direction

-   Warm neutral backgrounds.
-   Cream and beige.
-   Terracotta accents.
-   Subtle green accents.
-   Professional typography.
-   Beautiful product photography.
-   Spacious layouts.
-   Rounded product cards.
-   Subtle shadows.
-   Smooth hover effects.
-   Consistent spacing.
-   Clean navigation.

Create separate design systems for:

1.  Customer shopping website.
2.  Seller dashboard.
3.  Admin dashboard.

Avoid generic templates and excessive gradients.

Ensure accessibility, keyboard navigation, readable contrast, and mobile
responsiveness.

## Part 19 --- Additional Marketplace Features

### Customer engagement

-   Product reviews.
-   Verified purchase badges.
-   Seller ratings.
-   Customer enquiries.
-   Customer support tickets.
-   Report product functionality.
-   Wishlist.
-   Notifications.

### Seller trust

-   Verification status.
-   Shop policies.
-   Seller ratings.
-   Seller performance.
-   Seller agreement acceptance.

### Marketplace promotions

-   Platform coupons.
-   Seller coupons.
-   Percentage discounts.
-   Fixed discounts.
-   Minimum purchase amounts.
-   Maximum discount limits.
-   Coupon expiration.
-   Usage limits.

### Content and intellectual property

-   Product moderation.
-   Copyright complaint reporting.
-   Inappropriate product reporting.
-   Counterfeit product reporting.
-   Admin moderation history.

## Part 20 --- Testing Requirements

Use Django tests and suitable React testing tools.

### Unit tests

Test individual functions, services, models, and validation rules.

### Integration tests

Test database operations, API interactions, authentication, and payment
workflows.

### End-to-end tests

Test complete buyer, seller, and admin journeys.

### Security tests

Test:

-   Unauthorized access.
-   Role permissions.
-   IDOR.
-   Invalid input.
-   Token expiration.
-   Brute-force protection.
-   Malicious uploads.
-   Payment verification.

### Business logic tests

Test:

-   Seller approval.
-   Product approval.
-   Multi-seller checkout.
-   Stock reservation.
-   Overselling prevention.
-   Duplicate payments.
-   Partial refunds.
-   Commission calculations.
-   Seller settlements.
-   Shipping updates.

### Performance tests

Test:

-   Concurrent checkout.
-   API response times.
-   Database performance.
-   Concurrent users.
-   Large product listings.

Do not claim a feature is tested unless the relevant tests have actually
been executed.

## Part 21 --- Deployment

Prepare the application for production.

### Frontend

Vercel.

### Backend

Render or another compatible Django hosting provider.

### Database

Managed PostgreSQL.

### Image storage

Cloudinary.

Configure:

-   Production environment variables.
-   CORS.
-   Allowed hosts.
-   HTTPS.
-   Database connections.
-   Static files.
-   Media storage.
-   Secure cookies.
-   Production logging.
-   Monitoring.
-   Automated backups.
-   Database restoration procedures.
-   Deployment rollback.

Maintain separate development, staging, and production environments.

Never commit production secrets.

## Part 22 --- Development Roadmap

Follow this 12-week target roadmap. This is a target, not a guaranteed
deadline. Adjust it according to implementation complexity and test
results.

  Week   Tasks
  ------ ----------------------------------------
  1      SRS, architecture, ERD, UI/UX planning
  2      React, Django, and PostgreSQL setup
  3      Authentication and permissions
  4      Admin panel and seller onboarding
  5      Categories and product management
  6      Customer shopping website
  7      Cart, wishlist, and checkout
  8      Multi-vendor orders and Razorpay
  9      Shipping and order tracking
  10     Commissions, refunds, and payouts
  11     Notifications, reviews, and analytics
  12     Testing, security, and deployment

## Part 23 --- Strict AI Development Instructions

Follow these instructions throughout the project.

1.  Never generate the entire application in one response.
2.  First prepare the complete SRS.
3.  Then prepare system architecture.
4.  Then prepare the database ER diagram.
5.  Then prepare the frontend folder structure.
6.  Then prepare the backend folder structure.
7.  Then prepare API documentation.
8.  Then prepare the role-permission matrix.
9.  Then prepare the 12-week roadmap.
10. Wait for approval before writing application code.
11. Develop one module at a time.
12. Explain where each file should be created.
13. Provide complete working code for each required file.
14. Do not provide incomplete snippets when a complete file is required.
15. Do not overwrite working code unnecessarily.
16. Inspect existing code before modifying it.
17. Explain architectural changes before making them.
18. Explain installation commands and dependencies.
19. Test and debug each module before moving forward.
20. Ensure frontend and backend integration.
21. Follow clean coding standards.
22. Use realistic sample data only for development.
23. Never hardcode credentials or secrets.
24. Keep explanations beginner-friendly.
25. Do not introduce unnecessary frameworks.
26. Do not silently change database models or API contracts.
27. Maintain consistent naming conventions.
28. Never claim that unimplemented features are working.
29. Maintain project documentation.

### Module completion checklist

A module is not complete merely because its UI exists.

Every module must have:

-   Frontend implementation.
-   Backend implementation.
-   Database models and migrations.
-   API endpoints.
-   Authentication and permissions.
-   Input validation.
-   Frontend-backend integration.
-   Loading and empty states.
-   Error handling.
-   Success handling.
-   Unit tests.
-   Integration tests where appropriate.
-   Verification of unauthorized access.

Before moving to the next module:

-   Run relevant tests.
-   Verify database operations.
-   Test API responses.
-   Test frontend functionality.
-   Verify permissions.
-   Fix identified errors.
-   Explain what was completed.
-   Update project progress documentation.

Maintain a record of completed modules, pending modules, created files,
modified files, known issues, and next steps.

## Part 24 --- Definition of Done

Craftify is considered ready for production only when:

-   All three role-based panels work.
-   Authentication and permissions are secure.
-   Public registration creates buyers only.
-   Seller onboarding and approval work.
-   Product approval works.
-   Buyers can browse and purchase products.
-   Multi-vendor checkout works correctly.
-   Seller-specific order management works.
-   Payment verification works.
-   Duplicate payment processing is prevented.
-   Inventory management is reliable.
-   Refunds and commissions are traceable.
-   Seller settlements are handled correctly.
-   Shipping and order tracking work.
-   Notifications work.
-   Reviews work.
-   Admin reports work.
-   Critical security requirements are verified.
-   Automated tests pass.
-   Deployment is configured.
-   Backup and recovery procedures are tested.
-   Documentation is complete.

Do not prioritize generating large amounts of code over correctness.

## Part 25 --- First Task: Documentation Before Coding

Do not write application code immediately.

First, prepare the following deliverables:

1.  Complete Software Requirements Specification (SRS).
2.  Functional requirements.
3.  Non-functional requirements.
4.  User stories and use cases.
5.  System architecture diagram.
6.  Database ER diagram.
7.  Database table descriptions and relationships.
8.  Frontend folder structure.
9.  Backend folder structure.
10. API endpoint planning.
11. API request and response examples.
12. User-role and permission matrix.
13. Authentication workflow diagram.
14. Multi-vendor order workflow diagram.
15. Payment and financial workflow diagram.
16. Security architecture.
17. Testing strategy.
18. Deployment architecture.
19. Environment setup instructions.
20. Complete 12-week development roadmap.

For every important architectural decision, explain:

-   What is being implemented.
-   Why it is needed.
-   How it works.
-   What alternatives exist.
-   Whether it is necessary for the initial release or a future
    enhancement.

Use Mermaid diagrams where appropriate.

Present the documentation in an organized and beginner-friendly format.

Identify unresolved business decisions instead of silently inventing
answers.

After completing all deliverables, **STOP AND WAIT FOR APPROVAL**.

Do not start Phase 1 implementation until the project owner explicitly
approves the architecture and documentation.

## Final Project Objective

Build Craftify into a professional, premium, secure, scalable, and fully
functional multi-vendor handmade Art & Craft marketplace for the Indian
market.

The application must connect independent sellers and buyers through a
trustworthy shopping experience, with proper administration, product
management, order fulfilment, payment processing, financial management,
and production engineering.

**Build it correctly, build it incrementally, explain it clearly, and
test everything before moving forward.**
