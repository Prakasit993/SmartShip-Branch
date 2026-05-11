'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
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

type LoginNotice = {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
};

const noticeStyles: Record<LoginNotice['type'], { box: string; icon: string; title: string; text: string }> = {
    success: {
        box: 'border-emerald-400/30 bg-emerald-500/10 ring-emerald-400/10',
        icon: '✅',
        title: 'text-emerald-100',
        text: 'text-emerald-200/80',
    },
    error: {
        box: 'border-red-400/30 bg-red-500/10 ring-red-400/10',
        icon: '❌',
        title: 'text-red-100',
        text: 'text-red-200/80',
    },
    warning: {
        box: 'border-amber-400/30 bg-amber-500/10 ring-amber-400/10',
        icon: '⚠️',
        title: 'text-amber-100',
        text: 'text-amber-200/80',
    },
    info: {
        box: 'border-sky-400/30 bg-sky-500/10 ring-sky-400/10',
        icon: 'ℹ️',
        title: 'text-sky-100',
        text: 'text-sky-200/80',
    },
};

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [notice, setNotice] = useState<LoginNotice>({
        type: 'info',
        title: 'ยินดีต้อนรับกลับ',
        message: 'เข้าสู่ระบบเพื่อจัดการออเดอร์ สินค้า และการจัดส่งของ SmartShip',
    });
    const turnstileRef = useRef<TurnstileRef>(null);
    const { showToast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!turnstileToken) {
            const message = 'กรุณายืนยันช่องความปลอดภัยให้ครบก่อน';
            setNotice({ type: 'warning', title: 'ต้องยืนยันความปลอดภัย', message });
            showToast(message, 'warning');
            setLoading(false);
            return;
        }

        if (!username.trim() || !password.trim()) {
            const message = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
            setNotice({ type: 'warning', title: 'กรอกข้อมูลไม่ครบ', message });
            showToast(message, 'warning');
            setLoading(false);
            return;
        }

        try {
            setNotice({
                type: 'info',
                title: 'กำลังตรวจสอบข้อมูล',
                message: 'ระบบกำลังตรวจสอบบัญชีและความปลอดภัย กรุณารอสักครู่',
            });
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, turnstileToken }),
            });

            if (res.ok) {
                const message = 'เข้าสู่ระบบสำเร็จ กำลังเข้าแดชบอร์ด…';
                setNotice({ type: 'success', title: 'สำเร็จ', message });
                showToast(message, 'success');
                window.location.replace('/admin');
                return;
            }

            let serverMessage: string | undefined;
            try {
                const data = (await res.json()) as { error?: string };
                serverMessage = data.error;
            } catch {
                serverMessage = undefined;
            }
            const message = mapLoginErrorToThai(serverMessage);
            setNotice({ type: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', message });
            showToast(message, 'error');
        } catch {
            const message = 'เครือข่ายผิดพลาดหรือเซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองอีกครั้ง';
            setNotice({ type: 'error', title: 'เชื่อมต่อไม่ได้', message });
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const activeNoticeStyle = noticeStyles[notice.type];

    return (
        <div className="relative min-h-dvh overflow-hidden bg-[#030712] px-4 py-6 text-white sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-12rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-[120px]" />
                <div className="absolute bottom-[-14rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-blue-700/25 blur-[130px]" />
                <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-[130px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:100%_100%,44px_44px,44px_44px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center">
                <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_27rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
                    <section className="hidden lg:block">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold leading-none text-cyan-100 shadow-lg shadow-cyan-950/30 xl:text-xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                            SmartShip Admin Portal
                        </div>
                        <h1 className="mt-5 max-w-2xl text-[clamp(2.5rem,4vw,4.5rem)] font-black leading-[1.12] tracking-tight text-white">
                            จัดการร้านและออเดอร์ได้ในที่เดียว
                        </h1>
                        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 xl:text-base xl:leading-8">
                            เข้าสู่ระบบเพื่อดูยอดขาย ตรวจออเดอร์ จัดการสินค้า และติดตามการจัดส่งด้วยระบบหลังบ้านที่ปลอดภัย
                        </p>

                        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                            {[
                                ['ออเดอร์', 'เรียลไทม์'],
                                ['สินค้า', 'พร้อมขาย'],
                                ['ขนส่ง', 'ติดตามง่าย'],
                            ].map(([title, desc]) => (
                                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
                                    <p className="text-sm font-bold leading-5 text-white">{title}</p>
                                    <p className="mt-1 text-xs leading-5 text-zinc-400">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mx-auto w-full max-w-[26rem] rounded-[1.75rem] border border-white/10 bg-zinc-950/75 p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-7 lg:max-w-none">
                        <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
                            <div>
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-lg shadow-blue-500/25 sm:h-14 sm:w-14">
                                    <span className="text-xl sm:text-2xl">📦</span>
                                </div>
                                <h2 className="mt-4 text-[1.65rem] font-black leading-tight tracking-tight text-white sm:mt-5 sm:text-3xl">
                                    เข้าสู่ระบบ
                                </h2>
                                <p className="mt-2 text-[13px] leading-5 text-zinc-400 sm:text-sm">
                                    สำหรับผู้ดูแล SmartShip เท่านั้น
                                </p>
                            </div>
                            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-emerald-200 sm:px-3 sm:text-xs">
                                Secure
                            </div>
                        </div>

                        <div
                            className={`mb-5 flex gap-3 rounded-2xl border p-3.5 shadow-lg ring-1 sm:mb-6 sm:p-4 ${activeNoticeStyle.box}`}
                            role={notice.type === 'error' ? 'alert' : 'status'}
                            aria-live="polite"
                        >
                            <span className="mt-0.5 text-base sm:text-lg" aria-hidden>
                                {activeNoticeStyle.icon}
                            </span>
                            <div className="min-w-0">
                                <p className={`text-[13px] font-bold leading-5 sm:text-sm ${activeNoticeStyle.title}`}>{notice.title}</p>
                                <p className={`mt-1 text-[12px] leading-5 sm:text-xs sm:leading-5 ${activeNoticeStyle.text}`}>{notice.message}</p>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5" autoComplete="on">
                            <div className="space-y-1">
                                <label
                                    htmlFor="admin-login-username"
                                    className="block pl-1 text-[12px] font-semibold leading-5 text-zinc-300 sm:text-xs"
                                >
                                    ชื่อผู้ใช้
                                </label>
                                <div className="group relative">
                                    <input
                                        id="admin-login-username"
                                        name="username"
                                        type="text"
                                        className="w-full rounded-2xl border border-zinc-700/80 bg-zinc-900/70 px-4 py-3 text-[15px] leading-6 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 group-hover:border-zinc-500 sm:py-3.5"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="ชื่อผู้ใช้"
                                        autoComplete="username"
                                    />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label
                                    htmlFor="admin-login-password"
                                    className="block pl-1 text-[12px] font-semibold leading-5 text-zinc-300 sm:text-xs"
                                >
                                    รหัสผ่าน
                                </label>
                                <div className="group relative">
                                    <input
                                        id="admin-login-password"
                                        name="password"
                                        type="password"
                                        className="w-full rounded-2xl border border-zinc-700/80 bg-zinc-900/70 px-4 py-3 text-[15px] leading-6 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 group-hover:border-zinc-500 sm:py-3.5"
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
                                onSuccess={(token) => {
                                    setTurnstileToken(token);
                                    setNotice({
                                        type: 'success',
                                        title: 'ยืนยันความปลอดภัยแล้ว',
                                        message: 'พร้อมเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน',
                                    });
                                }}
                                onError={() => {
                                    setTurnstileToken(null);
                                    setNotice({
                                        type: 'warning',
                                        title: 'ยืนยันความปลอดภัยไม่สำเร็จ',
                                        message: 'กรุณาลองยืนยันช่องความปลอดภัยอีกครั้ง',
                                    });
                                }}
                                onExpire={() => {
                                    setTurnstileToken(null);
                                    setNotice({
                                        type: 'warning',
                                        title: 'การยืนยันหมดอายุ',
                                        message: 'กรุณายืนยันช่องความปลอดภัยใหม่ก่อนเข้าสู่ระบบ',
                                    });
                                }}
                                theme="dark"
                            />

                            <button
                                type="submit"
                                disabled={loading || !turnstileToken}
                                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 px-4 py-3.5 text-sm font-bold leading-6 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:via-cyan-500 hover:to-sky-400 hover:shadow-blue-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
                            >
                                {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
                            </button>
                        </form>

                        <div className="relative my-5 sm:my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-zinc-700" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-zinc-950 px-2 text-zinc-500">หรือ</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4 ring-1 ring-cyan-500/10 sm:p-5">
                            <p className="text-[13px] font-bold leading-5 text-cyan-100 sm:text-sm">Passkey</p>
                            <p className="mt-1.5 text-[11px] leading-5 text-zinc-400 sm:text-xs">
                                ยืนยันอุปกรณ์ทุกครั้ง (เช่น Hello / ลายนิ้ว / PIN)
                            </p>
                            <div className="mt-2.5">
                                <FingerprintLoginButton />
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-[12px] leading-5 text-zinc-400 sm:mt-6 sm:p-4 sm:text-xs">
                            รหัสผ่าน + Turnstile · Passkey ยืนยันอุปกรณ์
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
