#!/usr/bin/env bash
# M0 baseline: captures numbers from a database in the pre-002 (v1.1.x) state
# into parity/baseline/ (gitignored: the output contains personal data and
# money). Run against a LOCAL copy only.
#
#   PSQL_CMD="docker compose exec -T db psql -U zas_sodniki_admin -d zas_sodniki" \
#     ./scripts/parity/m0-baseline.sh
#
# PSQL_CMD must run psql against the database (the default is the one above,
# in the current compose project).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
OUT="${OUT:-parity/baseline}"
mkdir -p "$OUT"
git check-ignore -q "$OUT/x" || { echo "parity/ is not gitignored" >&2; exit 1; }

PSQL_CMD="${PSQL_CMD:-docker compose exec -T db psql -U zas_sodniki_admin -d zas_sodniki}"
q() { # q <file> <sql>
  # shellcheck disable=SC2086
  $PSQL_CMD --no-psqlrc -v ON_ERROR_STOP=1 -c "COPY ($2) TO STDOUT WITH CSV HEADER" > "$OUT/$1.csv"
}

q row_counts "
  SELECT 'officials' t, count(*) FROM officials UNION ALL
  SELECT 'competitions', count(*) FROM competitions UNION ALL
  SELECT 'competition_officials', count(*) FROM competition_officials UNION ALL
  SELECT 'payments', count(*) FROM payments UNION ALL
  SELECT 'settings', count(*) FROM settings UNION ALL
  SELECT 'users', count(*) FROM users ORDER BY 1"

q payments "
  SELECT id, official_id, competition_id, status, amount::numeric(10,2) AS amount, znesek_sodnik, znesek_racun,
         date, date_paid, method,
         (SELECT count(*) FROM regexp_split_to_table(coalesce(remarks,''), E'\n') l WHERE btrim(l) <> '') AS remarks_lines,
         (SELECT count(*) FROM regexp_split_to_table(coalesce(remarks,''), E'\n') l WHERE l ~ '^(Delno plačilo|Plačano v celoti)') AS remarks_tx_lines
  FROM payments ORDER BY id"

q assignments "
  SELECT id, competition_id, official_id, role, discipline, hours, kilometers, znesek_sodnik, znesek_racun
  FROM competition_officials ORDER BY id"

# EXACTLY the old getDashboardStats semantics, for several years.
q dashboard "
  WITH years(y) AS (VALUES (2025),(2026),(extract(year FROM now())::int)),
  paid AS (
    SELECT y, coalesce(sum(p.znesek_sodnik),0) AS paid
    FROM years LEFT JOIN payments p ON p.status='paid' AND p.znesek_sodnik <> 0
      AND p.date_paid >= y||'-01-01' AND p.date_paid <= y||'-12-31'
    GROUP BY y),
  owed AS (SELECT coalesce(sum(amount),0)::numeric(12,2) AS owed FROM payments WHERE status='owed' AND znesek_sodnik <> 0)
  SELECT DISTINCT paid.y AS year,
         (SELECT count(*) FROM officials) AS total_officials,
         (SELECT count(*) FROM competitions WHERE status IN ('planned','completed')) AS active_competitions,
         paid.paid AS paid_payments, owed.owed AS owed_payments, paid.paid + owed.owed AS total_payments
  FROM paid, owed ORDER BY 1"

q owed_by_official "
  SELECT official_id, count(*) AS payments, sum(amount)::numeric(12,2) AS owed
  FROM payments WHERE status='owed' AND znesek_sodnik <> 0 GROUP BY official_id ORDER BY official_id"

q distincts "
  SELECT 'payments.status' facet, coalesce(status,'<null>') value, count(*) FROM payments GROUP BY 2 UNION ALL
  SELECT 'payments.method', coalesce(method,'<null>'), count(*) FROM payments GROUP BY 2 UNION ALL
  SELECT 'competitions.status', coalesce(status,'<null>'), count(*) FROM competitions GROUP BY 2 UNION ALL
  SELECT 'competitions.type', coalesce(type,'<null>'), count(*) FROM competitions GROUP BY 2 UNION ALL
  SELECT 'competitions.date format', regexp_replace(coalesce(date,'<null>'),'[0-9]','d','g'), count(*) FROM competitions GROUP BY 2 UNION ALL
  SELECT 'payments.date format', regexp_replace(coalesce(date,'<null>'),'[0-9]','d','g'), count(*) FROM payments GROUP BY 2 UNION ALL
  SELECT 'payments.date_paid format', regexp_replace(coalesce(date_paid,'<null>'),'[0-9]','d','g'), count(*) FROM payments GROUP BY 2 UNION ALL
  SELECT 'competition_officials.role', coalesce(role,'<null>'), count(*) FROM competition_officials GROUP BY 2 UNION ALL
  SELECT 'competition_officials.discipline', coalesce(discipline,'<null>'), count(*) FROM competition_officials GROUP BY 2 UNION ALL
  SELECT 'officials.active', coalesce(active::text,'<null>'), count(*) FROM officials GROUP BY 2
  ORDER BY 1,2"

