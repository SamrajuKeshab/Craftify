import { Heart, Search, ShoppingBag, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import CraftifyLogo from '../common/CraftifyLogo';

export default function StorefrontNavbar({ searchQuery, onSearchChange }) {
  const { user, getDashboardUrl } = useAuth();
  const { itemCount, wishlistIds } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [localSearch, setLocalSearch] = useState('');

  const isControlled = typeof onSearchChange === 'function';
  const inputValue = isControlled ? searchQuery || '' : localSearch;

  const handleInputChange = (value) => {
    if (isControlled) {
      onSearchChange(value);
    } else {
      setLocalSearch(value);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (location.pathname !== '/') {
      navigate(trimmed ? `/?search=${encodeURIComponent(trimmed)}` : '/');
      return;
    }
    const target = document.getElementById('featured-products');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF6F0]/95 backdrop-blur-sm border-b border-[#E8DFD3]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 h-16">
        <CraftifyLogo variant="light" to="/" />

        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#524338]">
          <Link
            to="/"
            className="hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            Home
          </Link>
          <a
            href="/#featured-products"
            className="hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            Shop
          </a>
          <a
            href="/#popular-categories"
            className="hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            Categories
          </a>
          <Link
            to="/shops"
            className="hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            Our Artists
          </Link>
          <Link
            to="/become-seller"
            className="hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            Sell on Craftify
          </Link>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 flex-1 lg:flex-initial justify-end">
          <form
            onSubmit={handleSearchSubmit}
            className="relative hidden sm:block w-full max-w-[260px]"
          >
            <input
              type="search"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search for art & craft products..."
              aria-label="Search handmade products"
              className="w-full rounded-full bg-white border border-[#E2D8CB] pl-4 pr-9 py-1.5 text-sm text-[#2C2018] placeholder:text-[#8C7B6E] focus:outline-none focus:border-[#8B4B28] transition-colors"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A6A5E] hover:text-[#8B4B28]"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          <Link
            to={user ? '/buyer/dashboard?tab=wishlist' : '/login'}
            aria-label="Saved Wishlist"
            title="Wishlist"
            className="relative p-2 text-[#4A3B31] hover:text-[#8B4B28] transition-colors shrink-0"
          >
            <Heart className="h-5 w-5" />
            {wishlistIds.length > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8B4B28] px-1 text-[10px] font-semibold text-white tabular-nums">
                {wishlistIds.length}
              </span>
            )}
          </Link>

          <Link
            to="/cart"
            aria-label="Shopping Cart"
            title="Your Cart"
            className="relative p-2 text-[#4A3B31] hover:text-[#8B4B28] transition-colors shrink-0"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8B4B28] px-1 text-[10px] font-semibold text-white tabular-nums">
                {itemCount}
              </span>
            )}
          </Link>

          <Link
            to={user ? getDashboardUrl() : '/login'}
            aria-label={user ? 'Open Dashboard' : 'Sign In'}
            className="inline-flex items-center gap-2 rounded-full border border-[#E2D8CB] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28] hover:text-[#8B4B28] transition-colors whitespace-nowrap shrink-0"
          >
            <User className="h-4 w-4" />
            <span className="hidden md:inline">
              {user ? user.full_name.split(' ')[0] : 'Sign In'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
