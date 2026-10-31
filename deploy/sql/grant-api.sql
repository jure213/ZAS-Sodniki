\set ON_ERROR_STOP on

-- API privileges. Idempotent: resets everything the API roles can do, then
-- grants exactly what is listed here. Run by deploy/scripts/migrate.sh after
-- every migration and every restore.
--
--   zas_anon   no token: may only call login()
--   zas_user   read-only (no access to users)
--   zas_admin  read/write via column grants and functions; users only through the *_user() functions

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
  public.payment_transactions,
  public.payment_balances,
  public.assignment_details,
  public.roles,
  public.role_rates,
  public.disciplines,
  public.app_config
TO zas_user;

-- Write access, only where a plain table write is safe. Everything that
-- moves money or has rules goes through the functions below:
--   payment_transactions  record_payment() / delete_payment_transaction()
--   payments              generate_payments(); direct writes only to notes/amount_due
--   roles, role_rates     save_role() / delete_role()
--   disciplines           name/archived directly; reorder/delete through functions
-- Generated columns (travel_amount, znesek_*) cannot be written at all.
GRANT INSERT, UPDATE, DELETE ON public.officials, public.competitions TO zas_admin;

GRANT INSERT (competition_id, official_id, role_id, discipline_id, hours, kilometers,
              base_sodnik, base_racun, travel_rate, notes)
  ON public.competition_officials TO zas_admin;
GRANT UPDATE (role_id, discipline_id, hours, kilometers, base_sodnik, base_racun, travel_rate, notes)
  ON public.competition_officials TO zas_admin;
GRANT DELETE ON public.competition_officials TO zas_admin;

GRANT UPDATE (notes, amount_due) ON public.payments TO zas_admin;
GRANT DELETE ON public.payments TO zas_admin;

GRANT INSERT (name) ON public.disciplines TO zas_admin;
GRANT UPDATE (name, archived) ON public.disciplines TO zas_admin;

GRANT UPDATE (travel_cost_per_km, default_payment_method, min_client_version)
  ON public.app_config TO zas_admin;

GRANT USAGE ON
  public.officials_id_seq,
  public.competitions_id_seq,
  public.competition_officials_id_seq,
  public.disciplines_id_seq
TO zas_admin;

-- Users: admins may list them, but never read password hashes or write directly.
GRANT SELECT (id, username, name, role, created_at) ON public.users TO zas_admin;

-- Audit log (003): administrators may read it. Nobody may write it through the
-- API; entries come only from SECURITY DEFINER functions and triggers.
GRANT SELECT ON public.audit_log TO zas_admin;

-- Functions.
GRANT EXECUTE ON FUNCTION private.check_request() TO zas_anon, zas_user, zas_admin;
GRANT EXECUTE ON FUNCTION public.login(text, text, boolean) TO zas_anon;
GRANT EXECUTE ON FUNCTION public.me() TO zas_user;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(integer) TO zas_user;
GRANT EXECUTE ON FUNCTION public.create_user(text, text, text, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.update_user(bigint, text, text, text, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.delete_user(bigint) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_data() TO zas_admin;
GRANT EXECUTE ON FUNCTION public.generate_payments(bigint, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.record_payment(bigint, numeric, date, text, text) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.delete_payment_transaction(bigint) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.save_role(bigint, text, jsonb, jsonb, boolean) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.delete_role(bigint) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.delete_discipline(bigint) TO zas_admin;
GRANT EXECUTE ON FUNCTION public.reorder_disciplines(bigint[]) TO zas_admin;

NOTIFY pgrst, 'reload schema';
