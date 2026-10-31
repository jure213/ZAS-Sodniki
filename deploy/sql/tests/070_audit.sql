-- Audit trail (003_audit.sql): every audited table writes an entry with the right
-- user, no-op updates write nothing, summary functions write one entry, secrets
-- never appear, and the log cannot be changed or read by the wrong roles.
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

-- Entries written after the marker, as one text per entry: "action|entity|summary".
CREATE FUNCTION pg_temp.since(marker bigint) RETURNS text[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(l.action || '|' || l.entity || '|' || l.summary ORDER BY l.id), '{}')
  FROM public.audit_log AS l WHERE l.id > marker;
$$;
CREATE FUNCTION pg_temp.marker() RETURNS bigint LANGUAGE sql AS $$
  SELECT coalesce(max(id), 0) FROM public.audit_log;
$$;

DO $t$
DECLARE
  adm bigint;
  m bigint;
  e text[];
  r record;
  off bigint; comp bigint; asg bigint; pay bigint; tx bigint; role_id bigint; disc bigint; usr bigint;
  secret text := 'ZzSecret-Passw0rd!';
BEGIN
  -- ---- the acting administrator --------------------------------------------
  adm := public.create_user('zz_admin', secret, 'ZZ Admin', 'admin');
  PERFORM set_config('request.jwt.claims', format('{"user_id": %s, "role": "zas_admin"}', adm), true);
  PERFORM set_config('fx.adm', adm::text, true);

  -- ---- officials -----------------------------------------------------------
  m := pg_temp.marker();
  INSERT INTO public.officials (name, rank) VALUES ('ZZ Audit Official', 'A') RETURNING id INTO off;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|official|Dodan sodnik ZZ Audit Official'], 'official insert: ' || e::text;
  SELECT * INTO r FROM public.audit_log WHERE id > m;
  ASSERT r.user_id = adm AND r.username = 'zz_admin' AND r.entity_id = off, 'entry carries the acting user';
  ASSERT r.changes -> 'Rang' = '[null, "A"]'::jsonb, 'insert records the new values: ' || r.changes::text;

  m := pg_temp.marker();
  UPDATE public.officials SET name = 'ZZ Audit Official 2', phone = '040 123 456' WHERE id = off;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['update|official|Urejen sodnik ZZ Audit Official 2 (ime in priimek, telefon)'], 'official update: ' || e::text;
  ASSERT (SELECT changes -> 'Ime in priimek' FROM public.audit_log WHERE id > m) = '["ZZ Audit Official", "ZZ Audit Official 2"]'::jsonb, 'before/after';

  m := pg_temp.marker();
  UPDATE public.officials SET name = name, phone = phone WHERE id = off;
  UPDATE public.officials SET rank = 'A' WHERE id = off;
  ASSERT pg_temp.since(m) = '{}', 'updates that change nothing log nothing';

  UPDATE public.officials SET active = false WHERE id = off;
  ASSERT pg_temp.since(m) = ARRAY['update|official|Deaktiviran sodnik ZZ Audit Official 2'], 'deactivate';

  -- ---- competitions and assignments ---------------------------------------
  m := pg_temp.marker();
  INSERT INTO public.competitions (name, date, status) VALUES ('ZZ Audit Comp', DATE '2026-05-04', 'planned') RETURNING id INTO comp;
  UPDATE public.competitions SET date = DATE '2026-06-07', location = 'Ljubljana' WHERE id = comp;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|competition|Dodano tekmovanje »ZZ Audit Comp«',
                   'update|competition|Urejeno tekmovanje »ZZ Audit Comp« (datum, lokacija)'], 'competition: ' || e::text;
  ASSERT (SELECT changes -> 'Datum' FROM public.audit_log WHERE id > m AND action = 'update') = '["4. 5. 2026", "7. 6. 2026"]'::jsonb, 'dates shown as d. m. yyyy';

  m := pg_temp.marker();
  INSERT INTO public.competition_officials (competition_id, official_id, role_id, hours, kilometers, base_sodnik, base_racun, travel_rate)
  VALUES (comp, off, current_setting('fx.role')::bigint, 4, 100, 20, 24, 0.37) RETURNING id INTO asg;
  UPDATE public.competition_officials SET hours = 6, base_sodnik = 30 WHERE id = asg;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|assignment|Dodeljen sodnik ZZ Audit Official 2 – ZZ Audit Comp (ZZ test role)',
                   'update|assignment|Urejena dodelitev ZZ Audit Official 2 – ZZ Audit Comp (ure, osnova sodnik)'], 'assignment: ' || e::text;
  ASSERT (SELECT changes -> 'Osnova sodnik' FROM public.audit_log WHERE id > m AND action = 'update') = '["20,00 €", "30,00 €"]'::jsonb, 'money format';
  ASSERT NOT EXISTS (SELECT 1 FROM public.audit_log WHERE id > m AND changes::text ~ 'znesek|travel_amount'), 'generated columns are not recorded';

  -- ---- generate_payments: one entry, no per-row entries --------------------
  UPDATE public.competitions SET status = 'completed' WHERE id = comp;
  m := pg_temp.marker();
  PERFORM public.generate_payments(comp, 'sodnik');
  e := pg_temp.since(m);
  ASSERT e = ARRAY['generate|payment|Ustvarjeno 1 izplačilo – ZZ Audit Comp (tarifa sodnik, skupaj 67,00 €)'], 'generate: ' || e::text;
  ASSERT current_setting('zas.audit_skip', true) IN ('', 'off'), 'skip flag is reset';
  m := pg_temp.marker();
  PERFORM public.generate_payments(comp, 'sodnik');
  ASSERT pg_temp.since(m) = '{}', 'a repeated generate that creates nothing logs nothing';

  -- ---- payments and installments -------------------------------------------
  SELECT id INTO pay FROM public.payments WHERE assignment_id = asg;
  m := pg_temp.marker();
  tx := public.record_payment(pay, 20, DATE '2026-07-01', 'nakazilo', 'prvi obrok');
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|payment_transaction|Zabeleženo plačilo 20,00 € – ZZ Audit Official 2 (ZZ Audit Comp)'], 'record: ' || e::text;
  ASSERT (SELECT changes -> 'Način plačila' FROM public.audit_log WHERE id > m) = '[null, "Nakazilo"]'::jsonb, 'method label';

  m := pg_temp.marker();
  PERFORM public.delete_payment_transaction(tx);
  ASSERT pg_temp.since(m) = ARRAY['delete|payment_transaction|Izbrisano plačilo 20,00 € – ZZ Audit Official 2 (ZZ Audit Comp)'], 'delete installment';

  m := pg_temp.marker();
  UPDATE public.payments SET notes = 'nova opomba' WHERE id = pay;
  UPDATE public.payments SET amount_due = 70 WHERE id = pay;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['update|payment|Urejeno izplačilo ZZ Audit Official 2 – ZZ Audit Comp (opombe)',
                   'update|payment|Urejeno izplačilo ZZ Audit Official 2 – ZZ Audit Comp (znesek za izplačilo)'], 'payment update: ' || e::text;

  m := pg_temp.marker();
  DELETE FROM public.payments WHERE id = pay;
  DELETE FROM public.competition_officials WHERE id = asg;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['delete|payment|Izbrisano izplačilo ZZ Audit Official 2 – ZZ Audit Comp (70,00 €)',
                   'delete|assignment|Odstranjen sodnik ZZ Audit Official 2 – ZZ Audit Comp'], 'deletes: ' || e::text;

  m := pg_temp.marker();
  DELETE FROM public.competitions WHERE id = comp;
  DELETE FROM public.officials WHERE id = off;
  e := pg_temp.since(m);
  ASSERT e = ARRAY['delete|competition|Izbrisano tekmovanje »ZZ Audit Comp«',
                   'delete|official|Izbrisan sodnik ZZ Audit Official 2'], 'delete competition and official: ' || e::text;

  -- ---- roles: one entry per save, none for role_rates ----------------------
  m := pg_temp.marker();
  role_id := public.save_role(NULL, 'ZZ Audit Role', '[{"from":0,"to":4,"rate":10},{"from":4,"to":null,"rate":20}]', '[]');
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|role|Dodana vloga ZZ Audit Role (tarifa sodnik: 0–4 h: 10,00 €; nad 4 h: 20,00 €; tarifa račun: brez stopenj)'], 'save_role new: ' || e::text;

  m := pg_temp.marker();
  PERFORM public.save_role(role_id, 'ZZ Audit Role', '[{"from":0,"to":4,"rate":10},{"from":4,"to":null,"rate":25}]', '[]');
  e := pg_temp.since(m);
  ASSERT e = ARRAY['update|role|Urejena vloga ZZ Audit Role (stopnje sodnik)'], 'save_role tiers: ' || e::text;
  ASSERT (SELECT changes -> 'Stopnje sodnik' ->> 1 FROM public.audit_log WHERE id > m) = '0–4 h: 10,00 €; nad 4 h: 25,00 €', 'tier text';

  m := pg_temp.marker();
  PERFORM public.save_role(role_id, 'ZZ Audit Role', '[{"from":0,"to":4,"rate":10},{"from":4,"to":null,"rate":25}]', '[]');
  ASSERT pg_temp.since(m) = '{}', 'saving a role without changes logs nothing';

  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, '', '[]', '[]')$q$, '22023');
  PERFORM pg_temp.expect_error($q$SELECT public.save_role(NULL, 'ZZ Audit Role', '[]', '[]')$q$, '23505');
  ASSERT current_setting('zas.audit_skip', true) IN ('', 'off'), 'skip flag is reset after rejected saves';

  m := pg_temp.marker();
  PERFORM public.delete_role(role_id);
  ASSERT pg_temp.since(m) = ARRAY['delete|role|Izbrisana vloga ZZ Audit Role'], 'delete role';

  -- ---- disciplines ----------------------------------------------------------
  m := pg_temp.marker();
  INSERT INTO public.disciplines (name) VALUES ('ZZ Audit Disc') RETURNING id INTO disc;
  UPDATE public.disciplines SET name = 'ZZ Audit Disc 2' WHERE id = disc;
  UPDATE public.disciplines SET archived = true WHERE id = disc;
  PERFORM public.reorder_disciplines(ARRAY[disc]);
  PERFORM public.delete_discipline(disc);
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|discipline|Dodana disciplina ZZ Audit Disc',
                   'update|discipline|Urejena disciplina ZZ Audit Disc 2 (ime discipline)',
                   'update|discipline|Arhivirana disciplina ZZ Audit Disc 2',
                   'update|discipline|Spremenjen vrstni red disciplin',
                   'delete|discipline|Izbrisana disciplina ZZ Audit Disc 2'], 'disciplines: ' || e::text;

  -- ---- settings -------------------------------------------------------------
  m := pg_temp.marker();
  UPDATE public.app_config SET travel_cost_per_km = 0.4321, default_payment_method = 'gotovina';
  e := pg_temp.since(m);
  ASSERT e[1] LIKE 'update|config|Urejene nastavitve (%cena na kilometer % €/km → 0,4321 €/km%', 'config: ' || e::text;
  ASSERT (SELECT changes -> 'Privzeti način plačila' ->> 1 FROM public.audit_log WHERE id > m) = 'Gotovina', 'config method label';

  -- ---- users: never a password or a hash -----------------------------------
  m := pg_temp.marker();
  usr := public.create_user('zz_audit_u', 'AnotherSecret-123', 'ZZ Audit User', 'user');
  PERFORM public.update_user(usr, 'zz_audit_u', 'ZZ Audit User', 'user', 'BrandNewSecret-456');
  PERFORM public.update_user(usr, 'zz_audit_u', 'ZZ Renamed', 'admin');
  PERFORM public.delete_user(usr);
  e := pg_temp.since(m);
  ASSERT e = ARRAY['insert|user|Dodan uporabnik ZZ Audit User (zz_audit_u)',
                   'update|user|Urejen uporabnik ZZ Audit User (zz_audit_u) (geslo spremenjeno)',
                   'update|user|Urejen uporabnik ZZ Renamed (zz_audit_u) (ime, vloga)',
                   'delete|user|Izbrisan uporabnik ZZ Renamed (zz_audit_u)'], 'users: ' || e::text;
  ASSERT (SELECT changes -> 'Geslo' FROM public.audit_log WHERE id > m AND summary LIKE '%geslo spremenjeno%') = '["(skrito)", "(spremenjeno)"]'::jsonb, 'password change is a fact only';

  -- ---- logins ---------------------------------------------------------------
  -- login() runs without a token (zas_anon), so nobody is the current user yet
  PERFORM set_config('request.jwt.claims', '', true);
  m := pg_temp.marker();
  PERFORM public.login('zz_admin', secret);
  PERFORM public.login('zz_admin', 'wrong-Secret-999');
  PERFORM public.login('zz_nobody', 'whatever-Secret-1');
  PERFORM set_config('request.jwt.claims', format('{"user_id": %s, "role": "zas_admin"}', adm), true);
  e := pg_temp.since(m);
  ASSERT e = ARRAY['login|auth|Prijava – ZZ Admin',
                   'login_failed|auth|Neuspešna prijava (napačno geslo) – ZZ Admin',
                   'login_failed|auth|Neuspešna prijava (uporabniško ime »zz_nobody«)'], 'logins: ' || e::text;
  ASSERT (SELECT user_id FROM public.audit_log WHERE id > m AND action = 'login') = adm, 'login user';
  ASSERT (SELECT user_id IS NULL AND username = 'zz_nobody' FROM public.audit_log WHERE id > m AND summary LIKE '%zz_nobody%'), 'unknown user is recorded by name only';

  -- ---- no secret anywhere ----------------------------------------------------
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.audit_log AS l
    WHERE coalesce(l.summary, '') || coalesce(l.changes::text, '') || coalesce(l.username, '')
          ~ ('Secret|wrong-|whatever-|\$2[aby]\$|\$2[aby]\$|' || secret)
  ), 'no password or hash in the log';

  -- ---- clear_all: one entry, the log survives -------------------------------
  SELECT count(*) INTO STRICT m FROM public.audit_log;
  PERFORM set_config('fx.log_count', m::text, true);
  m := pg_temp.marker();
  PERFORM public.admin_clear_all_data();
  e := pg_temp.since(m);
  ASSERT cardinality(e) = 1 AND e[1] LIKE 'clear_all|system|Izbrisani vsi podatki (sodniki: %', 'clear_all: ' || e::text;
  ASSERT (SELECT count(*) FROM public.audit_log) = current_setting('fx.log_count')::bigint + 1, 'the log is kept';
  ASSERT current_setting('zas.audit_skip', true) IN ('', 'off'), 'skip flag is reset after clear_all';
