/**
 * Verify Turnstile token on the server side
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
        console.warn('Turnstile: TURNSTILE_SECRET_KEY not configured - skipping verification');
        return true; // Allow if not configured (development)
    }

    try {
        const formData = new FormData();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (ip) {
            formData.append('remoteip', ip);
        }

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Turnstile verification failed:', data['error-codes']);
        }

        return data.success === true;
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
}
