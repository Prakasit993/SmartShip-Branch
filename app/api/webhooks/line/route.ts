import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import crypto from 'crypto';

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) return false;

    const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(body)
        .digest('base64');

    return hash === signature;
}

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    // Verify signature (optional but recommended)
    if (process.env.LINE_CHANNEL_SECRET && !verifySignature(body, signature)) {
        console.error('Invalid LINE signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    try {
        const events = JSON.parse(body).events || [];

        for (const event of events) {
            if (event.type === 'postback') {
                const data = new URLSearchParams(event.postback.data);
                const action = data.get('action');
                const orderId = data.get('orderId');

                if (!orderId) continue;

                let newStatus = '';
                let replyText = '';

                switch (action) {
                    case 'confirm':
                        newStatus = 'confirmed';
                        replyText = '✅ ยืนยันคำสั่งซื้อแล้ว';
                        break;
                    case 'reject':
                        newStatus = 'cancelled';
                        replyText = '❌ ปฏิเสธคำสั่งซื้อแล้ว';
                        break;
                    case 'approve_slip':
                        newStatus = 'paid';
                        replyText = '✅ อนุมัติสลิปแล้ว';
                        break;
                    case 'reject_slip':
                        newStatus = 'payment_rejected';
                        replyText = '❌ ปฏิเสธสลิปแล้ว';
                        break;
                    default:
                        continue;
                }

                // Update order status
                const { error } = await supabaseAdmin
                    .from('orders')
                    .update({ status: newStatus })
                    .eq('id', orderId);

                if (error) {
                    console.error('Failed to update order:', error);
                    replyText = '❌ เกิดข้อผิดพลาด: ' + error.message;
                }

                // Reply to user
                const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
                if (token && event.replyToken) {
                    await fetch('https://api.line.me/v2/bot/message/reply', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            replyToken: event.replyToken,
                            messages: [{ type: 'text', text: replyText }]
                        })
                    });
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('LINE webhook error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
