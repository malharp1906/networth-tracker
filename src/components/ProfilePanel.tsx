import { Plus, Trash2, Wallet } from 'lucide-react';
import { NW_CLASSES, newItemId, sumItems, type NwClass, type Profile, type ProfileItem } from '../lib/profile';
import { formatCurrency } from '../lib/format';

type ListKey = keyof Profile;

const SECTIONS: { key: ListKey; title: string; hint: string; withClass?: boolean }[] = [
  { key: 'assets', title: 'Other assets', hint: 'Property, FDs, direct equity, PMS, AIF …', withClass: true },
  { key: 'liabilities', title: 'Liabilities', hint: 'Loans, commitments still to be paid' },
  { key: 'monthlyExpenses', title: 'Monthly expenses', hint: 'Per month' },
  { key: 'annualIncome', title: 'Annual income', hint: 'Pension, rent, salary … per year' },
];

export default function ProfilePanel({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const update = (key: ListKey, items: ProfileItem[]) => onChange({ ...profile, [key]: items });

  return (
    <div className="glass-panel panel">
      <h2><Wallet size={24} className="text-success" /> Beyond Mutual Funds</h2>
      <p className="muted small" style={{ marginBottom: '1rem' }}>
        Reports only cover mutual funds. Add everything else here — it's saved in this browser and feeds net worth, allocation and cash flow.
      </p>
      {SECTIONS.map(sec => {
        const items = profile[sec.key];
        return (
          <div key={sec.key} className="profile-section">
            <div className="profile-head">
              <span>{sec.title}</span>
              <span className="muted small">{items.length > 0 && formatCurrency(sumItems(items))}</span>
            </div>
            {items.map(it => (
              <div key={it.id} className="profile-row">
                <input
                  aria-label="Label"
                  value={it.label}
                  placeholder={sec.hint}
                  onChange={e => update(sec.key, items.map(x => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  aria-label="Amount in rupees"
                  type="number"
                  min={0}
                  className="amount"
                  value={it.amount || ''}
                  placeholder="₹"
                  onChange={e => update(sec.key, items.map(x => (x.id === it.id ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                />
                {sec.withClass && (
                  <select
                    aria-label="Asset class"
                    value={it.cls}
                    onChange={e => update(sec.key, items.map(x => (x.id === it.id ? { ...x, cls: e.target.value as NwClass } : x)))}
                  >
                    {NW_CLASSES.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
                <button className="icon-btn" aria-label="Remove" onClick={() => update(sec.key, items.filter(x => x.id !== it.id))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="add-btn"
              onClick={() => update(sec.key, [...items, { id: newItemId(), label: '', amount: 0, cls: 'Other' }])}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        );
      })}
    </div>
  );
}
