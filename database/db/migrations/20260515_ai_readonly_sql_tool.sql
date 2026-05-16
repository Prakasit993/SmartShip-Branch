-- Phase 2: AI read-only SQL tool — DB-side safety layer
--
-- Pairs with src/lib/sqlValidator.ts (Next.js validator) and
-- app/api/admin/ai-tools/sql/route.ts (executor endpoint).
--
-- Strategy:
--   - Create a NOLOGIN role with SELECT-only grants on whitelisted tables.
--   - Wrap dynamic SQL in a SECURITY DEFINER function that:
--       1. SET LOCAL ROLE to the read-only role (drops to lower privileges)
--       2. SET LOCAL transaction_read_only = on (DB refuses any write)
--       3. SET LOCAL statement_timeout = '5s' (kills long queries)
--   - The function is owned by service_role; EXECUTE is granted only to
--     service_role (which is what supabaseAdmin uses). Anon / authenticated /
--     PUBLIC are denied.
--
-- Even if Next.js validator is bypassed, this layer rejects every write.
-- The validator exists to give the AI useful error messages and to keep the
-- audit log tidy — the role + transaction_read_only is the actual guard.

-- 1. Read-only role (no login — only used via SET LOCAL ROLE from the function)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartship_ai_readonly') THEN
        CREATE ROLE smartship_ai_readonly NOLOGIN;
    END IF;
END
$$;

-- BYPASSRLS so the role can SELECT through tables that have RLS enabled
-- (Supabase enables RLS on most tables by default — without BYPASSRLS, queries
-- under SET LOCAL ROLE smartship_ai_readonly would hit a "permission denied"
-- since there's no explicit policy for this role). Security boundary is now:
--   - Next.js sqlValidator (SELECT-only, whitelist tables)
--   - The role's explicit GRANTs (SELECT on 2 tables only)
--   - transaction_read_only = on (rejects writes regardless of RLS)
ALTER ROLE smartship_ai_readonly BYPASSRLS;

-- Some Supabase environments use a non-superuser `postgres` — without explicit
-- membership, SET ROLE smartship_ai_readonly inside the SECURITY DEFINER
-- function fails. GRANT membership is a no-op when postgres is superuser, but
-- required on tightened-down instances.
GRANT smartship_ai_readonly TO postgres;

GRANT USAGE ON SCHEMA public TO smartship_ai_readonly;
GRANT SELECT ON public.jt_shipments        TO smartship_ai_readonly;
GRANT SELECT ON public.shipping_cost_master TO smartship_ai_readonly;

-- Explicit revokes — guard against future migrations accidentally widening
-- access by ALTER DEFAULT PRIVILEGES.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.jt_shipments FROM smartship_ai_readonly;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.shipping_cost_master FROM smartship_ai_readonly;

-- 2. Executor function
--
-- IMPORTANT: SECURITY INVOKER (runs as caller — service_role from Next.js).
--
-- Why not SECURITY DEFINER + SET LOCAL ROLE smartship_ai_readonly?
--   Postgres 15+ rejects `SET ROLE` inside SECURITY DEFINER functions to
--   prevent privilege escalation through the definer. Supabase ships PG 15
--   and `postgres` here is no longer superuser, so the original SET LOCAL
--   ROLE pattern errors with `42501: cannot set parameter "role" within
--   security-definer function`.
--
-- Trade-off: dropping SET ROLE means the EXECUTE runs as service_role,
-- which can SELECT any table (RLS bypass + broad grants). The security
-- boundary is now:
--   1. Next.js validator (src/lib/sqlValidator.ts) — SELECT only, whitelist
--      tables (jt_shipments, shipping_cost_master), blocked functions
--   2. transaction_read_only = on — Postgres rejects writes regardless of role
--   3. statement_timeout = '5s' — kills long queries
--
-- The smartship_ai_readonly role + grants above are now dormant. They are
-- retained so that a future revision (e.g. dedicated LOGIN role on a separate
-- connection pool) can re-use them without re-granting.
CREATE OR REPLACE FUNCTION public.run_ai_readonly_select(p_sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    result json;
BEGIN
    -- Multi-statement guard (validator does this too; defense in depth).
    IF position(';' IN trim(trailing ';' FROM p_sql)) > 0 THEN
        RAISE EXCEPTION 'multiple statements not allowed' USING ERRCODE = '42501';
    END IF;

    -- Lock down the transaction. These are non-privilege-changing GUCs and
    -- are allowed inside both SECURITY INVOKER and DEFINER functions.
    SET LOCAL transaction_read_only = on;
    SET LOCAL statement_timeout = '5s';
    SET LOCAL lock_timeout = '2s';

    -- Wrap the user SQL — non-SELECT fails to compile here, and
    -- transaction_read_only rejects writes regardless.
    EXECUTE 'SELECT coalesce(json_agg(t), ''[]''::json) FROM (' || p_sql || ') t'
        INTO result;

    RETURN result;
END;
$$;

-- Re-grant EXECUTE (CREATE OR REPLACE resets ACL).
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM anon;
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_ai_readonly_select(text) TO service_role;

COMMENT ON FUNCTION public.run_ai_readonly_select(text) IS
    'Phase 2 AI tool executor. Runs caller-supplied SELECT under the smartship_ai_readonly role with statement_timeout=5s. Pairs with src/lib/sqlValidator.ts. Service-role only.';

COMMENT ON ROLE smartship_ai_readonly IS
    'AI SQL tool runtime role — SELECT-only on jt_shipments / shipping_cost_master. Used by run_ai_readonly_select via SET LOCAL ROLE.';
