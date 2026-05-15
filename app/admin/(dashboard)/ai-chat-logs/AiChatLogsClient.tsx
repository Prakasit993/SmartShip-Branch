'use client';

/**
 * Client UI for /admin/ai-chat-logs.
 *
 * Fetches paginated logs from /api/admin/ai-chat-logs with filters and renders
 * a list with click-to-expand details. Lives separately from page.tsx because
 * the filter state + expand UX require client interactivity, but the server
 * page handles the chrome.
 */

import {
    AlertCircle,
    Bot,
    ChevronDown,
    ChevronRight,
    Loader2,
    RefreshCw,
    Search,
    User,
    Wrench,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ToolCall {
    name: string;
    args?: Record<string, unknown>;
    status?: string;
    duration_ms?: number;
    result_preview?: string;
}

interface LogRow {
    id: number;
    created_at: string;
    session_id: string;
    user_email: string | null;
    user_role: 'admin' | 'staff' | null;
    user_message: string;
    ai_response: string;
    tools_called: ToolCall[] | null;
    context: Record<string, unknown> | null;
    latency_ms: number | null;
    error: string | null;
}

const PAGE_SIZE = 50;

/** Asia/Bangkok formatter — match the rest of the admin UI. */
function formatThaiDateTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return iso;
    }
}

function truncate(s: string, n: number): string {
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trimEnd() + '…';
}

