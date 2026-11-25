import { ArrowRight, MapPin, Search, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { fetchPublicShops } from '../services/catalogService';

export default function ShopsDirectoryPage() {
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchPublicShops(search);
        if (active) setShops(data.results || []);
      } catch {
        if (active) setShops([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#EAE1D5]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#8B4B28]">
              Verified Independent Makers
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold text-[#2C2018]">
              Craftify Artisan Studios
            </h1>
            <p className="mt-2 text-sm text-[#524338] leading-relaxed">
              Every studio listed here has been reviewed and approved by the Craftify
              team. Visit any studio to browse handmade collections straight from the
              artist&apos;s workshop.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B6E]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search studio, city, or craft..."
              className="w-full rounded-lg border border-[#E2D8CB] bg-white pl-9 pr-3 py-2 text-sm text-[#2C2018] placeholder:text-[#8C7B6E] focus:outline-none focus:border-[#8B4B28]"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-white border border-[#EAE1D5] p-6 animate-pulse space-y-3"
              >
                <div className="h-11 w-11 rounded-xl bg-[#EFE6DA]" />
                <div className="h-5 w-48 rounded bg-[#E7DAC9]" />
                <div className="h-12 w-full rounded bg-[#EFE6DA]" />
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white border border-[#EAE1D5] p-12 text-center">
            <Store className="mx-auto h-9 w-9 text-[#C5B39F]" />
            <h2 className="mt-3 font-serif text-xl font-bold text-[#2C2018]">
              {search ? 'No artisan studios match your search' : 'No approved studios yet'}
            </h2>
            <p className="mt-1 text-sm text-[#6E5E52] max-w-md mx-auto">
              {search
                ? 'Try clearing your search to explore all verified Craftify studios.'
                : 'Approved Indian craft studios appear here automatically once verified by Craftify Admin.'}
            </p>
            {search && (
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                to={`/shops/${shop.slug}`}
                className="group flex flex-col justify-between rounded-2xl bg-white border border-[#EAE1D5] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] text-[#8B4B28] shrink-0">
                      <Store className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-[#6E5E52] tabular-nums">
                      {shop.approved_product_count ?? 0} craft
                      {(shop.approved_product_count ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  <h2 className="mt-4 font-serif text-xl font-bold text-[#2C2018] group-hover:text-[#8B4B28] transition-colors">
                    {shop.shop_name}
                  </h2>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6E5E52]">
                    {shop.primary_category && <span>{shop.primary_category}</span>}
                    {shop.primary_category && (shop.city || shop.state) && (
                      <span aria-hidden="true">·</span>
                    )}
                    {(shop.city || shop.state) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#8B4B28]" />
                        {[shop.city, shop.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>

                  {shop.description && (
                    <p className="mt-3 text-xs leading-relaxed text-[#524338] line-clamp-3">
                      {shop.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#F1E8DD] flex items-center justify-between text-xs font-semibold text-[#8B4B28]">
                  <span>Visit Studio Storefront</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
