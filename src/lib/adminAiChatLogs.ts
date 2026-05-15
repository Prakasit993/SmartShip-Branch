import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Persistent audit + analytics for the Admin Data Analyst AI chat.
 *
 * Each row = one turn (user message + AI reply). Inserted from
 * `app/api/admin/ai-chat/route.ts` after n8n returns. Read by
 * `app/api/admin/ai-chat-logs/route.ts` (admin-only).
 *
 * The DB table is created by `database/db/migrations/20260515_admin_ai_chat_logs.sql`.
 */

export const ADMIN_AI_CHAT_LOGS_TABLE = 'admin_ai_chat_logs';

/** Captured n8n tool invocation — only populated if the workflow sends it back. */
export interface AiChatToolCallLog {
    name: string;
    args?: Record<string, unknown>;
    status?: 'success' | 'error' | string;
    duration_ms?: number;
    /** Optional truncated response preview, if n8n includes it. */
    result_preview?: string;
}

export interface AdminAiChatLogInsert {
    session_id: string;
    user_email: string | null;
    user_role: 'admin' | 'staff' | null;
    user_message: string;
    ai_response: string;
    tools_called: AiChatToolCallLog[] | null;
    context: Record<string, unknown> | null;
    latency_ms: number | null;
    error: string | null;
}

export interface AdminAiChatLogRow extends AdminAiChatLogInsert {
    id: number;
    created_at: string;
}

/**
 * Fire-and-forget insert. Errors are logged but never thrown — chat UX must not
 * be blocked by an analytics write failure (e.g. DB hiccup, migration not yet run).
 */
export async function insertAdminAiChatLog(entry: AdminAiChatLogInsert): Promise<void> {
    try {
        const { error } = await supabaseAdmin
            .from(ADMIN_AI_CHAT_LOGS_TABLE)
            .insert({
                session_id: entry.session_id,
                user_email: entry.user_email,
                user_role: entry.user_role,
                user_message: entry.user_message,
                ai_response: entry.ai_response,
                tools_called: entry.tools_called,
                context: entry.context,
                latency_ms: entry.latency_ms,
                error: entry.error,
            });
        if (error) {
            // Most common cause during rollout: migration hasn't run yet on this env.
            console.warn('[admin-ai-chat-logs] insert failed:', error.message);
        }
    } catch (e) {
        console.warn('[admin-ai-chat-logs] insert threw:', e);
    }
}

// ── List query helpers (used by admin UI) ─────────────────────────────────────

export interface ListChatLogsFilters {
    /** ISO date string YYYY-MM-DD — inclusive. */
    dateFrom?: string;
    /** ISO date string YYYY-MM-DD — inclusive. */
    dateTo?: string;
    /** Free-text search across user_message + ai_response. */
    q?: string;
    /** Exact user_email filter. */
    userEmail?: string;
    /** If true, only return rows where `error IS NOT NULL`. */
    errorsOnly?: boolean;
    /** Pagination offset. */
    offset?: number;
    /** Pagination limit. Capped server-side to MAX_PAGE_SIZE. */
    limit?: number;
}

export interface ListChatLogsResult {
    rows: AdminAiChatLogRow[];
    total: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidYmd(v?: string): v is string {
    return typeof v === 'string' && YMD_RE.test(v);
}

/**
 * List chat logs with filters. Returns rows + total count for pagination.
 *
 * Search semantics: `q` does case-insensitive ILIKE on user_message AND
 * ai_response (OR). Empty `q` = no text filter.
 */
export async function listAdminAiChatLogs(
    filters: ListChatLogsFilters,
): Promise<ListChatLogsResult> {
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = Math.max(filters.offset ?? 0, 0);

    let q = supabaseAdmin
        .from(ADMIN_AI_CHAT_LOGS_TABLE)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (isValidYmd(filters.dateFrom)) {
        q = q.gte('created_at', `${filters.dateFrom}T00:00:00Z`);
    }
    if (isValidYmd(filters.dateTo)) {
        // Inclusive end-of-day. Use < (dateTo + 1 day) rather than <= to avoid
        // off-by-one on millisecond-precision timestamps.
        const next = new Date(`${filters.dateTo}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        q = q.lt('created_at', next.toISOString());
    }
    if (filters.userEmail) {
        q = q.eq('user_email', filters.userEmail);
    }
    if (filters.errorsOnly) {
        q = q.not('error', 'is', null);
    }
    if (filters.q && filters.q.trim()) {
        const term = filters.q.trim().replace(/[%_]/g, (m) => `\\${m}`);
        const pattern = `%${term}%`;
        // Search both user_message and ai_response.
        q = q.or(`user_message.ilike.${pattern},ai_response.ilike.${pattern}`);
    }

    const { data, count, error } = await q.range(offset, offset + limit - 1);
    if (error) {
        throw new Error(error.message);
    }

    return {
        rows: (data ?? []) as AdminAiChatLogRow[],
        total: count ?? 0,
    };
}
