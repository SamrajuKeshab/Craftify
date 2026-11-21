import {
  ArrowRight,
  Heart,
  RefreshCw,
  ShieldCheck,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductDetailModal from '../components/storefront/ProductDetailModal';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  CRAFTIFY_IMAGES,
  FEATURED_PRODUCTS,
  POPULAR_CATEGORIES,
} from '../data/craftifyData';
import { formatINR } from '../utils/formatters';

export default function StorefrontPage() {
  const { addToCart, toggleWishlist, wishlistIds } = useCart();
  const { user, getDashboardUrl } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [activeProduct, setActiveProduct] = useState(null);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = FEATURED_PRODUCTS.filter((product) => {
      const matchesCat =
        selectedCategory === 'all' || product.categoryId === selectedCategory;
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.categoryName.toLowerCase().includes(query) ||
        product.sellerName.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });

    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1">
        {/* Hero Banner (Matches User's Storefront Mockup) */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <div className="relative overflow-hidden rounded-2xl border border-[#E8DFD3] bg-[#F1E6D6] min-h-[340px] sm:min-h-[410px] flex items-center">
            <img
              src={CRAFTIFY_IMAGES.hero}
              alt="Hand-painted Indian ceramic pottery vase and carved wooden Buddha figurine on a sunlit table"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#F6EFE5]/95 via-[#F6EFE5]/75 to-transparent sm:via-[#F6EFE5]/55" />

            <div className="relative z-10 max-w-xl px-7 py-12 sm:px-12 sm:py-16">
              <p className="text-sm font-medium text-[#7A563E] tracking-wide mb-2">
                Handmade with Love
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#2C2018] leading-[1.12] tracking-tight">
                Discover Unique Art &amp; Craft
              </h1>
              <p className="mt-4 text-sm sm:text-base text-[#524338]">
                Support Artisans <span aria-hidden="true">·</span> Celebrate Creativity
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="#featured-products"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-6 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors whitespace-nowrap"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/become-seller"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D4C5B4] bg-white/85 px-5 py-3 text-sm font-semibold text-[#2C2018] hover:bg-white transition-colors whitespace-nowrap"
                >
                  Become a Seller
                </Link>
              </div>
            </div>
          </div>

          {/* 4-Pillar Trust Bar */}
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl bg-white/90 border border-[#EAE1D5] px-5 py-4">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-[#8B4B28] shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#2C2018]">
                  Free Shipping
                </p>
                <p className="text-xs text-[#6E5E52]">On Orders Above ₹999</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#8B4B28] shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#2C2018]">
                  Secure Payments
                </p>
                <p className="text-xs text-[#6E5E52]">Razorpay &amp; COD Available</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[#8B4B28] shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#2C2018]">
                  Support Artisans
                </p>
                <p className="text-xs text-[#6E5E52]">Direct From Indian Studios</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-[#8B4B28] shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#2C2018]">
                  Easy Returns
                </p>
                <p className="text-xs text-[#6E5E52]">7-Day Hassle Free</p>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Categories Strip */}
        <section
          id="popular-categories"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12"
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
              Popular Categories
            </h2>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B4B28] hover:text-[#733C1E] transition-colors whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
            {POPULAR_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(isSelected ? 'all' : category.id)
                  }
                  className={`group text-left rounded-xl overflow-hidden bg-white border transition-all duration-200 hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#8B4B28] ring-2 ring-[#8B4B28]/20'
                      : 'border-[#EAE1D5] hover:border-[#C9B7A2]'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#F3ECE2]">
                    <img
                      src={category.image}
                      alt={category.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="px-2.5 py-2.5 text-center">
                    <p className="text-xs font-semibold text-[#2C2018] leading-snug">
                      {category.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Featured Products Grid */}
        <section
          id="featured-products"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-16"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
                Featured Products
              </h2>
              <p className="text-xs text-[#6E5E52] mt-0.5">
                {selectedCategory === 'all'
                  ? 'Handpicked pieces vetted by Craftify curators'
                  : `Showing ${filteredProducts.length} craft(s) in ${
                      POPULAR_CATEGORIES.find((c) => c.id === selectedCategory)?.name
                    }`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-semibold text-[#8B4B28] hover:underline whitespace-nowrap"
                >
                  Clear filter
                </button>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort products"
                className="rounded-lg border border-[#E2D8CB] bg-white px-3 py-2 text-xs font-medium text-[#2C2018] focus:outline-none focus:border-[#8B4B28]"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-[#EAE1D5] bg-white p-12 text-center">
              <p className="font-serif text-lg font-semibold text-[#2C2018]">
                No handmade crafts match your search
              </p>
              <p className="mt-1 text-sm text-[#6E5E52]">
                Try resetting the category filter or searching for pottery, macrame, or paintings.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="mt-4 rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                const isWishlisted = wishlistIds.includes(product.id);
                return (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-xl bg-white border border-[#EAE1D5] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#F3ECE2]">
                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="block h-full w-full text-left"
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </button>
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
                          {product.sellerName} <span aria-hidden="true">·</span>{' '}
                          {product.categoryName}
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveProduct(product)}
                          className="mt-1 text-left font-semibold text-[15px] text-[#2C2018] hover:text-[#8B4B28] transition-colors line-clamp-1"
                        >
                          {product.name}
                        </button>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6E5E52] tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-[#D9822B] text-[#D9822B]" />
                          <span className="font-semibold text-[#2C2018]">
                            {product.rating.toFixed(1)}
                          </span>
                          <span>({product.reviewCount})</span>
                        </div>
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
                          onClick={() => addToCart(product)}
                          className="rounded-lg bg-[#FAF6F0] border border-[#DFD2C2] px-3 py-1.5 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white hover:border-[#8B4B28] transition-colors whitespace-nowrap"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Artisan Community Spotlight */}
        <section
          id="our-artists"
          className="border-t border-[#EAE1D5] bg-[#F3ECE2]/60 py-14"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold tracking-wide text-[#8B4B28]">
                Direct-to-Artisan Marketplace
              </p>
              <h2 className="font-serif text-3xl font-bold text-[#2C2018]">
                Crafted in small batches across Jaipur, Madhubani, Bagru &amp; Bengaluru
              </h2>
              <p className="text-sm leading-relaxed text-[#524338] max-w-2xl">
                Every seller on Craftify is verified by our admin team before their
                shop goes live. When you checkout crafts from multiple studios in a
                single order, each artisan receives their own fulfilment suborder and
                ships straight from their workshop.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/become-seller"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
                >
                  Apply to Open Your Shop
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/cart"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D8CBB9] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018] hover:border-[#8B4B28] transition-colors"
                >
                  Inspect Multi-Vendor Cart
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-5">
                <p className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                  120+
                </p>
                <p className="mt-1 text-xs text-[#6E5E52]">
                  Verified independent artisan studios across India
                </p>
              </div>
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-5">
                <p className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                  100%
                </p>
                <p className="mt-1 text-xs text-[#6E5E52]">
                  Admin-moderated handmade products before listing
                </p>
              </div>
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-5">
                <p className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                  ₹999+
                </p>
                <p className="mt-1 text-xs text-[#6E5E52]">
                  Complimentary shipping threshold across India
                </p>
              </div>
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-5">
                <p className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                  7 Days
                </p>
                <p className="mt-1 text-xs text-[#6E5E52]">
                  Buyer return window with transparent settlement holds
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer + Role Workspace Preview Links */}
      <footer className="border-t border-[#E8DFD3] bg-[#FAF6F0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-serif text-lg font-bold text-[#2C2018]">Craftify</p>
            <p className="mt-1 text-xs text-[#6E5E52]">
              © 2026 Craftify India · Handmade Art &amp; Craft Marketplace (INR ₹)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#524338]">
            <Link
              to="/become-seller"
              className="hover:text-[#8B4B28] underline-offset-4 hover:underline"
            >
              Become a Seller
            </Link>
            <Link
              to="/cart"
              className="hover:text-[#8B4B28] underline-offset-4 hover:underline"
            >
              Your Cart
            </Link>
            {user ? (
              <Link
                to={getDashboardUrl()}
                className="font-semibold text-[#8B4B28] underline-offset-4 hover:underline"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:text-[#8B4B28] underline-offset-4 hover:underline"
                >
                  Login
                </Link>
                <Link
                  to="/sign-up"
                  className="hover:text-[#8B4B28] underline-offset-4 hover:underline"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>

      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
    </div>
  );
}