END
$t$;

-- ---- the log cannot be changed, even by the owner ---------------------------
SELECT pg_temp.expect_error('UPDATE public.audit_log SET summary = ''x''', '42501');
SELECT pg_temp.expect_error('DELETE FROM public.audit_log', '42501');
SELECT pg_temp.expect_error('TRUNCATE public.audit_log', '42501');

-- ---- API roles --------------------------------------------------------------
SET LOCAL ROLE zas_admin;
SELECT count(*) FROM public.audit_log;
SELECT public.zz_denied('INSERT INTO public.audit_log (action, entity, summary) VALUES (''insert'', ''x'', ''x'')');
SELECT public.zz_denied('UPDATE public.audit_log SET summary = ''x''');
SELECT public.zz_denied('DELETE FROM public.audit_log');
SELECT public.zz_denied('TRUNCATE public.audit_log');
SELECT public.zz_denied('SELECT private.audit(''insert'', ''x'', NULL, ''x'')');
-- a direct write by the admin role is still logged, with that admin as the actor
DO $t$
DECLARE m bigint := (SELECT max(id) FROM public.audit_log);
BEGIN
  INSERT INTO public.officials (name) VALUES ('ZZ via zas_admin');
  ASSERT (SELECT count(*) FROM public.audit_log WHERE id > m AND user_id = current_setting('fx.adm')::bigint) = 1, 'direct update logged';
END
$t$;
RESET ROLE;

SET LOCAL ROLE zas_user;
SELECT public.zz_denied('SELECT 1 FROM public.audit_log');
SELECT public.zz_denied('SELECT count(*) FROM public.audit_log');
RESET ROLE;

SET LOCAL ROLE zas_anon;
SELECT public.zz_denied('SELECT 1 FROM public.audit_log');
RESET ROLE;
ROLLBACK;
