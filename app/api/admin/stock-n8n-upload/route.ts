import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

/**
 * โพรซี multipart ไปยัง n8n Webhook สำหรับนำเข้าข้อมูลคลังสินค้า
 * ใช้ STOCK_N8N_UPLOAD_WEBHOOK_URL เป็น URL ปลายทาง
 * Query: ?filename=... (ชื่อไฟล์สำหรับ n8n)
 * Body: multipart/form-data ฟิลด์ `file`
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const webhookBase = process.env.STOCK_N8N_UPLOAD_WEBHOOK_URL?.trim();
    if (!webhookBase) {
        return NextResponse.json(
            { error: 'ยังไม่ได้ตั้งค่า STOCK_N8N_UPLOAD_WEBHOOK_URL บนเซิร์ฟเวอร์' },
            { status: 500 }
        );
    }

    let filename = request.nextUrl.searchParams.get('filename')?.trim();
    const formDataIn = await request.formData();
    const file = formDataIn.get('file');

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'ไม่พบไฟล์ในแบบฟอร์ม (ต้องใช้ฟิลด์ชื่อ file)' }, { status: 400 });
    }

    if (!filename) filename = file.name || 'upload.bin';

    if (file.size === 0) {
        return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(webhookBase);
    } catch {
        return NextResponse.json({ error: 'STOCK_N8N_UPLOAD_WEBHOOK_URL ไม่ถูกต้อง' }, { status: 500 });
    }

    target.searchParams.set('filename', filename);

    const outbound = new FormData();
    outbound.append('file', file, file.name);

    try {
        const upstream = await fetch(target.toString(), {
            method: 'POST',
            body: outbound,
            signal: AbortSignal.timeout(290_000),
        });

        const bodyText = await upstream.text();
        const contentType = upstream.headers.get('Content-Type') || 'application/json';

        return new NextResponse(bodyText, {
            status: upstream.status,
            headers: {
                'Content-Type': contentType.startsWith('text/') ? 'text/plain; charset=utf-8' : contentType,
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Upstream error';
        console.error('[stock-n8n-upload]', msg);
        return NextResponse.json({ error: `ส่งไป n8n ไม่สำเร็จ: ${msg}` }, { status: 502 });
    }
}
