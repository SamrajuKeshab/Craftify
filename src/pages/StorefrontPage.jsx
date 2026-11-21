import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderTree,
  Heart,
  Image as ImageIcon,
  Package,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductDetailModal from '../components/storefront/ProductDetailModal';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CRAFTIFY_IMAGES } from '../data/craftifyData';
import {
  fetchPublicCategories,
  fetchPublicProducts,
  normalizeStorefrontProduct,
} from '../services/catalogService';
import { formatINR } from '../utils/formatters';

export default function StorefrontPage() {
  const { addToCart, toggleWishlist, wishlistIds } = useCart();
  const { user, getDashboardUrl } = useAuth();
  const [searchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  // Storefront discovery filters (Week 6)
  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get('category') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get('search') || ''
  );
  const [sortBy, setSortBy] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [customizableOnly, setCustomizableOnly] = useState(false);
  const [madeToOrderOnly, setMadeToOrderOnly] = useState(false);
  const [oneOfAKindOnly, setOneOfAKindOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [activeProduct, setActiveProduct] = useState(null);

  // Sync URL query params if user arrives via breadcrumb or cross-page search
  useEffect(() => {
    const paramCat = searchParams.get('category');
    const paramSearch = searchParams.get('search');
    if (paramCat) setSelectedCategory(paramCat);
    if (paramSearch !== null) setSearchQuery(paramSearch);
  }, [searchParams]);

  // Load live active craft categories from PostgreSQL
  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const data = await fetchPublicCategories();
        if (active) {
          setCategories(data.results || []);
        }
      } catch {
        if (active) setCategories([]);
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    selectedCategory,
    searchQuery,
    sortBy,
    minPrice,
    maxPrice,
    inStockOnly,
    customizableOnly,
    madeToOrderOnly,
    oneOfAKindOnly,
  ]);

  // Load live Admin-approved products from PostgreSQL
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoadingCatalog(true);
      setCatalogError('');
      try {
        const data = await fetchPublicProducts({
          category: selectedCategory,
          search: searchQuery,
          ordering: sortBy,
          minPrice,
          maxPrice,
          inStock: inStockOnly,
          customizable: customizableOnly,
          madeToOrder: madeToOrderOnly,
          oneOfAKind: oneOfAKindOnly,
          page,
          pageSize: 12,
        });
        if (!active) return;
        const normalized = (data.results || [])
          .map(normalizeStorefrontProduct)
          .filter(Boolean);
        setProducts(normalized);
        setTotalCount(data.count ?? normalized.length);
        setTotalPages(data.total_pages ?? 1);
      } catch {
        if (active) {
          setProducts([]);
          setTotalCount(0);
          setTotalPages(1);
          setCatalogError(
            'Could not load live products from the Craftify server. Make sure Django is running.'
          );
        }
      } finally {
        if (active) setLoadingCatalog(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    selectedCategory,
    searchQuery,
    sortBy,
    minPrice,
    maxPrice,
    inStockOnly,
    customizableOnly,
    madeToOrderOnly,
    oneOfAKindOnly,
    page,
  ]);

  const activeFilterCount = [
    minPrice !== '',
    maxPrice !== '',
    inStockOnly,
    customizableOnly,
    madeToOrderOnly,
    oneOfAKindOnly,
  ].filter(Boolean).length;

  const hasAnyFilter =
    selectedCategory !== 'all' || searchQuery.trim() !== '' || activeFilterCount > 0;

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setCustomizableOnly(false);
    setMadeToOrderOnly(false);
    setOneOfAKindOnly(false);
    setSortBy('newest');
    setPage(1);
  };

  const activeCategoryName =
    selectedCategory === 'all'
      ? ''
      : categories.find((c) => c.slug === selectedCategory || c.id === selectedCategory)
          ?.name || '';

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1">
        {/* Hero Banner */}
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
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#2C2018] leading-[1.12] tracking-tight text-balance">
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
                  to="/shops"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D4C5B4] bg-white/85 px-5 py-3 text-sm font-semibold text-[#2C2018] hover:bg-white transition-colors whitespace-nowrap"
                >
                  Explore Studios
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

        {/* Live Craft Categories Strip */}
        <section
          id="popular-categories"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12"
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
              Shop by Craft Category
            </h2>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B4B28] hover:text-[#733C1E] transition-colors whitespace-nowrap"
              >
                <span>View All</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {categories.length === 0 ? (
            <div className="rounded-xl border border-[#EAE1D5] bg-white px-6 py-8 text-center">
              <FolderTree className="mx-auto h-7 w-7 text-[#C5B39F]" />
              <p className="mt-2 text-sm font-semibold text-[#2C2018]">
                No craft categories published yet
              </p>
              <p className="mt-1 text-xs text-[#6E5E52] max-w-md mx-auto">
                Categories created by Craftify Admin appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {categories.map((category) => {
                const isSelected = selectedCategory === category.slug;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(isSelected ? 'all' : category.slug)
                    }
                    className={`group text-left rounded-xl overflow-hidden bg-white border transition-all duration-200 hover:-translate-y-0.5 ${
                      isSelected
                        ? 'border-[#8B4B28] ring-2 ring-[#8B4B28]/20'
                        : 'border-[#EAE1D5] hover:border-[#C9B7A2]'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#F3ECE2] flex items-center justify-center">
                      {category.cover_image_url ? (
                        <img
                          src={category.cover_image_url}
                          alt={category.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <FolderTree className="h-7 w-7 text-[#B69F88]" />
                      )}
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <p className="text-xs font-semibold text-[#2C2018] leading-snug line-clamp-1">
                        {category.name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-mono text-[#7A6A5E] tabular-nums">
                        {category.approved_product_count ?? 0} craft
                        {(category.approved_product_count ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Live Approved Products Grid + Advanced Week 6 Discovery Filters */}
        <section
          id="featured-products"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-16"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
                Approved Handmade Crafts
              </h2>
              <p className="text-xs text-[#6E5E52] mt-0.5 tabular-nums">
                {selectedCategory === 'all'
                  ? `${totalCount} curated craft${totalCount === 1 ? '' : 's'} available from verified studios`
                  : `Showing ${totalCount} craft${totalCount === 1 ? '' : 's'} in ${activeCategoryName || selectedCategory}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowFilters((open) => !open)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  showFilters || activeFilterCount > 0
                    ? 'border-[#8B4B28] bg-[#8B4B28]/10 text-[#8B4B28]'
                    : 'border-[#E2D8CB] bg-white text-[#2C2018] hover:border-[#8B4B28]'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </span>
              </button>

              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-semibold text-[#8B4B28] hover:underline whitespace-nowrap"
                >
                  Clear all
                </button>
              )}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort products"
                className="rounded-lg border border-[#E2D8CB] bg-white px-3 py-2 text-xs font-medium text-[#2C2018] focus:outline-none focus:border-[#8B4B28]"
              >
                <option value="newest">Sort: Newest Approved</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="title-asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Collapsible Price & Craft Attributes Filter Toolbar */}
          {showFilters && (
            <div className="mb-6 rounded-xl bg-white border border-[#EAE1D5] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-[#4A3B31]">
                  Price (₹):
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-28 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:border-[#8B4B28]"
                />
                <span className="text-xs text-[#8C7B6E]">to</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-28 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:border-[#8B4B28]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    label: 'In Stock Only',
                    active: inStockOnly,
                    toggle: () => setInStockOnly((v) => !v),
                  },
                  {
                    label: 'Customizable',
                    active: customizableOnly,
                    toggle: () => setCustomizableOnly((v) => !v),
                  },
                  {
                    label: 'Made to Order',
                    active: madeToOrderOnly,
                    toggle: () => setMadeToOrderOnly((v) => !v),
                  },
                  {
                    label: 'One of a Kind',
                    active: oneOfAKindOnly,
                    toggle: () => setOneOfAKindOnly((v) => !v),
                  },
                ].map((ctrl) => (
                  <button
                    key={ctrl.label}
                    type="button"
                    onClick={ctrl.toggle}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap ${
                      ctrl.active
                        ? 'border-[#8B4B28] bg-[#8B4B28] text-white'
                        : 'border-[#E2D8CB] bg-[#FAF6F0]/60 text-[#4A3B31] hover:border-[#8B4B28]'
                    }`}
                  >
                    {ctrl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {catalogError && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {catalogError}
            </div>
          )}

          {loadingCatalog ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((skeleton) => (
                <div
                  key={skeleton}
                  className="rounded-xl bg-white border border-[#EAE1D5] overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-[#F1E8DC]" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3 w-24 rounded bg-[#F1E8DC]" />
                    <div className="h-4 w-3/4 rounded bg-[#E7DAC9]" />
                    <div className="h-4 w-20 rounded bg-[#F1E8DC]" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-[#EAE1D5] bg-white p-12 text-center">
              <Package className="mx-auto h-9 w-9 text-[#C5B39F]" />
              <p className="mt-3 font-serif text-lg font-semibold text-[#2C2018]">
                {hasAnyFilter
                  ? 'No approved handmade crafts match your filters'
                  : 'Your live Craftify catalog is ready for its first creations'}
              </p>
              <p className="mt-1 text-sm text-[#6E5E52] max-w-md mx-auto">
                {hasAnyFilter
                  ? 'Try adjusting your price range, craft toggles, or search keyword.'
                  : 'Once Craftify Admin creates categories and approves a Seller product listing, it will appear right here automatically.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                  >
                    Reset Filters
                  </button>
                )}
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin/dashboard"
                    className="rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                  >
                    Open Admin Dashboard
                  </Link>
                )}
                {user?.role === 'SELLER' && (
                  <Link
                    to="/seller/dashboard"
                    className="rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                  >
                    Add Your First Product
                  </Link>
                )}
                {(!user || user.role === 'BUYER') && (
                  <Link
                    to="/become-seller"
                    className="rounded-lg border border-[#D8CBB9] bg-white px-4 py-2 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28]"
                  >
                    Become a Craftify Seller
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
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
                            <div className="flex flex-col items-center justify-center text-[#A8927B]">
                              <ImageIcon className="h-8 w-8" />
                              <span className="mt-1 text-[11px] font-medium">
                                Handmade Studio Piece
                              </span>
                            </div>
                          )}
                        </Link>
                        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product)}
                            aria-label={`Save ${product.name} to wishlist`}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4A3B31] shadow-sm hover:bg-white transition-colors"
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                isWishlisted
                                  ? 'fill-[#8B4B28] text-[#8B4B28]'
                                  : 'text-[#524338]'
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveProduct(product)}
                            aria-label={`Quick view ${product.name}`}
                            title="Quick view"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4A3B31] shadow-sm hover:bg-white transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <p className="text-[11px] font-medium text-[#7A6A5E] line-clamp-1">
                            {product.sellerSlug ? (
                              <Link
                                to={`/shops/${product.sellerSlug}`}
                                className="hover:text-[#8B4B28] hover:underline underline-offset-2"
                              >
                                {product.sellerName}
                              </Link>
                            ) : (
                              <span>{product.sellerName}</span>
                            )}{' '}
                            <span aria-hidden="true">·</span> {product.categoryName}
                          </p>
                          <Link
                            to={`/products/${product.slug}`}
                            className="mt-1 block font-semibold text-[15px] text-[#2C2018] hover:text-[#8B4B28] transition-colors line-clamp-1"
                          >
                            {product.name}
                          </Link>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6E5E52] tabular-nums">
                            {product.reviewCount > 0 ? (
                              <>
                                <Star className="h-3.5 w-3.5 fill-[#D9822B] text-[#D9822B]" />
                                <span className="font-semibold text-[#2C2018]">
                                  {product.rating.toFixed(1)}
                                </span>
                                <span>({product.reviewCount})</span>
                              </>
                            ) : (
                              <span>
                                {outOfStock
                                  ? 'Currently out of stock'
                                  : `${product.stock} available`}
                              </span>
                            )}
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
                            disabled={outOfStock}
                            onClick={() => addToCart(product)}
                            className="rounded-lg bg-[#FAF6F0] border border-[#DFD2C2] px-3 py-1.5 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white hover:border-[#8B4B28] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {outOfStock ? 'Sold Out' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E2D8CB] bg-white px-3.5 py-2 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <span className="font-mono text-xs text-[#524338] tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E2D8CB] bg-white px-3.5 py-2 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28] disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
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
                  to="/shops"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
                >
                  Explore Artisan Studios
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/become-seller"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D8CBB9] bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2018] hover:border-[#8B4B28] transition-colors"
                >
                  Apply to Open Your Shop
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
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
                  {categories.length}
                </p>
                <p className="mt-1 text-xs text-[#6E5E52]">
                  Active handmade craft categories live on Craftify
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

      {/* Quiet Editorial Footer */}
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
              to="/shops"
              className="hover:text-[#8B4B28] underline-offset-4 hover:underline"
            >
              Artisan Studios
            </Link>
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
