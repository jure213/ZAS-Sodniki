-- 002_report.sql: review report for migration 002 (READ ONLY).
--
--   docker compose exec -T db psql --no-psqlrc -U zas_sodniki_admin -d zas_sodniki \
--     < deploy/sql/reports/002_report.sql > parity/reports/002_report.txt
--
-- Lists everything the migration decided on its own, and compares the numbers
-- the v1 app showed (computed from the snapshots in private.m002_*) with what
-- v2 shows now. The output contains ids and names: keep it local.
\set ON_ERROR_STOP on
\pset null '-'
\pset footer off
BEGIN READ ONLY;

\echo
\echo '=== 1. Flags by category (what the migration decided) ==='
SELECT category, count(*) AS n, count(DISTINCT entity_id) AS distinct_entities,
       CASE WHEN count(DISTINCT entity_id) > 60 THEN left(string_agg(DISTINCT entity_id::text, ','), 240) || ' ...'
            ELSE string_agg(DISTINCT entity_id::text, ',') END AS ids
FROM private.m002_flags GROUP BY category ORDER BY category;

\echo
\echo '=== 2. Archived roles / disciplines created from names found only in assignments ==='
SELECT 'role' AS kind, r.id, r.name,
       (SELECT count(*) FROM public.competition_officials a WHERE a.role_id = r.id) AS used_by
FROM public.roles r WHERE r.archived
UNION ALL
SELECT 'discipline', d.id, d.name,
       (SELECT count(*) FROM public.competition_officials a WHERE a.discipline_id = d.id)
FROM public.disciplines d WHERE d.archived
ORDER BY 1, 2;

\echo
\echo '=== 3. Roles and tiers ==='
SELECT r.id, r.name, r.archived,
       (SELECT count(*) FROM public.role_rates x WHERE x.role_id = r.id AND x.tariff = 'sodnik') AS sodnik_tiers,
       (SELECT count(*) FROM public.role_rates x WHERE x.role_id = r.id AND x.tariff = 'racun') AS racun_tiers,
       (SELECT count(*) FROM private.m002_flags f WHERE f.entity = 'role' AND f.entity_id = r.id AND f.category = 'overlapping_tiers') AS overlapping_tariffs
FROM public.roles r ORDER BY r.position, r.id;

\echo
\echo '=== 4. Payments after migration ==='
SELECT b.status, count(*) AS payments, sum(b.amount_due) AS amount_due,
       sum(b.paid_total) AS paid, sum(b.remaining) AS remaining
FROM public.payment_balances b GROUP BY b.status ORDER BY b.status;
SELECT t.source, count(*) AS transactions, sum(t.amount) AS amount, min(t.paid_on) AS first, max(t.paid_on) AS last
FROM public.payment_transactions t GROUP BY t.source ORDER BY t.source;

\echo
\echo '=== 5. Orphan payments (no assignment for the same competition + official) ==='
SELECT b.id AS payment_id, b.competition_id, b.official_id, b.competition_name, b.official_name,
       b.amount_due, b.paid_total, b.remaining
FROM public.payment_balances b WHERE b.assignment_id IS NULL ORDER BY b.id;

\echo
\echo '=== 6. Assignments WITHOUT a payment, in competitions that have payments ==='
SELECT a.id AS assignment_id, a.competition_id, a.competition_name, a.official_id, a.official_name,
       a.competition_status, a.znesek_sodnik, a.znesek_racun
FROM public.assignment_details a
WHERE a.payment_id IS NULL
  AND EXISTS (SELECT 1 FROM public.payments p WHERE p.competition_id = a.competition_id)
ORDER BY a.competition_id, a.id;

\echo
\echo '=== 7. Assignment amounts that need a look ==='
SELECT 'racun total is 0 although sodnik total > 0 (invoice amounts never entered)' AS what, count(*) AS n
FROM public.competition_officials WHERE znesek_racun = 0 AND znesek_sodnik > 0
UNION ALL
SELECT 'negative base (total below the travel amount at the current rate)', count(*)
FROM public.competition_officials WHERE base_sodnik < 0 OR base_racun < 0
UNION ALL
SELECT 'free/other_zas with km > 0 (travel_rate zeroed)', count(*)
FROM private.m002_flags WHERE category = 'free_travel_zeroed'
UNION ALL
SELECT 'sodnik base differs from the role tier (manual override)', count(*)
FROM private.m002_flags WHERE category = 'base_differs_from_tier' AND detail LIKE 'sodnik:%'
UNION ALL
SELECT 'racun base differs from the role tier', count(*)
FROM private.m002_flags WHERE category = 'base_differs_from_tier' AND detail LIKE 'racun:%';

SELECT a.id AS assignment_id, a.competition_id, a.official_id, a.hours, a.kilometers,
       a.base_sodnik, a.base_racun, a.travel_amount
FROM public.competition_officials a
WHERE a.base_sodnik < 0 OR a.base_racun < 0 ORDER BY a.id;

