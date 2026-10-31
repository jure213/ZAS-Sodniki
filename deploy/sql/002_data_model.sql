-- 002_data_model.sql: v2.0 data model
--
-- Before: money history lived in payments.amount (real, overwritten by partial
-- payments) and free text in payments.remarks; dates were text; roles and
-- disciplines were matched by name; settings were two JSON blobs.
-- After:  typed columns, one row per installment (payment_transactions),
-- assignments carry their own tariff snapshot (base amounts + travel rate,
-- totals are generated columns), roles/disciplines are tables referenced by
-- id, and every money operation is a SQL function.
--
-- Applied by deploy/scripts/migrate.sh in ONE transaction. The \if guard makes
-- re-running a no-op. Every failed preflight check or assertion aborts and
-- rolls everything back, so a failed run changes nothing.
--
-- Rollback: restore the pre-migration backup (see DEPLOYMENT.md section 8).

SELECT to_regclass('public.payment_transactions') IS NOT NULL AS m002_done \gset
\if :m002_done
\echo '002_data_model: already applied, nothing to do.'
\else

-- ===========================================================================
-- 1. Helpers
-- ===========================================================================

-- Text date -> date. Accepts yyyy-mm-dd (optionally with a time part) and
-- d. m. yyyy / d/m/yyyy. Returns NULL for blank or unparseable input.
CREATE FUNCTION private.m002_to_date(t text)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  s text := btrim(regexp_replace(coalesce(t, ''), '[\u00a0\u202f\u2009\u2007]', ' ', 'g'));
  m text[];
BEGIN
  IF s = '' THEN
    RETURN NULL;
  END IF;
  m := regexp_match(s, '^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$');
  IF m IS NOT NULL THEN
    RETURN make_date(m[1]::int, m[2]::int, m[3]::int);
  END IF;
  m := regexp_match(s, '^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})$');
  IF m IS NOT NULL THEN
    RETURN make_date(m[3]::int, m[2]::int, m[1]::int);
  END IF;
  RETURN NULL;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
  RETURN NULL;
END;
$$;

