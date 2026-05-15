import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { MessageCircle } from 'lucide-react';
import AiChatLogsClient from './AiChatLogsClient';

export const dynamic = 'force-dynamic';

/**
 * Admin-only audit + analytics view for the Data Analyst AI chat.
 *
 * Backed by `admin_ai_chat_logs` (migration 20260515) — every turn from
 * /api/admin/ai-chat is logged here. Use this page to:
 *   - audit who asked what
 *   - spot questions the AI failed to answer (filter "errors only")
 *   - find coverage gaps that justify Phase 2 SQL tool or more endpoints
 *
 * Data fetching lives in the client component (filter UX needs state); this
 * server component just renders the chrome + permission-gates by being under
 * /admin (layout already enforces admin auth).
 */
export default function AiChatLogsPage() {
    return (
        <div className="min-w-0 space-y-5 pb-16">
            <AdminPageHeader
                title="บันทึก AI Chat"
                description="ดูคำถาม / คำตอบ / tool calls ของ Data Analyst AI — สำหรับวิเคราะห์การใช้งานและหา coverage gap"
                tone="dark"
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30">
                        <MessageCircle className="h-5 w-5" aria-hidden />
                    </span>
                }
            />
            <AiChatLogsClient />
        </div>
    );
}
