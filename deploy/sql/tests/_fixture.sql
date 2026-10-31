\set ON_ERROR_STOP on
\set QUIET on
-- Shared fixture, prepended to every test by run.sh. Everything happens in one
-- transaction that each test ends with ROLLBACK, so no data is left behind.
-- Ids are published as custom settings: current_setting('fx.<name>')::bigint.
BEGIN;
SELECT set_config('request.jwt.claims', '{"user_id": 1, "role": "zas_admin"}', true);

DO $fx$
DECLARE
  v_role bigint;
  v_disc bigint;
  oa bigint; ob bigint; oc bigint;
  c_done bigint; c_free bigint; c_planned bigint;
  a1 bigint; a2 bigint; a3 bigint;
BEGIN
  v_role := public.save_role(NULL, 'ZZ test role',
    '[{"from":0,"to":4,"rate":20},{"from":4,"to":8,"rate":30},{"from":8,"to":null,"rate":40}]',
    '[{"from":0,"to":4,"rate":24},{"from":4,"to":8,"rate":36},{"from":8,"to":null,"rate":48}]');
  INSERT INTO public.disciplines (name) VALUES ('ZZ test discipline') RETURNING id INTO v_disc;

  INSERT INTO public.officials (name) VALUES ('ZZ official A') RETURNING id INTO oa;
  INSERT INTO public.officials (name) VALUES ('ZZ official B') RETURNING id INTO ob;
  INSERT INTO public.officials (name) VALUES ('ZZ official C') RETURNING id INTO oc;

  INSERT INTO public.competitions (name, date, status) VALUES ('ZZ done', DATE '2026-03-01', 'completed') RETURNING id INTO c_done;
  INSERT INTO public.competitions (name, date, status) VALUES ('ZZ free', DATE '2026-03-02', 'free') RETURNING id INTO c_free;
  INSERT INTO public.competitions (name, date, status) VALUES ('ZZ planned', DATE '2026-12-01', 'planned') RETURNING id INTO c_planned;

  -- A: 4h + 100 km (travel 37.00): sodnik 20 + 37 = 57.00, racun 24 + 37 = 61.00
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, discipline_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c_done, oa, v_role, v_disc, 4, 100, 20, 24, 0.37) RETURNING id INTO a1;
  -- B: zero amounts (free work inside a paid competition)
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c_done, ob, v_role, 4, 0, 0, 0, 0.37) RETURNING id INTO a2;
  -- C: 6h, no km: sodnik 30.00, racun 36.00
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c_done, oc, v_role, 6, 0, 30, 36, 0.37) RETURNING id INTO a3;
  -- free competition assignment (A again, other competition)
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c_free, oa, v_role, 4, 100, 0, 0, 0);
  -- planned competition assignment
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (c_planned, oa, v_role, 4, 0, 20, 24, 0.37);

  PERFORM set_config('fx.role', v_role::text, true);
  PERFORM set_config('fx.disc', v_disc::text, true);
  PERFORM set_config('fx.off_a', oa::text, true);
  PERFORM set_config('fx.off_b', ob::text, true);
  PERFORM set_config('fx.off_c', oc::text, true);
  PERFORM set_config('fx.c_done', c_done::text, true);
  PERFORM set_config('fx.c_free', c_free::text, true);
  PERFORM set_config('fx.c_planned', c_planned::text, true);
  PERFORM set_config('fx.a1', a1::text, true);
  PERFORM set_config('fx.a2', a2::text, true);
  PERFORM set_config('fx.a3', a3::text, true);
END
$fx$;

-- Fails the test unless the statement raises the given SQLSTATE.
CREATE FUNCTION pg_temp.expect_error(stmt text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'expected SQLSTATE % but got % (%) for: %', expected_state, SQLSTATE, SQLERRM, stmt;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'expected SQLSTATE % but the statement succeeded: %', expected_state, stmt;
END
$$;
