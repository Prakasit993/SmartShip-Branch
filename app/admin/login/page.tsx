'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Turnstile, { TurnstileRef } from '@app/components/ui/Turnstile';
import { FingerprintLoginButton } from '@app/admin/components/FingerprintButtons';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileRef>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Check Turnstile token
        if (!turnstileToken) {
            setError('Please complete the security verification');
            setLoading(false);
            return;
        }

        // Validate inputs
        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, turnstileToken }),
            });

            if (res.ok) {
                router.push('/admin');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-900 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px] pointer-events-none" />
            </div>

            <div className="w-full max-w-md p-8 bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 relative z-10 transition-all duration-500 hover:shadow-blue-900/20 hover:border-blue-500/30">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 mb-4 shadow-lg shadow-blue-500/30">
                        <span className="text-3xl">📦</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Admin Login</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Sign in to manage your shop</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {/* Username Field */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Username</label>
                        <div className="relative group">
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-zinc-600 outline-none group-hover:border-zinc-600"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter admin username"
                                autoComplete="username"
                            />
                            <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Password</label>
                        <div className="relative group">
                            <input
                                type="password"
                                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-zinc-600 outline-none group-hover:border-zinc-600"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter admin password"
                                autoComplete="current-password"
                            />
                            <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 p-3 rounded-lg flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}

                    {/* Turnstile Bot Protection */}
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
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Verifying...' : 'Access Dashboard'}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-black/40 px-2 text-zinc-500">หรือ</span>
                    </div>
                </div>

                {/* Fingerprint Login */}
                <FingerprintLoginButton />

                <p className="mt-6 text-center text-xs text-zinc-600">
                    Protected by SmartShip Security
                </p>
            </div>
        </div>
    );
}
