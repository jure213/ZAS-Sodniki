-- 001_auth.sql: per-user authentication for PostgREST
--
-- Before: every installer shipped one JWT for role zas_sodniki_api (BYPASSRLS,
-- full CRUD on every table, no expiry).
-- After:  the app ships no key. Requests without a token run as zas_anon, which
-- may only call public.login(). login() verifies the bcrypt hash in the
-- database and returns a short-lived JWT for zas_user (read-only) or
-- zas_admin (read/write). private.check_request() runs before every request
-- and rejects tokens of deleted users, changed roles and changed passwords.
--
-- Applied by deploy/scripts/migrate.sh in one transaction, after
-- deploy/sql/roles.sql (roles are cluster-wide, so they are not part of a
-- dump). Table grants live in deploy/sql/grant-api.sql, run afterwards.

-- ---------------------------------------------------------------------------
-- Schemas and extension (neither schema is exposed by PostgREST)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Holds the JWT signing secret. Filled by migrate.sh from .env, excluded from
-- backups by backup.sh. No API role has any privilege on it.
CREATE TABLE IF NOT EXISTS private.config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON private.config FROM PUBLIC;

-- Tokens issued before this moment are rejected (password/role change).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tokens_valid_after timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Helpers (private, not callable through the API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.base64url(data bytea)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $$
  -- encode() wraps lines every 76 chars; translate() drops the newlines.
  SELECT translate(rtrim(encode(data, 'base64'), '='), E'+/\n', '-_');
$$;

CREATE OR REPLACE FUNCTION private.sign_jwt(payload jsonb)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  secret text;
  signing_input text;
BEGIN
  SELECT c.value INTO secret FROM private.config AS c WHERE c.key = 'jwt_secret';
  IF secret IS NULL OR length(secret) < 32 THEN
    RAISE EXCEPTION 'JWT secret is not configured (run deploy/scripts/migrate.sh)';
  END IF;

  signing_input :=
    private.base64url(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'))
    || '.' || private.base64url(convert_to(payload::text, 'UTF8'));

  RETURN signing_input || '.' || private.base64url(
    extensions.hmac(convert_to(signing_input, 'UTF8'), convert_to(secret, 'UTF8'), 'sha256')
  );
END;
$$;

-- Application role ('admin' / anything else) -> database role.
CREATE OR REPLACE FUNCTION private.db_role(app_role text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN app_role = 'admin' THEN 'zas_admin' ELSE 'zas_user' END;
$$;

-- bcryptjs writes $2b$ hashes; pgcrypto only understands $2a$. For passwords
-- shorter than 255 bytes the two variants are identical.
CREATE OR REPLACE FUNCTION private.password_matches(password text, hash text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT extensions.crypt(password, regexp_replace(hash, '^\$2[by]\$', '$2a$'))
       = regexp_replace(hash, '^\$2[by]\$', '$2a$');
$$;

CREATE OR REPLACE FUNCTION private.hash_password(password text)
RETURNS text
LANGUAGE sql VOLATILE
SET search_path = ''
AS $$
  SELECT extensions.crypt(password, extensions.gen_salt('bf', 10));
$$;

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS bigint
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id')::bigint;
$$;

CREATE OR REPLACE FUNCTION private.validate_user_fields(username text, name text, role text)
RETURNS void
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF coalesce(btrim(username), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Uporabniško ime je obvezno.';
  END IF;
  IF coalesce(btrim(name), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ime je obvezno.';
  END IF;
  IF role IS NULL OR role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Neveljavna vloga.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_password(password text)
RETURNS void
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF password IS NULL OR length(password) < 8 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Geslo mora imeti vsaj 8 znakov.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- PostgREST pre-request hook (configured via PGRST_DB_PRE_REQUEST)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.check_request()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  claim_role text := claims ->> 'role';
  u public.users%ROWTYPE;
BEGIN
  IF claim_role IS NULL OR claim_role = 'zas_anon' THEN
    RETURN;
  END IF;

  IF claim_role NOT IN ('zas_user', 'zas_admin') THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'session_invalid';
  END IF;

  SELECT * INTO u FROM public.users AS x WHERE x.id = (claims ->> 'user_id')::bigint;

  IF NOT FOUND
     OR private.db_role(u.role) <> claim_role
     OR coalesce((claims ->> 'iat')::bigint, 0) < floor(extract(epoch FROM u.tokens_valid_after))
  THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'session_invalid';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- API functions (public schema = exposed as /rpc/<name>)
-- ---------------------------------------------------------------------------
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
    RETURN NULL;
  END IF;

  IF NOT private.password_matches(coalesce(login.password, ''), u.password) THEN
    RETURN NULL;
  END IF;

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

CREATE OR REPLACE FUNCTION public.me()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object('id', u.id, 'username', u.username, 'name', u.name, 'role', u.role)
  FROM public.users AS u
  WHERE u.id = private.current_user_id();
$$;

CREATE OR REPLACE FUNCTION public.create_user(username text, password text, name text, role text)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id bigint;
BEGIN
  PERFORM private.validate_user_fields(create_user.username, create_user.name, create_user.role);
  PERFORM private.validate_password(create_user.password);

  INSERT INTO public.users (username, password, name, role)
  VALUES (btrim(create_user.username), private.hash_password(create_user.password),
          btrim(create_user.name), create_user.role)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user(id bigint, username text, name text, role text, password text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  prev public.users%ROWTYPE;
  change_password boolean := coalesce(update_user.password, '') <> '';
BEGIN
  PERFORM private.validate_user_fields(update_user.username, update_user.name, update_user.role);
  IF change_password THEN
    PERFORM private.validate_password(update_user.password);
  END IF;

  SELECT * INTO prev FROM public.users AS u WHERE u.id = update_user.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Uporabnik ne obstaja.';
  END IF;

  IF prev.role = 'admin' AND update_user.role <> 'admin'
     AND (SELECT count(*) FROM public.users AS u WHERE u.role = 'admin') <= 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Zadnjemu administratorju ni mogoče odvzeti vloge.';
  END IF;

  UPDATE public.users AS u SET
    username = btrim(update_user.username),
    name = btrim(update_user.name),
    role = update_user.role,
    password = CASE WHEN change_password THEN private.hash_password(update_user.password) ELSE u.password END,
    tokens_valid_after = CASE
      WHEN change_password OR prev.role <> update_user.role THEN now()
      ELSE u.tokens_valid_after
    END
  WHERE u.id = update_user.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user(id bigint)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
BEGIN
  IF delete_user.id = private.current_user_id() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Svojega uporabnika ni mogoče izbrisati.';
  END IF;

  SELECT u.role INTO target_role FROM public.users AS u WHERE u.id = delete_user.id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF target_role = 'admin'
     AND (SELECT count(*) FROM public.users AS u WHERE u.role = 'admin') <= 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Zadnjega administratorja ni mogoče izbrisati.';
  END IF;

  DELETE FROM public.users AS u WHERE u.id = delete_user.id;
END;
$$;

-- Replaces the old client-side clearAllData(): one transaction, and it keeps
-- the calling administrator instead of a user literally named "admin".
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

  DELETE FROM public.payments;
  DELETE FROM public.competition_officials;
  DELETE FROM public.competitions;
  DELETE FROM public.officials;
  DELETE FROM public.users AS u WHERE u.id <> caller;
END;
$$;

-- ---------------------------------------------------------------------------
-- Retire the shared key's role. Its JWT is public, so it must stop working
-- even if the JWT secret were not rotated.
-- ---------------------------------------------------------------------------
DO $legacy$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'zas_sodniki_api') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE zas_sodniki_admin IN SCHEMA public
      REVOKE ALL ON TABLES FROM zas_sodniki_api;
    ALTER DEFAULT PRIVILEGES FOR ROLE zas_sodniki_admin IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM zas_sodniki_api;
    DROP OWNED BY zas_sodniki_api;
    DROP ROLE zas_sodniki_api;
  END IF;
END
$legacy$;
