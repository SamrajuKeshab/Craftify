# Craftify — Multi-Vendor Handmade Art & Craft Marketplace

Craftify is a full-stack multi-vendor e-commerce marketplace built for Indian artisans, handmade studios, and craft buyers, denominated in Indian Rupees (**INR ₹**).

## Tech Stack
- **Frontend (Root — Vite + React `.jsx`)**: React 19, JavaScript (`.jsx`), Tailwind CSS v4, React Router DOM, Axios, Context API, Recharts, Lucide Icons.
- **Backend (`backend/` — Python + Django)**: Django 5, Django REST Framework (DRF), SimpleJWT, PostgreSQL (`psycopg`), `django-cors-headers`, Razorpay SDK, Cloudinary.
- **Documentation (`docs/`)**: Complete SRS, System Architecture, Mermaid ERD, `/api/v1/` Contract, Role-Permission Matrix, Security, Testing, Deployment, and 12-Week Roadmap.

---

## GitHub → VS Code Local Workflow Guide

Your repository is structured as a **dual-workspace monorepo** so the React frontend previews immediately in web environments while your complete Django + PostgreSQL backend runs natively in VS Code.

### 1. Push & Pull via GitHub
```bash
# In VS Code terminal, clone your connected GitHub repository:
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# Whenever new modules are pushed from AI Studio, pull them into VS Code:
git pull origin main
```

### 2. Run the Django Backend (Terminal 1 in VS Code)
Ensure **Python 3.11+** and **PostgreSQL 15+** are installed locally.

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install backend dependencies
pip install -r requirements/dev.txt

# Create your local environment file
cp .env.example .env
# Edit backend/.env with your local PostgreSQL credentials & SECRET_KEY

# Run database migrations
python manage.py migrate

# Create the initial Admin account securely (never hardcoded)
python manage.py create_initial_admin

# Start Django API server on http://127.0.0.1:8000
python manage.py runserver
```

Verify the API is alive by opening: `http://127.0.0.1:8000/api/v1/health/`

### 3. Run the React Frontend (Terminal 2 in VS Code)
From the repository root folder:

```bash
# Install frontend packages
npm install

# Create your local frontend environment file
cp .env.example .env

# Start Vite dev server on http://localhost:3000
npm run dev
```

Open `http://localhost:3000` in your browser. The React Axios client automatically connects to `http://127.0.0.1:8000/api/v1` via `VITE_API_BASE_URL`.

### 4. Run Backend Tests
```bash
cd backend
python manage.py test
```

---

## Architecture & Blueprint Documentation
Read the full project blueprints inside `docs/` before starting new modules:
1. `docs/01_SRS_AND_REQUIREMENTS.md` — Complete SRS, Functional/Non-Functional Requirements, User Stories, Compliance
2. `docs/02_SYSTEM_ARCHITECTURE_AND_WORKFLOWS.md` — System Architecture, Folder Structures, Auth / Order / Payment Mermaid Workflows
3. `docs/03_DATABASE_ERD_AND_SCHEMA.md` — Complete Database ER Diagram, Table Specifications, `DecimalField` & Locking Rules
4. `docs/04_API_SPEC_AND_PERMISSIONS.md` — `/api/v1/` API Plan, Request/Response Examples, Role-Permission Matrix
5. `docs/05_SECURITY_TESTING_DEPLOYMENT_ROADMAP.md` — OWASP Security, Testing Strategy, Deployment, 12-Week Roadmap & Progress Tracker
