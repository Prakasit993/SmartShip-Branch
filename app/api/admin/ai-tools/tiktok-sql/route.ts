import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_BULK } from '@/lib/rateLimit';
import { validateSelectSql, TIKTOK_ALLOWED_TABLES } from '@/lib/sqlValidator';

/**
 * POST /api/admin/ai-tools/tiktok-sql
 *
 * TikTok counterpart of /api/admin/ai-tools/sql. Same executor + safety model,
 * but the SQL validator is restricted to TIKTOK_ALLOWED_TABLES (tiktok_shipments
 * only). This keeps the TikTok carrier dataset strictly disjoint from the JT
 * dataset — neither query_sql nor query_tiktok_sql can reach the other's tables.
 * See docs/ai-agent-mcp-plan.md (P1.3).
 *
 * Pipeline (identical to the JT route):
 *   1. Bearer auth (requireAiToolAuth)
 *   2. Bulk rate limit
 *   3. validateSelectSql(sql, TIKTOK_ALLOWED_TABLES) — SELECT only, tiktok_shipments
 *      only, no blocked functions, auto LIMIT 1000
 *   4. run_ai_readonly_select(p_sql) RPC — transaction_read_only + statement_timeout 5s
 *
 * Body:    { "sql": "SELECT ... FROM tiktok_shipments WHERE ..." }
 * Response (200): { rows, rowCount, truncated, executedSql, limitInjected, elapsed_ms }
 * Response (400): { error }  // validation (e.g. table not allowed: jt_shipments)
 * Response (403): { error }  // permission denied
 * Response (504): { error }  // query timeout (>5s)
 */

const SQL_TIMEOUT_HINT_MS = 5500; // Slightly higher than DB statement_timeout to surface RPC vs DB timeout cleanly.

interface RequestBody {
    sql?: unknown;
}

export async function POST(req: Request) {
    const t0 = performance.now();
    try {
        // ── Rate limit (stricter than dashboard tools) ───────────────
        const rateLimited = applyRateLimit(req, 'ai-tools:tiktok-sql:POST', RATE_LIMIT_BULK);
        if (rateLimited) return rateLimited;

        // ── Auth ──────────────────────────────────────────────────────
        const denied = await requireAiToolAuth(req);
        if (denied) return denied;

        // ── Parse body ────────────────────────────────────────────────
        let body: RequestBody;
        try {
            body = (await req.json()) as RequestBody;
        } catch {
            return NextResponse.json(
                { error: 'invalid JSON body — expected { sql: string }' },
                { status: 400 },
            );
        }

        // ── Validate SQL — TikTok dataset only ───────────────────────
        const validation = validateSelectSql(body.sql, TIKTOK_ALLOWED_TABLES);
        if (!validation.ok) {
            // 400 with the validator's error so the AI agent can self-correct
            // on retry (the error message is meant to be agent-readable).
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const { safeSql, limit, limitInjected } = validation;

        // ── Execute via read-only RPC ────────────────────────────────
        // AbortSignal isn't honored by supabase-js for RPC, but the DB's
        // statement_timeout (5s) is the real backstop. The hint timeout is
        // here only so the route doesn't sit on a hung connection forever.
        const timer = new Promise<{ data: null; error: { message: string; code: 'CLIENT_TIMEOUT' } }>(
            (resolve) =>
                setTimeout(
                    () =>
                        resolve({
                            data: null,
                            error: { message: 'client-side SQL timeout', code: 'CLIENT_TIMEOUT' },
                        }),
                    SQL_TIMEOUT_HINT_MS,
                ),
        );

        const rpcCall = supabaseAdmin.rpc('run_ai_readonly_select', { p_sql: safeSql });

        const { data, error } = (await Promise.race([rpcCall, timer])) as {
            data: unknown;
            error: { message: string; code?: string } | null;
        };

        const elapsed = Math.round(performance.now() - t0);

        if (error) {
            // Map Postgres statement_timeout (57014) to 504; everything else 500.
            // Some PG errors also surface as messages without code — sniff text.
            const msg = error.message ?? '';
            const isTimeout =
                error.code === '57014' ||
                error.code === 'CLIENT_TIMEOUT' ||
                /statement timeout|canceling statement due to/i.test(msg);
            const isPermission =
                error.code === '42501' || /permission denied/i.test(msg);

            console.error('[ai-tools/tiktok-sql] execution error:', { code: error.code, msg, sql: safeSql });

            return NextResponse.json(
                {
                    error: isTimeout
                        ? 'query timeout — รัน SQL เกิน 5 วินาที (ลองเพิ่ม WHERE หรือลด range)'
                        : isPermission
                          ? 'permission denied — SQL พยายามเข้าถึง table/operation ที่ไม่อนุญาต'
                          : `SQL execution failed: ${msg}`,
                    executedSql: safeSql,
                    elapsed_ms: elapsed,
                },
                { status: isTimeout ? 504 : isPermission ? 403 : 500 },
            );
        }

        // The RPC returns a single json (jsonb) value — array of row objects.
        const rows: Array<Record<string, unknown>> = Array.isArray(data)
            ? (data as Array<Record<string, unknown>>)
            : [];

        console.log(
            `[ai-tools/tiktok-sql] done in ${elapsed}ms — ${rows.length} rows (limit=${limit}, injected=${limitInjected})`,
        );

        return NextResponse.json({
            rows,
            rowCount: rows.length,
            truncated: rows.length >= limit,
            executedSql: safeSql,
            limitInjected,
            elapsed_ms: elapsed,
        });
    } catch (err) {
        console.error('[ai-tools/tiktok-sql] unexpected error:', err);
        const elapsed = Math.round(performance.now() - t0);
        return NextResponse.json(
            { error: 'Internal server error', elapsed_ms: elapsed },
            { status: 500 },
        );
    }
}
