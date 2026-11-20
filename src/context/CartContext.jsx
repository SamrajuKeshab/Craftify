import { createContext, useContext, useMemo, useState } from 'react';
import { ACTIVE_COUPONS, INITIAL_CART_ITEMS } from '../data/craftifyData';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from '../utils/formatters';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(INITIAL_CART_ITEMS);
  const [wishlistIds, setWishlistIds] = useState(['prod-101', 'prod-104']);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [placedOrders, setPlacedOrders] = useState([
    {
      id: '#ORD1234',
      date: '20 Nov 2026',
      paymentMethod: 'Razorpay',
      total: 2698,
      status: 'Processing',
      suborders: [
        {
          code: 'ORD1234-S1',
          seller: 'Artistic Creations',
          item: 'Hand Painted Ceramic Vase × 1',
          status: 'Processing',
          tracking: 'Preparing kiln-safe packaging',
        },
        {
          code: 'ORD1234-S2',
          seller: 'Kala Knot Studio',
          item: 'Macrame Wall Hanging × 1',
          status: 'Shipped',
          tracking: 'DLVRY-9102441 (Delhivery)',
        },
      ],
    },
  ]);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 2600);
  };

  const addToCart = (product, selectedVariant = null) => {
    const variant = selectedVariant || product.variants?.[0] || 'Standard';
    setItems((prev) => {
      const idx = prev.findIndex(
        (entry) => entry.product.id === product.id && entry.selectedVariant === variant
      );
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { product, quantity: 1, selectedVariant: variant }];
    });
    showToast(`Added "${product.name}" to your cart`);
  };

  const updateQuantity = (productId, selectedVariant, delta) => {
    setItems((prev) =>
      prev
        .map((entry) => {
          if (entry.product.id === productId && entry.selectedVariant === selectedVariant) {
            const nextQty = entry.quantity + delta;
            return nextQty > 0 ? { ...entry, quantity: nextQty } : null;
          }
          return entry;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId, selectedVariant) => {
    setItems((prev) =>
      prev.filter(
        (entry) => !(entry.product.id === productId && entry.selectedVariant === selectedVariant)
      )
    );
    showToast('Item removed from cart');
  };

  const toggleWishlist = (product) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(product.id);
      showToast(
        exists
          ? `Removed "${product.name}" from wishlist`
          : `Saved "${product.name}" to wishlist`
      );
      return exists ? prev.filter((id) => id !== product.id) : [...prev, product.id];
    });
  };

  const applyCouponCode = (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { ok: false, message: 'Please enter a coupon code.' };
    }
    const coupon = ACTIVE_COUPONS[code];
    if (!coupon) {
      return { ok: false, message: 'Invalid coupon. Try CRAFT10 or ARTISAN150.' };
    }
    if (subtotal < coupon.minOrder) {
      return {
        ok: false,
        message: `Minimum order of ₹${coupon.minOrder} required for ${coupon.code}.`,
      };
    }
    setAppliedCoupon(coupon);
    showToast(`Coupon ${coupon.code} applied`);
    return { ok: true, message: coupon.description };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const itemCount = useMemo(
    () => items.reduce((sum, entry) => sum + entry.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0),
    [items]
  );

  const discount = useMemo(() => {
    if (!appliedCoupon || subtotal < appliedCoupon.minOrder) return 0;
    if (appliedCoupon.type === 'PERCENT') {
      return Math.min(Math.round((subtotal * appliedCoupon.value) / 100), appliedCoupon.maxDiscount);
    }
    return Math.min(appliedCoupon.value, subtotal);
  }, [appliedCoupon, subtotal]);

  const shipping = useMemo(() => {
    if (items.length === 0) return 0;
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  }, [items.length, subtotal]);

  const total = Math.max(0, subtotal - discount + shipping);

  const placeOrder = ({ address, paymentMethod }) => {
    const orderNum = `#ORD${Math.floor(1235 + Math.random() * 700)}`;
    // Group cart items by seller to demonstrate multi-vendor suborder splitting
    const bySeller = items.reduce((acc, entry) => {
      const seller = entry.product.sellerName;
      if (!acc[seller]) acc[seller] = [];
      acc[seller].push(entry);
      return acc;
    }, {});

    const suborders = Object.entries(bySeller).map(([seller, sellerItems], index) => ({
      code: `${orderNum.replace('#', '')}-S${index + 1}`,
      seller,
      item: sellerItems
        .map((e) => `${e.product.name} × ${e.quantity}`)
        .join(', '),
      status: paymentMethod === 'COD' ? 'Confirmed (COD)' : 'Paid · Processing',
      tracking: 'Awaiting artisan pickup',
    }));

    const newOrder = {
      id: orderNum,
      date: '20 Nov 2026',
      paymentMethod,
      address,
      total,
      status: 'Processing',
      suborders,
    };

    setPlacedOrders((prev) => [newOrder, ...prev]);
    setItems([]);
    setAppliedCoupon(null);
    showToast(`Order ${orderNum} confirmed across ${suborders.length} artisan studio(s)`);
    return newOrder;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        discount,
        shipping,
        total,
        appliedCoupon,
        wishlistIds,
        placedOrders,
        toastMessage,
        addToCart,
        updateQuantity,
        removeFromCart,
        toggleWishlist,
        applyCouponCode,
        removeCoupon,
        placeOrder,
        showToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return ctx;
}
