/**
 * Quarterly estimation from seasonal ratios.
 *
 * Pure functions — no database dependency.
 * Computes per-origin quarterly ratios from Eurostat data, then uses those
 * ratios to distribute UNHCR annual totals into q1-q4 estimates.
 *
 * Exports: computeSeasonalRatios, distributeByQuarter
 */

interface EurostatRow {
  origin: string;
  quarter: string;
  value: number;
}

interface QuarterSums {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export type SeasonalRatios = Record<string, QuarterSums>;

/**
 * Compute per-origin quarterly ratios from Eurostat rows.
 * Groups by origin, sums values per quarter across all EU destinations,
 * then computes ratio = quarterSum / totalSum.
 */
export function computeSeasonalRatios(eurostatRows: EurostatRow[]): SeasonalRatios {
  const byOrigin: Record<string, QuarterSums> = {};

  for (const row of eurostatRows) {
    if (!byOrigin[row.origin]) {
      byOrigin[row.origin] = { q1: 0, q2: 0, q3: 0, q4: 0 };
    }
    const sums = byOrigin[row.origin];
    const q = row.quarter as keyof QuarterSums;
    if (q in sums) {
      sums[q] += row.value;
    }
  }

  const ratios: SeasonalRatios = {};
  for (const [origin, sums] of Object.entries(byOrigin)) {
    const total = sums.q1 + sums.q2 + sums.q3 + sums.q4;
    if (total === 0) continue; // skip origins with zero total to avoid division by zero
    ratios[origin] = {
      q1: sums.q1 / total,
      q2: sums.q2 / total,
      q3: sums.q3 / total,
      q4: sums.q4 / total,
    };
  }

  return ratios;
}

/**
 * Distribute an annual total into quarterly values using seasonal ratios.
 * Falls back to equal 25% split when ratios are null/undefined.
 * Remainder goes to q4 to ensure q1+q2+q3+q4 === annualTotal exactly.
 */
export function distributeByQuarter(
  annualTotal: number,
  ratios: QuarterSums | null | undefined
): QuarterSums {
  const r: QuarterSums = ratios || { q1: 0.25, q2: 0.25, q3: 0.25, q4: 0.25 };
  const q1 = Math.round(annualTotal * r.q1);
  const q2 = Math.round(annualTotal * r.q2);
  const q3 = Math.round(annualTotal * r.q3);
  const q4 = annualTotal - q1 - q2 - q3;
  return { q1, q2, q3, q4 };
}
