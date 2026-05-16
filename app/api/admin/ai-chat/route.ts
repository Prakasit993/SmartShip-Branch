import { NextResponse } from 'next/server';
import { getAdminApiAccess, requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_MUTATE } from '@/lib/rateLimit';
import {
    insertAdminAiChatLog,
    type AiChatToolCallLog,
} from '@/lib/adminAiChatLogs';

/**
 * Max conversation history entries forwarded to n8n.
 * Keeps the payload small while giving enough context for multi-turn.
 */
const MAX_HISTORY_ENTRIES = 20;

/** Max length of a single user message (characters). */
const MAX_MESSAGE_LENGTH = 2000;

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatHistoryEntry {
    role: 'user' | 'assistant';
    text: string;
}

interface AiChatRequestBody {
    message?: unknown;
    sessionId?: unknown;
    history?: unknown;
    context?: unknown;
}

/** Keys n8n / AI nodes commonly use for the assistant message body. */
const ANSWER_KEYS = [
    'output',
    'text',
    'answer',
    'reply',
    'message',
    'content',
    'response',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickAnswerString(obj: Record<string, unknown>): string | null {
    for (const key of ANSWER_KEYS) {
        const v = obj[key];
        if (typeof v === 'string' && v.trim()) return v;
        if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
        if (typeof v === 'boolean') return v ? 'true' : 'false';
    }
    return null;
}

/**
 * Walk n8n webhook payloads (object, array, `{ json: {...} }`, nested wrappers)
 * so we do not drop the model reply when the workflow shape differs slightly.
 */
function extractAnswerFromValue(value: unknown, depth = 0): string | null {
    if (depth > 12) return null;
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const t = value.trim();
        return t.length > 0 ? value : null;
    }
    if (typeof value !== 'object') return null;

    if (Array.isArray(value)) {
        const parts: string[] = [];
        for (const item of value) {
            const s = extractAnswerFromValue(item, depth + 1);
            if (s) parts.push(s.trim());
        }
        return parts.length ? parts.join('\n') : null;
    }

    const obj = value as Record<string, unknown>;
    const direct = pickAnswerString(obj);
    if (direct) return direct;

    // e.g. { "answer": { "content": "..." } } — value under a known key is nested JSON
    for (const key of ANSWER_KEYS) {
        if (!(key in obj)) continue;
        const nested = extractAnswerFromValue(obj[key], depth + 1);
        if (nested) return nested;
    }

    if ('json' in obj) {
        const nested = extractAnswerFromValue(obj.json, depth + 1);
        if (nested) return nested;
    }
    for (const wrap of ['body', 'data', 'result', 'results'] as const) {
        if (wrap in obj) {
            const nested = extractAnswerFromValue(obj[wrap], depth + 1);
            if (nested) return nested;
        }
    }

    return null;
}

function getPayloadError(parsed: unknown): string | undefined {
    if (!isRecord(parsed)) return undefined;
    const e = parsed.error;
    return typeof e === 'string' && e.trim() ? e : undefined;
}

/**
 * Pull `tools_called` array from the n8n response if the workflow includes it
 * (see docs/ai-agent-tools.md — "Capturing tool calls"). Accepts a few payload
 * shapes since n8n's "Set" / "Edit Fields" nodes wrap data inconsistently.
 *
 * Returns null when no recognisable structure is found — the row is logged
 * with `tools_called: null` so we can tell "n8n didn't send it" apart from
 * "AI used 0 tools".
 */
