'use server';

import { notifyAdmin } from '@app/lib/line';

export async function submitQuoteRequest(formData: FormData) {
    const companyName = formData.get('companyName') as string;
    const contactName = formData.get('contactName') as string;
    const phone = formData.get('phone') as string;
    const details = formData.get('details') as string;

    if (!contactName || !phone || !details) {
        return { success: false, error: 'Please fill in all required fields.' };
    }

    const message = `
📦 **New Packing Quote Request**

👤 **Contact**: ${contactName}
🏢 **Company**: ${companyName || '-'}
📞 **Phone**: ${phone}

📝 **Details**:
${details}
`;

    try {
        await notifyAdmin(message.trim());
        return { success: true };
    } catch (error) {
        console.error('Failed to send LINE notification:', error);
        // Return true anyway so the user sees success, but log the error
        return { success: true };
    }
}
