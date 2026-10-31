// Data shapes that cross the IPC boundary. Money is always integer cents
// (`*_cents`); calendar dates are "YYYY-MM-DD" strings.

import type { CompetitionStatus, Tariff, Tier } from './tariff';

export type PaymentMethod = 'gotovina' | 'nakazilo' | 'drugo';
/** owed = nothing paid, partial = some paid, paid = nothing remaining. */
export type PaymentStatus = 'owed' | 'partial' | 'paid';

export type Official = {
  id: number;
  name: string;
  email: string;
  phone: string;
  rank: string;
  additional_exams: string;
  notes: string;
  active: boolean;
};

export type Competition = {
  id: number;
  name: string;
  date: string;
  location: string;
  status: CompetitionStatus;
  notes: string;
};

export type PaymentSummary = {
  id: number;
  tariff: Tariff;
  amount_due_cents: number;
  paid_cents: number;
  remaining_cents: number;
  status: PaymentStatus;
};

export type Assignment = {
  id: number;
  competition_id: number;
  official_id: number;
  official_name: string;
  official_rank: string;
  role_id: number;
  role_name: string;
  role_archived: boolean;
  discipline_id: number | null;
  discipline_name: string | null;
  hours: number;
  kilometers: number;
  notes: string;
  /** EUR per km frozen on the assignment. */
  travel_rate: number;
  base_sodnik_cents: number;
  base_racun_cents: number;
  travel_cents: number;
  total_sodnik_cents: number;
  total_racun_cents: number;
  payment: PaymentSummary | null;
};

export type AssignmentAmounts = {
  travel_rate: number;
  base_sodnik_cents: number;
  base_racun_cents: number;
  travel_cents: number;
  total_sodnik_cents: number;
  total_racun_cents: number;
};

/** One row of an official's history: an assignment with its payment status. */
export type OfficialHistoryRow = {
  assignment_id: number;
  competition_id: number;
  competition_name: string;
  competition_date: string;
  competition_status: CompetitionStatus;
  role_name: string;
  discipline_name: string | null;
  hours: number;
  kilometers: number;
  total_sodnik_cents: number;
  total_racun_cents: number;
  payment: PaymentSummary | null;
};

export type Role = {
  id: number;
  name: string;
  archived: boolean;
  position: number;
  /** Sodnik tariff tiers. */
  rates: Tier[];
  /** Račun tariff tiers. */
  invoiceRates: Tier[];
};

export type Discipline = { id: number; name: string; archived: boolean; position: number };

export type UsageItem = {
  assignment_id: number;
  competition_id: number;
  competition_name: string;
  official_id: number;
  official_name: string;
};
export type Usage = { count: number; items: UsageItem[] };

export type AppConfig = {
  travel_cost_per_km: number;
  default_payment_method: PaymentMethod;
  min_client_version: string | null;
};

export type PaymentRow = {
  id: number;
  assignment_id: number | null;
  official_id: number;
  official_name: string;
  competition_id: number;
  competition_name: string;
  competition_date: string;
  competition_status: CompetitionStatus;
  tariff: Tariff;
  amount_due_cents: number;
  paid_cents: number;
  remaining_cents: number;
  status: PaymentStatus;
  last_paid_on: string | null;
  installments: number;
  notes: string;
};

export type PaymentTransaction = {
  id: number;
  payment_id: number;
  amount_cents: number;
  paid_on: string;
  method: PaymentMethod;
  note: string;
  /** app = recorded in v2, remarks = parsed from v1 text, inferred = reconstructed by the migration. */
  source: 'app' | 'remarks' | 'inferred';
};

export type PaymentDetail = PaymentRow & {
  legacy_remarks: string;
  transactions: PaymentTransaction[];
};

export type GenerateResult = {
  created: number;
  skipped_existing: number;
  skipped_zero: number;
  payment_ids: number[];
};

export type DashboardStats = {
  year: number;
  total_officials: number;
  active_competitions: number;
  paid_cents: number;
  owed_cents: number;
  total_cents: number;
};

export type OwedByOfficial = {
  official_id: number;
  official_name: string;
  payments: number;
  owed_cents: number;
};

export type UserRow = {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'user' | (string & {});
  created_at: string;
};

export type AuditAction = 'insert' | 'update' | 'delete' | 'login' | 'login_failed' | 'generate' | 'clear_all';

/** One line of the audit log (Dnevnik). summary and changes are plain text, never HTML. */
export type AuditEntry = {
  id: number;
  at: string;
  user_id: number | null;
  username: string;
  action: AuditAction | (string & {});
  entity: string;
  entity_id: number | null;
  summary: string;
  /** Field label -> [before, after] as display text; null when the entry has no field diff. */
  changes: Record<string, [string | null, string | null]> | null;
};

export type CompetitionSummaryRow = {
  id: number;
  name: string;
  date: string;
  location: string;
  officials_cents: number;
  travel_cents: number;
  total_cents: number;
};

// --- Officials import -------------------------------------------------------

export type ImportCandidate = {
  /** 1-based row number in the sheet, for messages. */
  row: number;
  name: string;
  email: string;
  phone: string;
  rank: string;
  additional_exams: string;
};

export type ImportPreview = {
  fileName: string;
  toInsert: ImportCandidate[];
  skippedDuplicates: { row: number; name: string; reason: 'database' | 'file' }[];
  errors: { row: number; message: string }[];
};

export type SaveFileResult = { saved: false } | { saved: true; filePath: string };
