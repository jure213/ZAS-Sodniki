-- record_payment, installments, triggers, delete rules
DO $t$
DECLARE
  c_done bigint := current_setting('fx.c_done')::bigint;
  p bigint;
  t1 bigint;
  t2 bigint;
BEGIN
  PERFORM public.generate_payments(c_done, 'sodnik');
  SELECT id INTO p FROM public.payments WHERE assignment_id = current_setting('fx.a1')::bigint;  -- due 57.00

  ASSERT (SELECT status FROM public.payment_balances WHERE id = p) = 'owed', 'starts owed';

  -- rejected input
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 0, DATE ''2026-04-01'', ''gotovina'')', p), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, -5, DATE ''2026-04-01'', ''gotovina'')', p), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, NULL, DATE ''2026-04-01'', ''gotovina'')', p), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 10.005, DATE ''2026-04-01'', ''gotovina'')', p), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 57.01, DATE ''2026-04-01'', ''gotovina'')', p), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 10, DATE ''2026-04-01'', ''bitcoin'')', p), '22023');
  PERFORM pg_temp.expect_error('SELECT public.record_payment(-1, 10, DATE ''2026-04-01'', ''gotovina'')', 'P0002');

  -- partial payment
  t1 := public.record_payment(p, 20.00, DATE '2026-04-01', 'gotovina', 'prvi obrok');
  ASSERT (SELECT remaining FROM public.payment_balances WHERE id = p) = 37.00, 'remaining after 20';
  ASSERT (SELECT status FROM public.payment_balances WHERE id = p) = 'partial', 'partial status';
  ASSERT (SELECT source FROM public.payment_transactions WHERE id = t1) = 'app', 'source app';
  ASSERT (SELECT created_by FROM public.payment_transactions WHERE id = t1) = 1, 'created_by from the token';

  -- more than what remains is refused
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 37.01, DATE ''2026-04-02'', ''nakazilo'')', p), '22023');

  -- default method comes from app_config; paying the rest settles it
  t2 := public.record_payment(p, 37.00, DATE '2026-05-02');
  ASSERT (SELECT method FROM public.payment_transactions WHERE id = t2) = (SELECT default_payment_method FROM public.app_config), 'default method';
  ASSERT (SELECT status FROM public.payment_balances WHERE id = p) = 'paid', 'paid status';
  ASSERT (SELECT remaining FROM public.payment_balances WHERE id = p) = 0, 'nothing remains';
  ASSERT (SELECT last_paid_on FROM public.payment_balances WHERE id = p) = DATE '2026-05-02', 'last_paid_on';
  PERFORM pg_temp.expect_error(format('SELECT public.record_payment(%s, 0.01, DATE ''2026-05-03'', ''gotovina'')', p), '22023');

  -- the database itself refuses inconsistent writes, whoever writes
  PERFORM pg_temp.expect_error(format('INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method) VALUES (%s, 0.01, DATE ''2026-05-03'', ''gotovina'')', p), '23514');
  PERFORM pg_temp.expect_error(format('INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method) VALUES (%s, 0, DATE ''2026-05-03'', ''gotovina'')', p), '23514');
  PERFORM pg_temp.expect_error(format('UPDATE public.payments SET amount_due = 56.99 WHERE id = %s', p), '23514');
  PERFORM pg_temp.expect_error(format('UPDATE public.payment_transactions SET amount = 40 WHERE id = %s', t1), '23514');

  -- a payment with installments cannot be deleted; the installments can be removed
  PERFORM pg_temp.expect_error(format('DELETE FROM public.payments WHERE id = %s', p), '23503');
  PERFORM public.delete_payment_transaction(t2);
  ASSERT (SELECT remaining FROM public.payment_balances WHERE id = p) = 37.00, 'back to partial';
  PERFORM pg_temp.expect_error(format('SELECT public.delete_payment_transaction(%s)', t2), 'P0002');
  PERFORM public.delete_payment_transaction(t1);
  ASSERT (SELECT status FROM public.payment_balances WHERE id = p) = 'owed', 'owed again';
  DELETE FROM public.payments WHERE id = p;  -- now allowed
  ASSERT NOT EXISTS (SELECT 1 FROM public.payments WHERE id = p), 'deleted';
END
$t$;

-- referential rules and generated columns
DO $t$
DECLARE
  c_done bigint := current_setting('fx.c_done')::bigint;
BEGIN
  PERFORM public.generate_payments(c_done, 'sodnik');
  -- one assignment per official per competition
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours) VALUES (%s, %s, %s, 1)',
    c_done, current_setting('fx.off_a'), current_setting('fx.role')), '23505');
  -- payments block deleting the competition, the assignment and the official
  PERFORM pg_temp.expect_error(format('DELETE FROM public.competitions WHERE id = %s', c_done), '23503');
  PERFORM pg_temp.expect_error(format('DELETE FROM public.competition_officials WHERE id = %s', current_setting('fx.a1')), '23503');
  PERFORM pg_temp.expect_error(format('DELETE FROM public.officials WHERE id = %s', current_setting('fx.off_a')), '23503');
  -- generated columns cannot be written
  PERFORM pg_temp.expect_error(format('UPDATE public.competition_officials SET znesek_sodnik = 1 WHERE id = %s', current_setting('fx.a1')), '428C9');
  -- totals follow the base amounts
  UPDATE public.competition_officials SET kilometers = 200 WHERE id = current_setting('fx.a1')::bigint;
  ASSERT (SELECT znesek_sodnik FROM public.competition_officials WHERE id = current_setting('fx.a1')::bigint) = 94.00, '20 + round(200*0.37,2)';
  ASSERT (SELECT travel_amount FROM public.competition_officials WHERE id = current_setting('fx.a1')::bigint) = 74.00, 'travel amount';
  -- an assignment without payment can be deleted
  DELETE FROM public.competition_officials WHERE id = current_setting('fx.a2')::bigint;
END
$t$;
ROLLBACK;
