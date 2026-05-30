-- 2026-05-29: Update midday KPI to use J&T-matching workload denominator
--
-- ปัญหา: ของเรา intake_count = "ยอดเข้าวันนี้" (arrived_branch_time = today)
--        แต่ J&T portal ใช้ "ต้องเซ็นรับวันนี้" ที่กรองออก:
--          - พัสดุที่ปิดงานก่อนวันนี้
--          - พัสดุที่อยู่ในคลังยังไม่ assign staff
--
-- แก้: denominator ใช้ workload_count = signed today + currently pending (with staff)
--      ใกล้เคียง J&T's "ต้องเซ็นรับวันนี้" — operational view
--
-- arrived_count คงไว้เป็น informational (ยอดเข้า)

CREATE OR REPLACE FUNCTION public.get_warehouse_jt_midday_performance(
    p_delivery_branch_code text,
    p_today                date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today date;
    v_target_pct numeric;
    v_cutoff_hour integer;
    v_arrived_count integer;       -- ยอดเข้าวันนี้ (informational)
    v_workload_count integer;       -- ★ Denominator — ต้องเซ็นรับวันนี้
    v_closed_count integer;         -- ปิดงานวันนี้
    v_pending_with_staff integer;   -- ค้าง (assigned to staff)
    v_in_warehouse integer;         -- ค้าง (no staff)
    v_closed_pct numeric;
    v_target_count integer;
    v_status text;
    v_now_bangkok timestamptz;
    v_cutoff_today timestamptz;
    v_minutes_until_cutoff integer;
    v_is_after_cutoff boolean;
BEGIN
    v_today := COALESCE(p_today, (now() AT TIME ZONE 'Asia/Bangkok')::date);

    v_target_pct := COALESCE(
        (SELECT value::text::numeric FROM public.jt_warehouse_config WHERE key = 'midday_target_pct'),
        0.20
    );
    v_cutoff_hour := COALESCE(
        (SELECT value::text::integer FROM public.jt_warehouse_config WHERE key = 'midday_cutoff_hour'),
        12
    );

    v_cutoff_today := (v_today + make_time(v_cutoff_hour, 0, 0)) AT TIME ZONE 'Asia/Bangkok';
    v_now_bangkok := now();
    v_minutes_until_cutoff := FLOOR(EXTRACT(EPOCH FROM (v_cutoff_today - v_now_bangkok)) / 60)::integer;
    v_is_after_cutoff := v_now_bangkok > v_cutoff_today;

    -- ─────────────────────────────────────────────────────────
    -- 1. Arrived today (informational — แสดงเป็นยอดเข้า)
    -- ─────────────────────────────────────────────────────────
    SELECT COUNT(*)::integer INTO v_arrived_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND public.jt_parse_arrived_date(arrived_branch_time) = v_today;

    -- ─────────────────────────────────────────────────────────
    -- 2. Closed today — numerator
    --    (ปิดงานวันนี้ — ใช้ signed_time หรือ closed_time)
    -- ─────────────────────────────────────────────────────────
    SELECT COUNT(*)::integer INTO v_closed_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND public.jt_parcel_is_closed(
          signed_time, sign_branch_name, signed_record_time,
          signed_by_staff, signer_name, sign_time_status
      )
      AND (
          public.jt_parse_arrived_date(closed_time)  = v_today
          OR public.jt_parse_arrived_date(signed_time) = v_today
      );

    -- ─────────────────────────────────────────────────────────
    -- 3. Currently pending with staff assigned
    -- ─────────────────────────────────────────────────────────
    SELECT COUNT(*)::integer INTO v_pending_with_staff
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND NOT public.jt_parcel_is_closed(
          signed_time, sign_branch_name, signed_record_time,
          signed_by_staff, signer_name, sign_time_status
      )
      AND public.jt_text_is_filled(delivery_staff_id);

    -- ─────────────────────────────────────────────────────────
    -- 4. In warehouse (no staff — รอแจกจ่าย)
    -- ─────────────────────────────────────────────────────────
    SELECT COUNT(*)::integer INTO v_in_warehouse
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND NOT public.jt_parcel_is_closed(
          signed_time, sign_branch_name, signed_record_time,
          signed_by_staff, signer_name, sign_time_status
      )
      AND NOT public.jt_text_is_filled(delivery_staff_id);

    -- ─────────────────────────────────────────────────────────
    -- 5. Workload = closed today + currently pending with staff
    --    ★ Denominator ใหม่ — ใกล้เคียง J&T "ต้องเซ็นรับวันนี้"
    -- ─────────────────────────────────────────────────────────
    v_workload_count := v_closed_count + v_pending_with_staff;

    v_closed_pct := CASE
        WHEN v_workload_count > 0 THEN v_closed_count::numeric / v_workload_count::numeric
        ELSE 0
    END;
    v_target_count := CEIL(v_workload_count::numeric * v_target_pct)::integer;

    IF v_workload_count = 0 THEN
        v_status := 'no_data';
    ELSIF v_closed_pct >= v_target_pct THEN
        v_status := 'achieved';
    ELSIF v_is_after_cutoff THEN
        v_status := 'missed';
    ELSE
        v_status := 'behind';
    END IF;

    RETURN jsonb_build_object(
        'branch_code',           p_delivery_branch_code,
        'date',                  v_today,
        'target_pct',            v_target_pct,
        'cutoff_hour',           v_cutoff_hour,
        -- Denominator + numerator (KPI)
        'workload_count',        v_workload_count,
        'closed_count',          v_closed_count,
        'closed_pct',            ROUND(v_closed_pct, 4),
        'target_count',          v_target_count,
        'delta_count',           v_closed_count - v_target_count,
        'delta_pct',             ROUND(v_closed_pct - v_target_pct, 4),
        -- Informational breakdown
        'arrived_count',         v_arrived_count,
        'pending_with_staff',    v_pending_with_staff,
        'in_warehouse_count',    v_in_warehouse,
        -- Backward compat — เก็บ intake_count = arrived_count ไว้กัน UI พัง
        'intake_count',          v_arrived_count,
        -- Time
        'status',                v_status,
        'minutes_until_cutoff',  v_minutes_until_cutoff,
        'is_after_cutoff',       v_is_after_cutoff
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_midday_performance(text, date) TO service_role;
