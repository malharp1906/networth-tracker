import type { Holding, Totals } from './types.ts';
import { sumItems, type NwClass, type Profile } from './profile.ts';
import { formatCurrency, formatPct } from './format.ts';

export const ASSET_COLORS: Record<string, string> = {
  Equity: '#38bdf8',
  Hybrid: '#818cf8',
  Debt: '#34d399',
  Commodity: '#fbbf24',
  Other: '#94a3b8',
};
export const NW_COLORS: Record<NwClass, string> = {
  Equity: '#38bdf8',
  Hybrid: '#818cf8',
  Debt: '#34d399',
  'Real Estate': '#a78bfa',
  'Gold & Silver': '#fbbf24',
  Other: '#94a3b8',
};

// Alert thresholds (kept visible so they're easy to tune)
export const RULES = {
  singleSchemePct: 10,
  singleSchemeDangerPct: 20,
  categoryPct: 30,
  equityPct: 60,
  debtPct: 20,
  maxActiveSchemes: 20,
  deepLossPct: -10,
};

export interface Slice {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export interface CategoryGroup {
  assetClass: string;
  category: string;
  value: number;
  pct: number;
  holdings: Holding[]; // live holdings, largest first
}

export interface Summary {
  netValue: number; // sum of every line — what the report itself totals to
  liveValue: number; // positive positions only; the base for all percentages
  invested: number;
  unrealizedGain: number;
  unrealizedPct: number;
  realizedGain: number;
  dividends: number;
  live: Holding[]; // sorted by value desc
  closedCount: number;
  anomalies: Holding[]; // negative value in the source
  byAssetClass: Slice[];
  groups: CategoryGroup[];
  geography: Slice[] | null; // Indian vs foreign equity, null if no equity
  top: (Holding & { pct: number })[];
}

const sum = (hs: Holding[], k: 'currentValue' | 'invested' | 'unrealizedGain' | 'realizedGain' | 'dividendPayout') =>
  hs.reduce((a, h) => a + h[k], 0);

export const isForeign = (h: Holding) => h.assetClass === 'Equity' && /^global$/i.test(h.category);

export function summarize(holdings: Holding[]): Summary {
  const live = holdings.filter(h => h.currentValue > 0).sort((a, b) => b.currentValue - a.currentValue);
  const anomalies = holdings.filter(h => h.currentValue < 0);
  const liveValue = sum(live, 'currentValue');
  const invested = sum(holdings, 'invested');
  const unrealizedGain = sum(holdings, 'unrealizedGain');
  const pct = (v: number) => (liveValue > 0 ? (v / liveValue) * 100 : 0);

  const classTotals = new Map<string, number>();
  const groupMap = new Map<string, CategoryGroup>();
  for (const h of live) {
    classTotals.set(h.assetClass, (classTotals.get(h.assetClass) ?? 0) + h.currentValue);
    const k = `${h.assetClass}|${h.category}`;
    const g = groupMap.get(k) ?? { assetClass: h.assetClass, category: h.category, value: 0, pct: 0, holdings: [] };
    g.value += h.currentValue;
    g.holdings.push(h);
    groupMap.set(k, g);
  }

  const byAssetClass = [...classTotals]
    .map(([name, value]) => ({ name, value, pct: pct(value), color: ASSET_COLORS[name] ?? ASSET_COLORS.Other }))
    .sort((a, b) => b.value - a.value);

  const groups = [...groupMap.values()]
    .map(g => ({ ...g, pct: pct(g.value) }))
    .sort((a, b) => b.value - a.value);

  const equity = live.filter(h => h.assetClass === 'Equity');
  const equityValue = sum(equity, 'currentValue');
  const foreignValue = sum(equity.filter(isForeign), 'currentValue');
  const geography: Slice[] | null =
    equityValue > 0
      ? [
          { name: 'Indian equity', value: equityValue - foreignValue, pct: ((equityValue - foreignValue) / equityValue) * 100, color: '#38bdf8' },
          { name: 'Foreign equity', value: foreignValue, pct: (foreignValue / equityValue) * 100, color: '#818cf8' },
        ].filter(s => s.value > 0)
      : null;

  return {
    netValue: sum(holdings, 'currentValue'),
    liveValue,
    invested,
    unrealizedGain,
    unrealizedPct: invested > 0 ? (unrealizedGain / invested) * 100 : 0,
    realizedGain: sum(holdings, 'realizedGain'),
    dividends: sum(holdings, 'dividendPayout'),
    live,
    closedCount: holdings.length - live.length - anomalies.length,
    anomalies,
    byAssetClass,
    groups,
    geography,
    top: live.slice(0, 10).map(h => ({ ...h, pct: pct(h.currentValue) })),
  };
}

// ---------------------------------------------------------------- net worth

export interface NetWorth {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtToNetWorth: number;
  monthlySurplus: number;
  annualIncome: number;
  monthlyExpenses: number;
  allocation: Slice[];
}

const MF_TO_NW: Record<string, NwClass> = { Equity: 'Equity', Hybrid: 'Hybrid', Debt: 'Debt', Commodity: 'Gold & Silver' };

export function computeNetWorth(summary: Summary, profile: Profile): NetWorth {
  const totalAssets = summary.netValue + sumItems(profile.assets);
  const totalLiabilities = sumItems(profile.liabilities);
  const netWorth = totalAssets - totalLiabilities;

  const byClass = new Map<NwClass, number>();
  const add = (c: NwClass, v: number) => byClass.set(c, (byClass.get(c) ?? 0) + v);
  for (const s of summary.byAssetClass) add(MF_TO_NW[s.name] ?? 'Other', s.value);
  for (const a of profile.assets) if (a.amount > 0) add(a.cls, a.amount);
  const base = [...byClass.values()].reduce((a, b) => a + b, 0);

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    debtToNetWorth: netWorth > 0 ? (totalLiabilities / netWorth) * 100 : 0,
    monthlySurplus: sumItems(profile.annualIncome) / 12 - sumItems(profile.monthlyExpenses),
    annualIncome: sumItems(profile.annualIncome),
    monthlyExpenses: sumItems(profile.monthlyExpenses),
    allocation: [...byClass]
      .map(([name, value]) => ({ name, value, pct: base > 0 ? (value / base) * 100 : 0, color: NW_COLORS[name] }))
      .sort((a, b) => b.value - a.value),
  };
}