\echo
\echo '=== 8. Overlapping tiers (they are migrated as they were; first tier by position wins) ==='
SELECT f.entity_id AS role_id, f.detail AS tariff FROM private.m002_flags f
WHERE f.category = 'overlapping_tiers' ORDER BY 1, 2;

\echo
\echo '=== 9. Dashboard: v1 (from snapshots) vs v2 (dashboard_stats) ==='
\echo 'v1 counted only payments marked paid (at their full znesek_sodnik) in the year of date_paid and ignored'
\echo 'installments of payments that are still owed; v2 sums every installment by its own date.'
WITH years AS (
  SELECT extract(year FROM current_date)::int AS y
  UNION SELECT extract(year FROM private.m002_to_date(date_paid))::int
  FROM private.m002_payments WHERE status = 'paid' AND date_paid IS NOT NULL
), old AS (
  SELECT y.y,
         coalesce((SELECT sum(s.znesek_sodnik) FROM private.m002_payments s
                   WHERE s.status = 'paid' AND s.znesek_sodnik <> 0
                     AND s.date_paid >= y.y || '-01-01' AND s.date_paid <= y.y || '-12-31'), 0) AS paid,
         coalesce((SELECT sum(round(s.amount::numeric, 2)) FROM private.m002_payments s
                   WHERE s.status = 'owed' AND s.znesek_sodnik <> 0), 0) AS owed
  FROM years y
), new AS (
  SELECT y.y, public.dashboard_stats(y.y) AS j,
         coalesce((SELECT sum(t.amount) FROM public.payment_transactions t
                   JOIN public.payment_balances b ON b.id = t.payment_id
                   WHERE b.remaining > 0 AND extract(year FROM t.paid_on) = y.y), 0) AS on_unsettled
  FROM years y
)
SELECT old.y AS year,
       old.paid AS paid_v1, (new.j ->> 'paid_payments')::numeric AS paid_v2,
       new.on_unsettled AS v2_on_unsettled_payments,
       old.owed AS owed_v1, (new.j ->> 'owed_payments')::numeric AS owed_v2,
       CASE WHEN old.owed = (new.j ->> 'owed_payments')::numeric
             AND old.paid = (new.j ->> 'paid_payments')::numeric - new.on_unsettled
            THEN 'as expected' ELSE 'DIFFERENT' END AS verdict
FROM old JOIN new USING (y) ORDER BY 1;
SELECT (j ->> 'total_officials')::int AS officials, (j ->> 'active_competitions')::int AS active_competitions
FROM (SELECT public.dashboard_stats() AS j) x;

\echo '=== 10. Owed per official: v1 (snapshot) vs v2 (payment_balances); differing rows must be 0 ==='
WITH old AS (
  SELECT s.official_id, sum(round(s.amount::numeric, 2)) AS owed
  FROM private.m002_payments s WHERE s.status = 'owed' AND s.znesek_sodnik <> 0 GROUP BY s.official_id
), new AS (
  SELECT b.official_id, sum(b.remaining) AS owed FROM public.payment_balances b WHERE b.remaining > 0 GROUP BY b.official_id
)
SELECT count(*) AS officials_compared,
       count(*) FILTER (WHERE coalesce(old.owed, 0) <> coalesce(new.owed, 0)) AS differing_rows,
       coalesce(sum(old.owed), 0) AS total_v1, coalesce(sum(new.owed), 0) AS total_v2
FROM old FULL JOIN new USING (official_id);

\echo
\echo '=== 11. Invariants re-checked (the migration asserted these in its transaction) ==='
SELECT 'payment count unchanged' AS check_name,
       (SELECT count(*) FROM private.m002_payments) = (SELECT count(*) FROM public.payments) AS ok
UNION ALL
SELECT 'each payment remaining unchanged (v1: owed => amount, paid => 0)',
       NOT EXISTS (SELECT 1 FROM private.m002_payments s JOIN public.payment_balances b ON b.id = s.id
                   WHERE b.remaining <> CASE WHEN s.status = 'paid' THEN 0 ELSE round(s.amount::numeric, 2) END)
UNION ALL
SELECT 'each assignment total unchanged',
       NOT EXISTS (SELECT 1 FROM private.m002_competition_officials s JOIN public.competition_officials a ON a.id = s.id
                   WHERE a.znesek_sodnik <> s.znesek_sodnik OR a.znesek_racun <> s.znesek_racun)
UNION ALL
SELECT 'every assignment has a role', NOT EXISTS (SELECT 1 FROM public.competition_officials WHERE role_id IS NULL)
UNION ALL
SELECT 'remark lines = parsed transactions',
       (SELECT count(*) FROM private.m002_payments s, LATERAL private.parse_payment_remarks(s.remarks))
       = (SELECT count(*) FROM public.payment_transactions WHERE source = 'remarks')
UNION ALL
SELECT 'no payment is over-paid', NOT EXISTS (SELECT 1 FROM public.payment_balances WHERE remaining < 0);

ROLLBACK;
