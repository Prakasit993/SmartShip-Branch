// Helper to broadcast to Admin + Staff
async function getRecipients() {
    const adminId = process.env.LINE_ADMIN_USER_ID;
    const staffIds = (process.env.LINE_STAFF_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

    // Combine unique IDs
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

    // LINE Multicast API allows up to 500 users, but for safety in MVP we loop push or use multicast
    // "multicast" is efficient for same message
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

export async function notifyAdminNewOrder(order: any) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    // ... (Existing Bubble JSON) ...
    // Note: Reusing the existing Logic but with multicast
    const message = {
        type: 'flex',
        altText: `New Order: ${order.order_no}`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "New Order Received!",
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
                                    { "type": "text", "text": "Order No", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": order.order_no, "weight": "bold", "size": "sm", "flex": 2 }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    { "type": "text", "text": "Customer", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": order.customer_name, "size": "sm", "flex": 2 }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    { "type": "text", "text": "Total", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                    { "type": "text", "text": `฿${order.total_amount}`, "weight": "bold", "size": "sm", "flex": 2 }
                                ]
                            }
                        ]
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "Review Order",
                            "uri": `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/orders/${order.id}`
                        },
                        "style": "primary"
                    }
                ]
            }
        }
    };

    await sendLineMessage(recipients, [message]);
}

export async function notifyAdminPaymentSlip(order: any) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    const message = {
        type: 'flex',
        altText: `Slip Uploaded: ${order.friendly_id || order.order_no}`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "Payment Slip Uploaded",
                        "weight": "bold",
                        "size": "lg",
                        "color": "#FF9900"
                    },
                    {
                        "type": "text",
                        "text": `Order: ${order.friendly_id || order.order_no}`,
                        "size": "sm",
                        "margin": "md"
                    },
                    {
                        "type": "text",
                        "text": `Amount: ฿${order.total_amount}`,
                        "size": "sm"
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "Verify Slip",
                            "uri": `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/orders/${order.id}`
                        },
                        "style": "primary"
                    }
                ]
            }
        }
    };

    await sendLineMessage(recipients, [message]);
}

export async function notifyAdmin(text: string) {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;
    const message = { type: 'text', text: text };
    await sendLineMessage(recipients, [message]);
}