export default function AiChatLogsClient() {
    // ── Filter state ─────────────────────────────────────────────────────────
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [q, setQ] = useState('');
    const [errorsOnly, setErrorsOnly] = useState(false);

    // Debounced trigger — every filter change pushes a new request, but the
    // text input would otherwise refetch on every keystroke. Defer those.
    const [appliedFilters, setAppliedFilters] = useState({
        dateFrom: '',
        dateTo: '',
        q: '',
        errorsOnly: false,
    });

    useEffect(() => {
        // Date and errorsOnly apply instantly; q debounces.
        const handle = setTimeout(() => {
            setAppliedFilters({ dateFrom, dateTo, q, errorsOnly });
            setOffset(0); // reset paging on new filter
        }, 300);
        return () => clearTimeout(handle);
    }, [dateFrom, dateTo, q, errorsOnly]);

    // ── Data fetching state ──────────────────────────────────────────────────
    const [rows, setRows] = useState<LogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // ── Expanded row state ───────────────────────────────────────────────────
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggleExpand = useCallback((id: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (appliedFilters.dateFrom) params.set('date_from', appliedFilters.dateFrom);
        if (appliedFilters.dateTo) params.set('date_to', appliedFilters.dateTo);
        if (appliedFilters.q.trim()) params.set('q', appliedFilters.q.trim());
        if (appliedFilters.errorsOnly) params.set('errors_only', '1');
        params.set('offset', String(offset));
        params.set('limit', String(PAGE_SIZE));

        try {
            const res = await fetch(`/api/admin/ai-chat-logs?${params}`, {
                credentials: 'same-origin',
            });
            const json = (await res.json()) as
                | { rows: LogRow[]; total: number }
                | { error: string };
            if (!res.ok || 'error' in json) {
                throw new Error(('error' in json && json.error) || 'โหลดข้อมูลไม่สำเร็จ');
            }
            setRows(json.rows);
            setTotal(json.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, offset]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs, reloadKey]);

    const hasFilters = useMemo(
        () =>
            Boolean(
                appliedFilters.dateFrom ||
                    appliedFilters.dateTo ||
                    appliedFilters.q ||
                    appliedFilters.errorsOnly,
            ),
        [appliedFilters],
    );

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setQ('');
        setErrorsOnly(false);
    };

    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-4">
            {/* ── Filter bar ────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4 ring-1 ring-white/[0.02]">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-400">จากวันที่</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-400">ถึงวันที่</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <label className="text-xs font-medium text-slate-400">ค้นหาในคำถาม/คำตอบ</label>
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                aria-hidden
                            />
                            <input
                                type="text"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="พิมพ์คำค้น..."
                                className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2 pl-8 pr-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                            />
                        </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-300 hover:border-rose-500/40">
                        <input
                            type="checkbox"
                            checked={errorsOnly}
                            onChange={(e) => setErrorsOnly(e.target.checked)}
                            className="h-4 w-4 accent-rose-500"
                        />
                        เฉพาะที่ error
                    </label>
                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500/40 hover:text-indigo-200"
                        title="โหลดใหม่"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                        โหลดใหม่
                    </button>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-slate-400 transition hover:text-slate-200"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats summary ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between text-sm">
                <div className="text-slate-400">
                    พบ {total.toLocaleString('th-TH')} รายการ
                    {hasFilters && <span className="text-slate-500"> (มีตัวกรอง)</span>}
                </div>
                {totalPages > 1 && (
                    <div className="text-slate-400">
                        หน้า {page} / {totalPages}
                    </div>
                )}
            </div>

            {/* ── Error banner ──────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/25 px-3 py-2.5 text-sm text-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    {error}
                </div>
            )}

            {/* ── Log list ──────────────────────────────────────────────── */}
            {loading && rows.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-hidden />
                </div>
            ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                    <p className="text-sm text-slate-500">
                        {hasFilters ? 'ไม่พบบันทึกที่ตรงกับตัวกรอง' : 'ยังไม่มีบันทึกแชท'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map((row) => {
                        const isOpen = expanded.has(row.id);
                        return (
                            <LogRowCard
                                key={row.id}
                                row={row}
                                isOpen={isOpen}
                                onToggle={() => toggleExpand(row.id)}
                            />
                        );
                    })}
                </div>
            )}

            {/* ── Pagination ────────────────────────────────────────────── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        type="button"
                        disabled={offset === 0 || loading}
                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500/40 disabled:opacity-40"
                    >
                        ก่อนหน้า
                    </button>
                    <span className="text-sm text-slate-400">
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={offset + PAGE_SIZE >= total || loading}
                        onClick={() => setOffset(offset + PAGE_SIZE)}
                        className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500/40 disabled:opacity-40"
                    >
                        ถัดไป
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Row card ─────────────────────────────────────────────────────────────────

function LogRowCard({
    row,
    isOpen,
    onToggle,
}: {
    row: LogRow;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const userLabel = row.user_email
        ? row.user_role === 'admin'
            ? `${row.user_email} (admin)`
            : `${row.user_email} (staff)`
        : 'ไม่ระบุ';

    return (
        <div
            className={`rounded-xl border bg-slate-900/40 ring-1 transition ${
                row.error
                    ? 'border-rose-500/30 ring-rose-500/10'
                    : 'border-white/[0.06] ring-white/[0.02]'
            }`}
        >
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
            >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
                    {isOpen ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                    )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-mono text-slate-500">
                            {formatThaiDateTime(row.created_at)}
                        </span>
                        <span className="text-slate-400">{userLabel}</span>
                        {row.tools_called && row.tools_called.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-indigo-500/30">
                                <Wrench className="h-2.5 w-2.5" aria-hidden />
                                {row.tools_called.length} tool{row.tools_called.length > 1 ? 's' : ''}
                            </span>
                        )}
                        {row.latency_ms != null && (
                            <span className="text-slate-500">{row.latency_ms}ms</span>
                        )}
                        {row.error && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/30">
                                <AlertCircle className="h-2.5 w-2.5" aria-hidden />
                                error
                            </span>
                        )}
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-200">
                        <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        <span className="min-w-0 break-words">
                            {truncate(row.user_message, 160)}
                        </span>
                    </div>
                    {!isOpen && (
                        <div className="flex items-start gap-2 text-sm text-slate-400">
                            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                            <span className="min-w-0 break-words">
                                {truncate(row.ai_response, 200)}
                            </span>
                        </div>
                    )}
                </div>
            </button>

            {isOpen && (
                <div className="space-y-3 border-t border-white/[0.04] px-4 py-3">
                    <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            User message
                        </div>
                        <div className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                            {row.user_message}
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            AI response
                        </div>
                        <div className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                            {row.ai_response || <em className="text-slate-500">(empty)</em>}
                        </div>
                    </div>
                    {row.tools_called && row.tools_called.length > 0 && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Tools called
                            </div>
                            <div className="space-y-1">
                                {row.tools_called.map((t, i) => (
                                    <div
                                        key={i}
                                        className="rounded-lg bg-slate-950/50 px-3 py-2 font-mono text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-indigo-300">{t.name}</span>
                                            {t.status && (
                                                <span
                                                    className={`text-[10px] ${
                                                        t.status === 'success'
                                                            ? 'text-emerald-400'
                                                            : 'text-rose-400'
                                                    }`}
                                                >
                                                    [{t.status}]
                                                </span>
                                            )}
                                            {t.duration_ms != null && (
                                                <span className="text-slate-500">{t.duration_ms}ms</span>
                                            )}
                                        </div>
                                        {t.args && Object.keys(t.args).length > 0 && (
                                            <div className="mt-1 text-slate-400">
                                                {JSON.stringify(t.args)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {row.context && Object.keys(row.context).length > 0 && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Context
                            </div>
                            <div className="rounded-lg bg-slate-950/50 px-3 py-2 font-mono text-xs text-slate-400">
                                {JSON.stringify(row.context)}
                            </div>
                        </div>
                    )}
                    {row.error && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                                Error
                            </div>
                            <div className="whitespace-pre-wrap rounded-lg bg-rose-950/30 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/20">
                                {row.error}
                            </div>
                        </div>
                    )}
                    <div className="text-[10px] text-slate-500">
                        session_id: <span className="font-mono">{row.session_id}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
