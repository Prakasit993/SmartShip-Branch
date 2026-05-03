'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@app/components/ui/Toast';
import type { TurnstileRef } from '@app/components/ui/Turnstile';
import { FingerprintLoginButton } from '@app/admin/components/FingerprintButtons';

/** โหลด Turnstile แบบ lazy — ลด JS ช่วง first paint, ยังบังคับยืนยันฝั่งเซิร์ฟเวอร์เหมือนเดิม */
const Turnstile = dynamic(() => import('@app/components/ui/Turnstile'), {
    ssr: false,
    loading: () => (
        <div
            className="my-4 flex min-h-[65px] items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 text-center text-xs text-zinc-500"
            role="status"
            aria-live="polite"
        >
            กำลังโหลดการยืนยันความปลอดภัย…
        </div>
    ),
});

function mapLoginErrorToThai(message: string | undefined): string {
    if (!message) return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
    const pairs: [RegExp | string, string][] = [
        [/Too many login attempts/i, 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอแล้วลองใหม่'],
        [/Security verification failed/i, 'การยืนยันความปลอดภัยล้มเหลว กรุณารีเฟรชแล้วลองอีกครั้ง'],
        ['Security verification failed. Please try again.', 'การยืนยันความปลอดภัยล้มเหลว กรุณารีเฟรชแล้วลองอีกครั้ง'],
        ['Invalid username or password', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'],
        ['Server configuration error', 'ตั้งค่าเซิร์ฟเวอร์ไม่ครบ ติดต่อผู้ดูแลระบบ'],
        ['Internal server error', 'เซิร์ฟเวอร์ผิดพลาดชั่วคราว กรุณาลองใหม่ภายหลัง'],
    ];
    for (const [match, thai] of pairs) {
        if (typeof match === 'string') {
            if (message.includes(match)) return thai;
        } else if (match.test(message)) {
            return thai;
        }
    }
    return message;
}

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileRef>(null);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => {
        router.prefetch('/admin');
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!turnstileToken) {
            showToast('กรุณายืนยันช่องความปลอดภัยให้ครบก่อน', 'warning');
            setLoading(false);
            return;
        }

        if (!username.trim() || !password.trim()) {
            showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, turnstileToken }),
            });

            if (res.ok) {
                showToast('เข้าสู่ระบบสำเร็จ กำลังเข้าแดชบอร์ด…', 'success');
                router.push('/admin');
                router.refresh();
                return;
            }

            let serverMessage: string | undefined;
            try {
                const data = (await res.json()) as { error?: string };
                serverMessage = data.error;
            } catch {
                serverMessage = undefined;
            }
            showToast(mapLoginErrorToThai(serverMessage), 'error');
        } catch {
            showToast('เครือข่ายผิดพลาดหรือเซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองอีกครั้ง', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-900">
            {/* พื้นหลังเบา — ลดงาน GPU เทียบกับ pulse หลายชั้น */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute left-[-10%] top-[-20%] h-[500px] w-[500px] rounded-full bg-blue-600/25 blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] h-[420px] w-[420px] rounded-full bg-purple-600/20 blur-[90px]" />
                <div className="pointer-events-none absolute inset-0 bg-[size:32px] bg-grid-white/[0.02]" />
            </div>

            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:shadow-blue-900/20">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/30">
                        <span className="text-3xl">📦</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Login</h1>
                    <p className="mt-2 text-sm text-zinc-400">เข้าจัดการร้านด้วยชื่อผู้ใช้และรหัสผ่าน</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1">
                        <label className="block pl-1 text-xs font-medium text-zinc-400">
                            ชื่อผู้ใช้
                        </label>
                        <div className="group relative">
                            <input
                                type="text"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 group-hover:border-zinc-600"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="ชื่อผู้ใช้"
                                autoComplete="username"
                            />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block pl-1 text-xs font-medium text-zinc-400">
                            รหัสผ่าน
                        </label>
                        <div className="group relative">
                            <input
                                type="password"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 group-hover:border-zinc-600"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="รหัสผ่าน"
                                autoComplete="current-password"
                            />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />
                        </div>
                    </div>

                    <Turnstile
                        ref={turnstileRef}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onError={() => setTurnstileToken(null)}
                        onExpire={() => setTurnstileToken(null)}
                        theme="dark"
                    />

                    <button
                        type="submit"
                        disabled={loading || !turnstileToken}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:to-cyan-500 hover:shadow-blue-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
                    </button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-black/40 px-2 text-zinc-500">หรือ</span>
                    </div>
                </div>

                <FingerprintLoginButton />

                <p className="mt-6 text-center text-xs text-zinc-600">ปลอดภัยด้วย SmartShip</p>
            </div>
        </div>
    );
}
