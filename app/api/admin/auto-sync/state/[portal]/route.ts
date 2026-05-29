import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Storage state endpoint สำหรับ n8n Playwright auto-sync
 *
 * GET  /api/admin/auto-sync/state/[portal]   → คืน storage_state ล่าสุด (หรือ null)
 * POST /api/admin/auto-sync/state/[portal]   → บันทึก storage_state ใหม่
 *
 * Auth: Bearer N8N_UPLOAD_CALLBACK_SECRET (ใช้ secret เดียวกับ upload callback)
 * portal: 'jt' | 'tiktok' | 'stock'
 */

const ALLOWED_PORTALS = new Set(['jt', 'tiktok', 'stock']);

function verifyBearer(request: NextRequest): boolean {
    const expected = process.env.N8N_UPLOAD_CALLBACK_SECRET?.trim();
    if (!expected) return false;
    const header = request.headers.get('authorization')?.trim() ?? '';
    const provided = header.replace(/^Bearer\s+/i, '').trim();
    return provided === expected;
}

type RouteContext = {
    params: Promise<{ portal: string }>;
};

// ─────────────────────────────────────────────────────────────────
// GET — อ่าน storage state
// ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, ctx: RouteContext) {
    if (!verifyBearer(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { portal } = await ctx.params;
    const portalKey = portal.toLowerCase().trim();

    if (!ALLOWED_PORTALS.has(portalKey)) {
        return NextResponse.json(
            { error: `portal ต้องเป็นหนึ่งใน: ${Array.from(ALLOWED_PORTALS).join(', ')}` },
            { status: 400 },
        );
    }

    const { data, error } = await supabaseAdmin
        .from('n8n_playwright_state')
        .select('portal, storage_state, updated_at, login_count')
        .eq('portal', portalKey)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        // ไม่มี state ก่อนหน้า — n8n จะ login ใหม่
        return NextResponse.json({
            portal: portalKey,
            storage_state: null,
            updated_at: null,
            login_count: 0,
        }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}

// ─────────────────────────────────────────────────────────────────
// POST — บันทึก storage state ใหม่
// ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, ctx: RouteContext) {
    if (!verifyBearer(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { portal } = await ctx.params;
    const portalKey = portal.toLowerCase().trim();

    if (!ALLOWED_PORTALS.has(portalKey)) {
        return NextResponse.json(
            { error: `portal ต้องเป็นหนึ่งใน: ${Array.from(ALLOWED_PORTALS).join(', ')}` },
            { status: 400 },
        );
    }

    let body: { storage_state?: unknown; notes?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const storageState = body.storage_state;
    if (!storageState || typeof storageState !== 'object') {
        return NextResponse.json({ error: 'storage_state ต้องเป็น object' }, { status: 400 });
    }

    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null;

    // Upsert — เพิ่ม login_count ทุกครั้ง (track ว่ามี re-login กี่ครั้ง)
    const { data: existing } = await supabaseAdmin
        .from('n8n_playwright_state')
        .select('login_count')
        .eq('portal', portalKey)
        .maybeSingle();

    const nextLoginCount = ((existing?.login_count as number | undefined) ?? 0) + 1;

    const { error: upsertError } = await supabaseAdmin
        .from('n8n_playwright_state')
        .upsert({
            portal: portalKey,
            storage_state: storageState,
            login_count: nextLoginCount,
            notes,
        }, { onConflict: 'portal' });

    if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        portal: portalKey,
        login_count: nextLoginCount,
    });
}
