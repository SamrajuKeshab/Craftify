import { Clock, Heart, MapPin, ShieldCheck, Star, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatINR } from '../../utils/formatters';

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart, toggleWishlist, wishlistIds } = useCart();
  const navigate = useNavigate();
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants?.[0] || 'Standard'
  );

  const isWishlisted = wishlistIds.includes(product.id);

  const handleBuyNow = () => {
    addToCart(product, selectedVariant);
    onClose();
    navigate('/cart');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        className="relative grid w-full max-w-4xl grid-cols-1 md:grid-cols-2 overflow-hidden rounded-2xl bg-[#FAF6F0] border border-[#E8DFD3] shadow-2xl max-h-[90vh]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#2C2018] border border-[#E8DFD3] hover:bg-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: Product Image */}
        <div className="bg-[#F3ECE2] flex items-center justify-center p-6">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full aspect-[4/3] object-cover rounded-xl shadow-sm"
          />
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="flex flex-col justify-between p-6 sm:p-8 overflow-y-auto bg-white">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#6E5E52]">
              <span>{product.categoryName}</span>
              <span aria-hidden="true">·</span>
              <span>{product.sellerName}</span>
            </div>

            <h2 className="font-serif text-2xl font-bold text-[#2C2018] leading-snug">
              {product.name}
            </h2>

            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-[#2C2018] tabular-nums">
                <Star className="h-4 w-4 fill-[#D9822B] text-[#D9822B]" />
                {product.rating.toFixed(1)}
              </span>
              <span className="text-[#6E5E52]">{product.reviewCount} verified reviews</span>
              <span className="text-[#4E7A5B] font-medium">
                In stock ({product.stock})
              </span>
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="font-mono text-2xl font-bold text-[#2C2018] tabular-nums">
                {formatINR(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="font-mono text-sm text-[#8C7B6E] line-through tabular-nums">
                  {formatINR(product.originalPrice)}
                </span>
              )}
              <span className="text-xs text-[#6E5E52]">Inclusive of all taxes</span>
            </div>

            <p className="text-sm leading-relaxed text-[#524338]">
              {product.description}
            </p>

            {/* Variant selector */}
            {product.variants?.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-[#4A3B31] mb-2">
                  Select Option
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => {
                    const active = selectedVariant === variant;
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-medium border transition-colors ${
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

            {/* Craft specs */}
            <div className="grid grid-cols-1 gap-2 border-t border-[#EAE1D5] pt-4 text-xs text-[#524338]">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-[#8B4B28]" />
                <span>Handcrafted in {product.sellerCity} · Country of Origin: India</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#8B4B28]" />
                <span>
                  Artisan processing: {product.processingDays} · {product.dimensions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-[#4E7A5B]" />
                <span>Free shipping on orders above ₹999 · Razorpay &amp; COD available</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[#4E7A5B]" />
                <span>
                  {product.customizable
                    ? 'Customizable craft · Eligible for replacement if damaged on delivery'
                    : '7-day hassle-free return policy'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 pt-4 border-t border-[#EAE1D5]">
            <button
              type="button"
              onClick={() => addToCart(product, selectedVariant)}
              className="flex-1 rounded-lg bg-[#8B4B28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              className="flex-1 rounded-lg border border-[#8B4B28] bg-white px-5 py-3 text-sm font-semibold text-[#8B4B28] hover:bg-[#FAF6F0] transition-colors"
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
      </div>
    </div>
  );
}
