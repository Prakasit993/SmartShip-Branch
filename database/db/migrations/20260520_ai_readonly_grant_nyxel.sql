-- AI Level 1 — grant SELECT on NYXEL inventory + pricing tables to AI role
-- Date: 2026-05-20
-- Pairs with: src/lib/sqlValidator.ts ALLOWED_TABLES expansion
--
-- Context:
--   - 20260515_ai_readonly_sql_tool.sql created `smartship_ai_readonly` role
--     and granted SELECT on jt_shipments + shipping_cost_master.
--   - That role is currently DORMANT (PG 15 broke SET ROLE inside SECURITY
--     DEFINER, see comments in the 20260515 file). The actual gate is the
--     Next.js sqlValidator whitelist + transaction_read_only.
--   - We still GRANT here so the audit trail mirrors what the validator allows.
--     If a future migration re-enables SET LOCAL ROLE (e.g. dedicated pool),
--     these grants make Level 1 inventory queries continue to work.
--
-- Safety:
--   - SELECT only — no INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER
--   - All tables here have no direct PII (customer name/phone/email columns
--     live elsewhere — customers, customer_contact_history, reviews)
--   - Defer customer + order tables to Level 2 with PII redaction layer
--
-- Rollback:
--   REVOKE SELECT ON <each table> FROM smartship_ai_readonly;

-- =============================================================================
-- Inventory + taxonomy
-- =============================================================================
GRANT SELECT ON public.products             TO smartship_ai_readonly;
GRANT SELECT ON public.bundles              TO smartship_ai_readonly;
GRANT SELECT ON public.categories           TO smartship_ai_readonly;
GRANT SELECT ON public.bundle_items         TO smartship_ai_readonly;
GRANT SELECT ON public.bundle_option_groups TO smartship_ai_readonly;
GRANT SELECT ON public.bundle_options       TO smartship_ai_readonly;

-- =============================================================================
-- Pricing rules (admin-only, no PII)
-- =============================================================================
GRANT SELECT ON public.coupons        TO smartship_ai_readonly;
GRANT SELECT ON public.bulk_discounts TO smartship_ai_readonly;

-- =============================================================================
-- Order line items (snapshots only — bundle_name + price text, no customer FK
-- exposed here; customer link lives in `orders` which stays restricted)
-- =============================================================================
GRANT SELECT ON public.order_items TO smartship_ai_readonly;

-- =============================================================================
-- Explicit revokes — guard against ALTER DEFAULT PRIVILEGES regression
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.products, public.bundles, public.categories,
       public.bundle_items, public.bundle_option_groups, public.bundle_options,
       public.coupons, public.bulk_discounts, public.order_items
    FROM smartship_ai_readonly;
