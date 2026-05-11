'use client';

import { Bot, Loader2, MessageCircle, Send, UserRound, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type ChatMessage = {
    role: 'user' | 'assistant';
    text: string;
};

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

export default function AdminAiChatDock() {
    const pathname = usePathname();
    const [panelOpen, setPanelOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const submitChat = useCallback(
        async (messageText?: string) => {
            const text = (messageText ?? input).trim();
            if (!text || loading) return;

            setLoading(true);
            setError(null);
            setInput('');
            setMessages((prev) => [...prev, { role: 'user', text }]);

            try {
                const res = await fetch('/api/admin/ai-chat', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        message: text,
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
                setMessages((prev) => [...prev, { role: 'assistant', text: parsed.answer ?? '-' }]);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'ส่งคำถามไม่สำเร็จ');
            } finally {
                setLoading(false);
            }
        },
        [input, loading, pathname],
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
                    className="pointer-events-auto flex max-h-[min(90vh,40rem)] w-[min(calc(100vw-1.5rem),20rem)] flex-col overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/95 shadow-lg shadow-black/25 ring-1 ring-white/[0.03] sm:w-[min(calc(100vw-2rem),22rem)] lg:max-h-[min(92vh,44rem)] lg:w-[min(calc(100vw-2.5rem),24rem)]"
                    role="dialog"
                    aria-label="ผู้ช่วยวิเคราะห์ข้อมูล AI"
                >
                    <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-800/70 px-3 py-2.5 sm:px-3.5">
                        <div className="flex min-w-0 items-start gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/90 text-slate-400 ring-1 ring-slate-700/80">
                                <Bot className="h-3.5 w-3.5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <h2 className="text-sm font-medium tracking-tight text-slate-200">
                                        ผู้ช่วยวิเคราะห์ข้อมูล
                                    </h2>
                                    <span className="rounded border border-slate-700/90 bg-slate-800/80 px-1 py-px text-[9px] font-medium text-slate-500">
                                        AI
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                                    สรุป COD / ขนส่ง — ตามหน้าที่เปิดอยู่
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPanelOpen(false)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition hover:bg-slate-800/80 hover:text-slate-300"
                            aria-label="ปิดแชท"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-hidden px-3 py-2 sm:px-3.5">
                        <div className="scrollbar-hide flex max-h-[min(62vh,22rem)] min-h-[12rem] flex-col-reverse gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[min(68vh,26rem)] sm:min-h-[14rem] lg:max-h-[min(72vh,30rem)] lg:min-h-[16rem]">
                            {loading ? (
                                <div className="mr-6 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-2 text-xs leading-relaxed text-slate-400">
                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" aria-hidden />
                                    กำลังวิเคราะห์…
                                </div>
                            ) : null}
                            {messages.length === 0 ? (
                                <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-slate-800/70 bg-slate-900/25 px-3 text-center sm:min-h-[14rem] lg:min-h-[16rem]">
                                    <p className="max-w-[16rem] text-xs leading-relaxed text-slate-500">
                                        เลือกคีย์เวิร์ดด้านล่าง หรือพิมพ์คำถาม
                                    </p>
                                </div>
                            ) : (
                                messages
                                    .map((message, origIdx) => ({ message, origIdx }))
                                    .reverse()
                                    .map(({ message, origIdx }) => (
                                        <ChatBubble key={origIdx} message={message} />
                                    ))
                            )}
                        </div>
                    </div>

                    <form
                        className="shrink-0 border-t border-slate-800/70 p-3 sm:px-3.5 sm:pb-3 sm:pt-2.5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submitChat();
                        }}
                    >
                        <label htmlFor="admin-ai-chat-input" className="sr-only">
                            พิมพ์คำถาม AI
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <textarea
                                id="admin-ai-chat-input"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void submitChat();
                                    }
                                }}
                                rows={2}
                                placeholder="พิมพ์คำถาม…"
                                className="min-h-[3.25rem] flex-1 resize-y rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-[13px] leading-snug text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 text-xs font-medium text-slate-200 shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[4.5rem]"
                            >
                                {loading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                    <Send className="h-3.5 w-3.5" aria-hidden />
                                )}
                                ส่ง
                            </button>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-normal text-slate-600">Enter ส่ง · Shift+Enter บรรทัดใหม่</p>
                        <div className="mt-2">
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">คีย์เวิร์ด</p>
                            <div className="flex flex-wrap gap-1.5">
                                {KEYWORD_ACTIONS.map((action) => (
                                    <button
                                        key={action.keyword}
                                        type="button"
                                        disabled={loading}
                                        title={action.prompt}
                                        onClick={() => void submitChat(action.prompt)}
                                        className="rounded-full border border-slate-800 bg-slate-900/50 px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                            </div>
                        ) : null}
                    </form>
                </section>
            ) : null}

            <button
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700/90 bg-slate-900/95 text-slate-400 shadow-md shadow-black/20 ring-1 ring-black/20 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                aria-label={panelOpen ? 'ปิดแชท AI' : 'เปิดแชท AI'}
                aria-expanded={panelOpen}
            >
                {panelOpen ? <X className="h-5 w-5" aria-hidden /> : <MessageCircle className="h-5 w-5" aria-hidden />}
            </button>
        </div>
    );
}

function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser ? (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-500">
                    <Bot className="h-3 w-3" aria-hidden />
                </div>
            ) : null}
            <div
                className={`max-w-[min(94%,20rem)] rounded-lg px-2.5 py-2 text-[13px] leading-snug ${
                    isUser
                        ? 'border border-slate-700/80 bg-slate-800/90 text-slate-100'
                        : 'border border-slate-800 bg-slate-900/80 text-slate-300'
                }`}
            >
                <p
                    className={`mb-1 text-[9px] font-medium uppercase tracking-wide ${
                        isUser ? 'text-slate-500' : 'text-slate-600'
                    }`}
                >
                    {isUser ? 'คุณ' : 'ผู้ช่วย'}
                </p>
                <p className="whitespace-pre-wrap break-words">{normalizeChatText(message.text)}</p>
            </div>
            {isUser ? (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-500">
                    <UserRound className="h-3 w-3" aria-hidden />
                </div>
            ) : null}
        </div>
    );
}
