import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import {
    listShortcuts,
    insertShortcut,
    MAX_KEYWORD_LENGTH,
    MAX_PROMPT_LENGTH,
} from '@/lib/adminAiChatShortcuts';

/** GET /api/admin/ai-chat-shortcuts?active_only=true */
export async function GET(req: Request) {
    const denied = await requireAdminApiAuth('admin-or-staff', req);
    if (denied) return denied;

    try {
        const url = new URL(req.url);
        const activeOnly = url.searchParams.get('active_only') === 'true';
        const shortcuts = await listShortcuts(activeOnly);
        return NextResponse.json({ shortcuts });
    } catch (e) {
        console.error('[ai-chat-shortcuts] GET error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** POST /api/admin/ai-chat-shortcuts — create a new shortcut (admin only) */
export async function POST(req: Request) {
    const denied = await requireAdminApiAuth('admin-only', req);
    if (denied) return denied;

    try {
        const body = (await req.json()) as unknown;

        if (typeof body !== 'object' || body === null) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { keyword, prompt, is_active, sort_order } = body as Record<string, unknown>;

        if (typeof keyword !== 'string' || !keyword.trim()) {
            return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
        }
        if (typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        if (keyword.trim().length > MAX_KEYWORD_LENGTH) {
            return NextResponse.json(
                { error: `keyword ต้องไม่เกิน ${MAX_KEYWORD_LENGTH} ตัวอักษร` },
                { status: 400 },
            );
        }
        if (prompt.trim().length > MAX_PROMPT_LENGTH) {
            return NextResponse.json(
                { error: `prompt ต้องไม่เกิน ${MAX_PROMPT_LENGTH} ตัวอักษร` },
                { status: 400 },
            );
        }

        const created = await insertShortcut({
            keyword,
            prompt,
            is_active: typeof is_active === 'boolean' ? is_active : true,
            sort_order: typeof sort_order === 'number' ? Math.round(sort_order) : 0,
        });

        return NextResponse.json({ shortcut: created }, { status: 201 });
    } catch (e) {
        console.error('[ai-chat-shortcuts] POST error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
