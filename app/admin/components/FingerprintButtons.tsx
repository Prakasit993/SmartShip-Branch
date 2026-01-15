'use client';

import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export function FingerprintRegisterButton() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleRegister = async () => {
        setStatus('loading');
        setMessage('');

        try {
            // Get registration options from server
            const optionsRes = await fetch('/api/auth/webauthn?action=register');
            if (!optionsRes.ok) {
                throw new Error('Failed to get registration options');
            }
            const options = await optionsRes.json();

            // Start registration with browser
            const credential = await startRegistration({ optionsJSON: options });

            // Verify with server
            const verifyRes = await fetch('/api/auth/webauthn?action=register', {
                method: 'POST',
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
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleLogin = async () => {
        setStatus('loading');
        setMessage('');

        try {
            // Get authentication options from server
            const optionsRes = await fetch('/api/auth/webauthn?action=authenticate');
            if (!optionsRes.ok) {
                const error = await optionsRes.json();
                throw new Error(error.error || 'Failed to get authentication options');
            }
            const options = await optionsRes.json();

            // Start authentication with browser
            const credential = await startAuthentication({ optionsJSON: options });

            // Verify with server
            const verifyRes = await fetch('/api/auth/webauthn?action=authenticate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            });

            if (verifyRes.ok) {
                setMessage('✅ Login สำเร็จ!');
                onSuccess?.();
                // Redirect to admin
                window.location.href = '/admin';
            } else {
                throw new Error('Authentication failed');
            }
        } catch (error: unknown) {
            setStatus('error');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setMessage(`❌ ${errorMessage}`);
        }
    };

    return (
        <div className="w-full">
            <button
                onClick={handleLogin}
                disabled={status === 'loading'}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {status === 'loading' ? (
                    <>🔄 กำลังยืนยัน...</>
                ) : (
                    <>🖐️ Login ด้วยลายนิ้วมือ</>
                )}
            </button>
            {message && (
                <p className={`mt-2 text-sm text-center ${message.includes('✅') ? 'text-green-500' : 'text-red-500'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}
