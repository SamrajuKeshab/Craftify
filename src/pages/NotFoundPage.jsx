import { ArrowLeft, Compass, ShoppingBag, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full bg-white border border-[#E6DDD1] rounded-2xl p-10 text-center shadow-sm">
          <p className="font-['JetBrains_Mono'] text-xs uppercase tracking-[0.2em] text-[#8B4B28] font-semibold mb-3">
            404 — Page Not Found
          </p>
          <h1 className="font-['Fraunces'] text-3xl sm:text-4xl font-semibold text-[#2C2018] mb-3">
            This craft page has wandered off
          </h1>
          <p className="text-sm text-[#6B5B4E] leading-relaxed mb-8">
            The listing, studio, or link you opened may have moved or been archived.
            Explore handmade creations from independent Indian artisans below.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#8B4B28] text-white text-sm font-medium hover:bg-[#733D20] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Storefront
            </Link>
            <Link
              to="/shops"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#D8CBB9] bg-[#FAF6F0] text-[#2C2018] text-sm font-medium hover:bg-[#F2E9DC] transition-colors"
            >
              <Store className="w-4 h-4" />
              Artisan Studios
            </Link>
          </div>

          <div className="pt-5 border-t border-[#EFE7DC] flex items-center justify-center gap-6 text-xs text-[#7D6B5D]">
            <Link to="/cart" className="inline-flex items-center gap-1.5 hover:text-[#8B4B28]">
              <ShoppingBag className="w-3.5 h-3.5" />
              View Cart
            </Link>
            <Link to="/become-seller" className="inline-flex items-center gap-1.5 hover:text-[#8B4B28]">
              <Compass className="w-3.5 h-3.5" />
              Sell Your Crafts
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