-- "1.234,56 EUR", "99,99 €", "€99.99", "€1,234.56", "1.234" (= 1234) -> numeric.
CREATE FUNCTION private.parse_money_text(t text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  s text := regexp_replace(replace(coalesce(t, ''), '€', ''), '[^0-9.,]', '', 'g');
  dec text := NULL;
  n_dot int;
  n_comma int;
  pos int;
  int_part text;
  frac_part text;
BEGIN
  IF s !~ '[0-9]' THEN
    RETURN NULL;
  END IF;
  n_dot := length(s) - length(replace(s, '.', ''));
  n_comma := length(s) - length(replace(s, ',', ''));

  IF n_dot > 0 AND n_comma > 0 THEN
    -- Both present: the one that comes last is the decimal separator.
    dec := CASE WHEN strpos(reverse(s), '.') < strpos(reverse(s), ',') THEN '.' ELSE ',' END;
  ELSIF n_comma = 1 AND s ~ ',[0-9]{1,2}$' THEN
    dec := ',';
  ELSIF n_dot = 1 AND s ~ '\.[0-9]{1,2}$' THEN
    dec := '.';
  END IF;

  IF dec IS NULL THEN
    int_part := replace(replace(s, '.', ''), ',', '');
    frac_part := NULL;
  ELSE
    pos := length(s) - strpos(reverse(s), dec) + 1;
    int_part := replace(replace(left(s, pos - 1), '.', ''), ',', '');
    frac_part := substr(s, pos + 1);
  END IF;

  IF int_part !~ '^[0-9]+$' OR (frac_part IS NOT NULL AND frac_part !~ '^[0-9]+$') THEN
    RETURN NULL;
  END IF;
  RETURN (int_part || CASE WHEN frac_part IS NULL THEN '' ELSE '.' || frac_part END)::numeric;
END;
$$;

-- Parses the installment lines the v1 app wrote into payments.remarks:
--   "Plačano v celoti: 1.234,56 € (datum: 5. 3. 2025)"
--   "Delno plačilo: €99.99 (datum: 5. 3. 2025)"
-- Free-text lines after an installment line become its note. Lines that start
-- like an installment but cannot be read come back with parsed = false.
CREATE FUNCTION private.parse_payment_remarks(remarks text)
RETURNS TABLE (line_no integer, kind text, amount numeric, paid_on date, note text, parsed boolean)
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  WITH lines AS (
    SELECT t.n::integer AS n,
           btrim(regexp_replace(replace(t.l, E'\u200b', ''), '[\u00a0\u202f\u2009\u2007]', ' ', 'g')) AS s
    FROM regexp_split_to_table(coalesce(remarks, ''), '\r?\n|\r') WITH ORDINALITY AS t(l, n)
  ), m AS (
    SELECT n, s,
           s ~* '^(Delno pla[cč]ilo|Pla[cč]ano v celoti)\s*:' AS is_tx,
           regexp_match(s, '^(Delno pla[cč]ilo|Pla[cč]ano v celoti)\s*:([^()]*)\(\s*datum\s*:\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\s*\)\s*\.?$', 'i') AS g
    FROM lines
  ), grp AS (
    SELECT m.*, count(*) FILTER (WHERE m.is_tx) OVER (ORDER BY m.n) AS gi FROM m
  )
  SELECT tx.n,
         CASE WHEN lower(left(tx.s, 5)) = 'delno' THEN 'partial' ELSE 'full' END,
         private.parse_money_text(tx.g[2]),
         private.m002_to_date(tx.g[5] || '-' || tx.g[4] || '-' || tx.g[3]),
         nn.note,
         private.parse_money_text(tx.g[2]) IS NOT NULL
           AND private.m002_to_date(tx.g[5] || '-' || tx.g[4] || '-' || tx.g[3]) IS NOT NULL
  FROM grp AS tx
  LEFT JOIN LATERAL (
    SELECT nullif(string_agg(x.s, E'\n' ORDER BY x.n), '') AS note
    FROM grp AS x
    WHERE x.gi = tx.gi AND NOT x.is_tx AND x.s <> ''
  ) AS nn ON true
  WHERE tx.is_tx
  ORDER BY tx.n;
$$;

CREATE FUNCTION private.m002_map_method(m text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE lower(btrim(m))
    WHEN 'gotovina' THEN 'gotovina' WHEN 'cash' THEN 'gotovina'
    WHEN 'nakazilo' THEN 'nakazilo' WHEN 'bank_transfer' THEN 'nakazilo' WHEN 'check' THEN 'nakazilo'
    WHEN 'drugo' THEN 'drugo' WHEN 'other' THEN 'drugo'
  END;
$$;

CREATE FUNCTION private.format_eur(amount numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT translate(to_char(amount, 'FM999,999,990.00'), ',.', '.,') || ' €';
$$;

-- Returns a message when the official_roles JSON cannot be migrated, else NULL.
CREATE FUNCTION private.m002_check_roles(j jsonb)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  e jsonb;
  k text;
  t jsonb;
  seen_ids bigint[] := '{}';
  seen_names text[] := '{}';
  rid bigint;
  nm text;
BEGIN
  IF j IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(j) <> 'array' THEN
    RETURN 'settings.official_roles is not a JSON array';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(j) AS x LOOP
    IF jsonb_typeof(e) <> 'object' THEN
      RETURN 'settings.official_roles contains a non-object element';
    END IF;
    IF jsonb_typeof(e -> 'id') IS DISTINCT FROM 'number' OR (e ->> 'id') !~ '^[0-9]+$' OR (e ->> 'id')::bigint < 1 THEN
      RETURN format('role without a positive integer id: %s', left(e::text, 60));
    END IF;
    rid := (e ->> 'id')::bigint;
    nm := e ->> 'name';
    IF jsonb_typeof(e -> 'name') IS DISTINCT FROM 'string' OR btrim(nm) = '' THEN
      RETURN format('role id %s has no name', rid);
    END IF;
    IF rid = ANY (seen_ids) THEN
      RETURN format('duplicate role id %s', rid);
    END IF;
    IF lower(btrim(nm)) = ANY (seen_names) THEN
      RETURN format('duplicate role name (case-insensitive) for role id %s', rid);
    END IF;
    seen_ids := seen_ids || rid;
    seen_names := seen_names || lower(btrim(nm));
    FOREACH k IN ARRAY ARRAY['rates', 'invoiceRates'] LOOP
      IF e ? k AND jsonb_typeof(e -> k) NOT IN ('array', 'null') THEN
        RETURN format('role id %s: %s is not an array', rid, k);
      END IF;
      IF jsonb_typeof(e -> k) = 'array' THEN
        FOR t IN SELECT x FROM jsonb_array_elements(e -> k) AS x LOOP
          IF jsonb_typeof(t) <> 'object'
             OR jsonb_typeof(t -> 'from') IS DISTINCT FROM 'number'
             OR jsonb_typeof(t -> 'rate') IS DISTINCT FROM 'number'
             OR (t ? 'to' AND jsonb_typeof(t -> 'to') NOT IN ('number', 'null')) THEN
            RETURN format('role id %s: malformed tier in %s', rid, k);
          END IF;
          IF (t ->> 'from')::numeric < 0 OR (t ->> 'rate')::numeric < 0
             OR (t ->> 'from')::numeric <> round((t ->> 'from')::numeric, 2)
             OR (t ->> 'rate')::numeric <> round((t ->> 'rate')::numeric, 2)
             OR (jsonb_typeof(t -> 'to') = 'number' AND (
                   (t ->> 'to')::numeric <= (t ->> 'from')::numeric
                   OR ((t ->> 'to')::numeric < 999 AND (t ->> 'to')::numeric <> round((t ->> 'to')::numeric, 2))))
          THEN
            RETURN format('role id %s: tier out of range or with more than 2 decimals in %s', rid, k);
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN 'official_roles could not be read: ' || SQLERRM;
END;
$$;

-- ===========================================================================
-- 2. Preflight: collect every problem, then abort once with the full list.
--    Nothing is modified to make a check pass.
-- ===========================================================================
DO $preflight$
DECLARE
  errs text[] := '{}';
  v text;
  roles_json jsonb;
  app jsonb;
BEGIN
  -- competitions
  SELECT string_agg(DISTINCT coalesce(c.status, '<NULL>'), ', ') INTO v
  FROM public.competitions AS c
  WHERE c.status IS NULL OR c.status NOT IN ('planned', 'completed', 'cancelled', 'free', 'other_zas');
  IF v IS NOT NULL THEN
    errs := errs || format('competitions.status has unknown values: %s', v);
  END IF;

  SELECT string_agg(c.id::text, ', ' ORDER BY c.id) INTO v
  FROM public.competitions AS c
  WHERE btrim(coalesce(c.date, '')) <> '' AND private.m002_to_date(c.date) IS NULL;
  IF v IS NOT NULL THEN
    errs := errs || format('competitions with an unreadable date (ids): %s', v);
  END IF;

  -- payments
  SELECT string_agg(DISTINCT coalesce(p.status, '<NULL>'), ', ') INTO v
  FROM public.payments AS p WHERE p.status IS NULL OR p.status NOT IN ('owed', 'paid');
  IF v IS NOT NULL THEN
    errs := errs || format('payments.status has unknown values: %s', v);
  END IF;

  SELECT string_agg(DISTINCT p.method, ', ') INTO v
  FROM public.payments AS p
  WHERE btrim(coalesce(p.method, '')) <> '' AND private.m002_map_method(p.method) IS NULL;
  IF v IS NOT NULL THEN
    errs := errs || format('payments.method has unknown values: %s', v);
  END IF;

  SELECT string_agg(p.id::text, ', ' ORDER BY p.id) INTO v
  FROM public.payments AS p
  WHERE p.amount IS NULL OR p.znesek_sodnik IS NULL OR p.znesek_racun IS NULL
     OR p.amount < 0 OR p.znesek_sodnik < 0 OR p.znesek_racun < 0;
  IF v IS NOT NULL THEN
    errs := errs || format('payments with NULL or negative amounts (ids): %s', v);
  END IF;

  SELECT string_agg(p.id::text, ', ' ORDER BY p.id) INTO v
  FROM public.payments AS p
  WHERE btrim(coalesce(p.date_paid, '')) <> '' AND private.m002_to_date(p.date_paid) IS NULL;
  IF v IS NOT NULL THEN
    errs := errs || format('payments with an unreadable date_paid (ids): %s', v);
  END IF;

  SELECT string_agg(x.ids, '; ') INTO v FROM (
    SELECT format('competition %s / official %s: payments %s', p.competition_id, p.official_id,
                  string_agg(p.id::text, ',' ORDER BY p.id)) AS ids
    FROM public.payments AS p
    WHERE p.competition_id IS NOT NULL AND p.official_id IS NOT NULL
    GROUP BY p.competition_id, p.official_id HAVING count(*) > 1
    ORDER BY min(p.id) LIMIT 50
  ) AS x;
  IF v IS NOT NULL THEN
    errs := errs || format('several payments for the same official in one competition: %s', v);
  END IF;

  SELECT string_agg(DISTINCT p.id::text, ', ') INTO v
  FROM public.payments AS p, LATERAL private.parse_payment_remarks(p.remarks) AS r
  WHERE NOT r.parsed;
  IF v IS NOT NULL THEN
    errs := errs || format('payments whose remarks contain an unreadable installment line (ids): %s', v);
  END IF;

  SELECT string_agg(DISTINCT p.id::text, ', ') INTO v
  FROM public.payments AS p, LATERAL private.parse_payment_remarks(p.remarks) AS r
  WHERE r.parsed AND r.amount <= 0;
  IF v IS NOT NULL THEN
    errs := errs || format('payments whose remarks contain a zero installment (ids): %s', v);
  END IF;

  -- assignments
  SELECT string_agg(a.id::text, ', ' ORDER BY a.id) INTO v
  FROM public.competition_officials AS a
  WHERE a.competition_id IS NULL OR a.official_id IS NULL OR btrim(coalesce(a.role, '')) = ''
     OR a.znesek_sodnik IS NULL OR a.znesek_racun IS NULL
     OR a.znesek_sodnik < 0 OR a.znesek_racun < 0;
  IF v IS NOT NULL THEN
    errs := errs || format('assignments with NULL competition/official/role/amount or negative amounts (ids): %s', v);
  END IF;

  SELECT string_agg(a.id::text, ', ' ORDER BY a.id) INTO v
  FROM public.competition_officials AS a
  WHERE coalesce(a.hours, 0) < 0 OR coalesce(a.kilometers, 0) < 0
     OR coalesce(a.hours::numeric, 0) <> round(coalesce(a.hours::numeric, 0), 2)
     OR coalesce(a.kilometers::numeric, 0) <> round(coalesce(a.kilometers::numeric, 0), 4);
  IF v IS NOT NULL THEN
    errs := errs || format('assignments with negative or too precise hours/kilometers (ids): %s', v);
  END IF;

  SELECT string_agg(x.s, '; ') INTO v FROM (
    SELECT format('competition %s / official %s: assignments %s', a.competition_id, a.official_id,
                  string_agg(a.id::text, ',' ORDER BY a.id)) AS s
    FROM public.competition_officials AS a
    WHERE a.competition_id IS NOT NULL AND a.official_id IS NOT NULL
    GROUP BY a.competition_id, a.official_id HAVING count(*) > 1
    ORDER BY min(a.id) LIMIT 50
  ) AS x;
  IF v IS NOT NULL THEN
    errs := errs || format('DUPLICATE assignments (same official twice in one competition); merge or delete them first: %s', v);
  END IF;

  -- settings
  SELECT s.value INTO roles_json FROM public.settings AS s WHERE s.key = 'official_roles';
  v := private.m002_check_roles(roles_json);
  IF v IS NOT NULL THEN
    errs := errs || v;
  END IF;

  SELECT s.value INTO app FROM public.settings AS s WHERE s.key = 'app_settings';
  IF app IS NOT NULL THEN
    IF jsonb_typeof(app) <> 'object' THEN
      errs := errs || 'settings.app_settings is not a JSON object';
    ELSE
      IF app ? 'travelCostPerKm' AND (jsonb_typeof(app -> 'travelCostPerKm') <> 'number'
         OR (app ->> 'travelCostPerKm')::numeric < 0 OR (app ->> 'travelCostPerKm')::numeric >= 100) THEN
        errs := errs || 'app_settings.travelCostPerKm is not a number between 0 and 100';
      END IF;
      IF app ? 'disciplines' AND jsonb_typeof(app -> 'disciplines') <> 'array' THEN
        errs := errs || 'app_settings.disciplines is not an array';
      ELSIF jsonb_typeof(app -> 'disciplines') = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(app -> 'disciplines') AS d WHERE jsonb_typeof(d) <> 'string' OR btrim(d #>> '{}') = ''
      ) THEN
        errs := errs || 'app_settings.disciplines contains a non-string or blank entry';
      END IF;
      IF app ? 'defaultPaymentMethod' AND jsonb_typeof(app -> 'defaultPaymentMethod') = 'string'
         AND private.m002_map_method(app ->> 'defaultPaymentMethod') IS NULL THEN
        errs := errs || format('app_settings.defaultPaymentMethod is unknown: %s', app ->> 'defaultPaymentMethod');
      END IF;
    END IF;
  END IF;

  IF cardinality(errs) > 0 THEN
    RAISE EXCEPTION E'Migration 002 aborted: the data needs attention first (nothing was changed).\n  - %',
      array_to_string(errs, E'\n  - ')
      USING ERRCODE = 'P0001';
  END IF;
END
$preflight$;

-- ===========================================================================
-- 3. Snapshots (audit trail; no API role can read the private schema)
-- ===========================================================================
CREATE TABLE private.m002_payments AS TABLE public.payments;
CREATE TABLE private.m002_competition_officials AS TABLE public.competition_officials;
CREATE TABLE private.m002_competitions AS
  SELECT id, name, date, status, type FROM public.competitions;
CREATE TABLE private.m002_officials AS SELECT id, active FROM public.officials;
CREATE TABLE private.m002_settings AS TABLE public.settings;
REVOKE ALL ON private.m002_payments, private.m002_competition_officials, private.m002_competitions,
              private.m002_officials, private.m002_settings FROM PUBLIC;

-- Everything the migration had to decide on its own; read by reports/002_report.sql.
CREATE TABLE private.m002_flags (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category  text NOT NULL,
  entity    text NOT NULL,
  entity_id bigint,
  detail    text
);
REVOKE ALL ON private.m002_flags FROM PUBLIC;

-- ===========================================================================
-- 4. app_config (one typed row, seeded from settings.app_settings)
-- ===========================================================================
CREATE TABLE public.app_config (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  travel_cost_per_km     numeric(6,4) NOT NULL DEFAULT 0.37 CHECK (travel_cost_per_km >= 0),
  default_payment_method text NOT NULL DEFAULT 'nakazilo'
                         CHECK (default_payment_method IN ('gotovina', 'nakazilo', 'drugo')),
  min_client_version     text
);

INSERT INTO public.app_config (travel_cost_per_km, default_payment_method)
SELECT coalesce(round((s.value ->> 'travelCostPerKm')::numeric, 4), 0.37),
       coalesce(private.m002_map_method(s.value ->> 'defaultPaymentMethod'), 'nakazilo')
FROM (SELECT (SELECT value FROM private.m002_settings WHERE key = 'app_settings') AS value) AS s;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'app_config_rounded', 'app_config', NULL, 'travelCostPerKm had more than 4 decimals'
FROM private.m002_settings AS s
WHERE s.key = 'app_settings' AND s.value ? 'travelCostPerKm'
  AND (s.value ->> 'travelCostPerKm')::numeric <> round((s.value ->> 'travelCostPerKm')::numeric, 4);

-- ===========================================================================
-- 5. roles, role_rates, disciplines
-- ===========================================================================
CREATE TABLE public.roles (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name       text NOT NULL CHECK (btrim(name) <> ''),
  archived   boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roles_name_key ON public.roles (lower(btrim(name)));

-- Fixed-price tiers: a tier applies when hours_from < hours <= hours_to
-- (hours_to NULL = no upper limit). The first matching tier by position wins.
CREATE TABLE public.role_rates (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  role_id    bigint NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  tariff     text NOT NULL CHECK (tariff IN ('sodnik', 'racun')),
  position   integer NOT NULL,
  hours_from numeric(6,2) NOT NULL CHECK (hours_from >= 0),
  hours_to   numeric(6,2),
  rate       numeric(10,2) NOT NULL CHECK (rate >= 0),
  CHECK (hours_to IS NULL OR hours_to > hours_from),
  UNIQUE (role_id, tariff, position)
);

CREATE TABLE public.disciplines (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name       text NOT NULL CHECK (btrim(name) <> ''),
  archived   boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX disciplines_name_key ON public.disciplines (lower(btrim(name)));

-- Roles from the JSON, ids kept.
INSERT INTO public.roles (id, name, position)
SELECT (e ->> 'id')::bigint, e ->> 'name', a.ord::integer
FROM private.m002_settings AS s,
     LATERAL jsonb_array_elements(s.value) WITH ORDINALITY AS a(e, ord)
WHERE s.key = 'official_roles';

-- Role names used by assignments but missing from the JSON: archived roles.
-- A name that only differs in case/spaces is mapped to the existing role.
INSERT INTO public.roles (name, archived, position)
SELECT u.name, true, (SELECT coalesce(max(position), 0) FROM public.roles) + (row_number() OVER (ORDER BY u.name))::integer
FROM (
  SELECT DISTINCT ON (lower(btrim(a.role))) btrim(a.role) AS name
  FROM private.m002_competition_officials AS a
  WHERE NOT EXISTS (SELECT 1 FROM public.roles AS r WHERE lower(btrim(r.name)) = lower(btrim(a.role)))
  ORDER BY lower(btrim(a.role)), btrim(a.role)
) AS u;

SELECT setval(pg_get_serial_sequence('public.roles', 'id'), greatest((SELECT max(id) FROM public.roles), 1)) AS _ \gset

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'archived_role', 'role', r.id, 'used by assignments but not defined in settings; no tiers'
FROM public.roles AS r WHERE r.archived;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'role_matched_loosely', 'role', r.id, 'assignment role text differed in case/spacing: ' || a.role
FROM (SELECT DISTINCT role FROM private.m002_competition_officials) AS a
JOIN public.roles AS r ON lower(btrim(r.name)) = lower(btrim(a.role))
WHERE r.name <> a.role;

-- Tiers. 'to' >= 999 (the old "unlimited" marker) or missing becomes NULL.
-- Legacy fallback of the old app: no invoiceRates -> invoice used rates.
INSERT INTO public.role_rates (role_id, tariff, position, hours_from, hours_to, rate)
SELECT (e ->> 'id')::bigint, k.tariff, t.ord::integer,
       (t.x ->> 'from')::numeric,
       CASE WHEN jsonb_typeof(t.x -> 'to') = 'number' AND (t.x ->> 'to')::numeric < 999
            THEN (t.x ->> 'to')::numeric END,
       (t.x ->> 'rate')::numeric
FROM private.m002_settings AS s,
     LATERAL jsonb_array_elements(s.value) AS e,
     LATERAL (VALUES ('sodnik', 'rates'), ('racun', 'invoiceRates')) AS k(tariff, key),
     LATERAL jsonb_array_elements(
       CASE WHEN k.tariff = 'racun' AND coalesce(jsonb_array_length(e -> 'invoiceRates'), 0) = 0
            THEN coalesce(e -> 'rates', '[]'::jsonb)
            ELSE coalesce(e -> k.key, '[]'::jsonb) END
     ) WITH ORDINALITY AS t(x, ord)
WHERE s.key = 'official_roles';

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'racun_tiers_copied_from_sodnik', 'role', (e ->> 'id')::bigint,
       'no invoiceRates; the old app used the sodnik tiers for invoices, now stored explicitly'
FROM private.m002_settings AS s, LATERAL jsonb_array_elements(s.value) AS e
WHERE s.key = 'official_roles'
  AND coalesce(jsonb_array_length(e -> 'invoiceRates'), 0) = 0
  AND coalesce(jsonb_array_length(e -> 'rates'), 0) > 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'role_hourly_rate_not_migrated', 'role', (e ->> 'id')::bigint,
       'legacy hourlyRate=' || (e ->> 'hourlyRate') || ' cannot be expressed as tiers; existing amounts are kept'
FROM private.m002_settings AS s, LATERAL jsonb_array_elements(s.value) AS e
WHERE s.key = 'official_roles' AND (e ->> 'hourlyRate') IS NOT NULL
  AND coalesce((e ->> 'hourlyRate')::numeric, 0) <> 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT DISTINCT 'overlapping_tiers', 'role', a.role_id, a.tariff
FROM public.role_rates AS a
JOIN public.role_rates AS b
  ON b.role_id = a.role_id AND b.tariff = a.tariff AND a.position < b.position
 AND a.hours_from < coalesce(b.hours_to, 'Infinity'::numeric)
 AND b.hours_from < coalesce(a.hours_to, 'Infinity'::numeric);

-- Disciplines: the settings list in its order, then values in use (archived).
INSERT INTO public.disciplines (name, position)
SELECT d.name, (row_number() OVER (ORDER BY d.ord))::integer
FROM (
  SELECT DISTINCT ON (lower(btrim(x.name))) btrim(x.name) AS name, x.ord
  FROM private.m002_settings AS s,
       LATERAL jsonb_array_elements_text(coalesce(s.value -> 'disciplines', '[]'::jsonb)) WITH ORDINALITY AS x(name, ord)
  WHERE s.key = 'app_settings'
  ORDER BY lower(btrim(x.name)), x.ord
) AS d;

INSERT INTO public.disciplines (name, archived, position)
SELECT u.name, true, (SELECT coalesce(max(position), 0) FROM public.disciplines) + (row_number() OVER (ORDER BY u.name))::integer
FROM (
  SELECT DISTINCT ON (lower(btrim(a.discipline))) btrim(a.discipline) AS name
  FROM private.m002_competition_officials AS a
  WHERE btrim(coalesce(a.discipline, '')) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.disciplines AS d WHERE lower(btrim(d.name)) = lower(btrim(a.discipline)))
  ORDER BY lower(btrim(a.discipline)), btrim(a.discipline)
) AS u;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'archived_discipline', 'discipline', d.id, 'used by assignments but not in the settings list'
FROM public.disciplines AS d WHERE d.archived;

-- Tier lookup shared by the migration checks and the SQL tests.
CREATE FUNCTION private.tier_rate(role_id bigint, tariff text, hours numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT r.rate FROM public.role_rates AS r
    WHERE r.role_id = tier_rate.role_id AND r.tariff = tier_rate.tariff
      AND tier_rate.hours > r.hours_from
      AND (r.hours_to IS NULL OR tier_rate.hours <= r.hours_to)
    ORDER BY r.position LIMIT 1
  ), 0);
$$;

-- ===========================================================================
-- 6. competitions, officials
-- ===========================================================================
ALTER TABLE public.competitions
  ALTER COLUMN date TYPE date USING private.m002_to_date(date),
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'planned',
  ADD CONSTRAINT competitions_status_check
    CHECK (status IN ('planned', 'completed', 'cancelled', 'free', 'other_zas')),
  DROP COLUMN type;
CREATE INDEX idx_competitions_date ON public.competitions (date);

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'sentinel_date', 'competition', c.id, c.date::text
FROM public.competitions AS c WHERE c.date < DATE '1901-01-01';

ALTER TABLE public.officials ALTER COLUMN active DROP DEFAULT;
ALTER TABLE public.officials
  ALTER COLUMN active TYPE boolean USING (coalesce(active, 0) <> 0);
ALTER TABLE public.officials
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL;

-- ===========================================================================
-- 7. competition_officials (assignments)
-- ===========================================================================
ALTER TABLE public.competition_officials
  ADD COLUMN role_id       bigint,
  ADD COLUMN discipline_id bigint,
  ADD COLUMN base_sodnik   numeric(10,2),
  ADD COLUMN base_racun    numeric(10,2),
  ADD COLUMN travel_rate   numeric(6,4);

ALTER TABLE public.competition_officials ALTER COLUMN hours DROP DEFAULT;
ALTER TABLE public.competition_officials ALTER COLUMN kilometers DROP DEFAULT;
UPDATE public.competition_officials SET hours = coalesce(hours, 0), kilometers = coalesce(kilometers, 0);
ALTER TABLE public.competition_officials
  ALTER COLUMN hours TYPE numeric(5,2) USING round(hours::numeric, 2),
  ALTER COLUMN kilometers TYPE numeric(10,4) USING round(kilometers::numeric, 4);
ALTER TABLE public.competition_officials
  ALTER COLUMN hours SET DEFAULT 0,
  ALTER COLUMN hours SET NOT NULL,
  ALTER COLUMN kilometers SET DEFAULT 0,
  ALTER COLUMN kilometers SET NOT NULL;

UPDATE public.competition_officials AS a
SET role_id = (SELECT r.id FROM public.roles AS r WHERE lower(btrim(r.name)) = lower(btrim(a.role))),
    discipline_id = (SELECT d.id FROM public.disciplines AS d
                     WHERE btrim(coalesce(a.discipline, '')) <> ''
                       AND lower(btrim(d.name)) = lower(btrim(a.discipline)));

-- Tariff snapshot: base = stored total - travel at today's rate. Totals stay
-- identical by construction. In free / other_zas competitions where the
-- stored total is below the travel amount (the v1 free-competition bug that
-- made D1's ZNESEK negative) the travel rate is set to 0 instead.
UPDATE public.competition_officials AS a
SET travel_rate = CASE
      WHEN c.status IN ('free', 'other_zas')
       AND (a.znesek_sodnik < round(a.kilometers * cfg.travel_cost_per_km, 2)
         OR a.znesek_racun  < round(a.kilometers * cfg.travel_cost_per_km, 2))
      THEN 0
      ELSE cfg.travel_cost_per_km END
FROM public.competitions AS c, public.app_config AS cfg
WHERE c.id = a.competition_id;

UPDATE public.competition_officials AS a
SET base_sodnik = a.znesek_sodnik - round(a.kilometers * a.travel_rate, 2),
    base_racun  = a.znesek_racun  - round(a.kilometers * a.travel_rate, 2);

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'free_travel_zeroed', 'assignment', a.id, 'free/other_zas competition with km > 0: travel_rate set to 0'
FROM public.competition_officials AS a
WHERE a.travel_rate = 0 AND a.kilometers > 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'negative_base', 'assignment', a.id,
       CASE WHEN a.base_sodnik < 0 AND a.base_racun < 0 THEN 'sodnik+racun'
            WHEN a.base_sodnik < 0 THEN 'sodnik' ELSE 'racun' END
FROM public.competition_officials AS a
WHERE a.base_sodnik < 0 OR a.base_racun < 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'base_differs_from_tier', 'assignment', a.id,
       k.tariff || ': stored base ' || b.base || ' vs tier ' || b.expected
FROM public.competition_officials AS a
JOIN public.competitions AS c ON c.id = a.competition_id
CROSS JOIN LATERAL (VALUES ('sodnik'), ('racun')) AS k(tariff)
CROSS JOIN LATERAL (
  SELECT CASE k.tariff WHEN 'sodnik' THEN a.base_sodnik ELSE a.base_racun END AS base,
         CASE WHEN c.status IN ('free', 'other_zas') THEN 0
              ELSE private.tier_rate(a.role_id, k.tariff, a.hours) END AS expected
) AS b
WHERE b.base <> b.expected;

ALTER TABLE public.competition_officials
  ALTER COLUMN base_sodnik SET NOT NULL, ALTER COLUMN base_sodnik SET DEFAULT 0,
  ALTER COLUMN base_racun  SET NOT NULL, ALTER COLUMN base_racun  SET DEFAULT 0,
  ALTER COLUMN travel_rate SET NOT NULL, ALTER COLUMN travel_rate SET DEFAULT 0,
  ALTER COLUMN role_id SET NOT NULL,
  ALTER COLUMN competition_id SET NOT NULL,
  ALTER COLUMN official_id SET NOT NULL;

ALTER TABLE public.competition_officials
  DROP COLUMN znesek_sodnik, DROP COLUMN znesek_racun, DROP COLUMN role, DROP COLUMN discipline;

ALTER TABLE public.competition_officials
  ADD COLUMN travel_amount numeric(10,2) GENERATED ALWAYS AS (round(kilometers * travel_rate, 2)) STORED,
  ADD COLUMN znesek_sodnik numeric(10,2) GENERATED ALWAYS AS (base_sodnik + round(kilometers * travel_rate, 2)) STORED,
  ADD COLUMN znesek_racun  numeric(10,2) GENERATED ALWAYS AS (base_racun  + round(kilometers * travel_rate, 2)) STORED;

ALTER TABLE public.competition_officials
  ADD CONSTRAINT competition_officials_hours_check CHECK (hours >= 0),
  ADD CONSTRAINT competition_officials_km_check CHECK (kilometers >= 0),
  ADD CONSTRAINT competition_officials_travel_rate_check CHECK (travel_rate >= 0),
  DROP CONSTRAINT competition_officials_official_id_fkey,
  ADD CONSTRAINT competition_officials_official_id_fkey
    FOREIGN KEY (official_id) REFERENCES public.officials (id) ON DELETE RESTRICT,
  ADD CONSTRAINT competition_officials_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES public.roles (id) ON DELETE RESTRICT,
  ADD CONSTRAINT competition_officials_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines (id) ON DELETE RESTRICT,
  ADD CONSTRAINT competition_officials_one_per_competition UNIQUE (competition_id, official_id),
  ADD CONSTRAINT competition_officials_id_pair_key UNIQUE (id, competition_id, official_id);
-- competition_officials_competition_id_fkey (ON DELETE CASCADE) is kept.
CREATE INDEX idx_competition_officials_role ON public.competition_officials (role_id);
CREATE INDEX idx_competition_officials_discipline ON public.competition_officials (discipline_id);

-- ===========================================================================
-- 8. payments and payment_transactions
-- ===========================================================================
CREATE TABLE public.payment_transactions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  amount     numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_on    date NOT NULL,
  method     text NOT NULL CHECK (method IN ('gotovina', 'nakazilo', 'drugo')),
  note       text,
  source     text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'remarks', 'inferred')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint
);
CREATE INDEX idx_payment_transactions_payment ON public.payment_transactions (payment_id);
CREATE INDEX idx_payment_transactions_paid_on ON public.payment_transactions (paid_on);

ALTER TABLE public.payments
  ADD COLUMN assignment_id bigint,
  ADD COLUMN amount_due    numeric(10,2),
  ADD COLUMN tariff        text;
ALTER TABLE public.payments RENAME COLUMN remarks TO legacy_remarks;

-- What each old payment becomes (kept for the report and the assertions).
--   owed: due = remaining + parsed installments (remaining stays exactly as it was)
--   paid: due = tariff amount (or the parsed sum if larger); a difference to the
--         parsed installments becomes ONE inferred transaction dated date_paid
CREATE TABLE private.m002_payment_plan AS
WITH base AS (
  SELECT s.id, s.status, s.method, s.znesek_sodnik, s.znesek_racun, s.date_paid, s.created_at,
         round(s.amount::numeric, 2) AS amount_n,
         coalesce((SELECT sum(r.amount) FROM private.parse_payment_remarks(s.remarks) AS r), 0) AS parsed_sum,
         (SELECT count(*) FROM private.parse_payment_remarks(s.remarks)) AS parsed_n
  FROM private.m002_payments AS s
), t AS (
  SELECT b.*,
         CASE WHEN b.znesek_racun <> b.znesek_sodnik
               AND (CASE b.status WHEN 'paid' THEN b.parsed_sum ELSE b.amount_n + b.parsed_sum END) = b.znesek_racun
              THEN 'racun' ELSE 'sodnik' END AS tariff
  FROM base AS b
)
SELECT t.id, t.status, t.tariff, t.parsed_sum, t.parsed_n, t.amount_n,
       CASE WHEN t.tariff = 'racun' THEN t.znesek_racun ELSE t.znesek_sodnik END AS tariff_amount,
       CASE t.status
         WHEN 'paid' THEN greatest(CASE WHEN t.tariff = 'racun' THEN t.znesek_racun ELSE t.znesek_sodnik END, t.parsed_sum)
         ELSE t.amount_n + t.parsed_sum END AS amount_due,
       CASE WHEN t.status = 'paid'
            THEN greatest(CASE WHEN t.tariff = 'racun' THEN t.znesek_racun ELSE t.znesek_sodnik END, t.parsed_sum) - t.parsed_sum
            ELSE 0 END AS inferred_amount,
       coalesce(private.m002_to_date(t.date_paid), t.created_at::date) AS inferred_date,
       private.m002_to_date(t.date_paid) IS NULL AS date_paid_missing,
       private.m002_map_method(t.method) AS mapped_method
FROM t;
REVOKE ALL ON private.m002_payment_plan FROM PUBLIC;

UPDATE public.payments AS p
SET amount_due = pl.amount_due, tariff = pl.tariff
FROM private.m002_payment_plan AS pl WHERE pl.id = p.id;

-- Installments from the old remarks lines.
INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method, note, source)
SELECT pl.id, r.amount, r.paid_on,
       coalesce(pl.mapped_method, (SELECT default_payment_method FROM public.app_config)),
       r.note, 'remarks'
FROM private.m002_payment_plan AS pl
JOIN private.m002_payments AS s ON s.id = pl.id,
     LATERAL private.parse_payment_remarks(s.remarks) AS r
ORDER BY pl.id, r.line_no;

-- Paid rows whose installments do not add up: one inferred transaction.
INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method, note, source)
SELECT pl.id, pl.inferred_amount, pl.inferred_date,
       coalesce(pl.mapped_method, (SELECT default_payment_method FROM public.app_config)),
       'Izpeljano iz stanja pred migracijo 002 (v1 je zapisal samo status in datum)', 'inferred'
