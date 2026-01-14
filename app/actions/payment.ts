'use server';

import { notifyAdminPaymentSlip } from '@app/lib/line';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import generatePayload from 'promptpay-qr';

export async function onSlipUploaded(orderId: number) {
    const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (order) {
        await notifyAdminPaymentSlip(order);
    }
}

export async function generatePromptPayPayload(amount: number) {
    // In a real app, you would fetch this from Settings
    const phoneNumber = '0812345678';

    // Ensure amount is a number
    const safeAmount = Number(amount) || 0;

    if (safeAmount <= 0) return '';

    try {
        const payload = generatePayload(phoneNumber, { amount: safeAmount });
        return payload;
    } catch (error) {
        console.error('QR Gen Error:', error);
        return '';
    }
}
