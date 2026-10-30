const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1.23 Cr / ₹4.56 L / ₹78,900 — with a leading minus for negatives. */
export function formatCurrency(val: number): string {
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${inr.format(abs)}`;
}

/** Exact rupees with Indian digit grouping, e.g. ₹1,15,408 */
export const formatRupees = (val: number): string => `${val < 0 ? '-' : ''}₹${inr.format(Math.abs(val))}`;

export const formatPct = (val: number, digits = 1): string => `${val.toFixed(digits)}%`;

export const formatSignedPct = (val: number, digits = 1): string => `${val > 0 ? '+' : ''}${val.toFixed(digits)}%`;

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ageOn(dobIso: string, asOfIso: string): number | null {
  if (!dobIso) return null;
  const dob = new Date(`${dobIso}T00:00:00`);
  const ref = asOfIso ? new Date(`${asOfIso}T00:00:00`) : new Date();
  if (Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    ref.getMonth() < dob.getMonth() || (ref.getMonth() === dob.getMonth() && ref.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age;
}
