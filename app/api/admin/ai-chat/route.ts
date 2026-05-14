import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_MUTATE } from '@/lib/rateLimit';

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
    try {
        // ── Rate limit ───────────────────────────────────────────────
        const rateLimited = applyRateLimit(req, 'ai-chat:POST', RATE_LIMIT_MUTATE);
        if (rateLimited) return rateLimited;

        // ── Auth ─────────────────────────────────────────────────────
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

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
            return NextResponse.json(
                {
                    error:
                        getPayloadError(parsed) ||
                        `n8n webhook failed: HTTP ${upstream.status}${hint404}`,
                },
                { status: 502 },
            );
        }

        // ── Success ─────────────────────────────────────────────────
        const answer = extractAnswer(parsed, raw).trim();
        return NextResponse.json({
            answer:
                answer.length > 0
                    ? answer
                    : 'ได้รับคำตอบแล้ว แต่ไม่มีข้อความแสดงผล (ตรวจสอบว่า n8n ส่งฟิลด์ข้อความใน JSON)',
            sessionId,
        });
    } catch (e) {
        console.error('[ai-chat] Error:', e);
        if (e instanceof Error && e.name === 'AbortError') {
            return NextResponse.json({ error: 'n8n webhook timeout (ใช้เวลานานเกินไป)' }, { status: 504 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
