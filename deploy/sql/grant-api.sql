\set ON_ERROR_STOP on

-- API privileges. Idempotent: resets everything the API roles can do, then
-- grants exactly what is listed here. Run by deploy/scripts/migrate.sh after
-- every migration and every restore.
--
--   zas_anon   no token: may only call login()
--   zas_user   read-only (no access to users)
--   zas_admin  read/write; users only through the *_user() functions

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO zas_anon, zas_user, zas_admin;

-- Needed for PGRST_DB_PRE_REQUEST; nothing in private is granted otherwise.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO zas_anon, zas_user, zas_admin;

-- Start from zero.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, zas_anon, zas_user, zas_admin;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, zas_anon, zas_user, zas_admin;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public  FROM PUBLIC, zas_anon, zas_user, zas_admin;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, zas_anon, zas_user, zas_admin;
REVOKE ALL ON ALL TABLES    IN SCHEMA private FROM PUBLIC, zas_anon, zas_user, zas_admin;

-- Read access (zas_admin inherits these through membership in zas_user).
GRANT SELECT ON
  public.officials,
  public.competitions,
  public.competition_officials,
  public.payments,
  public.settings
TO zas_user;

-- Write access.
GRANT INSERT, UPDATE, DELETE ON
  public.officials,
  public.competitions,
  public.competition_officials,
  public.payments,
  public.settings
TO zas_admin;

GRANT USAGE ON
  public.officials_id_seq,
  public.competitions_id_seq,
  public.competition_officials_id_seq,
  public.payments_id_seq
TO zas_admin;

-- Users: admins may list them, but never read password hashes or write directly.
GRANT SELECT (id, username, name, role, created_at) ON public.users TO zas_admin;

-- Functions.
GRANT EXECUTE ON FUNCTION private.check_request() TO zas_anon, zas_user, zas_admin;
GRANT EXECUTE ON FUNCTION public.login(text, text, boolean) TO zas_anon;
GRANT EXECUTE ON FUNCTION public.me() TO zas_user;
GRANT EXECUTE ON FUNCTION public.create_user(text, text, text, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.update_user(bigint, text, text, text, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.delete_user(bigint) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_data() TO zas_admin;

NOTIFY pgrst, 'reload schema';
