import {
  ArrowLeft,
  Heart,
  Image as ImageIcon,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useCart } from '../context/CartContext';
import {
  fetchPublicShopBySlug,
  normalizeStorefrontProduct,
} from '../services/catalogService';
import { formatINR } from '../utils/formatters';

export default function SellerShopPage() {
  const { slug } = useParams();
  const { addToCart, toggleWishlist, wishlistIds } = useCart();

  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('newest');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await fetchPublicShopBySlug(slug, {
          search,
          ordering,
          inStock: inStockOnly,
        });
        if (!active) return;
        setShop(data.shop);
        setProducts(
          (data.products || []).map(normalizeStorefrontProduct).filter(Boolean)
        );
      } catch {
        if (active) {
          setShop(null);
          setProducts([]);
          setNotFound(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [slug, search, ordering, inStockOnly]);

  if (notFound && !loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
        <StorefrontNavbar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-12">
            <Store className="mx-auto h-10 w-10 text-[#C5B39F]" />
            <h1 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Artisan studio not found
            </h1>
            <p className="mt-2 text-sm text-[#6E5E52]">
              This studio may be unavailable or no longer active on Craftify.
            </p>
            <Link
              to="/shops"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Browse All Studios</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Link
          to="/shops"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5E52] hover:text-[#8B4B28] transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Artisan Studios</span>
        </Link>

        {/* Studio Banner Header */}
        <section className="rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-8">
          {loading && !shop ? (
            <div className="animate-pulse space-y-3">
              <div className="h-7 w-64 rounded bg-[#E7DAC9]" />
              <div className="h-4 w-96 rounded bg-[#EFE6DA]" />
            </div>
          ) : (
            shop && (
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex items-start gap-4 max-w-3xl">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF6F0] border border-[#EAE1D5] text-[#8B4B28] shrink-0">
                    <Store className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E5E52]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#355E44]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified Craftify Studio
                      </span>
                      {shop.primary_category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{shop.primary_category}</span>
                        </>
                      )}
                      {(shop.city || shop.state) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#8B4B28]" />
                            {[shop.city, shop.state].filter(Boolean).join(', ')}
                          </span>
                        </>
                      )}
                    </div>

                    <h1 className="mt-1.5 font-serif text-3xl font-bold text-[#2C2018]">
                      {shop.shop_name}
                    </h1>

                    {shop.description && (
                      <p className="mt-2.5 text-sm leading-relaxed text-[#524338]">
                        {shop.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 lg:text-right shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-[#F1E8DD]">
                  <div>
                    <p className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                      {shop.approved_product_count ?? products.length}
                    </p>
                    <p className="text-xs text-[#6E5E52]">Approved Crafts</p>
                  </div>
                </div>
              </div>
            )
          )}
        </section>

        {/* Studio Filter Bar */}
        <section className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
              Studio Collection ({products.length})
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8C7B6E]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this studio..."
                  className="rounded-lg border border-[#E2D8CB] bg-white pl-8 pr-3 py-1.5 text-xs text-[#2C2018] focus:outline-none focus:border-[#8B4B28]"
                />
              </div>

              <button
                type="button"
                onClick={() => setInStockOnly((v) => !v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap ${
                  inStockOnly
                    ? 'border-[#8B4B28] bg-[#8B4B28]/10 text-[#8B4B28]'
                    : 'border-[#E2D8CB] bg-white text-[#524338] hover:border-[#8B4B28]/50'
                }`}
              >
                In Stock Only
              </button>

              <select
                value={ordering}
                onChange={(e) => setOrdering(e.target.value)}
                aria-label="Sort studio products"
                className="rounded-lg border border-[#E2D8CB] bg-white px-3 py-1.5 text-xs font-medium text-[#2C2018] focus:outline-none focus:border-[#8B4B28]"
              >
                <option value="newest">Sort: Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="title-asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="rounded-xl bg-white border border-[#EAE1D5] overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-[#EFE6DA]" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[#E7DAC9]" />
                    <div className="h-4 w-20 rounded bg-[#EFE6DA]" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#EAE1D5] p-12 text-center">
              <Package className="mx-auto h-9 w-9 text-[#C5B39F]" />
              <p className="mt-3 font-serif text-lg font-semibold text-[#2C2018]">
                No approved crafts found in this studio
              </p>
              <p className="mt-1 text-xs text-[#6E5E52]">
                {search || inStockOnly
                  ? 'Try clearing your search or stock filter.'
                  : 'This artisan is currently preparing new handmade pieces.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => {
                const isWishlisted = wishlistIds.includes(product.id);
                const outOfStock = product.stock <= 0;
                return (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-xl bg-white border border-[#EAE1D5] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#F3ECE2]">
                      <Link
                        to={`/products/${product.slug}`}
                        className="flex h-full w-full items-center justify-center"
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-[#A8927B]" />
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product)}
                        aria-label={`Save ${product.name} to wishlist`}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4A3B31] shadow-sm hover:bg-white transition-colors"
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            isWishlisted
                              ? 'fill-[#8B4B28] text-[#8B4B28]'
                              : 'text-[#524338]'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <p className="text-[11px] font-medium text-[#7A6A5E]">
                          {product.categoryName}
                        </p>
                        <Link
                          to={`/products/${product.slug}`}
                          className="mt-1 block font-semibold text-[15px] text-[#2C2018] hover:text-[#8B4B28] transition-colors line-clamp-1"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-1 text-xs text-[#6E5E52] tabular-nums">
                          {outOfStock ? 'Out of stock' : `${product.stock} available`}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-[#F2ECE3]">
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="font-mono text-base font-bold text-[#2C2018]">
                            {formatINR(product.price)}
                          </span>
                          {product.originalPrice > product.price && (
                            <span className="font-mono text-xs text-[#9B8B7E] line-through">
                              {formatINR(product.originalPrice)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => addToCart(product)}
                          className="rounded-lg bg-[#FAF6F0] border border-[#DFD2C2] px-3 py-1.5 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white hover:border-[#8B4B28] disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {outOfStock ? 'Sold Out' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
