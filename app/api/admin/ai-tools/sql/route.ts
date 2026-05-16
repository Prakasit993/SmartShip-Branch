import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_BULK } from '@/lib/rateLimit';
import { validateSelectSql } from '@/lib/sqlValidator';

/**
 * POST /api/admin/ai-tools/sql
 *
 * Phase 2 AI tool — runs an AI-generated `SELECT` query under a Postgres
 * read-only role with hard timeouts.
 *
 * Pipeline:
 *   1. Bearer auth (requireAiToolAuth — same gate as Phase 1 tools)
 *   2. Bulk rate limit (10/min — SQL is heavier than dashboard endpoints)
 *   3. Parse + validate SQL via src/lib/sqlValidator.ts:
 *      - SELECT only, whitelist tables, no blocked functions
 *      - Auto-inject `LIMIT 1000` if missing
 *   4. Execute via `run_ai_readonly_select(p_sql)` RPC:
 *      - SET LOCAL ROLE smartship_ai_readonly (SELECT-only grants)
 *      - SET LOCAL transaction_read_only = on
 *      - SET LOCAL statement_timeout = '5s'
 *   5. Return rows (max 1000) + metadata for AI to format
 *
 * Body:
 * ```json
 * { "sql": "SELECT sender_name, count(*) FROM jt_shipments WHERE ..." }
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "rows": [...],            // array of objects, max 1000
 *   "rowCount": number,       // length of rows
 *   "truncated": boolean,     // true if rowCount === limit
 *   "executedSql": string,    // SQL actually run (after LIMIT injection)
 *   "limitInjected": boolean,
 *   "elapsed_ms": number
 * }
 * ```
 *
 * Response (400): { error: "<validation message>" }
 * Response (504): { error: "query timeout (>5s)" }
 * Response (500): { error: "<DB error>" }
 */

const SQL_TIMEOUT_HINT_MS = 5500; // Slightly higher than DB statement_timeout to surface RPC vs DB timeout cleanly.

interface RequestBody {
    sql?: unknown;
}

export async function POST(req: Request) {
    const t0 = performance.now();
    try {
        // ── Rate limit (stricter than dashboard tools) ───────────────
        const rateLimited = applyRateLimit(req, 'ai-tools:sql:POST', RATE_LIMIT_BULK);
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

        // ── Validate SQL (parse, whitelist, LIMIT injection) ─────────
        const validation = validateSelectSql(body.sql);
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

            console.error('[ai-tools/sql] execution error:', { code: error.code, msg, sql: safeSql });

            return NextResponse.json(
                {
                    error: isTimeout
                        ? 'query timeout — รัน SQL เกิน 5 วินาที (ลองเพิ่ม WHERE booking_date หรือลด range)'
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
            `[ai-tools/sql] done in ${elapsed}ms — ${rows.length} rows (limit=${limit}, injected=${limitInjected})`,
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
        console.error('[ai-tools/sql] unexpected error:', err);
        const elapsed = Math.round(performance.now() - t0);
        return NextResponse.json(
            { error: 'Internal server error', elapsed_ms: elapsed },
            { status: 500 },
        );
    }
}
