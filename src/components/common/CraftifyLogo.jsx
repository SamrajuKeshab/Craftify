import { Link } from 'react-router-dom';

/**
 * Craftify floral craft emblem + Fraunces serif wordmark.
 * Supports `variant="light"` (warm storefront/cart) and `variant="dark"` (dark slate sidebar).
 */
export default function CraftifyLogo({ variant = 'light', to = '/' }) {
  const isDark = variant === 'dark';

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8B4B28] rounded"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <g fill={isDark ? '#D48A5A' : '#8B4B28'}>
          <ellipse cx="16" cy="7.2" rx="2.7" ry="4.6" />
          <ellipse cx="16" cy="24.8" rx="2.7" ry="4.6" />
          <ellipse cx="7.2" cy="16" rx="4.6" ry="2.7" />
          <ellipse cx="24.8" cy="16" rx="4.6" ry="2.7" />
          <ellipse
            cx="9.8"
            cy="9.8"
            rx="2.6"
            ry="4.3"
            transform="rotate(-45 9.8 9.8)"
          />
          <ellipse
            cx="22.2"
            cy="22.2"
            rx="2.6"
            ry="4.3"
            transform="rotate(-45 22.2 22.2)"
          />
          <ellipse
            cx="22.2"
            cy="9.8"
            rx="2.6"
            ry="4.3"
            transform="rotate(45 22.2 9.8)"
          />
          <ellipse
            cx="9.8"
            cy="22.2"
            rx="2.6"
            ry="4.3"
            transform="rotate(45 9.8 22.2)"
          />
        </g>
        <circle cx="16" cy="16" r="3.4" fill={isDark ? '#242B33' : '#FAF6F0'} />
        <circle cx="16" cy="16" r="1.7" fill={isDark ? '#E8A87C' : '#B86B3E'} />
      </svg>
      <span
        className={`font-serif text-xl font-bold tracking-tight ${
          isDark ? 'text-white' : 'text-[#2C2018]'
        }`}
      >
        Craftify
      </span>
    </Link>
  );
}
