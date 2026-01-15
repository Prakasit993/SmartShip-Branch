import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { autoVerifySlip } from '@app/lib/slipok';
import { notifyAdmin } from '@app/lib/line';

// Webhook endpoint for n8n to call back with verification results
// or for n8n to trigger actions

export async function POST(request: Request) {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, orderId, slipUrl, expectedAmount } = body;

        switch (action) {
            case 'verify_slip': {
                // Auto verify slip using SlipOK
                if (!orderId || !slipUrl) {
                    return NextResponse.json({ error: 'Missing orderId or slipUrl' }, { status: 400 });
                }

                const result = await autoVerifySlip(orderId, slipUrl, expectedAmount || 0);

                if (result.verified) {
                    // Update order status to paid
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            status: 'paid',
                            slip_verified_at: new Date().toISOString(),
                            slip_verified_data: result.slipData
                        })
                        .eq('id', orderId);

                    await notifyAdmin(`✅ สลิปยืนยันอัตโนมัติ: Order ${orderId}\nยอด: ฿${result.slipData?.amount}`);
                } else {
                    await notifyAdmin(`⚠️ ต้องตรวจสอบสลิปด้วยตนเอง: Order ${orderId}\n${result.reason}`);
                }

                return NextResponse.json(result);
            }

            case 'update_status': {
                // Update order status from n8n
                const { status } = body;
                if (!orderId || !status) {
                    return NextResponse.json({ error: 'Missing orderId or status' }, { status: 400 });
                }

                const { error } = await supabaseAdmin
                    .from('orders')
                    .update({ status })
                    .eq('id', orderId);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                return NextResponse.json({ success: true });
            }

            case 'get_order': {
                // Get order details for n8n
                if (!orderId) {
                    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
                }

                const { data, error } = await supabaseAdmin
                    .from('orders')
                    .select('*')
                    .eq('id', orderId)
                    .single();

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                return NextResponse.json(data);
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('n8n webhook error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'n8n-webhook',
        timestamp: new Date().toISOString()
    });
}
