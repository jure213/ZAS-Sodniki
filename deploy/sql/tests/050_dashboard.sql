-- dashboard_stats: installments by their own date, owed = remaining
DO $t$
DECLARE
  p1 bigint; p3 bigint;
  base_paid numeric; base_owed numeric;
  s json;
BEGIN
  SELECT (public.dashboard_stats(2031) ->> 'paid_payments')::numeric,
         (public.dashboard_stats(2031) ->> 'owed_payments')::numeric INTO base_paid, base_owed;

  PERFORM public.generate_payments(current_setting('fx.c_done')::bigint, 'sodnik');   -- A 57.00, C 30.00
  SELECT id INTO p1 FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint;
  SELECT id INTO p3 FROM public.payments WHERE assignment_id = current_setting('fx.a3')::bigint;

  s := public.dashboard_stats(2031);
  ASSERT (s ->> 'owed_payments')::numeric = base_owed + 87.00, format('owed includes both: %s', s);
  ASSERT (s ->> 'paid_payments')::numeric = base_paid, 'nothing paid yet';

  -- installments in two different years: each year counts its own
  PERFORM public.record_payment(p1, 20.00, DATE '2031-12-31', 'gotovina');
  PERFORM public.record_payment(p1, 37.00, DATE '2032-01-01', 'gotovina');
  PERFORM public.record_payment(p3, 10.00, DATE '2031-06-01', 'nakazilo');

  s := public.dashboard_stats(2031);
  ASSERT (s ->> 'paid_payments')::numeric = base_paid + 30.00, format('2031: %s', s);
  ASSERT (s ->> 'owed_payments')::numeric = base_owed + 20.00, 'only C still owes 20';
  ASSERT (s ->> 'total_payments')::numeric = (s ->> 'paid_payments')::numeric + (s ->> 'owed_payments')::numeric, 'total';
  ASSERT (public.dashboard_stats(2032) ->> 'paid_payments')::numeric = 37.00, '2032 only has the January installment';
  ASSERT (public.dashboard_stats() ->> 'year')::int = extract(year FROM current_date)::int, 'defaults to the current year';

  -- counts follow the old rule: planned + completed competitions
  ASSERT (s ->> 'active_competitions')::int = (SELECT count(*) FROM public.competitions WHERE status IN ('planned', 'completed')), 'active competitions';
  ASSERT (s ->> 'total_officials')::int = (SELECT count(*) FROM public.officials), 'officials';
END
$t$;
ROLLBACK;
