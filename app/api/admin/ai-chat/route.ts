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
    message?: string;
    sessionId?: string;
    history?: ChatHistoryEntry[];
    context?: Record<string, unknown>;
}

// n8n may return the AI answer under various keys depending on the workflow.
interface N8nResponseShape {
    output?: string;
    text?: string;
    answer?: string;
    reply?: string;
    message?: string;
    error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the AI answer from n8n's response — supports multiple field names
 * and gracefully falls back to the raw text body.
 */
function extractAnswer(parsed: N8nResponseShape | null, rawBody: string): string {
    if (parsed) {
        const candidate =
            parsed.output ?? parsed.text ?? parsed.answer ?? parsed.reply ?? parsed.message;
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
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

        // ── Parse body ──────────────────────────────────────────────
        const body = (await req.json()) as AiChatRequestBody;

        const message = String(body.message ?? '').trim();
        if (!message) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }
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
                          typeof h === 'object' &&
                          h !== null &&
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
            context: body.context ?? {},
        };

        const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(n8nPayload),
        });

        const raw = await upstream.text();
        let parsed: N8nResponseShape | null = null;
        try {
            parsed = raw ? (JSON.parse(raw) as N8nResponseShape) : null;
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
                { error: parsed?.error || `n8n webhook failed: HTTP ${upstream.status}${hint404}` },
                { status: 502 },
            );
        }

        // ── Success ─────────────────────────────────────────────────
        const answer = extractAnswer(parsed, raw);
        return NextResponse.json({ answer, sessionId });
    } catch (e) {
        console.error('[ai-chat] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
