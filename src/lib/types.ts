export interface Totals {
  purchase: number;
  invested: number; // purchase outstanding (cost of units still held)
  currentValue: number;
  realizedGain: number;
  unrealizedGain: number;
  dividendPayout: number;
  absReturn: number; // since inception, as reported
  xirr: number; // since inception, as reported
}

export interface Holding {
  scheme: string;
  folio: string;
  applicant: string;
  assetClass: string; // Equity | Hybrid | Debt | Commodity | ...
  category: string; // Flexi Cap, Gold, ...
  units: number;
  invested: number;
  currentValue: number;
  realizedGain: number;
  unrealizedGain: number;
  dividendPayout: number;
  absReturn: number;
  xirr: number;
}

export interface Applicant {
  name: string;
  totals: Totals | null;
}

export interface ClientReport {
  id: string; // the client name
  name: string;
  dob: string;
  asOf: string; // ISO yyyy-mm-dd, "" if not found
  fileName: string;
  applicants: Applicant[];
  holdings: Holding[];
  grandTotals: Totals | null;
}
