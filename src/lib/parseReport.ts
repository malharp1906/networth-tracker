import * as XLSX from 'xlsx';
import type { Applicant, ClientReport, Holding, Totals } from './types.ts';

type Row = unknown[];

// PANs are stripped from names and never stored.
const PAN_RE = /\(([A-Z]{5}\d{4}[A-Z])\)\s*$/;

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[, ₹]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

// Header label (lower-cased) -> field. Columns are located by name, so reordering is safe.
const COLUMNS: Record<string, string> = {
  'scheme name': 'scheme',
  'folio no': 'folio',
  'purchase': 'purchase',
  'balance units': 'units',
  'purchase outstanding': 'invested',
  'current value': 'currentValue',
  'dividend payout': 'dividendPayout',
  'realized gain': 'realizedGain',
  'unrealized gain': 'unrealizedGain',
  'absolute return %': 'absReturn',
  'xirr return %': 'xirr',
};

const REQUIRED = ['scheme', 'currentValue'];

function findHeader(rows: Row[]): { index: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cols: Record<string, number> = {};
    rows[i].forEach((cell, c) => {
      const field = COLUMNS[str(cell).toLowerCase()];
      if (field) cols[field] = c;
    });
    if (REQUIRED.every(f => f in cols)) return { index: i, cols };
  }
  return null;
}

// "03-08-2026" -> "2026-08-03"
const isoDate = (dmy: string): string => {
  const m = dmy.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};

export function parseReport(buffer: ArrayBuffer, fileName: string): ClientReport {
  const wb = XLSX.read(buffer, { type: 'array' });

  let rows: Row[] = [];
  let header: ReturnType<typeof findHeader> = null;
  for (const name of wb.SheetNames) {
    const candidate = XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { header: 1, defval: null });
    header = findHeader(candidate);
    if (header) {
      rows = candidate;
      break;
    }
  }
  if (!header) {
    throw new Error('No portfolio table found (expected a header row with "SCHEME NAME" and "CURRENT VALUE").');
  }
  const { cols } = header;
  const cell = (r: Row, field: string) => (field in cols ? r[cols[field]] : null);

  let clientName = '';
  let dob = '';
  let asOf = '';

  const applicants: Applicant[] = [];
  const holdings: Holding[] = [];
  let grandTotals: Totals | null = null;
  const currentApplicant = (): Applicant | undefined => applicants[applicants.length - 1];
  let assetClass = '';
  let category = '';

  const totalsOf = (r: Row): Totals => ({
    purchase: num(cell(r, 'purchase')),
    invested: num(cell(r, 'invested')),
    currentValue: num(cell(r, 'currentValue')),
    realizedGain: num(cell(r, 'realizedGain')),
    unrealizedGain: num(cell(r, 'unrealizedGain')),
    dividendPayout: num(cell(r, 'dividendPayout')),
    absReturn: num(cell(r, 'absReturn')),
    xirr: num(cell(r, 'xirr')),
  });

  const startApplicant = (label: string) => {
    applicants.push({ name: label.replace(PAN_RE, '').trim(), totals: null });
  };

  // Rows above the table: client / date metadata
  for (let i = 0; i < header.index; i++) {
    const a = str(rows[i][0]);
    const rest = rows[i].map(str).join(' ');
    const client = a.match(/^Client:\s*(.+)$/i);
    if (client) {
      clientName = client[1].replace(PAN_RE, '').trim();
    }
    const d = rest.match(/DOB:\s*(\d{1,2}-\d{1,2}-\d{4})/i);
    if (d) dob = isoDate(d[1]);
    const t = a.match(/till\s+(\d{1,2}-\d{1,2}-\d{4})/i);
    if (t) asOf = isoDate(t[1]);
  }

  for (let i = header.index + 1; i < rows.length; i++) {
    const r = rows[i];
    const label = str(r[0]);
    if (!label) continue;

    const hasData = Object.keys(cols).some(f => f !== 'scheme' && f !== 'folio' && r[cols[f]] != null && r[cols[f]] !== '');

    if (/^grand total$/i.test(label)) {
      grandTotals = totalsOf(r);
      continue;
    }
    if (/^applicant total$/i.test(label)) {
      const a = currentApplicant();
      if (a) a.totals = totalsOf(r);
      continue;
    }
    if (/total$/i.test(label)) continue; // category subtotal

    if (!hasData) {
      // Label-only row: applicant heading or "Class: Category" heading
      const cat = label.match(/^([^:()]+):\s*(.+)$/);
      if (cat && !PAN_RE.test(label)) {
        assetClass = cat[1].trim();
        category = cat[2].trim();
      } else {
        startApplicant(label);
      }
      continue;
    }

    if (!currentApplicant()) startApplicant(clientName || 'Unknown');
    holdings.push({
      scheme: label,
      folio: str(cell(r, 'folio')),
      applicant: currentApplicant()!.name,
      assetClass: assetClass || 'Other',
      category: category || 'Uncategorised',
      units: num(cell(r, 'units')),
      invested: num(cell(r, 'invested')),
      currentValue: num(cell(r, 'currentValue')),
      realizedGain: num(cell(r, 'realizedGain')),
      unrealizedGain: num(cell(r, 'unrealizedGain')),
      dividendPayout: num(cell(r, 'dividendPayout')),
      absReturn: num(cell(r, 'absReturn')),
      xirr: num(cell(r, 'xirr')),
    });
  }

  if (holdings.length === 0) throw new Error('The table was found but contains no holdings.');

  if (!clientName) clientName = applicants[0]?.name ?? fileName.replace(/\.[^.]+$/, '');

  return {
    id: clientName,
    name: clientName,
    dob,
    asOf,
    fileName,
    applicants,
    holdings,
    grandTotals,
  };
}
