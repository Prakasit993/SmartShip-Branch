// SlipOK API Integration for automatic slip verification
// API Docs: https://slipok.com/docs

export interface SlipVerifyResult {
    success: boolean;
    data?: {
        amount: number;
        transactionDate: string;
        transactionTime: string;
        sendingBank: string;
        receivingBank: string;
        senderName: string;
        receiverName: string;
        ref: string;
    };
    error?: string;
}

export async function verifySlipWithSlipOK(slipImageUrl: string): Promise<SlipVerifyResult> {
    const branchId = process.env.SLIPOK_BRANCH_ID;
    const apiKey = process.env.SLIPOK_API_KEY;

    if (!branchId || !apiKey) {
        console.warn('SLIPOK_BRANCH_ID or SLIPOK_API_KEY not set.');
        return { success: false, error: 'SlipOK not configured' };
    }

    try {
        // Download the image first if it's a URL
        const imageResponse = await fetch(slipImageUrl);
        if (!imageResponse.ok) {
            return { success: false, error: 'Failed to fetch slip image' };
        }

        const imageBlob = await imageResponse.blob();
        const formData = new FormData();
        formData.append('files', imageBlob, 'slip.jpg');

        // Call SlipOK API
        const response = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
            method: 'POST',
            headers: {
                'x-authorization': apiKey,
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SlipOK API error:', errorText);
            return { success: false, error: 'SlipOK API error' };
        }

        const result = await response.json();

        if (result.success) {
            return {
                success: true,
                data: {
                    amount: parseFloat(result.data?.amount) || 0,
                    transactionDate: result.data?.transDate || '',
                    transactionTime: result.data?.transTime || '',
                    sendingBank: result.data?.sendingBank || '',
                    receivingBank: result.data?.receivingBank || '',
                    senderName: result.data?.sender?.displayName || '',
                    receiverName: result.data?.receiver?.displayName || '',
                    ref: result.data?.transRef || '',
                }
            };
        } else {
            return { success: false, error: result.message || 'Verification failed' };
        }
    } catch (error) {
        console.error('SlipOK verification error:', error);
        return { success: false, error: String(error) };
    }
}

// Auto verify slip and update order
export async function autoVerifySlip(orderId: string, slipUrl: string, expectedAmount: number) {
    const result = await verifySlipWithSlipOK(slipUrl);

    if (!result.success) {
        return {
            verified: false,
            reason: result.error,
        };
    }

    const { data } = result;
    if (!data) {
        return {
            verified: false,
            reason: 'No data returned from SlipOK',
        };
    }

    // Check if amount matches (with tolerance of 1 baht for rounding)
    const amountMatch = Math.abs(data.amount - expectedAmount) <= 1;

    return {
        verified: amountMatch,
        reason: amountMatch ? 'Amount verified successfully' : `Amount mismatch: expected ฿${expectedAmount}, got ฿${data.amount}`,
        slipData: data,
    };
}
