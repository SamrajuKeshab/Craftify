import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeStorefrontProduct } from '../services/catalogService';
import {
  addCartItem,
  applyCartCoupon,
  clearCart as clearCartRequest,
  createBuyerAddress,
  deleteBuyerAddress,
  fetchBuyerAddresses,
  fetchCart,
  fetchWishlist,
  moveWishlistProductToCart,
  removeCartCoupon,
  removeCartItem,
  setDefaultBuyerAddress,
  toggleWishlistProduct,
  updateBuyerAddress,
  updateCartItem,
} from '../services/commerceService';
import { extractServiceError } from '../services/sellerService';
import { COD_MAX_ORDER_AMOUNT, FREE_SHIPPING_THRESHOLD } from '../utils/formatters';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const EMPTY_CART_STATE = {
  items: [],
  itemCount: 0,
  distinctSellersCount: 0,
  subtotal: 0,
  discount: 0,
  shipping: 0,
  total: 0,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  codMaxAmount: COD_MAX_ORDER_AMOUNT,
  codEligible: true,
  appliedCoupon: null,
  couponNotice: '',
};

function normalizeCartResponse(data) {
  if (!data) return EMPTY_CART_STATE;
  const items = Array.isArray(data.items)
    ? data.items.map((item) => ({
        id: item.id,
        variantId: item.variant_id,
        variantSku: item.variant_sku,
        variantLabel: item.variant_label || 'Standard',
        productId: item.product_id,
        productSlug: item.product_slug,
        productTitle: item.product_title,
        categoryName: item.category_name,
        sellerId: item.seller_id,
        sellerName: item.seller_shop_name,
        sellerSlug: item.seller_slug,
        image: item.image_url || '',
        unitPrice: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 1),
        lineTotal: Number(item.line_total || 0),
        availableStock: Number(item.available_stock ?? 0),
        isCustomizable: Boolean(item.is_customizable),
        customizationNote: item.customization_note || '',
        isAvailable: item.is_available !== false,
        availabilityIssue: item.availability_issue || '',
      }))
    : [];

  return {
    items,
    itemCount: Number(data.item_count ?? 0),
    distinctSellersCount: Number(data.distinct_sellers_count ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    discount: Number(data.discount ?? 0),
    shipping: Number(data.shipping ?? 0),
    total: Number(data.total ?? 0),
    freeShippingThreshold: Number(
      data.free_shipping_threshold ?? FREE_SHIPPING_THRESHOLD
    ),
    codMaxAmount: Number(data.cod_max_amount ?? COD_MAX_ORDER_AMOUNT),
    codEligible: data.cod_eligible !== false,
    appliedCoupon: data.applied_coupon || null,
    couponNotice: data.coupon_notice || '',
  };
}

function normalizeWishlistResponse(data) {
  if (!data || !Array.isArray(data.items)) {
    return { items: [], ids: [] };
  }
  const normalizedItems = data.items
    .map((entry) => {
      const product = normalizeStorefrontProduct(entry.product);
      if (!product) return null;
      return {
        wishlistItemId: entry.id,
        savedAt: entry.created_at,
        product,
      };
    })
    .filter(Boolean);

  return {
    items: normalizedItems,
    ids: normalizedItems.map((entry) => entry.product.id),
  };
}

