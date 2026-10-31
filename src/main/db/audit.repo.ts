// Read-only access to the audit log. Only administrators can SELECT from
// audit_log (grant-api.sql); entries are written by the database itself.
import { parseIsoDate } from '@shared/dates';
import type { AuditQuery } from '@shared/schemas';
import type { AuditEntry } from '@shared/types';
import { db, unwrap } from './client';
import { text, type Row } from './rows';

/** Filter group -> the audit_log.entity values behind it. */
const ENTITIES: Record<NonNullable<AuditQuery['entity']>, string[]> = {
  official: ['official'],
  competition: ['competition'],
  assignment: ['assignment'],
  payment: ['payment', 'payment_transaction'],
  role: ['role'],
  discipline: ['discipline'],
  config: ['config', 'system'],
  user: ['user'],
  auth: ['auth'],
};

/** Local midnight of an ISO calendar day (plus an offset in days) as an ISO instant. */
function localMidnight(iso: string, plusDays = 0): string | null {
  const d = parseIsoDate(iso);
  return d ? new Date(d.year, d.month - 1, d.day + plusDays).toISOString() : null;
}

/** A LIKE pattern for PostgREST's quoted or() syntax: `*` is its wildcard, `\` and `"` are dropped. */
function likePattern(search: string): string {
  // Inside the quotes a backslash escapes the next character, so LIKE's own
  // escape (backslash before % or _) needs two of them to reach the database.
  const bs = String.fromCharCode(92);
  const s = search.replace(/[\\"*]/g, '').replace(/[%_]/g, (c) => bs + bs + c);
  return `*${s}*`;
}

function changesOf(v: unknown): AuditEntry['changes'] {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, [string | null, string | null]> = {};
  for (const [label, pair] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(pair)) continue;
    const show = (x: unknown) => (x == null ? null : String(x));
    out[label] = [show(pair[0]), show(pair[1])];
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function listAudit(q: AuditQuery): Promise<{ rows: AuditEntry[]; total: number }> {
  let req = db.rest
    .from('audit_log')
    .select('id, at, user_id, username, action, entity, entity_id, summary, changes', { count: 'exact' });

  const from = q.from ? localMidnight(q.from) : null;
  const before = q.to ? localMidnight(q.to, 1) : null;
  if (from) req = req.gte('at', from);
  if (before) req = req.lt('at', before);
  if (q.userId) req = req.eq('user_id', q.userId);
  if (q.entity) req = req.in('entity', ENTITIES[q.entity]);
  if (q.search) {
    const p = likePattern(q.search);
    req = req.or(`summary.ilike."${p}",username.ilike."${p}"`);
  }

  const res = await req
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  const rows = unwrap(res) as Row[];
  return {
    rows: rows.map((r) => ({
      id: Number(r.id),
      at: text(r.at),
      user_id: r.user_id == null ? null : Number(r.user_id),
      username: text(r.username),
      action: text(r.action),
      entity: text(r.entity),
      entity_id: r.entity_id == null ? null : Number(r.entity_id),
      summary: text(r.summary),
      changes: changesOf(r.changes),
    })),
    total: res.count ?? rows.length,
  };
}
