-- generate_payments: idempotency, 0 EUR skipping, status rules, tariffs
DO $t$
DECLARE
  c_done bigint := current_setting('fx.c_done')::bigint;
  c_free bigint := current_setting('fx.c_free')::bigint;
  c_planned bigint := current_setting('fx.c_planned')::bigint;
  r json;
BEGIN
  r := public.generate_payments(c_done, 'sodnik');
  ASSERT (r ->> 'created')::int = 2, format('created 2 (A and C), got %s', r);
  ASSERT (r ->> 'skipped_zero')::int = 1, 'B has 0 EUR and is skipped';
  ASSERT (r ->> 'skipped_existing')::int = 0, 'nothing existed';

  ASSERT (SELECT amount_due FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint) = 57.00, 'A: 20 + 37.00 travel';
  ASSERT (SELECT amount_due FROM public.payments WHERE assignment_id = current_setting('fx.a3')::bigint) = 30.00, 'C: 30';
  ASSERT NOT EXISTS (SELECT 1 FROM public.payments WHERE assignment_id = current_setting('fx.a2')::bigint), 'no payment for the 0 EUR assignment';
  ASSERT (SELECT tariff FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint) = 'sodnik', 'tariff stored';
  ASSERT (SELECT notes FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint) = 'ZZ test role (ZZ test discipline) - 4h, 100km', 'notes format';

  -- idempotent
  r := public.generate_payments(c_done, 'sodnik');
  ASSERT (r ->> 'created')::int = 0 AND (r ->> 'skipped_existing')::int = 2 AND (r ->> 'skipped_zero')::int = 1, format('second run: %s', r);
  -- a different tariff does not create a second payment either
  r := public.generate_payments(c_done, 'racun');
  ASSERT (r ->> 'created')::int = 0, 'one payment per assignment, whatever the tariff';
  ASSERT (SELECT count(*) FROM public.payments WHERE competition_id = c_done) = 2, 'still two payments';

  -- free competition: everything is 0 EUR
  r := public.generate_payments(c_free, 'sodnik');
  ASSERT (r ->> 'created')::int = 0 AND (r ->> 'skipped_zero')::int = 1, format('free competition: %s', r);

  -- statuses and bad input
  PERFORM pg_temp.expect_error(format('SELECT public.generate_payments(%s, ''sodnik'')', c_planned), '22023');
  PERFORM pg_temp.expect_error('SELECT public.generate_payments(-1, ''sodnik'')', 'P0002');
  PERFORM pg_temp.expect_error(format('SELECT public.generate_payments(%s, ''bogus'')', c_done), '22023');
  UPDATE public.competitions SET status = 'cancelled' WHERE id = c_done;
  PERFORM pg_temp.expect_error(format('SELECT public.generate_payments(%s, ''sodnik'')', c_done), '22023');
END
$t$;

-- invoice tariff on a fresh competition
DO $t$
DECLARE
  c bigint;
  r json;
BEGIN
  INSERT INTO public.competitions (name, date, status) VALUES ('ZZ racun', DATE '2026-04-01', 'other_zas') RETURNING id INTO c;
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c, current_setting('fx.off_a')::bigint, current_setting('fx.role')::bigint, 4, 100, 20, 24, 0.37);
  r := public.generate_payments(c, 'racun');
  ASSERT (r ->> 'created')::int = 1, format('racun: %s', r);
  ASSERT (SELECT amount_due FROM public.payments WHERE competition_id = c) = 61.00, 'invoice: 24 + 37.00';
  ASSERT (SELECT tariff FROM public.payments WHERE competition_id = c) = 'racun', 'invoice tariff stored';
END
$t$;
ROLLBACK;
