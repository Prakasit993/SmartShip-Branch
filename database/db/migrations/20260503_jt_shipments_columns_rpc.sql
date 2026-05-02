-- Expose column list for admin import UI + dynamic field passthrough (service role only)
CREATE OR REPLACE FUNCTION public.jt_shipments_import_columns()
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.column_name::text, c.data_type::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'jt_shipments'
    ORDER BY c.ordinal_position;
$$;

REVOKE ALL ON FUNCTION public.jt_shipments_import_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_shipments_import_columns() TO service_role;
