-- API privileges as seen by the three API roles (see deploy/sql/grant-api.sql).
-- Each denied statement runs in its own sub-block: a missing privilege must raise
-- insufficient_privilege (42501); any other outcome fails the test.
CREATE FUNCTION public.zz_denied(stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'expected permission denied but it worked: %', stmt;
END
$$;

GRANT EXECUTE ON FUNCTION public.zz_denied(text) TO PUBLIC;

DO $t$
DECLARE
  pay bigint;
  tx bigint;
BEGIN
  PERFORM public.generate_payments(current_setting('fx.c_done')::bigint, 'sodnik');
  SELECT id INTO pay FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint;
  tx := public.record_payment(pay, 5.00, DATE '2026-04-01', 'gotovina');
  PERFORM set_config('fx.pay', pay::text, true);
  PERFORM set_config('fx.tx', tx::text, true);
END
$t$;

-- zas_anon: nothing but login()
SET LOCAL ROLE zas_anon;
SELECT public.zz_denied('SELECT 1 FROM public.payment_balances');
SELECT public.zz_denied('SELECT 1 FROM public.assignment_details');
SELECT public.zz_denied('SELECT 1 FROM public.payment_transactions');
SELECT public.zz_denied('SELECT 1 FROM public.officials');
SELECT public.zz_denied('SELECT public.dashboard_stats()');
SELECT public.zz_denied('SELECT public.record_payment(1, 1)');
SELECT public.zz_denied('SELECT 1 FROM public.audit_log');
RESET ROLE;

-- zas_user: reads, but changes nothing and calls no money function
SET LOCAL ROLE zas_user;
SELECT 1 FROM public.payment_balances LIMIT 1;
SELECT 1 FROM public.assignment_details LIMIT 1;
SELECT 1 FROM public.payment_transactions LIMIT 1;
SELECT 1 FROM public.roles LIMIT 1;
SELECT 1 FROM public.role_rates LIMIT 1;
SELECT 1 FROM public.disciplines LIMIT 1;
SELECT 1 FROM public.app_config LIMIT 1;
SELECT public.dashboard_stats();
SELECT public.zz_denied(format('SELECT public.record_payment(%s, 1, DATE ''2026-04-02'', ''gotovina'')', current_setting('fx.pay')));
SELECT public.zz_denied(format('SELECT public.generate_payments(%s, ''sodnik'')', current_setting('fx.c_done')));
SELECT public.zz_denied('SELECT public.save_role(NULL, ''ZZ x'', ''[]'', ''[]'')');
SELECT public.zz_denied('UPDATE public.officials SET name = ''x''');
SELECT public.zz_denied('SELECT 1 FROM private.settings_legacy');
SELECT public.zz_denied('SELECT 1 FROM private.m002_payments');
SELECT public.zz_denied('SELECT 1 FROM public.audit_log');
RESET ROLE;

-- zas_admin: functions yes; direct writes to guarded tables and columns no
SET LOCAL ROLE zas_admin;
SELECT public.record_payment(current_setting('fx.pay')::bigint, 1.00, DATE '2026-04-02', 'gotovina');
SELECT public.delete_payment_transaction(current_setting('fx.tx')::bigint);
SELECT public.zz_denied(format('INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method) VALUES (%s, 1, DATE ''2026-04-03'', ''gotovina'')', current_setting('fx.pay')));
SELECT public.zz_denied('UPDATE public.payment_transactions SET amount = 1');
SELECT public.zz_denied('DELETE FROM public.payment_transactions');
SELECT public.zz_denied(format('INSERT INTO public.role_rates (role_id, tariff, position, hours_from, rate) VALUES (%s, ''sodnik'', 99, 0, 1)', current_setting('fx.role')));
SELECT public.zz_denied('UPDATE public.role_rates SET rate = 0');
SELECT public.zz_denied('DELETE FROM public.role_rates');
SELECT public.zz_denied('INSERT INTO public.roles (name) VALUES (''ZZ direct'')');
SELECT public.zz_denied('UPDATE public.roles SET name = name');
SELECT public.zz_denied(format('INSERT INTO public.payments (official_id, competition_id, amount_due, tariff) VALUES (%s, %s, 1, ''sodnik'')', current_setting('fx.off_a'), current_setting('fx.c_done')));
SELECT public.zz_denied('UPDATE public.payments SET tariff = ''racun''');
SELECT public.zz_denied('UPDATE public.competition_officials SET competition_id = competition_id');
SELECT public.zz_denied('SELECT 1 FROM private.settings_legacy');
-- the audit log is readable by admins, but never writable through the API
SELECT count(*) FROM public.audit_log;
SELECT public.zz_denied('INSERT INTO public.audit_log (action, entity, summary) VALUES (''insert'', ''x'', ''x'')');
SELECT public.zz_denied('UPDATE public.audit_log SET summary = summary');
SELECT public.zz_denied('DELETE FROM public.audit_log');
-- allowed direct writes
UPDATE public.officials SET name = 'ZZ official A2' WHERE id = current_setting('fx.off_a')::bigint;
UPDATE public.competition_officials SET hours = 5, base_sodnik = 25 WHERE id = current_setting('fx.a3')::bigint;
UPDATE public.payments SET notes = 'ok' WHERE id = current_setting('fx.pay')::bigint;
UPDATE public.app_config SET travel_cost_per_km = 0.40;
INSERT INTO public.disciplines (name) VALUES ('ZZ via api');
RESET ROLE;
ROLLBACK;
