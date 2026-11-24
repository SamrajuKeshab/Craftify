# Craftify — Production Deployment & Live Razorpay Webhook Runbook

This guide takes Craftify from your local VS Code environment to a live production deployment using:
- **Render** (Django 5 + Gunicorn + WhiteNoise + Managed PostgreSQL 15+)
- **Vercel** (React 19 + Vite SPA with same-origin `/api/:path*` proxy to Render so `HttpOnly; Secure; SameSite=Lax` cookies work seamlessly in every browser)
- **SMTP Email** (Gmail App Password, Brevo, or Resend)
- **Razorpay Test Mode** with a **live Render HTTPS webhook** (`RAZORPAY_WEBHOOK_SECRET`)

---

## Step 1: Verify Everything Locally First (VS Code)

Before pushing to production, pull the latest commits and run the full automated test & readiness suite:

```powershell
cd backend
python manage.py test
python manage.py check_production_readiness
```

Expected result: **52/52 tests pass** (Weeks 3–11 + 6 new Week 12 Security & E2E tests).

---

## Step 2: Deploy Django Backend + Managed PostgreSQL on Render

1. Push your repository to GitHub (`git push origin main`).
2. Open [Render Dashboard](https://dashboard.render.com/) → **New +** → **Blueprint**.
3. Select your Craftify GitHub repository. Render automatically detects **`render.yaml`** at the repository root and creates:
   - **`craftify-db`** (Managed PostgreSQL)
   - **`craftify-api`** (Python Web Service with `rootDir: backend`, `./build.sh`, Gunicorn, and `/api/v1/health/` health check)
4. Click **Apply** and wait for the first build to finish. Note your generated Render URL (for example: `https://craftify-api.onrender.com` — if Render appends a random suffix like `https://craftify-api-abcd.onrender.com`, copy that exact hostname).
5. In Render → **`craftify-api` → Environment**, fill in your environment variables:

   | Key | Example Value |
   | :--- | :--- |
   | `DJANGO_ALLOWED_HOSTS` | `craftify-api.onrender.com,your-craftify-app.vercel.app` |
   | `FRONTEND_URL` | `https://your-craftify-app.vercel.app` |
   | `CORS_ALLOWED_ORIGINS` | `https://your-craftify-app.vercel.app` |
   | `CSRF_TRUSTED_ORIGINS` | `https://your-craftify-app.vercel.app,https://craftify-api.onrender.com` |
   | `RAZORPAY_KEY_ID` | `rzp_test_...` (from Razorpay Test Mode) |
   | `RAZORPAY_KEY_SECRET` | `...` (from Razorpay Test Mode) |
   | `RAZORPAY_WEBHOOK_SECRET` | *(Set in Step 4 below)* |
   | `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
   | `CLOUDINARY_API_KEY` | Your Cloudinary API key |
   | `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
   | `EMAIL_HOST` | See Step 5 below (`smtp.gmail.com` / `smtp-relay.brevo.com` / `smtp.resend.com`) |
   | `EMAIL_PORT` | `587` |
   | `EMAIL_USE_TLS` | `True` |
   | `EMAIL_HOST_USER` | Your SMTP username / Gmail address |
   | `EMAIL_HOST_PASSWORD` | Your Gmail 16-char App Password or Brevo/Resend SMTP key |
   | `DEFAULT_FROM_EMAIL` | `Craftify <your-verified-sender@domain.com>` |

6. Open Render → **`craftify-api` → Shell** (or Run Command) and create your production Admin account, then verify readiness:

   ```bash
   python manage.py createsuperuser
   python manage.py check --deploy
   python manage.py check_production_readiness
   ```
   *(Make sure your superuser has `role="ADMIN"` and `is_email_verified=True` — or promote via Django shell: `User.objects.filter(username="<admin>").update(role="ADMIN", is_email_verified=True)`.)*

7. Verify the live backend health endpoint in your browser:
   ```
   https://<your-render-service>.onrender.com/api/v1/health/
   ```
   You should receive `{"status": "ok", "database": "connected", "currency": "INR", ...}`.

---

## Step 3: Deploy React Storefront on Vercel (Same-Origin `/api` Proxy)

1. Open **`vercel.json`** at the repository root and confirm the `/api/:path*` destination matches your exact Render URL:
   ```json
   {
     "source": "/api/:path*",
     "destination": "https://<your-exact-render-service>.onrender.com/api/:path*"
   }
   ```
   Commit and push if your Render hostname differed from `craftify-api.onrender.com`.
2. Open [Vercel Dashboard](https://vercel.com/) → **Add New → Project** → import your Craftify GitHub repo.
3. Keep the root directory as `.` (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Add Environment Variables in Vercel → **Settings → Environment Variables**:
   - `VITE_API_BASE_URL` = `/api/v1` *(keep `/api/v1` so every request proxies same-origin through `vercel.json`!)*
   - `VITE_RAZORPAY_KEY_ID` = `rzp_test_...` *(public Key ID only — never add Key Secret to Vercel)*
5. Click **Deploy**.
6. Once live (e.g., `https://craftify.vercel.app`), make sure that exact Vercel URL is pasted into Render's `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `DJANGO_ALLOWED_HOSTS` (hostname only without `https://` for `DJANGO_ALLOWED_HOSTS`).
7. Verify the same-origin proxy works by visiting:
   ```
   https://<your-vercel-app>.vercel.app/api/v1/health/
   ```

---

## Step 4: Configure Razorpay Test Mode Live HTTPS Webhook

Now that Render provides a real HTTPS endpoint, activate the Razorpay webhook:

1. Log into [Razorpay Dashboard](https://dashboard.razorpay.com/) and ensure **Test Mode** is toggled **ON**.
2. Go to **Account & Settings → Developers → Webhooks → + Add New Webhook**.
3. Configure:
   - **Webhook URL**: `https://<your-render-service>.onrender.com/api/v1/payments/razorpay/webhook/`
   - **Secret**: Generate a strong random secret string (e.g. 32+ chars) and copy it.
   - **Active Events** (check all 3):
     - `payment.captured`
     - `payment.failed`
     - `order.paid`
4. Click **Create Webhook**.
5. Paste that exact secret into Render → `craftify-api` → Environment as **`RAZORPAY_WEBHOOK_SECRET`** and let Render redeploy.
6. Run `python manage.py check_production_readiness --strict` in Render Shell — all checks should now report **PASS**.

---

## Step 5: Configure Production SMTP Email

Choose any of the three supported SMTP providers and set the 5 `EMAIL_*` variables in Render:

- **Gmail (App Password)**:
  - Enable 2-Step Verification on your Google account → generate a 16-character **App Password**.
  - `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=True`, `EMAIL_HOST_USER=you@gmail.com`, `EMAIL_HOST_PASSWORD=<16-char-app-password>`, `DEFAULT_FROM_EMAIL=Craftify <you@gmail.com>`.
- **Brevo (Free Tier — 300 emails/day)**:
  - `EMAIL_HOST=smtp-relay.brevo.com`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=True`, `EMAIL_HOST_USER=<brevo-smtp-login>`, `EMAIL_HOST_PASSWORD=<brevo-smtp-key>`.
- **Resend**:
  - `EMAIL_HOST=smtp.resend.com`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=True`, `EMAIL_HOST_USER=resend`, `EMAIL_HOST_PASSWORD=<re_api_key>`.

---

## Step 6: Post-Deploy Production Smoke Checklist

- [ ] Register a new Buyer account on Vercel → receive real verification email → click verification link → confirm email verified.
- [ ] Refresh the browser on `/buyer/dashboard` → confirm session persists seamlessly via same-origin `HttpOnly; Secure; SameSite=Lax` refresh cookie.
- [ ] Sign in as Admin → create a craft category with commission % → approve a Seller application → approve a craft product with Cloudinary photo.
- [ ] Place a **Razorpay Test Mode** order (`4111111111111111` or Test UPI) → verify Razorpay Checkout modal opens (no CSP console errors), payment verifies, and Razorpay Dashboard → Webhooks shows a `200 OK` delivery for `payment.captured` / `order.paid`.
- [ ] Dispatch parcel as Seller (Blue Dart / Delhivery), mark Delivered, release settlement hold / test payout, and post a Verified Buyer Review.
- [ ] Visit a nonexistent URL (e.g. `/does-not-exist`) → verify the branded Craftify 404 page renders cleanly without a Vercel 404 error.