export function CartProvider({ children }) {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [cartState, setCartState] = useState(EMPTY_CART_STATE);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [placedOrders] = useState([]);

  const [cartLoading, setCartLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3000);
  }, []);

  const redirectToLoginForAction = useCallback(
    (reasonMessage) => {
      showToast(reasonMessage);
      navigate('/login', {
        state: {
          from: `${location.pathname}${location.search || ''}`,
          message: reasonMessage,
        },
      });
    },
    [location.pathname, location.search, navigate, showToast]
  );

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartState(EMPTY_CART_STATE);
      return null;
    }
    setCartLoading(true);
    try {
      const data = await fetchCart();
      const normalized = normalizeCartResponse(data);
      setCartState(normalized);
      return normalized;
    } catch {
      return null;
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlistItems([]);
      setWishlistIds([]);
      return null;
    }
    setWishlistLoading(true);
    try {
      const data = await fetchWishlist();
      const normalized = normalizeWishlistResponse(data);
      setWishlistItems(normalized.items);
      setWishlistIds(normalized.ids);
      return normalized;
    } catch {
      return null;
    } finally {
      setWishlistLoading(false);
    }
  }, [user]);

  const refreshAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      return [];
    }
    setAddressesLoading(true);
    try {
      const data = await fetchBuyerAddresses();
      const list = Array.isArray(data.results) ? data.results : [];
      setAddresses(list);
      return list;
    } catch {
      return [];
    } finally {
      setAddressesLoading(false);
    }
  }, [user]);

  // Automatically hydrate persistent Cart, Wishlist, and Addresses whenever user signs in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCartState(EMPTY_CART_STATE);
      setWishlistItems([]);
      setWishlistIds([]);
      setAddresses([]);
      return;
    }
    Promise.all([refreshCart(), refreshWishlist(), refreshAddresses()]);
  }, [authLoading, user, refreshCart, refreshWishlist, refreshAddresses]);

  /**
   * Login-required Add to Cart backed by PostgreSQL CartItem & live Inventory checks.
   */
  const addToCart = async (product, selectedVariant = null, options = {}) => {
    if (!user) {
      redirectToLoginForAction('Please sign in to add items to your cart.');
      return { ok: false, requiresAuth: true };
    }

    const quantity = Number(options.quantity || 1);
    const customizationNote = (options.customizationNote || '').trim();

    let variantId = options.variantId || null;
    if (!variantId && Array.isArray(product?.variantObjects) && product.variantObjects.length > 0) {
      const matched = selectedVariant
        ? product.variantObjects.find(
            (v) =>
              v.label === selectedVariant ||
              v.id === selectedVariant ||
              v.sku === selectedVariant
          )
        : null;
      const fallback =
        product.variantObjects.find((v) => Number(v.quantity_available || 0) > 0) ||
        product.variantObjects[0];
      variantId = (matched || fallback)?.id || null;
    }

    try {
      const res = await addCartItem({
        variantId,
        productId: variantId ? null : product?.id,
        quantity,
        customizationNote,
      });
      setCartState(normalizeCartResponse(res.cart));
      showToast(res.detail || `Added "${product?.name || 'craft'}" to your cart`);
      return { ok: true, cart: res.cart };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not add item to your cart.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const updateCartItemQuantity = async (itemId, nextQuantity) => {
    if (!user) return { ok: false };
    try {
      const res = await updateCartItem(itemId, { quantity: Math.max(0, nextQuantity) });
      const normalized = normalizeCartResponse(res.cart);
      setCartState(normalized);
      if (normalized.couponNotice) {
        showToast(normalized.couponNotice);
      }
      return { ok: true, cart: normalized };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not update quantity.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const updateCartItemNote = async (itemId, customizationNote) => {
    if (!user) return { ok: false };
    try {
      const res = await updateCartItem(itemId, { customizationNote });
      setCartState(normalizeCartResponse(res.cart));
      showToast('Customization note saved');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not update customization note.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const removeFromCart = async (itemId) => {
    if (!user) return { ok: false };
    try {
      const res = await removeCartItem(itemId);
      const normalized = normalizeCartResponse(res.cart);
      setCartState(normalized);
      showToast(normalized.couponNotice || 'Item removed from cart');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not remove item from cart.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const clearCart = async () => {
    if (!user) return { ok: false };
    try {
      const data = await clearCartRequest();
      setCartState(normalizeCartResponse(data));
      showToast('Cart cleared');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not clear cart.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const toggleWishlist = async (product) => {
    if (!user) {
      redirectToLoginForAction('Please sign in to save handmade crafts to your wishlist.');
      return { ok: false, requiresAuth: true };
    }
    const productId = typeof product === 'string' ? product : product?.id;
    if (!productId) return { ok: false };

    try {
      const data = await toggleWishlistProduct(productId);
      const normalized = normalizeWishlistResponse(data);
      setWishlistItems(normalized.items);
      setWishlistIds(normalized.ids);
      showToast(data.detail || 'Wishlist updated');
      return { ok: true, action: data.action };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not update wishlist.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const moveWishlistToCart = async (productId, options = {}) => {
    if (!user) {
      redirectToLoginForAction('Please sign in to manage your cart.');
      return { ok: false, requiresAuth: true };
    }
    try {
      const res = await moveWishlistProductToCart(productId, options);
      if (res.cart) setCartState(normalizeCartResponse(res.cart));
      if (res.wishlist) {
        const normalizedWl = normalizeWishlistResponse(res.wishlist);
        setWishlistItems(normalizedWl.items);
        setWishlistIds(normalizedWl.ids);
      }
      showToast(res.detail || 'Moved craft to your cart');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not move item to cart.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const applyCouponCode = async (rawCode) => {
    if (!user) {
      redirectToLoginForAction('Please sign in to apply a coupon code.');
      return { ok: false, message: 'Sign in required.' };
    }
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { ok: false, message: 'Please enter a coupon code.' };
    }
    try {
      const res = await applyCartCoupon(code);
      setCartState(normalizeCartResponse(res.cart));
      showToast(`Coupon ${code} applied`);
      return { ok: true, message: res.detail || `Coupon ${code} applied.` };
    } catch (err) {
      const msg = extractServiceError(err, 'This coupon code is not valid for your cart.');
      return { ok: false, message: msg };
    }
  };

  const removeCoupon = async () => {
    if (!user) return { ok: false };
    try {
      const res = await removeCartCoupon();
      setCartState(normalizeCartResponse(res.cart));
      showToast('Coupon removed');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not remove coupon.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const saveAddress = async (payload, addressId = null) => {
    if (!user) return { ok: false, message: 'Sign in required.' };
    try {
      const res = addressId
        ? await updateBuyerAddress(addressId, payload)
        : await createBuyerAddress(payload);
      await refreshAddresses();
      showToast(res.detail || 'Delivery address saved');
      return { ok: true, address: res.address };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not save delivery address.');
      return { ok: false, message: msg };
    }
  };

  const removeAddress = async (addressId) => {
    if (!user) return { ok: false };
    try {
      await deleteBuyerAddress(addressId);
      await refreshAddresses();
      showToast('Delivery address removed');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not delete address.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const makeDefaultAddress = async (addressId) => {
    if (!user) return { ok: false };
    try {
      await setDefaultBuyerAddress(addressId);
      await refreshAddresses();
      showToast('Default delivery address updated');
      return { ok: true };
    } catch (err) {
      const msg = extractServiceError(err, 'Could not update default address.');
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  return (
    <CartContext.Provider
      value={{
        // Authoritative Cart state
        items: cartState.items,
        itemCount: cartState.itemCount,
        distinctSellersCount: cartState.distinctSellersCount,
        subtotal: cartState.subtotal,
        discount: cartState.discount,
        shipping: cartState.shipping,
        total: cartState.total,
        freeShippingThreshold: cartState.freeShippingThreshold,
        codMaxAmount: cartState.codMaxAmount,
        codEligible: cartState.codEligible,
        appliedCoupon: cartState.appliedCoupon,
        couponNotice: cartState.couponNotice,
        cartLoading,

        // Authoritative Wishlist state
        wishlistItems,
        wishlistIds,
        wishlistLoading,

        // Authoritative Buyer Addresses state
        addresses,
        addressesLoading,

        // Orders placeholder (Week 8 multi-vendor checkout)
        placedOrders,
        toastMessage,

        // Actions
        refreshCart,
        refreshWishlist,
        refreshAddresses,
        addToCart,
        updateCartItemQuantity,
        updateCartItemNote,
        removeFromCart,
        clearCart,
        toggleWishlist,
        moveWishlistToCart,
        applyCouponCode,
        removeCoupon,
        saveAddress,
        removeAddress,
        makeDefaultAddress,
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
