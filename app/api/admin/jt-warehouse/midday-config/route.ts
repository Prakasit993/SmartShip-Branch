import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth, getAdminApiAccess } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET   /api/admin/jt-warehouse/midday-config
 *   → คืน { target_pct, cutoff_hour }
 *
 * PATCH /api/admin/jt-warehouse/midday-config
 *   Body: { target_pct?, cutoff_hour? }
 *   → admin only — บันทึก config
 */

type ConfigShape = {
    target_pct: number;
    cutoff_hour: number;
};

async function readConfig(): Promise<ConfigShape> {
    const { data, error } = await supabaseAdmin
        .from('jt_warehouse_config')
        .select('key, value')
        .in('key', ['midday_target_pct', 'midday_cutoff_hour']);

    if (error) throw new Error(error.message);

    const map = new Map((data ?? []).map((row) => [row.key as string, row.value]));
    return {
        target_pct: Number(map.get('midday_target_pct') ?? 0.2),
        cutoff_hour: Number(map.get('midday_cutoff_hour') ?? 12),
    };
}

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    try {
        const config = await readConfig();
        return NextResponse.json(config, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'unknown error' },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest) {
    // Admin only — staff ห้ามแก้ config
    const denied = await requireAdminApiAuth('admin-only', request);
    if (denied) return denied;

    let body: { target_pct?: unknown; cutoff_hour?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const access = await getAdminApiAccess(request);
    const updatedBy = access.email ?? 'admin';

    const updates: { key: string; value: number }[] = [];

    if (body.target_pct !== undefined) {
        const v = Number(body.target_pct);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
            return NextResponse.json(
                { error: 'target_pct ต้องเป็นเลข 0..1 (เช่น 0.20 = 20%)' },
                { status: 400 },
            );
        }
        updates.push({ key: 'midday_target_pct', value: v });
    }

    if (body.cutoff_hour !== undefined) {
        const v = Number(body.cutoff_hour);
        if (!Number.isInteger(v) || v < 0 || v > 23) {
            return NextResponse.json(
                { error: 'cutoff_hour ต้องเป็นเลขจำนวนเต็ม 0..23' },
                { status: 400 },
            );
        }
        updates.push({ key: 'midday_cutoff_hour', value: v });
    }

    if (updates.length === 0) {
        return NextResponse.json({ error: 'ไม่มี field ให้แก้' }, { status: 400 });
    }

    for (const upd of updates) {
        const { error } = await supabaseAdmin.rpc('set_jt_warehouse_config', {
            p_key: upd.key,
            p_value: upd.value,
            p_updated_by: updatedBy,
        });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    const config = await readConfig();
    return NextResponse.json({ ok: true, config });
}
