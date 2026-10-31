\set ON_ERROR_STOP on

-- API roles. Roles are cluster-wide and are not included in pg_dump archives,
-- so migrate.sh runs this file every time (it is idempotent).

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zas_anon') THEN
    CREATE ROLE zas_anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zas_user') THEN
    CREATE ROLE zas_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zas_admin') THEN
    CREATE ROLE zas_admin NOLOGIN;
  END IF;
END
$roles$;

GRANT zas_anon, zas_user, zas_admin TO postgrest_authenticator;
GRANT zas_user TO zas_admin;  -- admin inherits everything a user can read

ALTER ROLE zas_anon  SET statement_timeout = '10s';
ALTER ROLE zas_user  SET statement_timeout = '20s';
ALTER ROLE zas_admin SET statement_timeout = '20s';
ALTER ROLE zas_user  SET idle_in_transaction_session_timeout = '20s';
ALTER ROLE zas_admin SET idle_in_transaction_session_timeout = '20s';

-- New functions must not be executable by everyone by default: PostgREST
-- exposes every function in the public schema that a role may execute.
-- (Default ACLs are skipped by restores with --no-privileges, hence here.)
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