FROM private.m002_payment_plan AS pl
WHERE pl.inferred_amount > 0
ORDER BY pl.id;

-- Link to the assignment (1:1 by competition + official; none => orphan).
UPDATE public.payments AS p
SET assignment_id = a.id
FROM public.competition_officials AS a
WHERE a.competition_id = p.competition_id AND a.official_id = p.official_id;

-- Flags for everything the plan decided.
INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'orphan_payment', 'payment', p.id, 'no assignment for this competition + official'
FROM public.payments AS p WHERE p.assignment_id IS NULL;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'inferred_transaction', 'payment', pl.id,
       'paid; installments in remarks sum to ' || pl.parsed_sum || ' of ' || pl.amount_due
FROM private.m002_payment_plan AS pl WHERE pl.inferred_amount > 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'paid_date_missing', 'payment', pl.id, 'paid without date_paid; transaction dated by created_at'
FROM private.m002_payment_plan AS pl WHERE pl.inferred_amount > 0 AND pl.date_paid_missing;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'paid_exceeds_tariff', 'payment', pl.id, 'installments ' || pl.parsed_sum || ' > tariff amount ' || pl.tariff_amount
FROM private.m002_payment_plan AS pl WHERE pl.status = 'paid' AND pl.parsed_sum > pl.tariff_amount;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'owed_due_differs_from_tariff', 'payment', pl.id,
       'remaining + installments = ' || pl.amount_due || ' (tariff ' || pl.tariff_amount || ')'
