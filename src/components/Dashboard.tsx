import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  AlertCircle, AlertTriangle, Info, TrendingUp, TrendingDown, Target, Database, ChevronDown, ChevronRight,
  ArrowUpDown, Globe, BarChart3, DollarSign,
} from 'lucide-react';
import type { Holding, Totals } from '../lib/types';
import { buildAlerts, computeHealthScore, computeNetWorth, summarize, type Slice } from '../lib/analytics';
import { formatCurrency, formatPct, formatRupees, formatSignedPct } from '../lib/format';
import type { Profile } from '../lib/profile';
import ProfilePanel from './ProfilePanel';

interface Props {
  holdings: Holding[];
  reported: Totals | null; // the report's own total for this scope, when one exists
  reportedLabel: string; // e.g. "Since inception, as reported"
  profile: Profile | null; // null = net-worth extras not applicable to this scope
  onProfileChange: (p: Profile) => void;
}

const tooltipStyle = { backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' };
const gainClass = (v: number) => (v > 0 ? 'positive' : v < 0 ? 'negative' : '');

function AllocationPie({ slices, height = 240 }: { slices: Slice[]; height?: number }) {
  return (
    <div className="split">
      <div className="chart-container" style={{ height, marginTop: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
              {slices.map(s => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <RechartsTooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#f8fafc' }}
              formatter={(val: number, name: string) => [`${formatCurrency(val)} (${formatPct(slices.find(s => s.name === name)?.pct ?? 0)})`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="allocation-list" style={{ marginTop: 0 }}>
        {slices.map(s => (
          <div key={s.name} className="allocation-item">
            <div className="allocation-label">
              <div className="color-dot" style={{ backgroundColor: s.color }} />
              <span>{s.name}</span>
            </div>
            <span className="allocation-value">
              {formatCurrency(s.value)} <span className="muted">{formatPct(s.pct)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SortKey = 'scheme' | 'category' | 'invested' | 'currentValue' | 'unrealizedGain' | 'gainPct' | 'xirr';

export default function Dashboard({ holdings, reported, reportedLabel, profile, onProfileChange }: Props) {
  const s = useMemo(() => summarize(holdings), [holdings]);
  // Mutual funds always count as assets; anything in the profile is added on top.
  const nw = useMemo(() => (profile ? computeNetWorth(s, profile) : null), [s, profile]);
  const health = useMemo(() => computeHealthScore(s, reported, nw), [s, reported, nw]);
  const alerts = useMemo(() => buildAlerts(s, reported, nw), [s, reported, nw]);

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'currentValue', dir: -1 });

  const toggle = (k: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const gainPct = (h: Holding) => (h.invested > 0 ? (h.unrealizedGain / h.invested) * 100 : 0);
  const rows = useMemo(() => {
    const val = (h: Holding): string | number =>
      sort.key === 'gainPct' ? gainPct(h) : (h[sort.key as keyof Holding] as string | number);
    return [...s.live].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  }, [s.live, sort]);

  const setSortKey = (key: SortKey) =>
    setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 1 ? -1 : 1) : key === 'scheme' || key === 'category' ? 1 : -1 }));

  const allocation = nw ? nw.allocation : s.byAssetClass;
  const classOrder = s.byAssetClass.map(c => c.name);
  const groupsByClass = classOrder.map(cls => ({
    cls,
    color: s.byAssetClass.find(c => c.name === cls)!.color,
    value: s.byAssetClass.find(c => c.name === cls)!.value,
    pct: s.byAssetClass.find(c => c.name === cls)!.pct,
    groups: s.groups.filter(g => g.assetClass === cls),
  }));

  const Th = ({ k, children, num }: { k: SortKey; children: string; num?: boolean }) => (
    <th className={num ? 'num' : ''} onClick={() => setSortKey(k)}>
      <span className="th-inner">{children} <ArrowUpDown size={12} className={sort.key === k ? 'active' : ''} /></span>
    </th>
  );

  return (
    <>
      {health && (
        <div className="glass-panel panel health-panel">
          <div className="health-score" style={{ borderColor: health.color }}>
            <span className="health-number" style={{ color: health.color }}>{health.score}</span>
            <span className="muted small">out of 100</span>
          </div>
          <div className="health-body">
            <h2>Financial Health: <span style={{ color: health.color }}>{health.grade}</span></h2>
            <div className="health-bars">
              {health.components.map(c => (
                <div key={c.id} className="health-row" title={c.detail}>
                  <span className="health-label">{c.label}</span>
                  <div className="health-track"><div className="health-fill" style={{ width: `${c.score}%`, background: c.score >= 65 ? 'var(--success)' : c.score >= 40 ? 'var(--warning)' : 'var(--danger)' }} /></div>
                  <span className="health-val">{c.score}</span>
                  <span className="muted small health-detail">{c.detail}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Weighted average of the measures above; anything that can't be measured (e.g. cash flow before income is entered) is left out. A guide, not advice.</p>
          </div>
        </div>
      )}

      {nw && (
        <div className="grid-top">
          <div className="glass-panel metric-card">
            <div className="metric-title">Net Worth</div>
            <div className="metric-value text-gradient">{formatCurrency(nw.netWorth)}</div>
            <div className="metric-sub neutral">Assets {formatCurrency(nw.totalAssets)}</div>
          </div>
          <div className="glass-panel metric-card">
            <div className="metric-title">Liabilities</div>
            <div className="metric-value">{formatCurrency(nw.totalLiabilities)}</div>
            <div className="metric-sub neutral">Debt-to-net-worth {formatPct(nw.debtToNetWorth)}</div>
          </div>
          <div className="glass-panel metric-card">
            <div className="metric-title">Monthly Cash-flow Surplus</div>
            <div className="metric-value">{formatCurrency(nw.monthlySurplus)}</div>
            <div className={`metric-sub ${nw.monthlySurplus >= 0 ? 'positive' : 'negative'}`}>
              {nw.monthlySurplus >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {nw.monthlySurplus >= 0 ? 'Income covers expenses' : 'Expenses exceed income'}
            </div>
          </div>
        </div>
      )}

      <div className="grid-top">
        <div className="glass-panel metric-card">
          <div className="metric-title">Mutual Fund Portfolio</div>
          <div className="metric-value text-gradient">{formatCurrency(s.netValue)}</div>
          <div className="metric-sub neutral">{s.live.length} active schemes</div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-title">Invested (Cost)</div>
          <div className="metric-value">{formatCurrency(s.invested)}</div>
          <div className={`metric-sub ${gainClass(s.unrealizedGain)}`}>
            {s.unrealizedGain >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {formatCurrency(s.unrealizedGain)} unrealised ({formatSignedPct(s.unrealizedPct)})
          </div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-title">XIRR</div>
          <div className={`metric-value ${reported ? gainClass(reported.xirr) : ''}`}>{reported ? formatPct(reported.xirr, 2) : '—'}</div>
          <div className="metric-sub neutral">
            {reported ? `Abs. return ${formatPct(reported.absReturn, 2)} · ${reportedLabel}` : 'Not available for a combined view'}
          </div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-title">Realised Gains</div>
          <div className={`metric-value ${gainClass(s.realizedGain)}`}>{formatCurrency(s.realizedGain)}</div>
          <div className="metric-sub neutral">Dividends paid out {formatCurrency(s.dividends)}</div>
        </div>
      </div>

      <div className="grid-main">
        <div className="col">
          <div className="glass-panel panel">
            <h2><Target size={24} className="text-accent" /> {nw ? 'Asset Allocation (all assets)' : 'Asset Allocation (mutual funds)'}</h2>
            {allocation.length > 0 ? <AllocationPie slices={allocation} /> : <p className="muted">No active holdings.</p>}
          </div>

          {s.geography && s.geography.length > 1 && (
            <div className="glass-panel panel">
              <h2><Globe size={24} className="text-accent" /> Equity: India vs Foreign</h2>
              <AllocationPie slices={s.geography} height={200} />
            </div>
          )}

          <div className="glass-panel panel mf-breakdown-section">
            <h2><Database size={24} className="text-accent" /> Holdings by Category</h2>
            {groupsByClass.map(({ cls, color, value, pct, groups }) => (
              <div key={cls}>
                <h3 className="class-heading">
                  <span className="color-dot" style={{ backgroundColor: color }} /> {cls}
                  <span className="muted"> · {formatCurrency(value)} · {formatPct(pct)}</span>
                </h3>
                <div className="mf-category-list">
                  {groups.map(g => {
                    const k = `${g.assetClass}|${g.category}`;
                    const isOpen = open.has(k);
                    return (
                      <div key={k} className="mf-category-row">
                        <div className="mf-category-header" onClick={() => toggle(k)}>
                          <div className="mf-category-title">
                            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            {g.category}
                            <span className="muted small">({g.holdings.length})</span>
                          </div>
                          <div className="mf-category-value">
                            <span style={{ fontWeight: 600 }}>{formatCurrency(g.value)}</span>
                            <span className="muted pct-col">{formatPct(g.pct)}</span>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="mf-schemes-list">
                            {g.holdings.map(h => (
                              <div key={h.folio + h.scheme + h.applicant} className="mf-scheme-row">
                                <span className="scheme-name" title={h.scheme}>{h.scheme}</span>
                                <span className={`scheme-gain ${gainClass(h.unrealizedGain)}`}>{formatSignedPct(gainPct(h))}</span>
                                <span className="scheme-value">{formatCurrency(h.currentValue)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {s.anomalies.length > 0 && (
              <div>
                <h3 className="class-heading warn"><Info size={16} /> Source-data anomalies <span className="muted"> · not counted in percentages</span></h3>
                <div className="mf-category-list">
                  {s.anomalies.map(h => (
                    <div key={h.folio + h.scheme + h.applicant} className="mf-category-row" style={{ opacity: 0.85 }}>
                      <div className="mf-category-header" style={{ cursor: 'default' }}>
                        <div className="mf-category-title scheme-name" title="The statement shows negative units/value — typically a fully redeemed position where recorded redemption exceeds recorded cost. Kept for fidelity with the report; not a live negative holding.">
                          {h.scheme} <span className="muted small">({h.assetClass}: {h.category})</span>
                        </div>
                        <div className="mf-category-value">
                          <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatRupees(h.currentValue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel panel">
            <h2><BarChart3 size={24} className="text-accent" /> Top 10 Holdings</h2>
            <div className="chart-container" style={{ height: Math.max(180, s.top.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.top} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" tickFormatter={v => formatCurrency(v)} />
                  <YAxis type="category" dataKey="scheme" width={260} stroke="#94a3b8" tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 40 ? v.slice(0, 39) + '…' : v)} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={tooltipStyle}
                    formatter={(val: number, _n: string, p) => [`${formatCurrency(val)} (${formatPct((p.payload as { pct: number }).pct)})`, 'Value']}
                  />
                  <Bar dataKey="currentValue" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel panel">
            <h2><DollarSign size={24} className="text-accent" /> All Active Holdings</h2>
            <div className="table-wrap">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <Th k="scheme">Scheme</Th>
                    <Th k="category">Category</Th>
                    <Th k="invested" num>Cost</Th>
                    <Th k="currentValue" num>Value</Th>
                    <Th k="gainPct" num>Gain</Th>
                    <Th k="xirr" num>XIRR</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(h => (
                    <tr key={h.folio + h.scheme + h.applicant}>
                      <td className="scheme-cell" title={h.scheme}>{h.scheme}</td>
                      <td className="muted">{h.category}</td>
                      <td className="num">{formatCurrency(h.invested)}</td>
                      <td className="num">{formatCurrency(h.currentValue)}</td>
                      <td className={`num ${gainClass(h.unrealizedGain)}`}>{formatSignedPct(gainPct(h))}</td>
                      <td className={`num ${gainClass(h.xirr)}`}>{formatPct(h.xirr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="glass-panel panel">
            <h2><AlertTriangle size={24} style={{ color: 'var(--warning)' }} /> Smart Alerts</h2>
            <div className="alert-list">
              {alerts.length === 0 && <p className="muted">Nothing to flag against the current rules.</p>}
              {alerts.map((a, i) => (
                <div key={a.id} className={`alert-item ${a.type}`} style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="alert-icon">{a.type === 'danger' ? <AlertCircle /> : a.type === 'warning' ? <AlertTriangle /> : <Info />}</div>
                  <div className="alert-content">
                    <h4>{a.title}</h4>
                    <p>{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {profile && <ProfilePanel profile={profile} onChange={onProfileChange} />}
        </div>
      </div>
    </>
  );
}
