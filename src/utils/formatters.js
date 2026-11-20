/**
 * Format numeric amounts into Indian Rupee (INR ₹) notation with Indian lakh grouping.
 * Example: 245000 -> "₹2,45,000"
 */
export function formatINR(amount, includeDecimals = false) {
  const numeric = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(numeric);
}

/**
 * Format compact Indian currency axis labels for Recharts (e.g., 50k, 1L, 1.5L).
 */
export function formatINRCompact(value) {
  if (value >= 100000) {
    const lakhs = value / 100000;
    return `${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return `${value}`;
}

export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 79;
export const COD_MAX_ORDER_AMOUNT = 5000;