// ---------------------------------------------------------------- alerts

export interface Alert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  desc: string;
}

export function buildAlerts(s: Summary, reported: Totals | null, nw: NetWorth | null): Alert[] {
  const alerts: Alert[] = [];

  for (const h of s.top) {
    if (h.pct <= RULES.singleSchemePct) break;
    alerts.push({
      id: `scheme-${h.folio}-${h.scheme}`,
      type: h.pct > RULES.singleSchemeDangerPct ? 'danger' : 'warning',
      title: 'Concentration risk',
      desc: `${h.scheme} is ${formatPct(h.pct)} of the mutual fund portfolio (threshold: >${RULES.singleSchemePct}%).`,
    });
  }

  const bigCat = s.groups.find(g => g.pct > RULES.categoryPct);
  if (bigCat) {
    alerts.push({
      id: 'category',
      type: 'warning',
      title: 'Category concentration',
      desc: `${bigCat.assetClass}: ${bigCat.category} holds ${formatPct(bigCat.pct)} of the portfolio (threshold: >${RULES.categoryPct}%).`,
    });
  }

  // Allocation rules run on total assets when a profile exists, otherwise on the fund portfolio.
  const slices = nw ? nw.allocation : s.byAssetClass;
  const basis = nw ? 'total assets' : 'the mutual fund portfolio';
  const share = (name: string) => slices.find(x => x.name === name)?.pct ?? 0;
  if (slices.length > 0) {
    if (share('Equity') > RULES.equityPct) {
      alerts.push({
        id: 'equity',
        type: 'warning',
        title: 'High equity exposure',
        desc: `Equity is ${formatPct(share('Equity'))} of ${basis} (threshold: >${RULES.equityPct}%). Consider rebalancing.`,
      });
    }
    if (share('Debt') < RULES.debtPct) {
      alerts.push({
        id: 'debt',
        type: 'warning',
        title: 'Low debt allocation',
        desc: `Debt is ${formatPct(share('Debt'))} of ${basis} (threshold: <${RULES.debtPct}%). May increase volatility.`,
      });
    }
  }

  if (s.live.length > RULES.maxActiveSchemes) {
    alerts.push({
      id: 'fragmentation',
      type: 'info',
      title: 'Many small positions',
      desc: `${s.live.length} active schemes, averaging ${formatCurrency(s.liveValue / s.live.length)} each. Overlapping funds add tracking effort without much diversification.`,
    });
  }

  const deepLosers = s.live.filter(h => h.invested > 0 && (h.unrealizedGain / h.invested) * 100 < RULES.deepLossPct);
  if (deepLosers.length > 0) {
    alerts.push({
      id: 'losers',
      type: 'info',
      title: 'Holdings down more than 10%',
      desc: `${deepLosers.map(h => h.scheme).slice(0, 3).join(', ')}${deepLosers.length > 3 ? ` and ${deepLosers.length - 3} more` : ''} (unrealised loss vs cost).`,
    });
  }

  if (s.anomalies.length > 0) {
    const total = s.anomalies.reduce((a, h) => a + h.currentValue, 0);
    alerts.push({
      id: 'anomalies',
      type: 'warning',
      title: 'Data anomaly in source report',
      desc: `${s.anomalies.length} position${s.anomalies.length > 1 ? 's' : ''} show negative units/value (${formatCurrency(total)} combined), usually redemptions recorded above cost. Excluded from allocation percentages, but included in the reported total.`,
    });
  }

  if (reported) {
    const diff = Math.abs(s.netValue - reported.currentValue);
    if (diff > Math.max(50, reported.currentValue * 0.0005)) {
      alerts.push({
        id: 'reconcile',
        type: 'warning',
        title: 'Totals do not reconcile',
        desc: `Holdings add up to ${formatCurrency(s.netValue)} but the report states ${formatCurrency(reported.currentValue)}. Some rows may not have been read.`,
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------- financial health score

export interface ScoreComponent {
  id: string;
  label: string;
  weight: number;
  score: number; // 0-100
  detail: string;
}

export interface HealthScore {
  score: number; // 0-100, weighted over the components that could be measured
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs attention';
  color: string;
  components: ScoreComponent[];
}

// Linear map: `bad` -> 0, `good` -> 100, clamped (works for either direction).
const scale = (v: number, bad: number, good: number) => Math.max(0, Math.min(100, ((v - bad) / (good - bad)) * 100));

export function computeHealthScore(s: Summary, reported: Totals | null, nw: NetWorth | null): HealthScore | null {
  if (s.liveValue <= 0) return null;
  const components: ScoreComponent[] = [];

  const topScheme = s.top[0]?.pct ?? 0;
  const topCategory = s.groups[0]?.pct ?? 0;
  components.push({
    id: 'diversification',
    label: 'Diversification',
    weight: 25,
    score: (scale(topScheme, 30, RULES.singleSchemePct) + scale(topCategory, 60, RULES.categoryPct)) / 2,
    detail: `Largest scheme ${formatPct(topScheme)}, largest category ${formatPct(topCategory)} of mutual funds`,
  });

  const slices = nw ? nw.allocation : s.byAssetClass;
  const share = (name: string) => slices.find(x => x.name === name)?.pct ?? 0;
  components.push({
    id: 'allocation',
    label: 'Asset allocation',
    weight: 25,
    score: (scale(share('Equity'), 90, RULES.equityPct) + scale(share('Debt'), 0, RULES.debtPct)) / 2,
    detail: `Equity ${formatPct(share('Equity'))}, debt ${formatPct(share('Debt'))} of ${nw ? 'total assets' : 'mutual funds'}`,
  });

  components.push(
    reported
      ? {
          id: 'returns',
          label: 'Returns',
          weight: 20,
          score: scale(reported.xirr, -5, 12),
          detail: `XIRR ${formatPct(reported.xirr, 2)} (full marks at 12%+)`,
        }
      : {
          id: 'returns',
          label: 'Returns',
          weight: 20,
          score: scale(s.unrealizedPct, -10, 20),
          detail: `Unrealised return ${formatPct(s.unrealizedPct)} on cost (full marks at 20%+)`,
        },
  );

  if (nw) {
    const ratio = nw.totalAssets > 0 ? (nw.totalLiabilities / nw.totalAssets) * 100 : 0;
    components.push({
      id: 'leverage',
      label: 'Debt load',
      weight: 15,
      score: scale(ratio, 50, 0),
      detail: ratio > 0 ? `Liabilities are ${formatPct(ratio)} of total assets` : 'No liabilities recorded',
    });
  }

  if (nw && nw.annualIncome + nw.monthlyExpenses > 0) {
    const monthlyIncome = nw.annualIncome / 12;
    const saved = monthlyIncome > 0 ? nw.monthlySurplus / monthlyIncome : -0.2;
    components.push({
      id: 'cashflow',
      label: 'Cash flow',
      weight: 15,
      score: scale(saved, -0.2, 0.3),
      detail: monthlyIncome > 0 ? `Saving ${formatPct(saved * 100)} of income (full marks at 30%+)` : 'Expenses recorded but no income',
    });
  }

  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const score = Math.round(components.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight);
  const [grade, color] =
    score >= 80 ? (['Excellent', '#34d399'] as const)
    : score >= 65 ? (['Good', '#38bdf8'] as const)
    : score >= 50 ? (['Fair', '#fbbf24'] as const)
    : (['Needs attention', '#ef4444'] as const);

  return { score, grade, color, components: components.map(c => ({ ...c, score: Math.round(c.score) })) };
}
