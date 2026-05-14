'use client';

import { Bot, Loader2, MessageCircle, RotateCcw, Send, Trash2, UserRound, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
    role: 'user' | 'assistant';
    text: string;
    ts?: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'admin-ai-chat-messages';
const SESSION_KEY = 'admin-ai-chat-session';
const MAX_HISTORY = 50;

/** คีย์เวิร์ดเดียวใต้ช่องพิมพ์ — แสดง `keyword` ส่ง `prompt` ไปยัง AI */
const KEYWORD_ACTIONS: { keyword: string; prompt: string }[] = [
    { keyword: 'COD วันนี้', prompt: 'สรุปเคส COD ที่ควรติดตามวันนี้' },
    { keyword: 'กำไรขนส่งเดือนนี้', prompt: 'กำไรค่าขนส่งเดือนนี้ควรดูตัวเลขอะไรบ้าง' },
    { keyword: 'ส่งแล้วเงินไม่เข้า', prompt: 'ช่วยหาแนวทางลดเคสส่งสำเร็จแต่เงินยังไม่เข้า' },
    {
        keyword: 'กำไรเดือนนี้',
        prompt: 'ช่วยสรุปกำไรค่าขนส่งของเดือนนี้ พร้อมบอกยอดขายรวม ต้นทุนรวม และกำไรรวมที่ควรแสดงบน Dashboard',
    },
    {
        keyword: 'COD ค้างเกิน 24 ชม.',
        prompt: 'ช่วยวิเคราะห์เคส COD ที่ส่งสำเร็จแล้วแต่เงินยังไม่เข้าเกิน 24 ชั่วโมง และแนะนำลำดับการติดตาม',
    },
    {
        keyword: 'ต้นทุนที่ยังไม่ Map',
        prompt: 'ช่วยตรวจแนวทางหา shipping_fee ที่ยังไม่มีราคาต้นทุนใน shipping_cost_master และสรุปผลกระทบต่อกำไร',
    },
    {
        keyword: 'เคสเร่งด่วนวันนี้',
        prompt: 'ช่วยจัดลำดับเคสขนส่งที่ควรติดตามวันนี้ โดยดูจาก COD ค้าง พัสดุผิดปกติ และรายการที่กระทบรายได้',
    },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return '';
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
}

function loadMessages(): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ChatMessage[]).slice(-MAX_HISTORY) : [];
    } catch {
        return [];
    }
}

function saveMessages(msgs: ChatMessage[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
    } catch { /* quota exceeded — ignore */ }
}

