/**
 * Format large numbers into compact social-media style strings.
 *
 * Examples:
 *  1000        -> "1K"
 *  1250        -> "1.3K"
 *  1500000     -> "1.5M"
 *  2000000000  -> "2B"
 *
 * Rules:
 *  - Accepts number | string | bigint | unknown inputs (commas/spaces allowed).
 *  - Uses one decimal place (e.g., 2.3K) and removes ".0" automatically.
 *  - Supports K (thousand), M (million), B (billion).
 *  - Returns `invalidFallback` (default "0") for invalid inputs.
 */
export function formatCompactNumber(value: unknown, invalidFallback = '0'): string {
  if (value === null || value === undefined) return invalidFallback;

  // Normalize input to number
  let num: number;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]+/g, '').trim();
    if (cleaned === '') return invalidFallback;
    num = Number(cleaned);
  } else if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'bigint') {
    num = Number(value);
  } else {
    num = Number(value as any);
  }

  if (!isFinite(num) || Number.isNaN(num)) return invalidFallback;

  const sign = num < 0 ? '-' : '';
  const n = Math.abs(num);

  if (n < 1000) return `${sign}${Math.floor(n)}`;

  const format = (value: number, suffix: string) => {
    const formatted = (value).toFixed(1).replace(/\.0$/, ''); // keep 1 decimal, remove .0
    return `${sign}${formatted}${suffix}`;
  };

  if (n >= 1_000_000_000) {
    return format(n / 1_000_000_000, 'B');
  }

  if (n >= 1_000_000) {
    return format(n / 1_000_000, 'M');
  }

  if (n >= 1_000) {
    return format(n / 1_000, 'K');
  }

  return `${sign}${Math.floor(n)}`;
}