function extractToolsCalled(parsed: unknown): AiChatToolCallLog[] | null {
    if (!isRecord(parsed)) return null;

    const candidates: unknown[] = [];
    if (Array.isArray(parsed.tools_called)) candidates.push(parsed.tools_called);
    if (Array.isArray(parsed.toolsCalled)) candidates.push(parsed.toolsCalled);
    if (Array.isArray(parsed.tools)) candidates.push(parsed.tools);
    if (isRecord(parsed.json)) {
        const j = parsed.json;
        if (Array.isArray(j.tools_called)) candidates.push(j.tools_called);
        if (Array.isArray(j.toolsCalled)) candidates.push(j.toolsCalled);
        if (Array.isArray(j.tools)) candidates.push(j.tools);
    }
    if (candidates.length === 0) return null;

    const raw = candidates[0] as unknown[];
    const out: AiChatToolCallLog[] = [];
    for (const item of raw) {
        if (!isRecord(item)) continue;
        const name = typeof item.name === 'string' ? item.name : null;
        if (!name) continue;
        out.push({
            name,
            args: isRecord(item.args) ? (item.args as Record<string, unknown>) : undefined,
            status: typeof item.status === 'string' ? item.status : undefined,
            duration_ms:
                typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
            result_preview:
                typeof item.result_preview === 'string'
                    ? item.result_preview.slice(0, 500)
                    : undefined,
        });
    }
    return out.length > 0 ? out : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the AI answer from n8n's response — supports multiple field names,
 * array roots, `json` envelopes, and falls back to the raw text body.
 */
function extractAnswer(parsed: unknown, rawBody: string): string {
    const fromParsed = extractAnswerFromValue(parsed);
    if (fromParsed) return fromParsed;
    if (rawBody.trim()) return rawBody;
    return 'ได้รับคำตอบแล้ว แต่ไม่มีข้อความแสดงผล';
}

// ── POST handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/ai-chat
 *
 * Proxy a user message to the n8n AI chat webhook.
 * Supports sessionId + conversation history for multi-turn memory.
 *
 * Body:
 * ```json
 * {
 *   "message":   "สรุปยอด COD วันนี้",
 *   "sessionId": "uuid-v4",          // optional — enables n8n session memory
 *   "history":   [{ role, text }],    // optional — last N messages for context
 *   "context":   { page, focus, … }   // optional — page context
 * }
 * ```
 */
export async function POST(req: Request) {
    // Identity + timing captured at the top so we can log on every exit path
    // (success, upstream error, timeout, unexpected throw). `logCtx` is mutated
    // as we learn more about the request — populate what we can, log what we have.
    const t0 = performance.now();
    const logCtx: {
        sessionId: string | null;
        userEmail: string | null;
        userRole: 'admin' | 'staff' | null;
        message: string | null;
        context: Record<string, unknown> | null;
    } = {
        sessionId: null,
        userEmail: null,
        userRole: null,
        message: null,
        context: null,
    };

    const finishLog = (params: {
        answer: string;
        toolsCalled: AiChatToolCallLog[] | null;
        error: string | null;
    }) => {
        // Don't await — log writes happen in background and never block the response.
        // sessionId + message are required for a meaningful row; skip if missing
        // (e.g. validation failed before we could parse the body).
        if (!logCtx.sessionId || !logCtx.message) return;
        void insertAdminAiChatLog({
            session_id: logCtx.sessionId,
            user_email: logCtx.userEmail,
            user_role: logCtx.userRole,
            user_message: logCtx.message,
            ai_response: params.answer,
            tools_called: params.toolsCalled,
            context: logCtx.context,
            latency_ms: Math.round(performance.now() - t0),
            error: params.error,
        });
    };

    try {
        // ── Rate limit ───────────────────────────────────────────────
        const rateLimited = applyRateLimit(req, 'ai-chat:POST', RATE_LIMIT_MUTATE);
        if (rateLimited) return rateLimited;

        // ── Auth ─────────────────────────────────────────────────────
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        // Resolve identity for audit log (separate call — requireAdminApiAuth
        // gates the request but doesn't return user details).
        const access = await getAdminApiAccess(req);
        logCtx.userEmail = access.email;
        logCtx.userRole = access.role;

        // ── Env ──────────────────────────────────────────────────────
        const webhookUrl = process.env.N8N_AI_WEBHOOK_URL;
        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'Missing N8N_AI_WEBHOOK_URL environment variable' },
                { status: 500 },
            );
        }

        // ── Parse & Validate body ───────────────────────────────────
        const body = (await req.json()) as AiChatRequestBody;

        if (typeof body.message !== 'string' || !body.message.trim()) {
            return NextResponse.json(
                { error: 'message is required and must be a string' },
                { status: 400 }
            );
        }
        const message = body.message.trim();

        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `ข้อความยาวเกินไป (สูงสุด ${MAX_MESSAGE_LENGTH} ตัวอักษร)` },
                { status: 400 },
            );
        }

        // Sanitize sessionId — accept UUIDs and short alphanumeric IDs only.
        const sessionId =
            typeof body.sessionId === 'string' &&
            /^[\w-]{8,64}$/.test(body.sessionId)
                ? body.sessionId
                : undefined;

        logCtx.sessionId = sessionId ?? null;
        logCtx.message = message;
        logCtx.context = isRecord(body.context) ? body.context : null;

        // Trim history to the last N entries, validate structure.
        const history: ChatHistoryEntry[] = Array.isArray(body.history)
            ? body.history
                  .filter(
                      (h): h is ChatHistoryEntry =>
                          isRecord(h) &&
                          (h.role === 'user' || h.role === 'assistant') &&
                          typeof h.text === 'string' &&
                          h.text.trim().length > 0,
                  )
                  .slice(-MAX_HISTORY_ENTRIES)
                  .map((h) => ({ role: h.role, text: h.text.slice(0, MAX_MESSAGE_LENGTH) }))
            : [];

        // ── Forward to n8n ──────────────────────────────────────────
        const n8nPayload = {
            source: 'admin-jt-dashboard',
            message,
            ...(sessionId ? { sessionId } : {}),
            ...(history.length > 0 ? { history } : {}),
            context: isRecord(body.context) ? body.context : {},
        };

        // Enforce a timeout to prevent hanging connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds

        const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(n8nPayload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const raw = await upstream.text();
        let parsed: unknown = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }

        // ── Error handling ──────────────────────────────────────────
        if (!upstream.ok) {
            const hint404 =
                upstream.status === 404
                    ? ' ตรวจสอบ N8N_AI_WEBHOOK_URL ให้ตรงกับ Production URL ใน Webhook node (คัดลอกจาก n8n) และให้ workflow เปิดใช้งาน (Active) แล้ว'
                    : '';
            const errMsg =
                getPayloadError(parsed) || `n8n webhook failed: HTTP ${upstream.status}${hint404}`;
            finishLog({ answer: '', toolsCalled: null, error: errMsg });
            return NextResponse.json({ error: errMsg }, { status: 502 });
        }

        // ── Success ─────────────────────────────────────────────────
        const answer = extractAnswer(parsed, raw).trim();
        const toolsCalled = extractToolsCalled(parsed);
        const isFallback = answer.length === 0;
        const finalAnswer = isFallback
            ? 'ได้รับคำตอบแล้ว แต่ไม่มีข้อความแสดงผล (ตรวจสอบว่า n8n ส่งฟิลด์ข้อความใน JSON)'
            : answer;

        // Even though n8n returned 2xx, an empty answer is a soft failure —
        // record it in `error` so admins can filter "errors only" in the log
        // viewer to find these cases. Include a snippet of the raw response
        // for debugging (truncated to keep the column small).
        const softError = isFallback
            ? `n8n returned 2xx but no parseable answer. Raw response (first 500 chars): ${raw.slice(0, 500)}`
            : null;

        finishLog({ answer: finalAnswer, toolsCalled, error: softError });

        return NextResponse.json({ answer: finalAnswer, sessionId });
    } catch (e) {
        console.error('[ai-chat] Error:', e);
        if (e instanceof Error && e.name === 'AbortError') {
            finishLog({ answer: '', toolsCalled: null, error: 'n8n webhook timeout' });
            return NextResponse.json({ error: 'n8n webhook timeout (ใช้เวลานานเกินไป)' }, { status: 504 });
        }
        finishLog({
            answer: '',
            toolsCalled: null,
            error: e instanceof Error ? e.message : 'unknown error',
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
