import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Heart,
  Image as ImageIcon,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useCart } from '../context/CartContext';
import {
  fetchPublicProductBySlug,
  normalizeStorefrontProduct,
} from '../services/catalogService';
import { formatINR } from '../utils/formatters';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlistIds } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImageUrl, setActiveImageUrl] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('Standard');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await fetchPublicProductBySlug(slug);
        if (!active) return;
        const normalized = normalizeStorefrontProduct(data);
        setProduct(normalized);
        setActiveImageUrl(normalized.image || normalized.images?.[0]?.image_url || '');
        setSelectedVariant(normalized.variants?.[0] || 'Standard');
        setQuantity(1);
        setRelatedProducts(
          (data.related_products || []).map(normalizeStorefrontProduct).filter(Boolean)
        );
      } catch {
        if (active) {
          setProduct(null);
          setNotFound(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
        <StorefrontNavbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
            <div className="lg:col-span-6 aspect-[4/3] rounded-2xl bg-[#EFE6DA]" />
            <div className="lg:col-span-6 space-y-4 py-4">
              <div className="h-4 w-40 rounded bg-[#EFE6DA]" />
              <div className="h-9 w-3/4 rounded bg-[#E5D8C7]" />
              <div className="h-8 w-32 rounded bg-[#EFE6DA]" />
              <div className="h-24 w-full rounded bg-[#EFE6DA]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
        <StorefrontNavbar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-12">
            <h1 className="font-serif text-2xl font-bold text-[#2C2018]">
              Handmade craft not found
            </h1>
            <p className="mt-2 text-sm text-[#6E5E52]">
              This listing may have been removed or is not currently published on Craftify.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Storefront</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const gallery =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.map((img) => ({
          id: img.id || img.image_url,
          url: img.image_url,
          alt: img.alt_text || product.name,
        }))
      : product.image
      ? [{ id: 'primary', url: product.image, alt: product.name }]
      : [];

  const selectedVariantObj = Array.isArray(product.variantObjects)
    ? product.variantObjects.find((v) => v.label === selectedVariant) ||
      product.variantObjects[0]
    : null;

  const displayPrice = selectedVariantObj?.effective_price
    ? Number(selectedVariantObj.effective_price)
    : product.price;
  const displayStock =
    selectedVariantObj && typeof selectedVariantObj.quantity_available === 'number'
      ? selectedVariantObj.quantity_available
      : product.stock;
  const displayDimensions =
    selectedVariantObj?.dimensions_cm || product.dimensions || 'Handmade dimensions';
  const displaySku = selectedVariantObj?.sku || '';

  const outOfStock = displayStock <= 0;
  const maxOrderQty = Math.max(1, Math.min(displayStock, 20));
  const isWishlisted = wishlistIds.includes(product.id);

  const craftAttributes = [
    product.customizable && 'Customizable',
    product.isMadeToOrder && 'Made to Order',
    product.isOneOfAKind && 'One of a Kind',
  ].filter(Boolean);

  const handleVariantSelect = (variantLabel) => {
    setSelectedVariant(variantLabel);
    setQuantity(1);
  };

  const handleAddToCart = () => {
    if (outOfStock) return;
    for (let i = 0; i < quantity; i += 1) {
      addToCart({ ...product, price: displayPrice }, selectedVariant);
    }
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    for (let i = 0; i < quantity; i += 1) {
      addToCart({ ...product, price: displayPrice }, selectedVariant);
    }
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Clean Unboxed Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-[#6E5E52]"
        >
          <Link to="/" className="hover:text-[#8B4B28] transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#B4A391]" />
          <Link
            to={`/?category=${encodeURIComponent(product.categoryId)}`}
            className="hover:text-[#8B4B28] transition-colors"
          >
            {product.categoryName}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#B4A391]" />
          <span className="font-medium text-[#2C2018] truncate max-w-xs">
            {product.name}
          </span>
        </nav>

        {/* Primary PDP Split: Sticky Gallery Left + Contiguous Purchase Module Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Gallery */}
          <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-4">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#EAE1D5] bg-[#F3ECE2] flex items-center justify-center">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#9E8770]">
                  <ImageIcon className="h-12 w-12" />
                  <span className="mt-2 text-xs font-medium">
                    Handmade Studio Photography
                  </span>
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                {gallery.map((img) => {
                  const active = activeImageUrl === img.url;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setActiveImageUrl(img.url)}
                      className={`aspect-square overflow-hidden rounded-xl border bg-white transition-all ${
                        active
                          ? 'border-[#8B4B28] ring-2 ring-[#8B4B28]/25'
                          : 'border-[#E2D8CB] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="lg:col-span-6 rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              {/* Quiet unboxed metadata line */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E5E52]">
                <span>{product.categoryName}</span>
                <span aria-hidden="true">·</span>
                {product.sellerSlug ? (
                  <Link
                    to={`/shops/${product.sellerSlug}`}
                    className="font-semibold text-[#8B4B28] hover:underline underline-offset-4"
                  >
                    {product.sellerName}
                  </Link>
                ) : (
                  <span className="font-semibold text-[#2C2018]">
                    {product.sellerName}
                  </span>
                )}
                {craftAttributes.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{craftAttributes.join(' · ')}</span>
                  </>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2C2018] leading-tight text-balance">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3 pt-1">
                <span className="font-mono text-3xl font-bold text-[#2C2018] tabular-nums">
                  {formatINR(displayPrice)}
                </span>
                {product.originalPrice > displayPrice && (
                  <span className="font-mono text-base text-[#8C7B6E] line-through tabular-nums">
                    {formatINR(product.originalPrice)}
                  </span>
                )}
                <span className="text-xs text-[#6E5E52]">
                  Inclusive of all taxes
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span
                  className={`font-semibold ${
                    outOfStock ? 'text-red-700' : 'text-[#355E44]'
                  }`}
                >
                  {outOfStock
                    ? 'Currently out of stock'
                    : `In stock — ${displayStock} available`}
                </span>
                {displaySku && (
                  <>
                    <span className="text-[#C5B5A3]" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono text-[#7A6A5E]">
                      SKU {displaySku}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Variant selector */}
            {product.variants?.length > 0 && (
              <div className="border-t border-[#F1E8DD] pt-5">
                <p className="text-xs font-semibold text-[#4A3B31] mb-2.5">
                  Select Option
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => {
                    const active = selectedVariant === variant;
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => handleVariantSelect(variant)}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold border transition-colors whitespace-nowrap ${
                          active
                            ? 'border-[#8B4B28] bg-[#8B4B28]/10 text-[#8B4B28]'
                            : 'border-[#E2D8CB] bg-[#FAF6F0] text-[#4A3B31] hover:border-[#8B4B28]/50'
                        }`}
                      >
                        {variant}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Primary Purchase Actions */}
            <div className="border-t border-[#F1E8DD] pt-5 space-y-4">
              {!outOfStock && (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-[#4A3B31]">
                    Quantity
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="flex h-9 w-9 items-center justify-center text-[#524338] hover:text-[#8B4B28]"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-sm font-semibold text-[#2C2018] tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxOrderQty, q + 1))}
                      aria-label="Increase quantity"
                      className="flex h-9 w-9 items-center justify-center text-[#524338] hover:text-[#8B4B28]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={handleAddToCart}
                  className="flex-1 rounded-lg bg-[#8B4B28] px-6 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={handleBuyNow}
                  className="flex-1 rounded-lg border border-[#8B4B28] bg-white px-6 py-3 text-sm font-semibold text-[#8B4B28] hover:bg-[#FAF6F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-label="Toggle wishlist"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E2D8CB] hover:border-[#8B4B28] transition-colors shrink-0"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      isWishlisted ? 'fill-[#8B4B28] text-[#8B4B28]' : 'text-[#524338]'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Story & Description */}
            <div className="border-t border-[#F1E8DD] pt-5 space-y-2">
              <h2 className="text-sm font-bold text-[#2C2018]">
                About This Handmade Craft
              </h2>
              <p className="text-sm leading-relaxed text-[#524338] whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Craft Specifications & Delivery Terms */}
            <div className="border-t border-[#F1E8DD] pt-5 space-y-2.5 text-xs text-[#524338]">
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-[#8B4B28] shrink-0" />
                <span>
                  Handcrafted in {product.sellerCity} · Country of Origin: India
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-[#8B4B28] shrink-0" />
                <span>
                  Dispatch preparation: {product.processingDays} · {displayDimensions}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-[#4E7A5B] shrink-0" />
                <span>
                  Free shipping on orders above ₹999 (₹79 standard below ₹999) · Razorpay
                  &amp; COD up to ₹5,000
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#4E7A5B] shrink-0" />
                <span>
                  {product.customizable || product.isMadeToOrder
                    ? 'Personalized / made-to-order piece · Eligible for replacement if damaged or wrong on delivery'
                    : '7-day hassle-free return window post-delivery'}
                </span>
              </div>
            </div>

            {/* Studio Attribution Footer */}
            {product.sellerSlug && (
              <div className="border-t border-[#F1E8DD] pt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] text-[#8B4B28] shrink-0">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#2C2018] truncate">
                      {product.sellerName}
                    </p>
                    <p className="text-xs text-[#6E5E52] truncate">
                      Verified Artisan Studio · {product.sellerCity}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/shops/${product.sellerSlug}`}
                  className="rounded-lg border border-[#DFD2C2] bg-[#FAF6F0] px-3.5 py-2 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white hover:border-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
                >
                  Visit Studio
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Related Handmade Crafts */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-[#EAE1D5]">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="font-serif text-2xl font-bold text-[#2C2018]">
                More Handmade Crafts
              </h2>
              <Link
                to="/"
                className="text-xs font-semibold text-[#8B4B28] hover:underline underline-offset-4"
              >
                Explore full catalog
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/products/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl bg-white border border-[#EAE1D5] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#F3ECE2] flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-[#A8927B]" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-[#7A6A5E]">
                        {item.sellerName} <span aria-hidden="true">·</span>{' '}
                        {item.categoryName}
                      </p>
                      <h3 className="mt-1 font-semibold text-[15px] text-[#2C2018] group-hover:text-[#8B4B28] transition-colors line-clamp-1">
                        {item.name}
                      </h3>
                    </div>
                    <p className="mt-3 font-mono text-sm font-bold text-[#2C2018] tabular-nums">
                      {formatINR(item.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
