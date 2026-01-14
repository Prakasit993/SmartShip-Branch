/**
 * n8n Webhook Integration
 * ใช้สำหรับส่งข้อมูล order ไปยัง n8n เพื่อ trigger automation
 * เช่น ส่ง email ใบเสร็จ, แจ้งเตือน LINE, etc.
 */

interface OrderEmailData {
    order_no: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    customer_address: string;
    total_amount: number;
    payment_method: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        line_total: number;
    }>;
    pay_link: string;
    created_at: string;
}

/**
 * Trigger n8n webhook สำหรับส่ง email ใบเสร็จ
 * @param orderData ข้อมูล order ที่ต้องการส่ง
 */
export async function triggerN8nOrderEmail(orderData: OrderEmailData): Promise<void> {
    const webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('[n8n] N8N_ORDER_WEBHOOK_URL not configured, skipping email trigger');
        return;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...orderData,
                triggered_at: new Date().toISOString(),
                source: 'smartship-order'
            })
        });

        if (!response.ok) {
            console.error('[n8n] Webhook failed:', response.status, await response.text());
        }
        // Success - no console.log in production
    } catch (error) {
        console.error('[n8n] Error triggering webhook:', error);
        // Don't throw - email failure shouldn't block order creation
    }
}

/**
 * Trigger n8n webhook เมื่อมีการอัปโหลดสลิป
 */
export async function triggerN8nSlipUploaded(orderData: {
    order_no: string;
    customer_name: string;
    slip_url: string;
    total_amount: number;
}): Promise<void> {
    const webhookUrl = process.env.N8N_SLIP_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('[n8n] N8N_SLIP_WEBHOOK_URL not configured');
        return;
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...orderData,
                triggered_at: new Date().toISOString(),
                source: 'smartship-slip'
            })
        });
    } catch (error) {
        console.error('[n8n] Error triggering slip webhook:', error);
    }
}
