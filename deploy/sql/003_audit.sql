-- 003_audit.sql: audit trail ("Dnevnik")
--
-- One append-only table, public.audit_log, that records who changed what and
-- when, plus successful and failed logins. Only administrators can read it
-- (grant-api.sql); nobody can insert, update or delete through the API, and a
-- trigger refuses UPDATE, DELETE and TRUNCATE even for the owner role.
--
--   * Row triggers write one entry per changed row (Slovenian summary text and
--     a {label: [before, after]} diff). Password hashes are never recorded.
--   * generate_payments(), admin_clear_all_data() and save_role() suppress the
--     per-row entries (transaction-local zas.audit_skip) and write one summary
--     entry instead.
--   * login() records successful and failed attempts (never the password).
--
-- The triggers are created after 002's data conversion, so applying this
-- migration logs nothing. Applied by deploy/scripts/migrate.sh in ONE
-- transaction; the \if guard makes re-running a no-op.
--
-- Rollback: restore the pre-migration backup (DEPLOYMENT.md section 8). The
-- audit log lives in the public schema and goes with the restore.

SELECT to_regclass('public.audit_log') IS NOT NULL AS m003_done \gset
\if :m003_done
\echo '003_audit: already applied, nothing to do.'
\else

DO $pre$
BEGIN
  IF to_regclass('public.payment_transactions') IS NULL THEN
    RAISE EXCEPTION '003_audit needs 002_data_model to be applied first.';
  END IF;
END
$pre$;

-- ===========================================================================
-- 1. Table (append-only)
-- ===========================================================================
CREATE TABLE public.audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   bigint,   -- no foreign key: entries outlive deleted users
  username  text,     -- snapshot at the time of the event
  action    text NOT NULL CHECK (action IN
              ('insert', 'update', 'delete', 'login', 'login_failed', 'generate', 'clear_all')),
  entity    text NOT NULL,
  entity_id bigint,
  summary   text NOT NULL,
  changes   jsonb
);
CREATE INDEX idx_audit_log_at ON public.audit_log (at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity, entity_id);

CREATE FUNCTION private.audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Dnevnik je samo za dodajanje, vnosov ni mogoče spreminjati ali brisati.';
END;
$$;

CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION private.audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION private.audit_log_immutable();

