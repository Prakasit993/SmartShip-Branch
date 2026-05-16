import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import {
    updateShortcut,
    deleteShortcut,
    MAX_KEYWORD_LENGTH,
    MAX_PROMPT_LENGTH,
} from '@/lib/adminAiChatShortcuts';

function parseId(params: unknown): number | null {
    const id = Number((params as Record<string, string>)?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** PATCH /api/admin/ai-chat-shortcuts/[id] — partial update (admin only) */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    const denied = await requireAdminApiAuth('admin-only', req);
    if (denied) return denied;

    const params = await context.params;
    const id = parseId(params);
    if (!id) {
        return NextResponse.json({ error: 'Invalid shortcut id' }, { status: 400 });
    }

    try {
        const body = (await req.json()) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};

        if ('keyword' in body) {
            if (typeof body.keyword !== 'string' || !body.keyword.trim()) {
                return NextResponse.json({ error: 'keyword must be a non-empty string' }, { status: 400 });
            }
            if (body.keyword.trim().length > MAX_KEYWORD_LENGTH) {
                return NextResponse.json(
                    { error: `keyword ต้องไม่เกิน ${MAX_KEYWORD_LENGTH} ตัวอักษร` },
                    { status: 400 },
                );
            }
            patch.keyword = body.keyword;
        }

        if ('prompt' in body) {
            if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
                return NextResponse.json({ error: 'prompt must be a non-empty string' }, { status: 400 });
            }
            if (body.prompt.trim().length > MAX_PROMPT_LENGTH) {
                return NextResponse.json(
                    { error: `prompt ต้องไม่เกิน ${MAX_PROMPT_LENGTH} ตัวอักษร` },
                    { status: 400 },
                );
            }
            patch.prompt = body.prompt;
        }

        if ('is_active' in body) {
            if (typeof body.is_active !== 'boolean') {
                return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
            }
            patch.is_active = body.is_active;
        }

        if ('sort_order' in body) {
            if (typeof body.sort_order !== 'number') {
                return NextResponse.json({ error: 'sort_order must be a number' }, { status: 400 });
            }
            patch.sort_order = Math.round(body.sort_order);
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await updateShortcut(id, patch);
        return NextResponse.json({ shortcut: updated });
    } catch (e) {
        console.error('[ai-chat-shortcuts] PATCH error:', e);
        const msg = e instanceof Error ? e.message : 'Internal server error';
        if (msg === 'Shortcut not found') {
            return NextResponse.json({ error: 'Shortcut not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** DELETE /api/admin/ai-chat-shortcuts/[id] — hard delete (admin only) */
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    const denied = await requireAdminApiAuth('admin-only', req);
    if (denied) return denied;

    const params = await context.params;
    const id = parseId(params);
    if (!id) {
        return NextResponse.json({ error: 'Invalid shortcut id' }, { status: 400 });
    }

    try {
        await deleteShortcut(id);
        return new NextResponse(null, { status: 204 });
    } catch (e) {
        console.error('[ai-chat-shortcuts] DELETE error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
