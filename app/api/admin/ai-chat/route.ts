import { NextResponse } from 'next/server';
import { isAdminApiRequest } from '@/lib/adminApiAuth';

export async function POST(req: Request) {
    try {
        if (!(await isAdminApiRequest())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
            return NextResponse.json(
                {
                    error:
                        (parsed as { error?: string } | null)?.error ||
                        `n8n webhook failed: HTTP ${upstream.status}`,
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