-- ===========================================================================
-- 2. private.audit(): the only writer
-- ===========================================================================
-- The actor is the JWT user of the current request. login() passes the user
-- (or the attempted username) explicitly because nobody is authenticated yet.
CREATE FUNCTION private.audit(
  p_action text, p_entity text, p_entity_id bigint, p_summary text, p_changes jsonb DEFAULT NULL,
  p_user_id bigint DEFAULT NULL, p_username text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid bigint := coalesce(p_user_id, private.current_user_id());
  v_name text := p_username;
BEGIN
  IF current_setting('zas.audit_skip', true) = 'on' THEN
    RETURN;
  END IF;
  IF v_name IS NULL AND v_uid IS NOT NULL THEN
    SELECT u.username INTO v_name FROM public.users AS u WHERE u.id = v_uid;
  END IF;
  INSERT INTO public.audit_log (user_id, username, action, entity, entity_id, summary, changes)
  VALUES (v_uid, v_name, p_action, p_entity, p_entity_id, p_summary, p_changes);
END;
$$;

-- ===========================================================================
-- 3. Helpers for readable text
-- ===========================================================================
-- Slovenian field label, or NULL for columns that are never recorded. This is
-- a whitelist on purpose: a column that is not listed (password hashes,
-- generated and derived columns, timestamps, positions, foreign keys) cannot
-- end up in the log.
CREATE FUNCTION private.audit_label(tbl text, col text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE tbl || '.' || col
    WHEN 'officials.name' THEN 'Ime in priimek'
    WHEN 'officials.email' THEN 'E-pošta'
    WHEN 'officials.phone' THEN 'Telefon'
    WHEN 'officials.rank' THEN 'Rang'
    WHEN 'officials.active' THEN 'Aktiven'
    WHEN 'officials.notes' THEN 'Opombe'
    WHEN 'officials.additional_exams' THEN 'Dodatni izpiti'
    WHEN 'competitions.name' THEN 'Ime tekmovanja'
    WHEN 'competitions.date' THEN 'Datum'
    WHEN 'competitions.location' THEN 'Lokacija'
    WHEN 'competitions.status' THEN 'Status'
    WHEN 'competitions.notes' THEN 'Opombe'
    WHEN 'competition_officials.role_id' THEN 'Vloga'
    WHEN 'competition_officials.discipline_id' THEN 'Disciplina'
    WHEN 'competition_officials.hours' THEN 'Ure'
    WHEN 'competition_officials.kilometers' THEN 'Kilometri'
    WHEN 'competition_officials.base_sodnik' THEN 'Osnova sodnik'
    WHEN 'competition_officials.base_racun' THEN 'Osnova račun'
    WHEN 'competition_officials.travel_rate' THEN 'Cena na kilometer'
    WHEN 'competition_officials.notes' THEN 'Opombe'
    WHEN 'payments.amount_due' THEN 'Znesek za izplačilo'
    WHEN 'payments.tariff' THEN 'Tarifa'
    WHEN 'payments.notes' THEN 'Opombe'
    WHEN 'payment_transactions.amount' THEN 'Znesek'
    WHEN 'payment_transactions.paid_on' THEN 'Datum plačila'
    WHEN 'payment_transactions.method' THEN 'Način plačila'
    WHEN 'payment_transactions.note' THEN 'Opomba'
    WHEN 'roles.name' THEN 'Ime vloge'
    WHEN 'roles.archived' THEN 'Arhivirana'
    WHEN 'disciplines.name' THEN 'Ime discipline'
    WHEN 'disciplines.archived' THEN 'Arhivirana'
    WHEN 'app_config.travel_cost_per_km' THEN 'Cena na kilometer'
    WHEN 'app_config.default_payment_method' THEN 'Privzeti način plačila'
    WHEN 'app_config.min_client_version' THEN 'Najnižja različica aplikacije'
    WHEN 'users.username' THEN 'Uporabniško ime'
    WHEN 'users.name' THEN 'Ime'
    WHEN 'users.role' THEN 'Vloga'
  END;
$$;

-- A column value as it is shown to people: money as 1.234,56 €, dates as
-- d. m. yyyy, codes as the labels the app uses, true/false as da/ne.
CREATE FUNCTION private.audit_value(tbl text, col text, v jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  s text;
  shown text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN 'null'::jsonb;
  END IF;
  s := v #>> '{}';
  shown := CASE
    WHEN col IN ('base_sodnik', 'base_racun', 'amount_due', 'amount') THEN private.format_eur(s::numeric)
    WHEN col IN ('travel_rate', 'travel_cost_per_km')
      THEN translate(CASE WHEN scale(trim_scale(s::numeric)) < 2 THEN to_char(s::numeric, 'FM990.00')
                          ELSE trim_scale(s::numeric)::text END, '.', ',') || ' €/km'
    WHEN col IN ('date', 'paid_on') THEN to_char(s::date, 'FMDD. FMMM. YYYY')
    WHEN col = 'status' THEN CASE s
      WHEN 'planned' THEN 'Načrtovano' WHEN 'completed' THEN 'Izvedeno' WHEN 'cancelled' THEN 'Preklicano'
      WHEN 'free' THEN 'Zastonj' WHEN 'other_zas' THEN 'Plača drug ZAS' ELSE s END
    WHEN col IN ('method', 'default_payment_method') THEN CASE s
      WHEN 'gotovina' THEN 'Gotovina' WHEN 'nakazilo' THEN 'Nakazilo' WHEN 'drugo' THEN 'Drugo' ELSE s END
    WHEN col = 'tariff' THEN CASE s WHEN 'sodnik' THEN 'Sodnik' WHEN 'racun' THEN 'Račun' ELSE s END
    WHEN tbl = 'users' AND col = 'role' THEN CASE s WHEN 'admin' THEN 'Administrator' WHEN 'user' THEN 'Uporabnik' ELSE s END
    WHEN col = 'role_id' THEN coalesce((SELECT r.name FROM public.roles AS r WHERE r.id = s::bigint), s)
    WHEN col = 'discipline_id' THEN coalesce((SELECT d.name FROM public.disciplines AS d WHERE d.id = s::bigint), s)
    WHEN jsonb_typeof(v) = 'boolean' THEN CASE WHEN s = 'true' THEN 'da' ELSE 'ne' END
    WHEN jsonb_typeof(v) = 'number' THEN replace(trim_scale(s::numeric)::text, '.', ',')
    ELSE s
  END;
  RETURN to_jsonb(shown);
END;
$$;

-- "Ustvarjenih 5 izplačil" with the Slovenian noun and verb forms.
CREATE FUNCTION private.audit_created_payments(n integer)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN n % 100 = 1 THEN 'Ustvarjeno ' || n || ' izplačilo'
           WHEN n % 100 = 2 THEN 'Ustvarjeni ' || n || ' izplačili'
           WHEN n % 100 IN (3, 4) THEN 'Ustvarjena ' || n || ' izplačila'
           ELSE 'Ustvarjenih ' || n || ' izplačil'
         END;
$$;

-- A role's tiers as one line: "0-4 h: 20,00 €; 4-8 h: 30,00 €; nad 8 h: 40,00 €".
CREATE FUNCTION private.audit_tiers(p_role_id bigint, p_tariff text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT string_agg(
           CASE WHEN t.hours_to IS NULL
                THEN 'nad ' || replace(trim_scale(t.hours_from)::text, '.', ',') || ' h'
                ELSE replace(trim_scale(t.hours_from)::text, '.', ',') || '–' || replace(trim_scale(t.hours_to)::text, '.', ',') || ' h'
           END || ': ' || private.format_eur(t.rate),
           '; ' ORDER BY t.position)
  FROM public.role_rates AS t
  WHERE t.role_id = p_role_id AND t.tariff = p_tariff;
$$;

-- ===========================================================================
-- 4. The generic row trigger
-- ===========================================================================
CREATE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tbl text := TG_TABLE_NAME;
  o jsonb;
  n jsonb;
  r jsonb;
  k text;
  lbl text;
  ov jsonb;
  nv jsonb;
  ch jsonb := '{}'::jsonb;
  labs text[] := '{}';
  cfg text[] := '{}';
  pw boolean := false;
  sfx text;
  v_entity text;
  v_id bigint;
  v_sum text;
  v_off text;
  v_comp text;
  v_pay public.payments%ROWTYPE;
BEGIN
  IF current_setting('zas.audit_skip', true) = 'on' THEN
    RETURN NULL;
  END IF;

  o := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  n := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  r := coalesce(n, o);

  -- What changed, as {label: [before, after]} with display values.
  FOR k IN SELECT x FROM jsonb_object_keys(r) AS x LOOP
    lbl := private.audit_label(tbl, k);
    CONTINUE WHEN lbl IS NULL;
    ov := coalesce(o -> k, 'null'::jsonb);
    nv := coalesce(n -> k, 'null'::jsonb);
    IF TG_OP = 'UPDATE' THEN
      CONTINUE WHEN ov = nv;
    ELSE
      CONTINUE WHEN r -> k = 'null'::jsonb;
    END IF;
    ch := ch || jsonb_build_object(lbl, jsonb_build_array(private.audit_value(tbl, k, ov), private.audit_value(tbl, k, nv)));
    labs := labs || lower(lbl);
    cfg := cfg || (lower(lbl) || ' ' || coalesce(private.audit_value(tbl, k, ov) #>> '{}', '–')
                   || ' → ' || coalesce(private.audit_value(tbl, k, nv) #>> '{}', '–'));
  END LOOP;

  -- A password change is recorded as the fact only, never as a value or hash.
  IF tbl = 'users' AND TG_OP = 'UPDATE' AND (o ->> 'password') IS DISTINCT FROM (n ->> 'password') THEN
    pw := true;
    ch := ch || jsonb_build_object('Geslo', jsonb_build_array('(skrito)', '(spremenjeno)'));
    labs := labs || 'geslo spremenjeno'::text;
  END IF;

  IF TG_OP = 'UPDATE' AND ch = '{}'::jsonb THEN
    RETURN NULL;  -- nothing a person would care about changed
  END IF;

  sfx := CASE WHEN TG_OP = 'UPDATE' THEN ' (' || array_to_string(labs, ', ') || ')' ELSE '' END;
  v_id := CASE WHEN tbl = 'app_config' THEN NULL ELSE (r ->> 'id')::bigint END;

  IF tbl IN ('competition_officials', 'payments') THEN
    SELECT x.name INTO v_off FROM public.officials AS x WHERE x.id = (r ->> 'official_id')::bigint;
    SELECT x.name INTO v_comp FROM public.competitions AS x WHERE x.id = (r ->> 'competition_id')::bigint;
  ELSIF tbl = 'payment_transactions' THEN
    SELECT * INTO v_pay FROM public.payments AS p WHERE p.id = (r ->> 'payment_id')::bigint;
    SELECT x.name INTO v_off FROM public.officials AS x WHERE x.id = v_pay.official_id;
    SELECT x.name INTO v_comp FROM public.competitions AS x WHERE x.id = v_pay.competition_id;
  END IF;
  v_off := coalesce(v_off, '(izbrisan sodnik)');
  v_comp := coalesce(v_comp, '(izbrisano tekmovanje)');

  IF tbl = 'officials' THEN
    v_entity := 'official';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodan sodnik ' || (r ->> 'name')
      WHEN 'DELETE' THEN 'Izbrisan sodnik ' || (r ->> 'name')
      WHEN 'UPDATE' THEN CASE
        WHEN labs = ARRAY['aktiven'] THEN
          CASE WHEN (n ->> 'active')::boolean THEN 'Aktiviran sodnik ' ELSE 'Deaktiviran sodnik ' END || (n ->> 'name')
        ELSE 'Urejen sodnik ' || (n ->> 'name') || sfx END
    END;
  ELSIF tbl = 'competitions' THEN
    v_entity := 'competition';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodano tekmovanje »' || (r ->> 'name') || '«'
      WHEN 'DELETE' THEN 'Izbrisano tekmovanje »' || (r ->> 'name') || '«'
      ELSE 'Urejeno tekmovanje »' || (n ->> 'name') || '«' || sfx
    END;
  ELSIF tbl = 'competition_officials' THEN
    v_entity := 'assignment';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodeljen sodnik ' || v_off || ' – ' || v_comp
                         || ' (' || coalesce(private.audit_value(tbl, 'role_id', r -> 'role_id') #>> '{}', '?') || ')'
      WHEN 'DELETE' THEN 'Odstranjen sodnik ' || v_off || ' – ' || v_comp
      ELSE 'Urejena dodelitev ' || v_off || ' – ' || v_comp || sfx
    END;
  ELSIF tbl = 'payments' THEN
    v_entity := 'payment';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodano izplačilo ' || v_off || ' – ' || v_comp
      WHEN 'DELETE' THEN 'Izbrisano izplačilo ' || v_off || ' – ' || v_comp
                         || ' (' || private.format_eur((r ->> 'amount_due')::numeric) || ')'
      ELSE 'Urejeno izplačilo ' || v_off || ' – ' || v_comp || sfx
    END;
  ELSIF tbl = 'payment_transactions' THEN
    v_entity := 'payment_transaction';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Zabeleženo plačilo ' || private.format_eur((r ->> 'amount')::numeric)
                         || ' – ' || v_off || ' (' || v_comp || ')'
      WHEN 'DELETE' THEN 'Izbrisano plačilo ' || private.format_eur((r ->> 'amount')::numeric)
                         || ' – ' || v_off || ' (' || v_comp || ')'
      ELSE 'Urejeno plačilo ' || private.format_eur((n ->> 'amount')::numeric)
           || ' – ' || v_off || ' (' || v_comp || ')' || sfx
    END;
  ELSIF tbl = 'roles' THEN
    v_entity := 'role';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodana vloga ' || (r ->> 'name')
      WHEN 'DELETE' THEN 'Izbrisana vloga ' || (r ->> 'name')
      WHEN 'UPDATE' THEN CASE
        WHEN labs = ARRAY['arhivirana'] THEN
          CASE WHEN (n ->> 'archived')::boolean THEN 'Arhivirana vloga ' ELSE 'Obnovljena vloga ' END || (n ->> 'name')
        ELSE 'Urejena vloga ' || (n ->> 'name') || sfx END
    END;
  ELSIF tbl = 'disciplines' THEN
    v_entity := 'discipline';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodana disciplina ' || (r ->> 'name')
      WHEN 'DELETE' THEN 'Izbrisana disciplina ' || (r ->> 'name')
      WHEN 'UPDATE' THEN CASE
        WHEN labs = ARRAY['arhivirana'] THEN
          CASE WHEN (n ->> 'archived')::boolean THEN 'Arhivirana disciplina ' ELSE 'Obnovljena disciplina ' END || (n ->> 'name')
        ELSE 'Urejena disciplina ' || (n ->> 'name') || sfx END
    END;
  ELSIF tbl = 'app_config' THEN
    v_entity := 'config';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodane nastavitve'
      WHEN 'DELETE' THEN 'Izbrisane nastavitve'
      ELSE 'Urejene nastavitve (' || array_to_string(cfg, ', ') || ')'
    END;
  ELSIF tbl = 'users' THEN
    v_entity := 'user';
    v_sum := CASE TG_OP
      WHEN 'INSERT' THEN 'Dodan uporabnik ' || (r ->> 'name') || ' (' || (r ->> 'username') || ')'
      WHEN 'DELETE' THEN 'Izbrisan uporabnik ' || (r ->> 'name') || ' (' || (r ->> 'username') || ')'
      ELSE 'Urejen uporabnik ' || (n ->> 'name') || ' (' || (n ->> 'username') || ')' || sfx
    END;
  ELSE
    RETURN NULL;
  END IF;

  PERFORM private.audit(lower(TG_OP), v_entity, v_id, v_sum, nullif(ch, '{}'::jsonb));
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.officials
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.competition_officials
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
-- Payments are created by generate_payments(), which writes one summary entry.
CREATE TRIGGER audit_row AFTER UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.disciplines
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
-- role_rates has no trigger: save_role() writes one entry for the role and its tiers.

-- ===========================================================================
-- 5. Existing functions, bodies unchanged except for the audit calls
-- ===========================================================================

-- 001 version + audit calls. The failed-login branches keep the same work as
-- before (including the dummy hash for unknown usernames).
CREATE OR REPLACE FUNCTION public.login(username text, password text, remember boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u public.users%ROWTYPE;
  issued_at bigint := floor(extract(epoch FROM now()));
  lifetime integer := CASE WHEN login.remember THEN 30 * 24 * 3600 ELSE 12 * 3600 END;
BEGIN
  SELECT * INTO u FROM public.users AS x WHERE x.username = login.username;

  IF NOT FOUND THEN
    -- Same cost as a real check, so response time does not reveal usernames.
    PERFORM private.hash_password(coalesce(login.password, ''));
    PERFORM private.audit('login_failed', 'auth', NULL,
      'Neuspešna prijava (uporabniško ime »' || left(coalesce(login.username, ''), 100) || '«)',
      NULL, NULL, left(coalesce(login.username, ''), 100));
    RETURN NULL;
  END IF;

  IF NOT private.password_matches(coalesce(login.password, ''), u.password) THEN
    PERFORM private.audit('login_failed', 'auth', u.id,
      'Neuspešna prijava (napačno geslo) – ' || u.name, NULL, u.id, u.username);
    RETURN NULL;
  END IF;

  PERFORM private.audit('login', 'auth', u.id, 'Prijava – ' || u.name, NULL, u.id, u.username);

  RETURN json_build_object(
    'token', private.sign_jwt(jsonb_build_object(
      'role', private.db_role(u.role),
      'user_id', u.id,
      'iat', issued_at,
      'exp', issued_at + lifetime
    )),
    'expires_at', issued_at + lifetime,
    'user', json_build_object('id', u.id, 'username', u.username, 'name', u.name, 'role', u.role)
  );
END;
$$;

-- 002 version + skip flag and one summary entry.
CREATE OR REPLACE FUNCTION public.generate_payments(competition_id bigint, tariff text DEFAULT 'sodnik')
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comp public.competitions%ROWTYPE;
  a record;
  v_amount numeric;
  v_created bigint[] := '{}';
  v_existing integer := 0;
  v_zero integer := 0;
  v_new_id bigint;
  v_total numeric := 0;
  v_prev_skip text := current_setting('zas.audit_skip', true);
BEGIN
  IF generate_payments.tariff IS NULL OR generate_payments.tariff NOT IN ('sodnik', 'racun') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Neveljaven tarifni razred.';
  END IF;

  SELECT * INTO v_comp FROM public.competitions AS c
  WHERE c.id = generate_payments.competition_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tekmovanje ne obstaja.';
  END IF;
  IF v_comp.status IN ('planned', 'cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Za načrtovano ali preklicano tekmovanje izplačil ni mogoče ustvariti.';
  END IF;

  PERFORM set_config('zas.audit_skip', 'on', true);

  FOR a IN
    SELECT x.id, x.competition_id, x.official_id, x.hours, x.kilometers, x.znesek_sodnik, x.znesek_racun,
           r.name AS role_name, d.name AS discipline_name
    FROM public.competition_officials AS x
    JOIN public.roles AS r ON r.id = x.role_id
    LEFT JOIN public.disciplines AS d ON d.id = x.discipline_id
    WHERE x.competition_id = v_comp.id
    ORDER BY x.id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.payments AS p
      WHERE p.assignment_id = a.id OR (p.competition_id = a.competition_id AND p.official_id = a.official_id)
    ) THEN
      v_existing := v_existing + 1;
      CONTINUE;
    END IF;

    v_amount := CASE generate_payments.tariff WHEN 'racun' THEN a.znesek_racun ELSE a.znesek_sodnik END;
    IF v_amount <= 0 THEN
      v_zero := v_zero + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.payments (assignment_id, official_id, competition_id, amount_due, tariff, notes)
    VALUES (a.id, a.official_id, a.competition_id, v_amount, generate_payments.tariff,
            a.role_name || CASE WHEN a.discipline_name IS NOT NULL THEN ' (' || a.discipline_name || ')' ELSE '' END
            || ' - ' || trim_scale(a.hours)::text || 'h, ' || trim_scale(a.kilometers)::text || 'km')
    RETURNING id INTO v_new_id;
    v_created := v_created || v_new_id;
    v_total := v_total + v_amount;
  END LOOP;

  PERFORM set_config('zas.audit_skip', coalesce(v_prev_skip, 'off'), true);
  IF cardinality(v_created) > 0 THEN
    PERFORM private.audit('generate', 'payment', NULL,
      private.audit_created_payments(cardinality(v_created)) || ' – ' || v_comp.name
        || ' (tarifa ' || CASE generate_payments.tariff WHEN 'racun' THEN 'račun' ELSE 'sodnik' END
        || ', skupaj ' || private.format_eur(v_total) || ')');
  END IF;

  RETURN json_build_object(
    'created', cardinality(v_created),
    'skipped_existing', v_existing,
    'skipped_zero', v_zero,
    'payment_ids', to_json(v_created)
  );
END;
$$;

-- 002 version + one entry describing the role and its tiers (row entries for
-- roles are suppressed here; role_rates has no trigger).
CREATE OR REPLACE FUNCTION public.save_role(
  id bigint, name text, sodnik_rates jsonb DEFAULT '[]', racun_rates jsonb DEFAULT '[]', archived boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id bigint := save_role.id;
  v_name text := btrim(coalesce(save_role.name, ''));
  k record;
  v_prev_skip text := current_setting('zas.audit_skip', true);
  v_new boolean := save_role.id IS NULL;
  v_old_name text;
  v_old_archived boolean;
  v_old_sodnik text;
  v_old_racun text;
  v_new_sodnik text;
  v_new_racun text;
  ch jsonb := '{}'::jsonb;
  labs text[] := '{}';
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ime vloge je obvezno.';
  END IF;
  PERFORM private.validate_rate_tiers(save_role.sodnik_rates);
  PERFORM private.validate_rate_tiers(save_role.racun_rates);

  IF NOT v_new THEN
    SELECT r.name, r.archived INTO v_old_name, v_old_archived FROM public.roles AS r WHERE r.id = v_id;
    v_old_sodnik := private.audit_tiers(v_id, 'sodnik');
    v_old_racun := private.audit_tiers(v_id, 'racun');
  END IF;

  PERFORM set_config('zas.audit_skip', 'on', true);

  BEGIN
    IF v_id IS NULL THEN
      INSERT INTO public.roles (name, archived, position)
      VALUES (v_name, coalesce(save_role.archived, false),
              (SELECT coalesce(max(r.position), 0) + 1 FROM public.roles AS r))
      RETURNING roles.id INTO v_id;
    ELSE
      UPDATE public.roles AS r SET name = v_name, archived = coalesce(save_role.archived, false)
      WHERE r.id = v_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Vloga ne obstaja.';
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Vloga s tem imenom že obstaja.';
  END;

  DELETE FROM public.role_rates AS rr WHERE rr.role_id = v_id;
  FOR k IN SELECT * FROM (VALUES ('sodnik', save_role.sodnik_rates), ('racun', save_role.racun_rates)) AS v(tariff, tiers) LOOP
    IF k.tiers IS NOT NULL AND jsonb_typeof(k.tiers) = 'array' THEN
      INSERT INTO public.role_rates (role_id, tariff, position, hours_from, hours_to, rate)
      SELECT v_id, k.tariff, t.ord::integer, (t.x ->> 'from')::numeric,
             CASE WHEN jsonb_typeof(t.x -> 'to') = 'number' THEN (t.x ->> 'to')::numeric END,
             (t.x ->> 'rate')::numeric
      FROM jsonb_array_elements(k.tiers) WITH ORDINALITY AS t(x, ord);
    END IF;
  END LOOP;

  PERFORM set_config('zas.audit_skip', coalesce(v_prev_skip, 'off'), true);

  v_new_sodnik := private.audit_tiers(v_id, 'sodnik');
  v_new_racun := private.audit_tiers(v_id, 'racun');
  IF v_new OR v_old_name IS DISTINCT FROM v_name THEN
    ch := ch || jsonb_build_object('Ime vloge', jsonb_build_array(to_jsonb(v_old_name), to_jsonb(v_name)));
    labs := labs || 'ime vloge'::text;
  END IF;
  IF NOT v_new AND v_old_archived IS DISTINCT FROM coalesce(save_role.archived, false) THEN
    ch := ch || jsonb_build_object('Arhivirana', jsonb_build_array(
      to_jsonb(CASE WHEN v_old_archived THEN 'da' ELSE 'ne' END),
      to_jsonb(CASE WHEN coalesce(save_role.archived, false) THEN 'da' ELSE 'ne' END)));
    labs := labs || 'arhivirana'::text;
  END IF;
  IF v_old_sodnik IS DISTINCT FROM v_new_sodnik THEN
    ch := ch || jsonb_build_object('Stopnje sodnik', jsonb_build_array(to_jsonb(v_old_sodnik), to_jsonb(v_new_sodnik)));
    labs := labs || 'stopnje sodnik'::text;
  END IF;
  IF v_old_racun IS DISTINCT FROM v_new_racun THEN
    ch := ch || jsonb_build_object('Stopnje račun', jsonb_build_array(to_jsonb(v_old_racun), to_jsonb(v_new_racun)));
    labs := labs || 'stopnje račun'::text;
  END IF;

  IF v_new THEN
    PERFORM private.audit('insert', 'role', v_id,
      'Dodana vloga ' || v_name || ' (tarifa sodnik: ' || coalesce(v_new_sodnik, 'brez stopenj')
        || '; tarifa račun: ' || coalesce(v_new_racun, 'brez stopenj') || ')',
      nullif(ch, '{}'::jsonb));
  ELSIF ch <> '{}'::jsonb THEN
    PERFORM private.audit('update', 'role', v_id,
      'Urejena vloga ' || v_name || ' (' || array_to_string(labs, ', ') || ')', ch);
  END IF;

  RETURN v_id;
END;
$$;

-- Listed disciplines get positions 1..n in the given order; the rest follow.
-- (002 version + one entry; position is not a recorded column.)
CREATE OR REPLACE FUNCTION public.reorder_disciplines(ids bigint[])
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer := coalesce(cardinality(reorder_disciplines.ids), 0);
BEGIN
  IF n <> (SELECT count(DISTINCT x) FROM unnest(reorder_disciplines.ids) AS x) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Seznam disciplin vsebuje podvojene vnose.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(reorder_disciplines.ids) AS x
             WHERE NOT EXISTS (SELECT 1 FROM public.disciplines AS d WHERE d.id = x)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Disciplina ne obstaja.';
  END IF;

  UPDATE public.disciplines AS d
  SET position = CASE WHEN o.ord IS NOT NULL THEN o.ord::integer ELSE n + r.rn::integer END
  FROM (SELECT d2.id, row_number() OVER (ORDER BY d2.position, d2.id) AS rn FROM public.disciplines AS d2) AS r
  LEFT JOIN unnest(reorder_disciplines.ids) WITH ORDINALITY AS o(id, ord) ON o.id = r.id
  WHERE d.id = r.id;

  PERFORM private.audit('update', 'discipline', NULL, 'Spremenjen vrstni red disciplin');
END;
$$;

-- 002 version + skip flag and one entry with the counts.
CREATE OR REPLACE FUNCTION public.admin_clear_all_data()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller bigint := private.current_user_id();
  v_prev_skip text := current_setting('zas.audit_skip', true);
  n_tx bigint;
  n_pay bigint;
  n_asg bigint;
  n_comp bigint;
  n_off bigint;
  n_usr bigint;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ni prijavljenega uporabnika.';
  END IF;

  PERFORM set_config('zas.audit_skip', 'on', true);

  DELETE FROM public.payment_transactions;
  GET DIAGNOSTICS n_tx = ROW_COUNT;
  DELETE FROM public.payments;
  GET DIAGNOSTICS n_pay = ROW_COUNT;
  DELETE FROM public.competition_officials;
  GET DIAGNOSTICS n_asg = ROW_COUNT;
  DELETE FROM public.competitions;
  GET DIAGNOSTICS n_comp = ROW_COUNT;
  DELETE FROM public.officials;
  GET DIAGNOSTICS n_off = ROW_COUNT;
  DELETE FROM public.users AS u WHERE u.id <> caller;
  GET DIAGNOSTICS n_usr = ROW_COUNT;

  PERFORM set_config('zas.audit_skip', coalesce(v_prev_skip, 'off'), true);
  PERFORM private.audit('clear_all', 'system', NULL,
    'Izbrisani vsi podatki (sodniki: ' || n_off || ', tekmovanja: ' || n_comp || ', dodelitve: ' || n_asg
      || ', izplačila: ' || n_pay || ', plačila: ' || n_tx || ', drugi uporabniki: ' || n_usr || ')');
END;
$$;

-- ===========================================================================
-- 6. Assertions: any failure rolls the whole migration back
-- ===========================================================================
DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.audit_log) <> 0 THEN
    RAISE EXCEPTION 'Assertion failed: the migration itself must not write audit entries';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'audit_row' AND NOT tgisinternal) <> 9 THEN
    RAISE EXCEPTION 'Assertion failed: expected 9 audit_row triggers';
  END IF;
END
$assert$;

\endif
