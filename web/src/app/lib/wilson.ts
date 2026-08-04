/**
 * Wilson score confidence interval for a binomial proportion.
 * Returns [lower, upper] as fractions (0–1), or null if insufficient data.
 *
 * @param wins   number of successes (win_rate * sample_size)
 * @param n      total sample size
 * @param z      z-score (default 1.96 = 95% CI)
 */
export function wilsonCI(
  wins: number,
  n: number,
  z = 1.96
): [number, number] | null {
  if (n < 5) return null; // 樣本太小，CI 無意義
  const p      = wins / n;
  const z2     = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [
    Math.max(0, center - margin),
    Math.min(1, center + margin),
  ];
}

/**
 * Format a Wilson CI as a display string, e.g. "[48% – 62%]"
 */
export function wilsonCILabel(
  winRate: number | null,
  sampleSize: number | null
): string | null {
  if (winRate == null || sampleSize == null || sampleSize < 5) return null;
  const wins = Math.round(winRate * sampleSize);
  const ci   = wilsonCI(wins, sampleSize);
  if (!ci) return null;
  return `[${(ci[0] * 100).toFixed(0)}%–${(ci[1] * 100).toFixed(0)}%]`;
}