FROM private.m002_payment_plan AS pl WHERE pl.status = 'owed' AND pl.amount_due <> pl.tariff_amount;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'paid_with_nonzero_amount', 'payment', pl.id, 'old amount ' || pl.amount_n || ' ignored (paid => remaining 0)'
FROM private.m002_payment_plan AS pl WHERE pl.status = 'paid' AND pl.amount_n <> 0;

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'tariff_racun', 'payment', pl.id, 'amounts match the invoice tariff'
FROM private.m002_payment_plan AS pl WHERE pl.tariff = 'racun';

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'method_defaulted', 'payment', pl.id, 'no method on the old row; installments use the default method'
FROM private.m002_payment_plan AS pl
WHERE pl.mapped_method IS NULL AND (pl.parsed_n > 0 OR pl.inferred_amount > 0);

INSERT INTO private.m002_flags (category, entity, entity_id, detail)
SELECT 'payment_date_differs', 'payment', s.id, 'payments.date ' || s.date || ' vs competition ' || c.date
FROM private.m002_payments AS s
JOIN public.competitions AS c ON c.id = s.competition_id
WHERE private.m002_to_date(s.date) IS DISTINCT FROM c.date;

-- Drop the old columns on purpose: v1.1.x clients must fail loudly, not write
-- wrong data. (payments.date is the competition date and is no longer stored.)
DROP INDEX IF EXISTS public.idx_payments_status;
ALTER TABLE public.payments
  DROP COLUMN amount, DROP COLUMN status, DROP COLUMN date_paid, DROP COLUMN method,
  DROP COLUMN znesek_sodnik, DROP COLUMN znesek_racun, DROP COLUMN date;

