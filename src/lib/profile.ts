// Things a mutual-fund report cannot know: property, FDs, direct equity, loans, cash flow.
// Stored per client in localStorage; Priya Ramanathan's original hardcoded figures are kept as her default.

export const NW_CLASSES = ['Equity', 'Hybrid', 'Debt', 'Real Estate', 'Gold & Silver', 'Other'] as const;
export type NwClass = (typeof NW_CLASSES)[number];

export interface ProfileItem {
  id: string;
  label: string;
  amount: number;
  cls: NwClass; // only meaningful for assets
}

export interface Profile {
  assets: ProfileItem[];
  liabilities: ProfileItem[];
  monthlyExpenses: ProfileItem[];
  annualIncome: ProfileItem[];
}

export const emptyProfile = (): Profile => ({ assets: [], liabilities: [], monthlyExpenses: [], annualIncome: [] });

export const newItemId = () => Math.random().toString(36).slice(2, 10);

const item = (label: string, amount: number, cls: NwClass = 'Other'): ProfileItem => ({
  id: newItemId(),
  label,
  amount,
  cls,
});

const DEFAULTS_BY_CLIENT: Record<string, () => Profile> = {
  'priya ramanathan': () => ({
    assets: [
      item('Residential property', 25000000, 'Real Estate'),
      item('Gold', 2000000, 'Gold & Silver'),
      item('Fixed deposits', 6000000, 'Debt'),
      item('Direct equity', 15000000, 'Equity'),
      item('PMS', 7000000, 'Equity'),
      item('AIF', 13000000, 'Equity'),
    ],
    liabilities: [item('Pension premium remaining', 2000000)],
    monthlyExpenses: [item('Household', 100000), item('Medical', 100000)],
    annualIncome: [item('Pension receivable', 500000)],
  }),
};

const key = (clientId: string) => `nwt-profile:${clientId}`;

export function loadProfile(clientId: string): Profile {
  try {
    const raw = localStorage.getItem(key(clientId));
    if (raw) return { ...emptyProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    /* storage unavailable or corrupt — fall through to defaults */
  }
  return (DEFAULTS_BY_CLIENT[clientId.trim().toLowerCase()] ?? emptyProfile)();
}

export function saveProfile(clientId: string, profile: Profile): void {
  try {
    localStorage.setItem(key(clientId), JSON.stringify(profile));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export const sumItems = (items: ProfileItem[]) => items.reduce((a, b) => a + (Number.isFinite(b.amount) ? b.amount : 0), 0);
