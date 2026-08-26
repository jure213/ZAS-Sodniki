\set ON_ERROR_STOP on

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO zas_sodniki_api;

DO $block$
DECLARE
  api_table text;
BEGIN
  FOREACH api_table IN ARRAY ARRAY[
    'users',
    'officials',
    'competitions',
    'competition_officials',
    'payments',
    'settings'
  ]
  LOOP
    IF to_regclass(format('public.%I', api_table)) IS NULL THEN
      RAISE EXCEPTION 'Required API table public.% is missing', api_table;
    END IF;

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO zas_sodniki_api',
      api_table
    );
  END LOOP;
END
$block$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zas_sodniki_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zas_sodniki_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO zas_sodniki_api;

NOTIFY pgrst, 'reload schema';
