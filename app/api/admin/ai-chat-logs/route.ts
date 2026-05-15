import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';
import { listAdminAiChatLogs } from '@/lib/adminAiChatLogs';

/**
 * GET /api/admin/ai-chat-logs
 *
 * List rows from `admin_ai_chat_logs` for the admin UI.
 *
 * Access: **admin-only** (this view contains every staff user's questions —
 * staff should not see each other's logs).
 *
 * Query params:
 *   date_from    YYYY-MM-DD  (optional, inclusive)
 *   date_to      YYYY-MM-DD  (optional, inclusive)
 *   q            free-text search across user_message + ai_response
 *   user_email   exact match filter
 *   errors_only  '1' | 'true' — only rows where error IS NOT NULL
 *   offset       pagination offset (default 0)
 *   limit        page size (default 50, max 200)
 *
 * Response (200):
 * {
 *   rows: AdminAiChatLogRow[],
 *   total: number,
 *   offset: number,
 *   limit: number,
 * }
 */
export async function GET(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'admin-ai-chat-logs:GET', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-only', req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from')?.trim() || undefined;
        const dateTo = searchParams.get('date_to')?.trim() || undefined;
        const q = searchParams.get('q')?.trim() || undefined;
        const userEmail = searchParams.get('user_email')?.trim() || undefined;
        const errorsParam = searchParams.get('errors_only')?.trim().toLowerCase();
        const errorsOnly = errorsParam === '1' || errorsParam === 'true';

        const offsetRaw = Number(searchParams.get('offset'));
        const limitRaw = Number(searchParams.get('limit'));
        const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 50;

        const { rows, total } = await listAdminAiChatLogs({
            dateFrom,
            dateTo,
            q,
            userEmail,
            errorsOnly,
            offset,
            limit,
        });

        return NextResponse.json({ rows, total, offset, limit });
    } catch (e) {
        console.error('[admin-ai-chat-logs] GET error:', e);
        const message =
            e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
