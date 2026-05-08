import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type AiFinancialReportRow = {
    id: number | string;
    report_date: string | null;
    report_type: string | null;
    health_status: string | null;
    title: string | null;
    summary: string | null;
    key_metrics: unknown;
    highlights: unknown;
    risks: unknown;
    recommended_actions: unknown;
    data_quality_notes: unknown;
    source_payload: unknown;
    ai_model: string | null;
    created_at: string | null;
};

function asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const items = (value as { items?: unknown }).items;
        return Array.isArray(items) ? items : [];
    }
    return [];
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { data, error } = await supabaseAdmin
            .from('ai_financial_reports')
            .select(
                'id, report_date, report_type, health_status, title, summary, key_metrics, highlights, risks, recommended_actions, data_quality_notes, source_payload, ai_model, created_at',
            )
            .order('report_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[ai-financial-reports/latest]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ report: null });
        }

        const row = data as AiFinancialReportRow;
        return NextResponse.json({
            report: {
                id: row.id,
                reportDate: row.report_date,
                reportType: row.report_type,
                healthStatus: row.health_status || 'warning',
                title: row.title || 'รายงาน AI ล่าสุด',
                summary: row.summary || '',
                keyMetrics: asObject(row.key_metrics),
                highlights: asArray(row.highlights),
                risks: asArray(row.risks),
                recommendedActions: asArray(row.recommended_actions),
                dataQualityNotes: asArray(row.data_quality_notes),
                sourcePayload: asObject(row.source_payload),
                aiModel: row.ai_model,
                createdAt: row.created_at,
            },
        });
    } catch (e) {
        console.error('[ai-financial-reports/latest]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
