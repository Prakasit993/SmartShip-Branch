import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const webhookUrl = process.env.N8N_AI_WEBHOOK_URL;
        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'Missing N8N_AI_WEBHOOK_URL environment variable' },
                { status: 500 },
            );
        }

        const body = (await req.json()) as {
            message?: string;
            context?: Record<string, unknown>;
        };
        const message = String(body.message ?? '').trim();
        if (!message) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }

        const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                source: 'admin-jt-dashboard',
                message,
                context: body.context ?? {},
            }),
        });

        const raw = await upstream.text();
        let parsed: unknown = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }

        if (!upstream.ok) {
            const fallback = `n8n webhook failed: HTTP ${upstream.status}`;
            const hint404 =
                upstream.status === 404
                    ? ' ตรวจสอบ N8N_AI_WEBHOOK_URL ให้ตรงกับ Production URL ใน Webhook node (คัดลอกจาก n8n) และให้ workflow เปิดใช้งาน (Active) แล้ว'
                    : '';
            return NextResponse.json(
                {
                    error:
                        (parsed as { error?: string } | null)?.error ||
                        fallback + hint404,
                },
                { status: 502 },
            );
        }

        const answer =
            (parsed as { answer?: string; reply?: string; message?: string } | null)?.answer ||
            (parsed as { answer?: string; reply?: string; message?: string } | null)?.reply ||
            (parsed as { answer?: string; reply?: string; message?: string } | null)?.message ||
            raw ||
            'ได้รับคำตอบแล้ว แต่ไม่มีข้อความแสดงผล';

        return NextResponse.json({ answer });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Internal server error' },
            { status: 500 },
        );
    }
}