function normalizeChatText(text: string): string {
    return text.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function contextForPath(pathname: string | null): Record<string, string> {
    if (!pathname || pathname === '/admin') {
        return { page: 'admin-dashboard', focus: 'overview' };
    }
    if (pathname.startsWith('/admin/jt-deep-dive-dashboard')) {
        return { page: 'deep-dive-dashboard', focus: 'financial-and-sla-analysis' };
    }
    if (pathname.startsWith('/admin/jt-dashboard')) {
        return { page: 'jt-dashboard', focus: 'jt-metrics' };
    }
    if (pathname.startsWith('/admin/orders')) {
        return { page: 'orders', focus: 'order-ops' };
    }
    if (pathname.startsWith('/admin/settings')) {
        return { page: 'settings', focus: 'site-config' };
    }
    const slug = pathname.replace(/^\/admin\/?/, '').replace(/\//g, '-') || 'admin';
    return { page: slug, focus: 'general' };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminAiChatDock() {
    const pathname = usePathname();
    const [panelOpen, setPanelOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load persisted messages on mount
    useEffect(() => {
        setMessages(loadMessages());
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, loading]);

    const clearChat = useCallback(() => {
        setMessages([]);
        setError(null);
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_KEY);
    }, []);

    const submitChat = useCallback(
        async (messageText?: string) => {
            const text = (messageText ?? input).trim();
            if (!text || loading) return;

            setLoading(true);
            setError(null);
            setInput('');

            const userMsg: ChatMessage = { role: 'user', text, ts: Date.now() };
            const updated = [...messages, userMsg];
            setMessages(updated);
            saveMessages(updated);

            try {
                const sessionId = getOrCreateSessionId();
                const res = await fetch('/api/admin/ai-chat', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        sessionId,
                        history: updated.slice(-20).map((m) => ({ role: m.role, text: m.text })),
                        context: {
                            ...contextForPath(pathname),
                            pathname: pathname ?? '',
                        },
                    }),
                });
                const raw = await res.text();
                let parsed: { answer?: string; error?: string } = {};
                try {
                    parsed = JSON.parse(raw) as { answer?: string; error?: string };
                } catch {
                    parsed = {};
                }
                if (!res.ok) {
                    throw new Error(parsed.error || 'ส่งคำถามไม่สำเร็จ');
                }
                const answerStr =
                    typeof parsed.answer === 'string'
                        ? parsed.answer.trim()
                        : typeof parsed.answer === 'number' || typeof parsed.answer === 'boolean'
                          ? String(parsed.answer)
                          : '';
                const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    text:
                        answerStr ||
                        'ไม่ได้รับข้อความจากผู้ช่วย (ลองใหม่หรือตรวจสอบ workflow n8n ว่าส่งฟิลด์ answer/output/text)',
                    ts: Date.now(),
                };
                const withReply = [...updated, assistantMsg];
                setMessages(withReply);
                saveMessages(withReply);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'ส่งคำถามไม่สำเร็จ');
            } finally {
                setLoading(false);
            }
        },
        [input, loading, pathname, messages],
    );

    useEffect(() => {
        if (!panelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPanelOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [panelOpen]);

    return (
        <div
            className="pointer-events-none fixed bottom-0 right-0 z-[90] flex max-w-[100vw] flex-col items-end gap-2.5 p-3 sm:p-4"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
            {panelOpen ? (
                <section
                    className="pointer-events-auto flex max-h-[min(90vh,40rem)] w-[min(calc(100vw-1.5rem),22rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/85 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-white/[0.02] sm:w-[min(calc(100vw-2rem),24rem)] lg:max-h-[min(92vh,44rem)] lg:w-[min(calc(100vw-2.5rem),28rem)]"
                    role="dialog"
                    aria-label="ผู้ช่วยวิเคราะห์ข้อมูล AI"
                >
                    {/* ── Header ─────────────────────────────────────────── */}
                    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-indigo-500/20 to-purple-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                                <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-md" />
                                <Bot className="relative z-10 h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-[15px] font-semibold tracking-wide text-slate-100">
                                        Data Analyst AI
                                    </h2>
                                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                                        n8n
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    พร้อมช่วยสรุปและวิเคราะห์ข้อมูล
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {messages.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearChat}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                    aria-label="ล้างแชท"
                                    title="ล้างประวัติแชท"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                                aria-label="ปิดแชท"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>
                    </header>

                    {/* ── Messages ────────────────────────────────────────── */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-2">
                        <div
                            ref={scrollRef}
                            className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain scroll-pb-4 py-1 pr-1 pb-4"
                        >
                            {messages.length === 0 && !loading ? (
                                <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center sm:min-h-[14rem]">
                                    <Bot className="mb-3 h-8 w-8 text-slate-600/50" />
                                    <p className="max-w-[16rem] text-sm text-slate-500">
                                        สอบถามข้อมูลเกี่ยวกับยอดขาย COD หรือกำไรได้เลยครับ
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message, idx) => (
                                        <ChatBubble key={idx} message={message} />
                                    ))}
                                    {loading && (
                                        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-2 text-xs leading-relaxed text-slate-400">
                                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" aria-hidden />
                                            กำลังวิเคราะห์…
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Input form ──────────────────────────────────────── */}
                    <form
                        className="shrink-0 border-t border-white/[0.06] bg-slate-950/50 p-4 pb-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submitChat();
                        }}
                    >
                        <label htmlFor="admin-ai-chat-input" className="sr-only">
                            พิมพ์คำถาม AI
                        </label>
                        <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-1.5 shadow-inner transition-all focus-within:border-indigo-500/50 focus-within:bg-slate-900/80 focus-within:ring-1 focus-within:ring-indigo-500/20">
                            <textarea
                                id="admin-ai-chat-input"
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void submitChat();
                                    }
                                }}
                                rows={1}
                                style={{ minHeight: '44px', maxHeight: '120px' }}
                                placeholder="ถามอะไรก็ตอบได้..."
                                className="scrollbar-hide flex-1 resize-none bg-transparent px-3 py-3 text-[14px] text-slate-200 outline-none placeholder:text-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="mb-0.5 mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-900/20 transition-all hover:scale-105 hover:shadow-indigo-900/40 disabled:pointer-events-none disabled:opacity-40"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                    <Send className="h-4 w-4 -ml-0.5" aria-hidden />
                                )}
                            </button>
                        </div>
                        <p className="mt-2 text-center text-[10px] tracking-wide text-slate-500">Enter เพื่อส่ง · Shift+Enter เพื่อขึ้นบรรทัดใหม่</p>
                        <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                                {KEYWORD_ACTIONS.map((action) => (
                                    <button
                                        key={action.keyword}
                                        type="button"
                                        disabled={loading}
                                        title={action.prompt}
                                        onClick={() => void submitChat(action.prompt)}
                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium tracking-wide text-slate-300 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {action.keyword}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {error ? (
                            <div className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/30 px-2.5 py-2">
                                <p className="text-xs leading-relaxed text-rose-200/90">{error}</p>
                                {error.includes('N8N_AI_WEBHOOK_URL') ? (
                                    <p className="mt-1 text-[10px] leading-relaxed text-rose-300/80">
                                        ตั้งค่า N8N_AI_WEBHOOK_URL ใน env แล้วรีสตาร์ทเซิร์ฟเวอร์
                                    </p>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setError(null)}
                                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-rose-300/70 transition hover:text-rose-200"
                                >
                                    <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                                    ปิดข้อผิดพลาด
                                </button>
                            </div>
                        ) : null}
                    </form>
                </section>
            ) : null}

            {/* ── FAB toggle ─────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                className="group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-900/30 ring-1 ring-white/20 transition-all hover:scale-105 hover:shadow-indigo-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-label={panelOpen ? 'ปิดแชท AI' : 'เปิดแชท AI'}
                aria-expanded={panelOpen}
            >
                <div className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/10" />
                {panelOpen ? <X className="relative z-10 h-6 w-6" aria-hidden /> : <MessageCircle className="relative z-10 h-6 w-6" aria-hidden />}
            </button>
        </div>
    );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex min-w-0 gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser ? (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-indigo-400 ring-1 ring-white/10">
                    <Bot className="h-3.5 w-3.5" aria-hidden />
                </div>
            ) : null}
            <div
                className={`min-w-0 max-w-[min(94%,24rem)] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                    isUser
                        ? 'rounded-tr-sm border border-indigo-500/20 bg-gradient-to-br from-indigo-600 to-indigo-800 text-indigo-50 shadow-indigo-900/20'
                        : 'rounded-tl-sm border border-white/5 bg-white/[0.03] text-slate-200 shadow-black/10'
                }`}
            >
                <p
                    className={`mb-1 text-[9px] font-medium uppercase tracking-wide ${
                        isUser ? 'text-slate-500' : 'text-slate-600'
                    }`}
                >
                    {isUser ? 'คุณ' : 'ผู้ช่วย AI'}
                </p>
                <div className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {isUser ? normalizeChatText(message.text) : <FormattedAiText text={message.text} />}
                </div>
            </div>
            {isUser ? (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                </div>
            ) : null}
        </div>
    );
}

// ── Simple markdown-like renderer for AI responses ───────────────────────────

/** Inline **bold** segments — must not confuse with numbered-list layout. */
function renderBoldSegments(line: string): ReactNode[] {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={j} className="font-semibold text-slate-100">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={j}>{part}</span>;
    });
}

function FormattedAiText({ text }: { text: string }) {
    const normalized = normalizeChatText(text);
    const lines = normalized.split('\n');

    return (
        <>
            {lines.map((line, i) => {
                const rendered = renderBoldSegments(line);

                // Bullet points
                if (/^[\s]*[-•]\s/.test(line)) {
                    return (
                        <div key={i} className="flex min-w-0 gap-1 pl-1">
                            <span className="shrink-0 text-slate-500">•</span>
                            <span className="min-w-0">{rendered}</span>
                        </div>
                    );
                }
                // Numbered lists: strip "1. " then bold-parse the remainder (avoid dropping text vs. slice(1) on nodes).
                const numMatch = line.match(/^(\s*\d+[.)]\s)/);
                if (numMatch) {
                    const rest = line.slice(numMatch[0].length);
                    return (
                        <div key={i} className="flex min-w-0 gap-1 pl-1">
                            <span className="shrink-0 text-slate-500">{numMatch[1].trim()}</span>
                            <span className="min-w-0">{renderBoldSegments(rest)}</span>
                        </div>
                    );
                }
                // Empty line
                if (!line.trim()) {
                    return <div key={i} className="h-1.5" />;
                }
                return <div key={i}>{rendered}</div>;
            })}
        </>
    );
}
