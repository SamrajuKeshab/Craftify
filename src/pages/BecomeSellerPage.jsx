import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { POPULAR_CATEGORIES } from '../data/craftifyData';

/**
 * Separate "Become a Seller" onboarding workflow (Part 4.2):
 * Buyers submit studio details and verification documents for Admin review.
 */
export default function BecomeSellerPage() {
  const [form, setForm] = useState({
    shopName: '',
    primaryCategory: POPULAR_CATEGORIES[0].name,
    city: '',
    state: '',
    panNumber: '',
    gstin: '',
    craftStory: '',
    acceptedAgreement: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018]">
      <StorefrontNavbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold text-[#8B4B28]">
            Artisan Onboarding Workflow
          </p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold text-[#2C2018]">
            Apply to Become a Craftify Seller
          </h1>
          <p className="mt-2 text-sm text-[#524338] leading-relaxed">
            Every Craftify shop starts as an existing buyer account and is reviewed
            by our Admin team to preserve handmade authenticity. Once approved, your
            Seller Dashboard activates automatically on your account.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl bg-white border border-[#D4E6D8] p-8">
            <CheckCircle2 className="h-9 w-9 text-[#355E44]" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Application Submitted for Admin Review
            </h2>
            <p className="mt-2 text-sm text-[#524338]">
              Thank you! Your studio application for{' '}
              <strong>{form.shopName}</strong> ({form.city}, {form.state}) has been
              queued in the Admin Panel under Pending Seller Applications.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/"
                className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
              >
                Return to Storefront
              </Link>
              <Link
                to="/buyer/dashboard"
                className="rounded-lg border border-[#E2D8CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018]"
              >
                Go to Buyer Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  Proposed Shop Name
                </label>
                <input
                  required
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  placeholder="e.g., Terracotta Loom Studio"
                  className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  Primary Craft Category
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  City
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
                  State
                </label>
                <input
                  required
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="Rajasthan"
                  className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                  PAN Number (Verification)
                </label>
                <input
                  required
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
                  value={form.gstin}
                  onChange={(e) =>
                    setForm({ ...form, gstin: e.target.value.toUpperCase() })
                  }
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#8B4B28]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A3B31] mb-1.5">
                Tell Us About Your Craft &amp; Process
              </label>
              <textarea
                required
                rows={4}
                value={form.craftStory}
                onChange={(e) => setForm({ ...form, craftStory: e.target.value })}
                placeholder="Describe the materials, traditional techniques, and handmade process behind your creations..."
                className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/50 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8B4B28]"
              />
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
                studio and agree to Craftify&apos;s category commission schedule and
                7-day post-delivery settlement cycle.
              </span>
            </label>

            <div className="flex items-center justify-between gap-4 pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#4E7A5B]">
                <ShieldCheck className="h-4 w-4" />
                Verified by Craftify Admin within 48 hours
              </span>
              <button
                type="submit"
                className="rounded-lg bg-[#8B4B28] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                Submit Application
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
