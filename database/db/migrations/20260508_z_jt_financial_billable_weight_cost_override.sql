-- Keep the public financial RPC names pointed at the billable-weight cost model.
-- This file intentionally sorts after the earlier 20260508 financial migrations.

CREATE OR REPLACE FUNCTION public.get_financial_summary(start_date date, end_date date)
RETURNS TABLE(
    total_revenue numeric,
    total_cost numeric,
    total_profit numeric,
    shipment_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.get_financial_summary_billable_weight($1, $2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_financial_daily_profit(start_date date, end_date date)
RETURNS TABLE(
    day date,
    total_revenue numeric,
    total_cost numeric,
    total_profit numeric,
    shipment_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.get_financial_daily_profit_billable_weight($1, $2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_financial_missing_cost_prices(start_date date, end_date date)
RETURNS TABLE(
    sale_price numeric,
    shipment_count bigint,
    total_revenue numeric,
    default_cost_total numeric,
    estimated_profit_with_default_cost numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.get_financial_missing_cost_prices_billable_weight($1, $2);
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.get_financial_summary(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_daily_profit(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_missing_cost_prices(date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_financial_summary(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_daily_profit(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_missing_cost_prices(date, date) TO service_role;
