# Craftify Django Backend (`backend/`)

Modular Django 5 + Django REST Framework + PostgreSQL API backend for Craftify.

## Quick Start in VS Code
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\Activate.ps1  |  macOS/Linux: source venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env
# Edit backend/.env with PostgreSQL credentials (or set USE_SQLITE_FALLBACK=True for quick test)
python manage.py makemigrations accounts
python manage.py migrate
python manage.py create_initial_admin
python manage.py test
python manage.py runserver
```

## Implemented in Starter Milestone
- `GET /api/v1/health/` — Database & API health verification
- `POST /api/v1/auth/register/` — Public registration (always forces `BUYER` role)
- `POST /api/v1/auth/login/` — Unified login returning JWT tokens + DB-resolved `redirect_url`
- `POST /api/v1/auth/token/refresh/` — Rotating JWT refresh
- `POST /api/v1/auth/logout/` — Blacklists refresh token
- `GET/PATCH /api/v1/auth/me/` — Authenticated profile endpoint

## Upcoming Modular Apps (Weeks 4–11)
`sellers`, `categories`, `products`, `cart`, `coupons`, `orders`, `payments`, `shipping`, `finance`, `reviews`, `notifications`, `support`.
