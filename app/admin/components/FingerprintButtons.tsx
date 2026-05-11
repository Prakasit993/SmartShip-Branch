'use client';

import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useToast } from '@app/components/ui/Toast';

export function FingerprintRegisterButton() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleRegister = async () => {
        setStatus('loading');
        setMessage('');

        try {
            // Get registration options from server
            const optionsRes = await fetch('/api/auth/webauthn?action=register', { credentials: 'same-origin' });
            if (!optionsRes.ok) {
                throw new Error('Failed to get registration options');
            }
            const options = await optionsRes.json();

            // Start registration with browser
            const credential = await startRegistration({ optionsJSON: options });

            // Verify with server
            const verifyRes = await fetch('/api/auth/webauthn?action=register', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            });

            if (verifyRes.ok) {
                setStatus('success');
                setMessage('✅ ลงทะเบียนลายนิ้วมือสำเร็จ!');
            } else {
                throw new Error('Verification failed');
            }
        } catch (error: unknown) {
            setStatus('error');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setMessage(`❌ ${errorMessage}`);
        }
    };

    return (
        <div>
            <button
                onClick={handleRegister}
                disabled={status === 'loading'}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
                {status === 'loading' ? '🔄 กำลังลงทะเบียน...' : '🖐️ ลงทะเบียนลายนิ้วมือ'}
            </button>
            {message && (
                <p className={`mt-2 text-sm ${status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}

export function FingerprintLoginButton({ onSuccess }: { onSuccess?: () => void }) {
    const { showToast } = useToast();
    const [status, setStatus] = useState<'idle' | 'loading'>('idle');

    const handleLogin = async () => {
        setStatus('loading');

        try {
            const optionsRes = await fetch('/api/auth/webauthn?action=authenticate', { credentials: 'same-origin' });
            if (!optionsRes.ok) {
                let message = 'เริ่ม Passkey ไม่ได้';
                try {
                    const errBody = (await optionsRes.json()) as { error?: string };
                    if (errBody.error === 'No fingerprint registered') {
                        message = 'ยังไม่มี Passkey';
                    } else if (errBody.error) {
                        message = errBody.error;
                    }
                } catch {
                    /* use default */
                }
                throw new Error(message);
            }
            const options = await optionsRes.json();

            const credential = await startAuthentication({ optionsJSON: options });

            const verifyRes = await fetch('/api/auth/webauthn?action=authenticate', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            });

            if (verifyRes.ok) {
                showToast('เข้าระบบสำเร็จ', 'success');
                onSuccess?.();
                window.location.replace('/admin');
            } else {
                let failMsg = 'ยืนยันไม่สำเร็จ';
                try {
                    const errBody = (await verifyRes.json()) as { error?: string };
                    if (errBody.error === 'Challenge expired') failMsg = 'หมดเวลายืนยัน กรุณากดอีกครั้ง';
                    else if (errBody.error === 'Credential not found') failMsg = 'ไม่พบ Passkey — ลงทะเบียนใหม่บน URL นี้';
                    else if (errBody.error === 'Authentication failed')
                        failMsg = 'ยืนยันไม่สำเร็จ — ใช้ URL เดียวกับตอนลงทะเบียน หรือลงทะเบียน Passkey ใหม่';
                    else if (errBody.error) failMsg = errBody.error;
                } catch {
                    /* keep default */
                }
                throw new Error(failMsg);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showToast(errorMessage, 'error');
        } finally {
            setStatus('idle');
        }
    };

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={handleLogin}
                disabled={status === 'loading'}
                aria-label="เข้าด้วย Passkey"
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {status === 'loading' ? <>กำลังยืนยัน…</> : <>เข้าด้วย Passkey</>}
            </button>
        </div>
    );
}
