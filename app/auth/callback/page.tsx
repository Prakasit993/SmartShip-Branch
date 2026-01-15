'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Suspense } from 'react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get('next') || '/';
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const [status, setStatus] = useState('กำลังดำเนินการ...');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Check for error from OAuth provider
                if (error) {
                    console.error('OAuth error:', error, errorDescription);
                    router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`);
                    return;
                }

                // Method 1: PKCE flow - exchange code for session
                if (code) {
                    setStatus('กำลังแลกรหัส...');
                    console.log('Exchanging code for session...');

                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (exchangeError) {
                        console.error('Code exchange error:', exchangeError);
                        // Don't redirect to error yet, try to get session
                    }

                    if (data?.session) {
                        console.log('Session established via PKCE!');
                        setStatus('สำเร็จ! กำลังเปลี่ยนหน้า...');
                        window.location.href = next;
                        return;
                    }
                }

                // Method 2: Check for hash fragment (Implicit flow)
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    setStatus('กำลังประมวลผล token...');
                    console.log('Found access_token in hash');

                    // Wait for Supabase to process the hash
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        console.log('Session established from hash!');
                        setStatus('สำเร็จ! กำลังเปลี่ยนหน้า...');
                        window.location.href = next;
                        return;
                    }
                }

                // Method 3: Check if session already exists
                setStatus('กำลังตรวจสอบ session...');
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log('Existing session found!');
                    setStatus('สำเร็จ! กำลังเปลี่ยนหน้า...');
                    window.location.href = next;
                    return;
                }

                // No session found - redirect to login
                console.log('No session found, redirecting to login');
                setStatus('ไม่พบ session, กำลังกลับหน้า login...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                window.location.href = '/login?error=โปรดลองเข้าสู่ระบบอีกครั้ง';

            } catch (err) {
                console.error('Auth callback error:', err);
                router.push(`/login?error=${encodeURIComponent(String(err))}`);
            }
        };

        handleCallback();
    }, [code, error, errorDescription, next, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-6"></div>
                <h1 className="text-xl font-bold text-white mb-2">กำลังเข้าสู่ระบบ</h1>
                <p className="text-zinc-400">{status}</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
