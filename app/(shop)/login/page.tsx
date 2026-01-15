'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, Suspense, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Turnstile, { TurnstileRef } from '@app/components/ui/Turnstile';

function LoginForm() {
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get('next') || '/';
    const errorParam = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(
        errorParam ? { text: decodeURIComponent(errorParam), type: 'error' } : null
    );
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileRef>(null);

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            // 1. Listen for auth state changes (Handles Implicit Flow / Fragment)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    router.push(next);
                }
            });

            // 2. Check current session (Handles Persistence)
            try {
                // Set a timeout to prevent infinite loading
                const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));
                const sessionPromise = supabase.auth.getSession();

                const result: any = await Promise.race([sessionPromise, timeoutPromise]);

                if (result && result.data && result.data.session) {
                    router.push(next);
                    // Don't return here, let the subscription handle any updates
                }
            } catch (error) {
                console.error('Session check failed:', error);
            } finally {
                if (mountedRef.current) {
                    setCheckingSession(false);
                }
            }

            return () => {
                subscription.unsubscribe();
            };
        };

        const mountedRef = { current: true };
        checkSession();

        return () => {
            mountedRef.current = false;
        };
    }, [router, next]);

    // Show loading while checking session
    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                    <p className="text-zinc-500">กำลังตรวจสอบ...</p>
                </div>
            </div>
        );
    }


    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check Turnstile token
        if (!turnstileToken) {
            setMessage({ text: 'Please complete the security verification', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out. Please try again.')), 15000)
            );

            if (isSignUp) {
                const signUpPromise = supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                    },
                });

                const result: any = await Promise.race([signUpPromise, timeoutPromise]);
                if (result.error) throw result.error;
                setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
            } else {
                console.log('Attempting email login for:', email);

                const signInPromise = supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                const result: any = await Promise.race([signInPromise, timeoutPromise]);
                console.log('Sign in result:', result);

                if (result.error) throw result.error;

                console.log('Login successful, redirecting to:', next);
                router.push(next);
                router.refresh();
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            setMessage({ text: error.message || 'Authentication failed', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (provider: 'line' | 'google' | 'facebook') => {
        setLoading(true);
        try {
            let authProvider: any = provider;
            const options: any = {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                flowType: 'pkce',
            };

            // Use OpenID Connect (OIDC) for LINE if native support is missing
            if (provider === 'line') {
                authProvider = 'oidc';
                options.scopes = 'openid profile email';
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: authProvider,
                options,
            });
            if (error) throw error;
        } catch (error: any) {
            console.error('Login error:', error);
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4 py-12">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2">
                        {isSignUp ? 'Create an Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-zinc-500 text-sm">
                        {isSignUp ? 'Sign up to start your journey' : 'Login to manage your orders'}
                    </p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
                            placeholder="name@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {/* Turnstile Bot Protection */}
                    <Turnstile
                        ref={turnstileRef}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onError={() => setTurnstileToken(null)}
                        onExpire={() => setTurnstileToken(null)}
                        theme="auto"
                    />

                    <button
                        type="submit"
                        disabled={loading || !turnstileToken}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 rounded-lg hover:opacity-80 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500">Or continue with</span>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* LINE Login */}
                    <button
                        onClick={() => handleLogin('line')}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3 rounded-lg transition-all active:scale-95"
                    >
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M22.288 10.384c0-5.074-4.665-9.189-10.422-9.189-5.76 0-10.423 4.115-10.423 9.189 0 4.542 3.733 8.337 9.07 9.066.866.19 2.035.586 2.333 1.341 0 0 .346 2.058.423 2.502.138.802 1.488.51 2.527-1.42 2.766-4.225 6.492-7.23 6.492-11.489z" />
                        </svg>
                        Login with LINE
                    </button>

                    {/* Google Login */}
                    <button
                        onClick={() => handleLogin('google')}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-gray-200 font-bold py-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Login with Google
                    </button>

                    {/* Facebook Login */}
                    <button
                        onClick={() => handleLogin('facebook')}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3 rounded-lg transition-all"
                    >
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        Login with Facebook
                    </button>
                </div>

                <div className="mt-8 text-center text-sm">
                    <p className="text-zinc-500">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 font-bold text-black dark:text-white hover:underline"
                        >
                            {isSignUp ? 'Log in' : 'Sign up'}
                        </button>
                    </p>
                </div>

                <p className="text-center text-xs text-zinc-400 mt-6">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}

export default function ShopLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
