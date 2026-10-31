-- save_role, delete_role, delete_discipline, reorder_disciplines
DO $t$
DECLARE
  r bigint;
  x bigint;
  res text;
BEGIN
  -- overlapping tiers are rejected (upper bound inclusive: (0,4] and (3,8] overlap)
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ overlap', '[{"from":0,"to":4,"rate":1},{"from":3,"to":8,"rate":2}]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ overlap', '[{"from":0,"to":null,"rate":1},{"from":3,"to":8,"rate":2}]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ bad', '[{"from":4,"to":4,"rate":1}]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ bad', '[{"from":0,"to":4,"rate":-1}]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ bad', '[{"from":0,"to":4,"rate":1.005}]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, '   ', '[]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ bad', '{"from":0}', '[]')$q$, '22023');
  ASSERT NOT EXISTS (SELECT 1 FROM public.roles WHERE name IN ('ZZ overlap', 'ZZ bad')), 'nothing saved on rejection';

  -- adjacent tiers are fine
  r := public.save_role(NULL, 'ZZ ok', '[{"from":0,"to":4,"rate":10},{"from":4,"to":null,"rate":20}]', '[{"from":0,"to":null,"rate":99}]');
  ASSERT (SELECT count(*) FROM public.role_rates WHERE role_id = r) = 3, 'three tiers saved';
  ASSERT private.tier_rate(r, 'sodnik', 4) = 10 AND private.tier_rate(r, 'sodnik', 4.01) = 20 AND private.tier_rate(r, 'sodnik', 0) = 0
     AND private.tier_rate(r, 'racun', 100) = 99, 'tier lookup: from < h <= to';

  -- duplicate names (case-insensitive) are refused; renaming keeps the id
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'zz OK ', '[]', '[]')$q$, '23505');
  x := public.save_role(r, 'ZZ renamed', '[{"from":0,"to":null,"rate":5}]', '[]');
  ASSERT x = r AND (SELECT name FROM public.roles WHERE id = r) = 'ZZ renamed', 'rename keeps id';
  ASSERT (SELECT count(*) FROM public.role_rates WHERE role_id = r) = 1, 'tiers replaced';
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(-1, 'ZZ nope', '[]', '[]')$q$, 'P0002');

  -- unused role is deleted, used role is archived
  res := public.delete_role(r);
  ASSERT res = 'deleted' AND NOT EXISTS (SELECT 1 FROM public.roles WHERE id = r), 'unused role deleted';
  res := public.delete_role(current_setting('fx.role')::bigint);
  ASSERT res = 'archived' AND (SELECT archived FROM public.roles WHERE id = current_setting('fx.role')::bigint), 'used role archived';
  PERFORM pg_temp.expect_error('SELECT public.delete_role(-1)', 'P0002');
  -- a direct delete of a used role is blocked by the foreign key
  PERFORM pg_temp.expect_error(format('DELETE FROM public.roles WHERE id = %s', current_setting('fx.role')), '23503');
END
$t$;

DO $t$
DECLARE
  d1 bigint; d2 bigint; d3 bigint;
  res text;
BEGIN
  INSERT INTO public.disciplines (name) VALUES ('ZZ d1') RETURNING id INTO d1;
  INSERT INTO public.disciplines (name) VALUES ('ZZ d2') RETURNING id INTO d2;
  INSERT INTO public.disciplines (name) VALUES ('ZZ d3') RETURNING id INTO d3;
  ASSERT (SELECT position FROM public.disciplines WHERE id = d1) < (SELECT position FROM public.disciplines WHERE id = d3), 'new disciplines go last';
  PERFORM pg_temp.expect_error($q$INSERT INTO public.disciplines (name) VALUES ('zz D1 ')$q$, '23505');

  PERFORM public.reorder_disciplines(ARRAY[d3, d1, d2]);
  ASSERT (SELECT array_agg(id ORDER BY position) FILTER (WHERE id IN (d1, d2, d3)) FROM public.disciplines) = ARRAY[d3, d1, d2], 'reordered';
  ASSERT (SELECT position FROM public.disciplines WHERE id = d3) = 1, 'listed ones come first';
  PERFORM pg_temp.expect_error(format('SELECT public.reorder_disciplines(ARRAY[%s, %s])', d1, d1), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.reorder_disciplines(ARRAY[%s, -1])', d1), '22023');

  -- rename is safe: assignments reference the id
  UPDATE public.disciplines SET name = 'ZZ renamed discipline' WHERE id = current_setting('fx.disc')::bigint;
  ASSERT (SELECT discipline_name FROM public.assignment_details WHERE id = current_setting('fx.a1')::bigint) = 'ZZ renamed discipline', 'rename follows';

  res := public.delete_discipline(d2);
  ASSERT res = 'deleted', 'unused discipline deleted';
  res := public.delete_discipline(current_setting('fx.disc')::bigint);
  ASSERT res = 'archived' AND (SELECT archived FROM public.disciplines WHERE id = current_setting('fx.disc')::bigint), 'used discipline archived';
  PERFORM pg_temp.expect_error('SELECT public.delete_discipline(-1)', 'P0002');
END
$t$;
ROLLBACK;