q data_quality "
  SELECT 'duplicate (competition,official) assignments' check_name, count(*) n FROM (SELECT 1 FROM competition_officials GROUP BY competition_id, official_id HAVING count(*)>1) x UNION ALL
  SELECT 'assignments with NULL competition/official', count(*) FROM competition_officials WHERE competition_id IS NULL OR official_id IS NULL UNION ALL
  SELECT 'payments with NULL competition/official', count(*) FROM payments WHERE competition_id IS NULL OR official_id IS NULL UNION ALL
  SELECT 'orphan payments (no matching assignment)', count(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM competition_officials c WHERE c.competition_id=p.competition_id AND c.official_id=p.official_id) UNION ALL
  SELECT 'assignments without payment', count(*) FROM competition_officials c WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE c.competition_id=p.competition_id AND c.official_id=p.official_id) UNION ALL
  SELECT 'duplicate payments per (competition,official)', count(*) FROM (SELECT 1 FROM payments GROUP BY competition_id, official_id HAVING count(*)>1) x UNION ALL
  SELECT 'payments whose znesek differs from assignment', count(*) FROM payments p JOIN competition_officials c USING (competition_id, official_id) WHERE p.znesek_sodnik<>c.znesek_sodnik OR p.znesek_racun<>c.znesek_racun UNION ALL
  SELECT 'payments.date differs from competition date', count(*) FROM payments p JOIN competitions c ON c.id=p.competition_id WHERE p.date IS DISTINCT FROM c.date UNION ALL
  SELECT 'negative amounts', count(*) FROM payments WHERE amount<0 OR znesek_sodnik<0 OR znesek_racun<0 UNION ALL
  SELECT 'assignments with km>0', count(*) FROM competition_officials WHERE kilometers>0 UNION ALL
  SELECT 'assignments with km>0 in free/other_zas', count(*) FROM competition_officials c JOIN competitions k ON k.id=c.competition_id WHERE c.kilometers>0 AND k.status IN ('free','other_zas') UNION ALL
  SELECT 'assignments total below km*0.37', count(*) FROM competition_officials WHERE znesek_sodnik < round(kilometers::numeric*0.37,2) OR znesek_racun < round(kilometers::numeric*0.37,2) UNION ALL
  SELECT 'owed payments with partial remarks', count(*) FROM payments WHERE status='owed' AND remarks ~ 'Delno' UNION ALL
  SELECT 'paid payments with amount<>0', count(*) FROM payments WHERE status='paid' AND amount<>0 UNION ALL
  SELECT 'zero-amount payments', count(*) FROM payments WHERE znesek_sodnik=0 AND znesek_racun=0 UNION ALL
  SELECT 'planned competitions dated before 1901', count(*) FROM competitions WHERE status='planned' AND date < '1901-01-01'"

# Role JSON analysis: legacy hourlyRate, missing invoiceRates, overlapping tiers.
q roles_analysis "
  WITH r AS (SELECT (e->>'id')::int id, e->>'name' AS name, e FROM settings s, jsonb_array_elements(s.value) e WHERE s.key='official_roles'),
  t AS (SELECT r.id, k AS kind, ord, (x->>'from')::numeric f, (x->>'to')::numeric t FROM r,
        LATERAL (VALUES ('rates'),('invoiceRates')) AS kinds(k),
        LATERAL jsonb_array_elements(coalesce(r.e->k,'[]'::jsonb)) WITH ORDINALITY AS a(x,ord))
  SELECT r.id, r.name, (r.e ? 'hourlyRate') AS has_hourly_rate, (r.e->>'hourlyRate') AS hourly_rate,
         jsonb_array_length(coalesce(r.e->'rates','[]')) AS n_rates,
         jsonb_array_length(coalesce(r.e->'invoiceRates','[]')) AS n_invoice_rates,
         (SELECT count(*) FROM t a JOIN t b ON a.id=b.id AND a.kind=b.kind AND a.ord<b.ord AND a.f < b.t AND b.f < a.t WHERE a.id=r.id) AS overlapping_pairs,
         (SELECT count(*) FROM competition_officials c WHERE c.role=r.name) AS used_by_assignments
  FROM r ORDER BY r.id"

q settings_official_roles "SELECT jsonb_pretty(value) AS official_roles_json FROM settings WHERE key='official_roles'"
q settings_app_settings   "SELECT jsonb_pretty(value) AS app_settings_json FROM settings WHERE key='app_settings'"

q unknown_names "
  SELECT 'role not in official_roles' kind, role AS name, count(*) FROM competition_officials c
   WHERE role NOT IN (SELECT e->>'name' FROM settings s, jsonb_array_elements(s.value) e WHERE s.key='official_roles') GROUP BY role UNION ALL
  SELECT 'discipline not in settings list', discipline, count(*) FROM competition_officials c
   WHERE coalesce(discipline,'') <> '' AND discipline NOT IN (SELECT jsonb_array_elements_text(value->'disciplines') FROM settings WHERE key='app_settings') GROUP BY discipline"

echo "Baseline written to $OUT:"
ls -1 "$OUT"
