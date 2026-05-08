'use client';

import { Bot, ChevronDown, Loader2, Send, Sparkles, UserRound } from 'lucide-react';
import { useState } from 'react';

type ChatMessage = {
    role: 'user' | 'assistant';
    text: string;
};

const SUGGESTIONS = [
    'สรุปเคส COD ที่ควรติดตามวันนี้',
    'กำไรค่าขนส่งเดือนนี้ควรดูตัวเลขอะไรบ้าง',
    'ช่วยหาแนวทางลดเคสส่งสำเร็จแต่เงินยังไม่เข้า',
];

const QUICK_ACTIONS = [
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

export function DeepDiveAiAssistant() {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    async function submitChat(messageText?: string) {
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
                        page: 'deep-dive-dashboard',
                        focus: 'financial-and-sla-analysis',
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
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950/95 via-slate-950/80 to-slate-900/75 shadow-xl shadow-black/20 ring-1 ring-white/[0.04]">
            <div className={`${open ? 'border-b border-slate-800/80' : ''} p-3 sm:p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                            <Bot className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-white">
                                    ผู้ช่วยวิเคราะห์ข้อมูล
                                </h2>
                                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                                    AI Agent
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
                                ถามสรุปกำไร COD เคสผิดปกติ หรือแนวโน้มการจัดส่งจากหน้าวิเคราะห์เชิงลึก
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpen((value) => !value)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 text-sm font-semibold text-sky-200 transition-colors hover:border-sky-400/50 hover:bg-sky-500/15"
                    >
                        {open ? 'ปิดแชท' : 'เปิดแชท'}
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                            aria-hidden
                        />
                    </button>
                </div>

                {open ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {SUGGESTIONS.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                disabled={loading}
                                onClick={() => void submitChat(suggestion)}
                                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {open ? (
                <>
                    <div className="p-3 sm:p-4">
                        <div className="min-h-[14rem] rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="scrollbar-hide flex max-h-[18rem] min-h-[12rem] flex-col-reverse gap-3 overflow-y-auto overscroll-contain pr-1">
                                {loading ? (
                                    <div className="mr-8 flex items-center gap-2 rounded-2xl border border-slate-700/90 bg-slate-900/95 px-3 py-2 text-sm text-slate-300">
                                        <Loader2 className="h-4 w-4 animate-spin text-sky-300" aria-hidden />
                                        กำลังวิเคราะห์ข้อมูล...
                                    </div>
                                ) : null}
                                {messages.length === 0 ? (
                                    <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/25 px-4 text-center">
                                        <p className="max-w-md text-sm leading-relaxed text-slate-500">
                                            เริ่มจากคำถามด้านบน หรือพิมพ์คำถามเอง เช่น “วันนี้มีเคสไหนที่ควรรีบตามเงิน COD?”
                                        </p>
                                    </div>
                                ) : (
                                    [...messages].reverse().map((message, index) => (
                                        <ChatBubble
                                            key={`${message.role}-${index}`}
                                            message={message}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <form
                        className="border-t border-slate-800/80 p-3 sm:p-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submitChat();
                        }}
                    >
                <label htmlFor="deep-dive-ai-input" className="sr-only">
                    พิมพ์คำถามสำหรับผู้ช่วยวิเคราะห์ข้อมูล
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <textarea
                        id="deep-dive-ai-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void submitChat();
                            }
                        }}
                        rows={2}
                        placeholder="พิมพ์คำถาม เช่น สรุปกำไรเดือนนี้ หรือ เคส COD ไหนควรติดตามก่อน..."
                        className="min-h-14 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm leading-relaxed text-white outline-none ring-sky-500/25 placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                            <Send className="h-4 w-4" aria-hidden />
                        )}
                        {loading ? 'กำลังส่ง' : 'ส่งคำถาม'}
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">
                    กด Enter เพื่อส่ง หรือ Shift + Enter เพื่อขึ้นบรรทัดใหม่
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600">คีย์เวิร์ด:</span>
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.keyword}
                            type="button"
                            disabled={loading}
                            onClick={() => void submitChat(action.prompt)}
                            className="rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="กดเพื่อส่งคำถามอัตโนมัติ"
                        >
                            {action.keyword}
                        </button>
                    ))}
                </div>
                {error ? (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                        <p className="text-sm leading-relaxed text-rose-200">{error}</p>
                        {error.includes('N8N_AI_WEBHOOK_URL') ? (
                            <p className="mt-1 text-[11px] text-rose-200/90">
                                กรุณาตั้งค่า `N8N_AI_WEBHOOK_URL` ใน `.env.local` แล้วรีสตาร์ทเซิร์ฟเวอร์
                            </p>
                        ) : null}
                    </div>
                ) : null}
                    </form>
                </>
            ) : null}
        </section>
    );
}

function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser ? (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sky-300">
                    <Bot className="h-3.5 w-3.5" aria-hidden />
                </div>
            ) : null}
            <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isUser
                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/20'
                        : 'border border-slate-700/90 bg-slate-900/95 text-slate-100'
                }`}
            >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {isUser ? 'คุณ' : 'ผู้ช่วยวิเคราะห์'}
                </p>
                <p className="whitespace-pre-wrap break-words">{normalizeChatText(message.text)}</p>
            </div>
            {isUser ? (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-200">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                </div>
            ) : null}
        </div>
    );
}
