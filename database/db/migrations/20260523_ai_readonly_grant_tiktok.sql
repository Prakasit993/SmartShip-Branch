-- AI P1.3 — grant SELECT on tiktok_shipments to AI role (TikTok dataset)
-- Date: 2026-05-23
-- Pairs with: src/lib/sqlValidator.ts TIKTOK_ALLOWED_TABLES
--             app/api/admin/ai-tools/tiktok-sql/route.ts
--             docs/ai-agent-mcp-plan.md (P1.3)
--
-- Context:
--   - 20260515_ai_readonly_sql_tool.sql created `smartship_ai_readonly` and
--     granted SELECT on jt_shipments + shipping_cost_master.
--   - That role is currently DORMANT (PG 15 broke SET ROLE inside SECURITY
--     DEFINER — see 20260515). The ACTUAL gate is the Next.js sqlValidator
--     whitelist (per-tool: JT_ALLOWED_TABLES vs TIKTOK_ALLOWED_TABLES) +
--     transaction_read_only. This GRANT does not itself enforce the JT/TikTok
--     separation — the validator does.
--   - We still GRANT here so the audit trail mirrors what the validator allows
--     and a future re-enable of SET LOCAL ROLE keeps TikTok queries working.
--
-- Carrier separation:
--   - tiktok_shipments is reachable ONLY via query_tiktok_sql (its own tool +
--     TIKTOK_ALLOWED_TABLES). query_sql (JT/NYXEL) cannot reference it, and
--     query_tiktok_sql cannot reference jt_shipments. No cross-join, no union.
--
-- Safety:
--   - SELECT only — no INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER
--
-- Rollback:
--   REVOKE SELECT ON public.tiktok_shipments FROM smartship_ai_readonly;

GRANT SELECT ON public.tiktok_shipments TO smartship_ai_readonly;

-- Explicit revoke — guard against ALTER DEFAULT PRIVILEGES regression
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tiktok_shipments FROM smartship_ai_readonly;