ALTER TABLE public.payments
  ALTER COLUMN amount_due SET NOT NULL,
  ALTER COLUMN tariff SET NOT NULL,
  ADD CONSTRAINT payments_amount_due_check CHECK (amount_due >= 0),
  ADD CONSTRAINT payments_tariff_check CHECK (tariff IN ('sodnik', 'racun')),
  ADD CONSTRAINT payments_assignment_id_key UNIQUE (assignment_id),
  DROP CONSTRAINT payments_competition_id_fkey,
  DROP CONSTRAINT payments_official_id_fkey,
  ADD CONSTRAINT payments_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES public.competitions (id) ON DELETE RESTRICT,
  ADD CONSTRAINT payments_official_id_fkey
    FOREIGN KEY (official_id) REFERENCES public.officials (id) ON DELETE RESTRICT,
  -- MATCH SIMPLE: orphans (assignment_id NULL) are not checked; linked rows must agree.
  ADD CONSTRAINT payments_assignment_fkey
    FOREIGN KEY (assignment_id, competition_id, official_id)
    REFERENCES public.competition_officials (id, competition_id, official_id) ON DELETE RESTRICT;

-- Installments can never add up to more than the amount due, whoever writes.
CREATE FUNCTION private.check_transaction_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_due numeric;
  v_other numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_id <> OLD.payment_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Plačila ni mogoče prestaviti na drugo izplačilo.';
  END IF;
  SELECT p.amount_due INTO v_due FROM public.payments AS p WHERE p.id = NEW.payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;  -- the foreign key reports it
  END IF;
  SELECT coalesce(sum(t.amount), 0) INTO v_other
  FROM public.payment_transactions AS t
  WHERE t.payment_id = NEW.payment_id AND (TG_OP = 'INSERT' OR t.id <> NEW.id);
  IF v_other + NEW.amount > v_due THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Skupni znesek plačil presega znesek izplačila.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_transactions_total
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION private.check_transaction_total();

