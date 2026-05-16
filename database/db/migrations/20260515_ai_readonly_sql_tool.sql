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

GRANT USAGE ON SCHEMA public TO smartship_ai_readonly;
GRANT SELECT ON public.jt_shipments        TO smartship_ai_readonly;
GRANT SELECT ON public.shipping_cost_master TO smartship_ai_readonly;

-- Explicit revokes — guard against future migrations accidentally widening
-- access by ALTER DEFAULT PRIVILEGES.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.jt_shipments FROM smartship_ai_readonly;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.shipping_cost_master FROM smartship_ai_readonly;

-- 2. Executor function — runs the SQL under the read-only role with timeout
CREATE OR REPLACE FUNCTION public.run_ai_readonly_select(p_sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result json;
BEGIN
    -- Refuse semicolon-containing input as a final guard against multi-statement
    -- injection (Next.js validator already rejects this; defense in depth).
    IF position(';' IN trim(trailing ';' FROM p_sql)) > 0 THEN
        RAISE EXCEPTION 'multiple statements not allowed' USING ERRCODE = '42501';
    END IF;

    -- Drop privileges + lock down the transaction.
    SET LOCAL ROLE smartship_ai_readonly;
    SET LOCAL transaction_read_only = on;
    SET LOCAL statement_timeout = '5s';
    SET LOCAL lock_timeout = '2s';
    SET LOCAL idle_in_transaction_session_timeout = '5s';

    -- Wrap the user SQL so non-SELECT (which somehow slipped past validators)
    -- would still error here. json_agg over a subquery requires the inner
    -- expression to be table-shaped → only SELECT compiles.
    EXECUTE 'SELECT coalesce(json_agg(t), ''[]''::json) FROM (' || p_sql || ') t'
        INTO result;

    RETURN result;
END;
$$;

-- Owner = postgres (Supabase default for SECURITY DEFINER functions).
-- We do NOT want PUBLIC to be able to call this.
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM anon;
REVOKE ALL ON FUNCTION public.run_ai_readonly_select(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_ai_readonly_select(text) TO service_role;

COMMENT ON FUNCTION public.run_ai_readonly_select(text) IS
    'Phase 2 AI tool executor. Runs caller-supplied SELECT under the smartship_ai_readonly role with statement_timeout=5s. Pairs with src/lib/sqlValidator.ts. Service-role only.';

COMMENT ON ROLE smartship_ai_readonly IS
    'AI SQL tool runtime role — SELECT-only on jt_shipments / shipping_cost_master. Used by run_ai_readonly_select via SET LOCAL ROLE.';
