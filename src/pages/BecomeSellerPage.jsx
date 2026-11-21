import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MailWarning,
  RefreshCw,
  ShieldCheck,
  Store,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useAuth } from '../context/AuthContext';
import { POPULAR_CATEGORIES } from '../data/craftifyData';
import {
  downloadVerificationDocument,
  extractServiceError,
  fetchMySellerApplicationStatus,
  submitSellerApplication,
} from '../services/sellerService';

const DOC_TYPE_OPTIONS = [
  { value: 'PAN_CARD', label: 'PAN Card Scan (PDF / JPG / PNG)' },
  { value: 'GST_CERTIFICATE', label: 'GST Certificate' },
  { value: 'ID_PROOF', label: 'Government ID Proof' },
  { value: 'CRAFT_PORTFOLIO', label: 'Artisan Studio / Craft Portfolio' },
];

/**
 * Live "Become a Seller" onboarding workflow (Week 4):
 * Verified Buyers submit real SellerApplications + KYC verification documents
 * directly to PostgreSQL for Craftify Admin approval.
 */
export default function BecomeSellerPage() {
  const { user, authLoading, resendVerification, refreshUser } = useAuth();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const [form, setForm] = useState({
    shopName: '',
    primaryCategory: POPULAR_CATEGORIES[0].name,
    pickupAddress: '',
    city: '',
    state: '',
    pincode: '',
    panNumber: '',
    gstin: '',
    bankAccountNumber: '',
    ifscCode: '',
    craftStory: '',
    docType: 'PAN_CARD',
    acceptedAgreement: false,
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reapplyMode, setReapplyMode] = useState(false);

  const loadApplicationStatus = async () => {
    if (!user) return;
    setLoadingStatus(true);
    setStatusError('');
    try {
      const data = await fetchMySellerApplicationStatus();
      setStatusData(data);
      // Keep AuthContext role / email verification synced with live DB
      if (
        data.role !== user.role ||
        data.is_email_verified !== user.is_email_verified
      ) {
        await refreshUser();
      }
    } catch (err) {
      setStatusError(
        extractServiceError(err, 'Could not fetch your seller application status.')
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadApplicationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const handleResendVerification = async () => {
    setResending(true);
    setResendMsg('');
    try {
      const res = await resendVerification();
      setResendMsg(
        res.detail ||
          'Verification link sent! Check your email inbox (or your local Django terminal in development) and open the link.'
      );
    } catch (err) {
      setResendMsg(err.message || 'Could not send verification email right now.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('shop_name', form.shopName.trim());
      formData.append('primary_category', form.primaryCategory);
      formData.append('pickup_address', form.pickupAddress.trim());
      formData.append('city', form.city.trim());
      formData.append('state', form.state.trim());
      formData.append('pincode', form.pincode.trim());
      formData.append('pan_number', form.panNumber.trim().toUpperCase());
      if (form.gstin.trim()) {
        formData.append('gstin', form.gstin.trim().toUpperCase());
      }
      if (form.bankAccountNumber.trim()) {
        formData.append('bank_account_number', form.bankAccountNumber.trim());
      }
      if (form.ifscCode.trim()) {
        formData.append('ifsc_code', form.ifscCode.trim().toUpperCase());
      }
      formData.append('bio', form.craftStory.trim());
      formData.append('accepted_agreement', String(form.acceptedAgreement));
      formData.append('doc_type', form.docType);
      if (documentFile) {
        formData.append('document_file', documentFile);
      }

      const res = await submitSellerApplication(formData);
      setStatusData((prev) => ({
        ...(prev || {}),
        role: user.role,
        is_email_verified: true,
        application: res.application,
      }));
      setReapplyMode(false);
      setDocumentFile(null);
    } catch (err) {
      setSubmitError(
        extractServiceError(
          err,
          'Could not submit your seller application. Please check the fields and try again.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const application = statusData?.application || null;
  const isVerified = statusData?.is_email_verified ?? user?.is_email_verified;
  const effectiveRole = statusData?.role || user?.role;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018]">
      <StorefrontNavbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#8B4B28]">
              Artisan Onboarding Workflow
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold text-[#2C2018]">
              Apply to Become a Craftify Seller
            </h1>
            <p className="mt-2 text-sm text-[#524338] leading-relaxed">
              Every Craftify shop starts as a verified buyer account and is reviewed
              by our Admin team to preserve handmade authenticity. Once approved,
              your Seller Dashboard activates automatically on your account.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={loadApplicationStatus}
              disabled={loadingStatus}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2D8CB] bg-white px-3.5 py-2 text-xs font-semibold text-[#4A3B31] hover:border-[#8B4B28] transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`}
              />
              <span>Refresh Status</span>
            </button>
          )}
        </div>

        {/* 1. Guest / Not Logged In */}
        {!authLoading && !user && (
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-8">
            <Store className="h-9 w-9 text-[#8B4B28]" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Sign In to Apply as an Artisan Seller
            </h2>
            <p className="mt-2 text-sm text-[#524338]">
              To protect buyers and artisans, seller applications are linked to an
              existing Craftify buyer account with a verified email address.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
              >
                Login to Your Account
              </Link>
              <Link
                to="/sign-up"
                className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018] hover:border-[#8B4B28]"
              >
                Create Buyer Account
              </Link>
            </div>
          </div>
        )}

        {/* 2. Loading State */}
        {(authLoading || (user && loadingStatus && !statusData)) && (
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-10 text-center text-sm text-[#6E5E52]">
            Checking your Craftify seller onboarding status...
          </div>
        )}

        {/* Status Fetch Error */}
        {statusError && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{statusError}</span>
          </div>
        )}

        {/* 3. Already an Approved Seller */}
        {user && !loadingStatus && effectiveRole === 'SELLER' && (
          <div className="rounded-2xl bg-white border border-[#D4E6D8] p-8">
            <CheckCircle2 className="h-9 w-9 text-[#355E44]" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Your Craftify Seller Studio Is Approved!
            </h2>
            <p className="mt-2 text-sm text-[#524338]">
              Congratulations! Your account has been promoted to{' '}
              <strong>SELLER</strong>
              {statusData?.seller_profile?.shop_name
                ? ` for ${statusData.seller_profile.shop_name}`
                : ''}
              . You can manage your shop profile directly in the Seller Dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/seller/dashboard"
                className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
              >
                Open Seller Dashboard
              </Link>
              <Link
                to="/"
                className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018]"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        )}

        {/* 4. Admin Account */}
        {user && !loadingStatus && effectiveRole === 'ADMIN' && (
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-8">
            <ShieldCheck className="h-9 w-9 text-[#2E9A90]" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Signed In as Craftify Admin
            </h2>
            <p className="mt-2 text-sm text-[#524338]">
              Administrator accounts review and approve buyer seller applications
              inside the Admin Dashboard rather than applying as sellers.
            </p>
            <div className="mt-6">
              <Link
                to="/admin/dashboard"
                className="inline-flex rounded-lg bg-[#2E9A90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#247D75]"
              >
                Go to Admin Approvals Queue
              </Link>
            </div>
          </div>
        )}

        {/* 5. Buyer with Unverified Email */}
        {user &&
          !loadingStatus &&
          effectiveRole === 'BUYER' &&
          !isVerified && (
            <div className="rounded-2xl bg-white border border-amber-200 p-8">
              <MailWarning className="h-9 w-9 text-amber-700" />
              <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
                Verify Your Email Address First
              </h2>
              <p className="mt-2 text-sm text-[#524338] leading-relaxed">
                Before submitting a seller application, please verify your email
                address (<strong>{user.email}</strong>). In local development,
                Django prints the verification link directly inside your VS Code
                terminal running <code className="font-mono text-xs bg-[#FAF6F0] px-1.5 py-0.5 rounded">python manage.py runserver</code>.
              </p>

              {resendMsg && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
                  {resendMsg}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendVerification}
                  className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60"
                >
                  {resending ? 'Sending Link...' : 'Resend Verification Email'}
                </button>
                <button
                  type="button"
                  onClick={loadApplicationStatus}
                  className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018] hover:border-[#8B4B28]"
                >
                  I&apos;ve Verified — Check Again
                </button>
              </div>
            </div>
          )}

        {/* 6. Buyer with Pending Application */}
        {user &&
          !loadingStatus &&
          effectiveRole === 'BUYER' &&
          isVerified &&
          application?.status === 'PENDING' && (
            <div className="rounded-2xl bg-white border border-[#D4E6D8] p-8">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-6 w-6" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Pending Admin Review
                </span>
              </div>
              <h2 className="mt-3 font-serif text-2xl font-bold text-[#2C2018]">
                {application.shop_name}
              </h2>
              <p className="mt-2 text-sm text-[#524338]">
                Your application has been saved in PostgreSQL and is now visible in
                the Craftify Admin Panel under <strong>Sellers → Applications</strong>.
              </p>

              <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] p-4 text-xs">
                <div>
                  <dt className="text-[#6E5E52]">Category</dt>
                  <dd className="font-semibold text-[#2C2018] mt-0.5">
                    {application.primary_category}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6E5E52]">Studio Location</dt>
                  <dd className="font-semibold text-[#2C2018] mt-0.5">
                    {application.city}, {application.state} — {application.pincode}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6E5E52]">PAN Number</dt>
                  <dd className="font-mono font-semibold text-[#2C2018] mt-0.5">
                    {application.pan_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6E5E52]">Submitted On</dt>
                  <dd className="font-semibold text-[#2C2018] mt-0.5">
                    {new Date(application.created_at).toLocaleString('en-IN')}
                  </dd>
                </div>
              </dl>

              {application.documents?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-[#4A3B31] mb-2">
                    Attached Verification Document
                  </p>
                  {application.documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() =>
                        downloadVerificationDocument(doc.id, doc.original_filename)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E2D8CB] bg-white px-3.5 py-2 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28]"
                    >
                      <FileText className="h-4 w-4 text-[#8B4B28]" />
                      <span>{doc.original_filename || doc.doc_type}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/buyer/dashboard"
                  className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
                >
                  Back to Buyer Account
                </Link>
                <Link
                  to="/"
                  className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018]"
                >
                  Browse Storefront
                </Link>
              </div>
            </div>
          )}

        {/* 7. Buyer with Rejected Application (shows Admin feedback + Re-apply option) */}
        {user &&
          !loadingStatus &&
          effectiveRole === 'BUYER' &&
          isVerified &&
          application?.status === 'REJECTED' &&
          !reapplyMode && (
            <div className="rounded-2xl bg-white border border-red-200 p-8">
              <XCircle className="h-9 w-9 text-red-600" />
              <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
                Previous Application Needs Revision
              </h2>
              <p className="mt-2 text-sm text-[#524338]">
                Your earlier request for <strong>{application.shop_name}</strong> was
                not approved yet. Review the Admin feedback below and submit an
                updated application.
              </p>
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Admin Review Notes
                </p>
                <p className="mt-1">{application.review_notes}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setReapplyMode(true)}
                  className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
                >
                  Submit Revised Application
                </button>
                <Link
                  to="/buyer/dashboard"
                  className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018]"
                >
                  Back to Buyer Account
                </Link>
              </div>
            </div>
          )}

        {/* 8. Live Seller Application Form (Verified Buyer with no pending app or re-applying) */}
        {user &&
          !loadingStatus &&
          effectiveRole === 'BUYER' &&
          isVerified &&
          (!application || (application.status === 'REJECTED' && reapplyMode)) && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-8 space-y-5"
            >
              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    Proposed Shop Name *
                  </label>
                  <input
                    required
                    minLength={3}
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="e.g., Terracotta Loom Studio"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    Primary Craft Category *
                  </label>
                  <select
                    value={form.primaryCategory}
                    onChange={(e) =>
                      setForm({ ...form, primaryCategory: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                  >
                    {POPULAR_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name} ({cat.commissionRate}% platform commission)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  Studio Pickup Address *
                </label>
                <input
                  required
                  minLength={5}
                  value={form.pickupAddress}
                  onChange={(e) =>
                    setForm({ ...form, pickupAddress: e.target.value })
                  }
                  placeholder="House/Studio No., Street, Locality"
                  className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    City *
                  </label>
                  <input
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Jaipur"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    State *
                  </label>
                  <input
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="Rajasthan"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    6-Digit Pincode *
                  </label>
                  <input
                    required
                    pattern="[1-9][0-9]{5}"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="302003"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    PAN Number (Verification) *
                  </label>
                  <input
                    required
                    maxLength={10}
                    value={form.panNumber}
                    onChange={(e) =>
                      setForm({ ...form, panNumber: e.target.value.toUpperCase() })
                    }
                    placeholder="ABCDE1234F"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    GSTIN (Optional — if applicable)
                  </label>
                  <input
                    maxLength={15}
                    value={form.gstin}
                    onChange={(e) =>
                      setForm({ ...form, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="08ABCDE1234F1Z5"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    Bank Account Number (Payouts — Masked on Save)
                  </label>
                  <input
                    value={form.bankAccountNumber}
                    onChange={(e) =>
                      setForm({ ...form, bankAccountNumber: e.target.value })
                    }
                    placeholder="e.g., 123456789012"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                    IFSC Code (Optional)
                  </label>
                  <input
                    maxLength={11}
                    value={form.ifscCode}
                    onChange={(e) =>
                      setForm({ ...form, ifscCode: e.target.value.toUpperCase() })
                    }
                    placeholder="SBIN0001234"
                    className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  Tell Us About Your Craft &amp; Process * (min 20 chars)
                </label>
                <textarea
                  required
                  minLength={20}
                  rows={4}
                  value={form.craftStory}
                  onChange={(e) => setForm({ ...form, craftStory: e.target.value })}
                  placeholder="Describe the materials, traditional techniques, and handmade process behind your creations..."
                  className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                />
              </div>

              {/* Optional Verification Document Upload */}
              <div className="rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#4A3B31]">
                  <Upload className="h-4 w-4 text-[#8B4B28]" />
                  <span>Verification Document (Optional — PDF, JPG, PNG up to 5 MB)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={form.docType}
                    onChange={(e) => setForm({ ...form, docType: e.target.value })}
                    className="rounded-lg border border-[#E2D8CB] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#8B4B28]"
                  >
                    {DOC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    className="text-xs text-[#524338] file:mr-3 file:rounded-lg file:border-0 file:bg-[#8B4B28] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#733C1E]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 text-xs text-[#524338]">
                <input
                  type="checkbox"
                  required
                  checked={form.acceptedAgreement}
                  onChange={(e) =>
                    setForm({ ...form, acceptedAgreement: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[#D8CBB9] accent-[#8B4B28]"
                />
                <span>
                  I confirm all listed items are genuinely handmade or crafted by my
                  studio and agree to Craftify&apos;s category commission schedule
                  and 7-day post-delivery settlement cycle.
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#4E7A5B]">
                  <ShieldCheck className="h-4 w-4" />
                  Reviewed directly by Craftify Admin
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#8B4B28] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Application'}
                </button>
              </div>
            </form>
          )}
      </main>
    </div>
  );
}