CREATE FUNCTION private.check_amount_due()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paid numeric;
BEGIN
  SELECT coalesce(sum(t.amount), 0) INTO v_paid
  FROM public.payment_transactions AS t WHERE t.payment_id = NEW.id;
  IF NEW.amount_due < v_paid THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Znesek izplačila ne sme biti manjši od že plačanega (' || private.format_eur(v_paid) || ').';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_amount_due
  BEFORE UPDATE OF amount_due ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.check_amount_due();

-- ===========================================================================
-- 9. Views (security_invoker: callers' own privileges apply)
-- ===========================================================================
CREATE VIEW public.payment_balances WITH (security_invoker = true) AS
SELECT p.id,
       p.assignment_id,
       p.official_id,
       p.competition_id,
       o.name AS official_name,
       c.name AS competition_name,
       c.date AS competition_date,
       c.status AS competition_status,
       p.tariff,
       p.amount_due,
       coalesce(t.paid_total, 0) AS paid_total,
       p.amount_due - coalesce(t.paid_total, 0) AS remaining,
       CASE WHEN p.amount_due - coalesce(t.paid_total, 0) <= 0 THEN 'paid'
            WHEN coalesce(t.paid_total, 0) > 0 THEN 'partial'
            ELSE 'owed' END AS status,
       t.last_paid_on,
       coalesce(t.n, 0) AS installments,
       p.notes,
       p.legacy_remarks,
       p.created_at
FROM public.payments AS p
LEFT JOIN public.officials AS o ON o.id = p.official_id
LEFT JOIN public.competitions AS c ON c.id = p.competition_id
LEFT JOIN LATERAL (
  SELECT sum(x.amount) AS paid_total, max(x.paid_on) AS last_paid_on, count(*)::integer AS n
  FROM public.payment_transactions AS x WHERE x.payment_id = p.id
) AS t ON true;

CREATE VIEW public.assignment_details WITH (security_invoker = true) AS
SELECT a.id,
       a.competition_id,
       a.official_id,
       a.role_id,
       a.discipline_id,
       a.hours,
       a.kilometers,
       a.notes,
       a.base_sodnik,
       a.base_racun,
       a.travel_rate,
       a.travel_amount,
       a.znesek_sodnik,
       a.znesek_racun,
       o.name AS official_name,
       o.rank AS official_rank,
       o.active AS official_active,
       r.name AS role_name,
       r.archived AS role_archived,
       d.name AS discipline_name,
       d.archived AS discipline_archived,
       c.name AS competition_name,
       c.date AS competition_date,
       c.location AS competition_location,
       c.status AS competition_status,
       pb.id AS payment_id,
       pb.tariff AS payment_tariff,
       pb.amount_due,
       pb.paid_total,
       pb.remaining,
       pb.status AS payment_status
FROM public.competition_officials AS a
JOIN public.officials AS o ON o.id = a.official_id
JOIN public.competitions AS c ON c.id = a.competition_id
JOIN public.roles AS r ON r.id = a.role_id
LEFT JOIN public.disciplines AS d ON d.id = a.discipline_id
LEFT JOIN public.payment_balances AS pb ON pb.assignment_id = a.id;

-- ===========================================================================
-- 10. Functions (SECURITY DEFINER, empty search_path, Slovenian messages)
-- ===========================================================================

-- Creates one payment per assignment that has none. Idempotent. Assignments
-- whose amount for the tariff is 0 are skipped (they stay visible as assignments).
CREATE FUNCTION public.generate_payments(competition_id bigint, tariff text DEFAULT 'sodnik')
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
  END LOOP;

  RETURN json_build_object(
    'created', cardinality(v_created),
    'skipped_existing', v_existing,
    'skipped_zero', v_zero,
    'payment_ids', to_json(v_created)
  );
END;
$$;

-- Records one installment. Rejects amounts <= 0 and anything above what remains.
CREATE FUNCTION public.record_payment(
  payment_id bigint, amount numeric, paid_on date DEFAULT NULL, method text DEFAULT NULL, note text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_due numeric;
  v_paid numeric;
  v_method text;
  v_id bigint;
BEGIN
  IF record_payment.amount IS NULL OR record_payment.amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Znesek plačila mora biti večji od 0.';
  END IF;
  IF record_payment.amount <> round(record_payment.amount, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Znesek plačila ima lahko največ dve decimalki.';
  END IF;

  v_method := coalesce(nullif(btrim(record_payment.method), ''),
                       (SELECT c.default_payment_method FROM public.app_config AS c));
  IF v_method NOT IN ('gotovina', 'nakazilo', 'drugo') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Neveljaven način plačila.';
  END IF;

  SELECT p.amount_due INTO v_due FROM public.payments AS p
  WHERE p.id = record_payment.payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Izplačilo ne obstaja.';
  END IF;

  SELECT coalesce(sum(t.amount), 0) INTO v_paid
  FROM public.payment_transactions AS t WHERE t.payment_id = record_payment.payment_id;

  IF record_payment.amount > v_due - v_paid THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Znesek presega neporavnani znesek (' || private.format_eur(v_due - v_paid) || ').';
  END IF;

  INSERT INTO public.payment_transactions (payment_id, amount, paid_on, method, note, source, created_by)
  VALUES (record_payment.payment_id, record_payment.amount,
          coalesce(record_payment.paid_on, current_date), v_method,
          nullif(btrim(record_payment.note), ''), 'app', private.current_user_id())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE FUNCTION public.delete_payment_transaction(id bigint)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment bigint;
BEGIN
  SELECT t.payment_id INTO v_payment FROM public.payment_transactions AS t
  WHERE t.id = delete_payment_transaction.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Plačilo ne obstaja.';
  END IF;
  PERFORM 1 FROM public.payments AS p WHERE p.id = v_payment FOR UPDATE;
  DELETE FROM public.payment_transactions AS t WHERE t.id = delete_payment_transaction.id;
END;
$$;

-- Validates [{"from":0,"to":4,"rate":20}, ..., {"from":8,"to":null,"rate":35}].
CREATE FUNCTION private.validate_rate_tiers(tiers jsonb)
RETURNS void
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  a record;
  b record;
BEGIN
  IF tiers IS NULL OR jsonb_typeof(tiers) = 'null' THEN
    RETURN;
  END IF;
  IF jsonb_typeof(tiers) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Stopnje morajo biti seznam.';
  END IF;

  FOR a IN SELECT x, ord FROM jsonb_array_elements(tiers) WITH ORDINALITY AS t(x, ord) LOOP
    IF jsonb_typeof(a.x) <> 'object'
       OR jsonb_typeof(a.x -> 'from') IS DISTINCT FROM 'number'
       OR jsonb_typeof(a.x -> 'rate') IS DISTINCT FROM 'number'
       OR (a.x ? 'to' AND jsonb_typeof(a.x -> 'to') NOT IN ('number', 'null')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Stopnja %s ni veljavna.', a.ord);
    END IF;
    IF (a.x ->> 'from')::numeric < 0 OR (a.x ->> 'from')::numeric <> round((a.x ->> 'from')::numeric, 2) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Stopnja %s: začetek mora biti število ur od 0 naprej (največ 2 decimalki).', a.ord);
    END IF;
    IF jsonb_typeof(a.x -> 'to') = 'number'
       AND ((a.x ->> 'to')::numeric <= (a.x ->> 'from')::numeric
            OR (a.x ->> 'to')::numeric <> round((a.x ->> 'to')::numeric, 2)) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Stopnja %s: konec mora biti večji od začetka.', a.ord);
    END IF;
    IF (a.x ->> 'rate')::numeric < 0 OR (a.x ->> 'rate')::numeric <> round((a.x ->> 'rate')::numeric, 2) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Stopnja %s: cena mora biti neničelna in imeti največ 2 decimalki.', a.ord);
    END IF;
  END LOOP;

  FOR a IN SELECT x, ord FROM jsonb_array_elements(tiers) WITH ORDINALITY AS t(x, ord) LOOP
    FOR b IN SELECT x, ord FROM jsonb_array_elements(tiers) WITH ORDINALITY AS t(x, ord) WHERE ord > a.ord LOOP
      IF (a.x ->> 'from')::numeric < coalesce((b.x ->> 'to')::numeric, 'Infinity'::numeric)
         AND (b.x ->> 'from')::numeric < coalesce((a.x ->> 'to')::numeric, 'Infinity'::numeric) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Stopnji %s in %s se prekrivata.', a.ord, b.ord);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Creates (id NULL) or updates a role together with both tariffs' tiers.
CREATE FUNCTION public.save_role(
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
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ime vloge je obvezno.';
  END IF;
  PERFORM private.validate_rate_tiers(save_role.sodnik_rates);
  PERFORM private.validate_rate_tiers(save_role.racun_rates);

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

  RETURN v_id;
END;
$$;

-- Deletes the role, or archives it when assignments still use it.
CREATE FUNCTION public.delete_role(id bigint)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.roles AS r WHERE r.id = delete_role.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Vloga ne obstaja.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.competition_officials AS a WHERE a.role_id = delete_role.id) THEN
    UPDATE public.roles AS r SET archived = true WHERE r.id = delete_role.id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.roles AS r WHERE r.id = delete_role.id;
  RETURN 'deleted';
END;
$$;

CREATE FUNCTION public.delete_discipline(id bigint)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.disciplines AS d WHERE d.id = delete_discipline.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Disciplina ne obstaja.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.competition_officials AS a WHERE a.discipline_id = delete_discipline.id) THEN
    UPDATE public.disciplines AS d SET archived = true WHERE d.id = delete_discipline.id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.disciplines AS d WHERE d.id = delete_discipline.id;
  RETURN 'deleted';
END;
$$;

-- Listed disciplines get positions 1..n in the given order; the rest follow.
CREATE FUNCTION public.reorder_disciplines(ids bigint[])
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
END;
$$;

CREATE FUNCTION private.set_discipline_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.position = 0 THEN
    NEW.position := (SELECT coalesce(max(d.position), 0) + 1 FROM public.disciplines AS d);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER disciplines_position BEFORE INSERT ON public.disciplines
  FOR EACH ROW EXECUTE FUNCTION private.set_discipline_position();

-- Dashboard numbers. "Paid in the year" sums installments by their own date;
-- "owed" is everything still remaining (0 EUR payments contribute nothing).
CREATE FUNCTION public.dashboard_stats(for_year integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year integer := coalesce(dashboard_stats.for_year, extract(year FROM current_date)::integer);
  v_paid numeric;
  v_owed numeric;
BEGIN
  SELECT coalesce(sum(t.amount), 0) INTO v_paid
  FROM public.payment_transactions AS t
  WHERE t.paid_on >= make_date(v_year, 1, 1) AND t.paid_on <= make_date(v_year, 12, 31);

  SELECT coalesce(sum(b.remaining), 0) INTO v_owed
  FROM public.payment_balances AS b WHERE b.remaining > 0;

  RETURN json_build_object(
    'year', v_year,
    'total_officials', (SELECT count(*) FROM public.officials),
    'active_competitions', (SELECT count(*) FROM public.competitions AS c WHERE c.status IN ('planned', 'completed')),
    'paid_payments', v_paid,
    'owed_payments', v_owed,
    'total_payments', v_paid + v_owed
  );
END;
$$;

-- Replaces the 001 version: new tables, installments first. Roles,
-- disciplines and app_config are configuration and are kept.
CREATE OR REPLACE FUNCTION public.admin_clear_all_data()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller bigint := private.current_user_id();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ni prijavljenega uporabnika.';
  END IF;

  DELETE FROM public.payment_transactions;
  DELETE FROM public.payments;
  DELETE FROM public.competition_officials;
  DELETE FROM public.competitions;
  DELETE FROM public.officials;
  DELETE FROM public.users AS u WHERE u.id <> caller;
END;
$$;

-- ===========================================================================
-- 11. The old key/value settings table is retired (kept for audit)
-- ===========================================================================
ALTER TABLE public.settings SET SCHEMA private;
ALTER TABLE private.settings RENAME TO settings_legacy;

-- ===========================================================================
-- 12. Assertions: any failure rolls the whole migration back
-- ===========================================================================
DO $assert$
DECLARE
  n_old bigint;
  n_new bigint;
  bad text;
  v_old numeric;
  v_new numeric;
BEGIN
  -- payment count unchanged
  SELECT count(*) INTO n_old FROM private.m002_payments;
  SELECT count(*) INTO n_new FROM public.payments;
  IF n_old <> n_new THEN
    RAISE EXCEPTION 'Assertion failed: payments %, expected %', n_new, n_old;
  END IF;

  -- other row counts unchanged
  IF (SELECT count(*) FROM private.m002_competition_officials) <> (SELECT count(*) FROM public.competition_officials)
     OR (SELECT count(*) FROM private.m002_competitions) <> (SELECT count(*) FROM public.competitions)
     OR (SELECT count(*) FROM private.m002_officials) <> (SELECT count(*) FROM public.officials) THEN
    RAISE EXCEPTION 'Assertion failed: row counts of assignments/competitions/officials changed';
  END IF;

  -- each payment's remaining unchanged (old: owed => amount, paid => 0)
  SELECT string_agg(s.id::text, ', ' ORDER BY s.id) INTO bad
  FROM private.m002_payments AS s
  JOIN public.payment_balances AS b ON b.id = s.id
  WHERE b.remaining <> CASE WHEN s.status = 'paid' THEN 0 ELSE round(s.amount::numeric, 2) END;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Assertion failed: remaining changed for payments (ids): %', bad;
  END IF;

  -- old status 'paid' => derived 'paid'; old 'owed' with remaining > 0 => not paid
  SELECT string_agg(s.id::text, ', ' ORDER BY s.id) INTO bad
  FROM private.m002_payments AS s
  JOIN public.payment_balances AS b ON b.id = s.id
  WHERE (s.status = 'paid' AND b.status <> 'paid')
     OR (s.status = 'owed' AND round(s.amount::numeric, 2) > 0 AND b.status = 'paid');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Assertion failed: derived status differs for payments (ids): %', bad;
  END IF;

  -- total owed unchanged (with the old dashboard filter and without)
  SELECT coalesce(sum(CASE WHEN status = 'paid' THEN 0 ELSE round(amount::numeric, 2) END), 0) INTO v_old
  FROM private.m002_payments;
  SELECT coalesce(sum(remaining), 0) INTO v_new FROM public.payment_balances;
  IF v_old <> v_new THEN
    RAISE EXCEPTION 'Assertion failed: total owed % (old) vs % (new)', v_old, v_new;
  END IF;
  SELECT coalesce(sum(round(amount::numeric, 2)), 0) INTO v_old
  FROM private.m002_payments WHERE status = 'owed' AND znesek_sodnik <> 0;
  SELECT coalesce(sum(b.remaining), 0) INTO v_new FROM public.payment_balances AS b WHERE b.remaining > 0;
  IF v_old <> v_new THEN
    RAISE EXCEPTION 'Assertion failed: dashboard owed % (old) vs % (new)', v_old, v_new;
  END IF;

  -- each assignment's totals unchanged
  SELECT string_agg(s.id::text, ', ' ORDER BY s.id) INTO bad
  FROM private.m002_competition_officials AS s
  LEFT JOIN public.competition_officials AS a ON a.id = s.id
  WHERE a.id IS NULL OR a.znesek_sodnik <> s.znesek_sodnik OR a.znesek_racun <> s.znesek_racun
     OR a.competition_id <> s.competition_id OR a.official_id <> s.official_id;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Assertion failed: assignment totals changed (ids): %', bad;
  END IF;

  -- every assignment has a role (and a discipline when it had one)
  IF EXISTS (SELECT 1 FROM public.competition_officials WHERE role_id IS NULL) THEN
    RAISE EXCEPTION 'Assertion failed: assignment without role_id';
  END IF;
  SELECT string_agg(s.id::text, ', ' ORDER BY s.id) INTO bad
  FROM private.m002_competition_officials AS s
  JOIN public.competition_officials AS a ON a.id = s.id
  WHERE btrim(coalesce(s.discipline, '')) <> '' AND a.discipline_id IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Assertion failed: assignment lost its discipline (ids): %', bad;
  END IF;

  -- remark lines == parsed transactions
  SELECT count(*) INTO n_old
  FROM private.m002_payments AS s,
       LATERAL regexp_split_to_table(coalesce(s.remarks, ''), '\r?\n|\r') AS l
  WHERE btrim(regexp_replace(l, '[\u00a0\u202f\u2009\u2007]', ' ', 'g')) ~* '^(Delno pla[cč]ilo|Pla[cč]ano v celoti)\s*:';
  SELECT count(*) INTO n_new FROM public.payment_transactions WHERE source = 'remarks';
  IF n_old <> n_new THEN
    RAISE EXCEPTION 'Assertion failed: % remark lines but % parsed transactions', n_old, n_new;
  END IF;

  -- installments never exceed the amount due; paid rows are fully covered
  IF EXISTS (SELECT 1 FROM public.payment_balances WHERE remaining < 0) THEN
    RAISE EXCEPTION 'Assertion failed: negative remaining';
  END IF;

  -- money paid per year, all payments: new (installments) vs old (paid rows' amounts)
  -- is reported by reports/002_report.sql, not asserted (the v1 dashboard used
  -- znesek_sodnik, which the report compares).
END
$assert$;

\endif
