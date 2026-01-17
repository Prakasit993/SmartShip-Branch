// LINE Messaging API Helper Functions
// Includes: Order notifications, Payment notifications, Quick Reply, n8n webhook

// Helper to get payment method display
function getPaymentMethodDisplay(paymentMethod: string): { emoji: string; label: string; color: string } {
    switch (paymentMethod?.toLowerCase()) {
        case 'cash':
            return { emoji: '💵', label: 'เงินสด', color: '#4CAF50' };
        case 'transfer':
        case 'bank_transfer':
            return { emoji: '🏦', label: 'โอนเงิน', color: '#2196F3' };
        case 'qr':
        case 'qr_code':
        case 'promptpay':
            return { emoji: '📱', label: 'QR Code', color: '#9C27B0' };
        default:
            return { emoji: '💳', label: paymentMethod || 'ไม่ระบุ', color: '#757575' };
    }
}

// Helper to broadcast to Admin + Staff
async function getRecipients() {
    const adminId = process.env.LINE_ADMIN_USER_ID;
    const staffIds = (process.env.LINE_STAFF_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

    const recipients = new Set<string>();
    if (adminId) recipients.add(adminId);
    staffIds.forEach(id => recipients.add(id));

    return Array.from(recipients);
}

export async function sendLineMessage(to: string | string[], messages: any[]) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
        console.warn('LINE_CHANNEL_ACCESS_TOKEN not set.');
        return;
    }

    const targets = Array.isArray(to) ? to : [to];

    if (targets.length > 0) {
        try {
            const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: targets,
                    messages: messages
                })
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('Failed to send LINE multicast:', text);
            }
        } catch (error) {
            console.error('Error sending LINE message:', error);
        }
    }
}

// Send data to n8n webhook
export async function sendToN8n(eventType: string, data: any) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('N8N_WEBHOOK_URL not set.');
        return;
    }

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || '',
            },
            body: JSON.stringify({
                event: eventType,
                timestamp: new Date().toISOString(),
                data: data
            })
        });

        if (!res.ok) {
            console.error('Failed to send to n8n:', await res.text());
        }
        return res.ok;
    } catch (error) {
        console.error('Error sending to n8n:', error);
        return false;
    }
}

export async function notifyAdminNewOrder(order: any) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    const payment = getPaymentMethodDisplay(order.payment_method);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const message = {
        type: 'flex',
        altText: `📦 คำสั่งซื้อใหม่: ${order.order_no}`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "📦 คำสั่งซื้อใหม่!",
                        "weight": "bold",
                        "size": "xl",
                        "color": "#1DB446"
                    },
                    {
                        "type": "separator",
                        "margin": "md"
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "md",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    { "type": "text", "text": "เลขที่", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": order.order_no || order.friendly_id || '-', "weight": "bold", "size": "sm", "flex": 2 }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "margin": "sm",
                                "contents": [
                                    { "type": "text", "text": "ลูกค้า", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": order.customer_name || '-', "size": "sm", "flex": 2 }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "margin": "sm",
                                "contents": [
                                    { "type": "text", "text": "📞 เบอร์", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": order.customer_phone || '-', "size": "sm", "flex": 2, "color": "#1DB446" }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "margin": "sm",
                                "contents": [
                                    { "type": "text", "text": "ยอดรวม", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": `฿${order.total_amount?.toLocaleString() || order.total_amount}`, "weight": "bold", "size": "sm", "flex": 2, "color": "#1DB446" }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "margin": "sm",
                                "contents": [
                                    { "type": "text", "text": "ชำระ", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": `${payment.emoji} ${payment.label}`, "size": "sm", "flex": 2, "color": payment.color }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "separator",
                        "margin": "md"
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "md",
                        "contents": [
                            {
                                "type": "text",
                                "text": "🛒 รายการสินค้า:",
                                "size": "sm",
                                "weight": "bold",
                                "color": "#555555"
                            },
                            ...(order.order_items?.slice(0, 5)?.map((item: any) => ({
                                "type": "box",
                                "layout": "baseline",
                                "margin": "sm",
                                "contents": [
                                    { "type": "text", "text": `• ${item.bundle_name || item.product_name || 'สินค้า'}`, "size": "xs", "flex": 3, "wrap": true },
                                    { "type": "text", "text": `x${item.quantity}`, "size": "xs", "flex": 1, "align": "end" }
                                ]
                            })) || [{ "type": "text", "text": "(ไม่มีรายการ)", "size": "xs", "color": "#aaaaaa" }]),
                            ...(order.order_items?.length > 5 ? [{
                                "type": "text",
                                "text": `...และอีก ${order.order_items.length - 5} รายการ`,
                                "size": "xs",
                                "color": "#888888",
                                "margin": "sm"
                            }] : [])
                        ]
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "📋 ดูรายละเอียด",
                            "uri": `${appUrl}/admin/orders/${order.id}`
                        },
                        "style": "primary"
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "button",
                                "action": {
                                    "type": "postback",
                                    "label": "✅ ยืนยัน",
                                    "data": `action=confirm&orderId=${order.id}`
                                },
                                "style": "secondary",
                                "flex": 1
                            },
                            {
                                "type": "button",
                                "action": {
                                    "type": "postback",
                                    "label": "❌ ปฏิเสธ",
                                    "data": `action=reject&orderId=${order.id}`
                                },
                                "style": "secondary",
                                "flex": 1
                            }
                        ]
                    }
                ]
            }
        }
    };

    await sendLineMessage(recipients, [message]);

    // Send to n8n webhook
    await sendToN8n('new_order', {
        orderId: order.id,
        orderNo: order.order_no,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method,
        status: order.status,
    });
}

export async function notifyAdminPaymentSlip(order: any, slipUrl?: string) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const message = {
        type: 'flex',
        altText: `🧾 สลิปใหม่: ${order.friendly_id || order.order_no}`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🧾 มีสลิปใหม่!",
                        "weight": "bold",
                        "size": "lg",
                        "color": "#FF9900"
                    },
                    {
                        "type": "text",
                        "text": `เลขที่: ${order.friendly_id || order.order_no}`,
                        "size": "sm",
                        "margin": "md"
                    },
                    {
                        "type": "text",
                        "text": `ยอด: ฿${order.total_amount}`,
                        "size": "sm",
                        "weight": "bold"
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "🔍 ตรวจสอบสลิป",
                            "uri": `${appUrl}/admin/orders/${order.id}`
                        },
                        "style": "primary"
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "button",
                                "action": {
                                    "type": "postback",
                                    "label": "✅ อนุมัติ",
                                    "data": `action=approve_slip&orderId=${order.id}`
                                },
                                "style": "secondary",
                                "flex": 1
                            },
                            {
                                "type": "button",
                                "action": {
                                    "type": "postback",
                                    "label": "❌ ปฏิเสธ",
                                    "data": `action=reject_slip&orderId=${order.id}`
                                },
                                "style": "secondary",
                                "flex": 1
                            }
                        ]
                    }
                ]
            }
        }
    };

    await sendLineMessage(recipients, [message]);

    // Send to n8n webhook for auto verification
    await sendToN8n('slip_uploaded', {
        orderId: order.id,
        orderNo: order.order_no || order.friendly_id,
        totalAmount: order.total_amount,
        slipUrl: slipUrl || order.payment_slip_url,
    });
}

export async function notifyAdmin(text: string) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;
    const message = { type: 'text', text: text };
    await sendLineMessage(recipients, [message]);
}
