'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUser(user);
            }
            setLoading(false);
        };
        checkUser();
    }, [router]);

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;
    if (!user) return null;

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-4 mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                        {user.email?.[0].toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">My Account</h1>
                        <p className="text-zinc-500 text-sm">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Email</label>
                        <div className="font-mono bg-zinc-50 dark:bg-zinc-800 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
                            {user.email}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">User ID</label>
                        <div className="font-mono text-xs text-zinc-500 break-all">
                            {user.id}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                        <Link href="/admin" className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl font-bold transition-colors">
                            <span>⚙️</span> Staff Portal
                        </Link>

                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                router.push('/');
                            }}
                            className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
