/**
 * Helper utilities for the Point of Sale application.
 */

/**
 * Format a number into Indonesian Rupiah (Rp) or other currencies.
 */
export function formatCurrency(value: number, symbol: string = 'Rp'): string {
  const formattedValue = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
  
  return `${symbol} ${formattedValue}`;
}

/**
 * Format timestamp into human-readable local date and time in Indonesian.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Generate a visual avatar or short name for products/categories.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
