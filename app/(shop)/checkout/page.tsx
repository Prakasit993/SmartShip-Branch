'use client';

import CheckoutForm from '@app/components/shop/CheckoutForm';
import { useLanguage } from '@app/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error) {
                    console.error('Auth error:', error);
                    router.push('/login?next=/checkout');
                    return;
                }
                if (!user) {
                    router.push('/login?next=/checkout');
                } else {
                    setChecking(false);
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                router.push('/login?next=/checkout');
            }
        };
        checkUser();
    }, [router]);

    if (checking) {
        return (
            <div className="container mx-auto px-4 py-8 text-center pt-20">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                <p className="text-zinc-500">Checking login status...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center">{t('cart.checkout')}</h1>
            <CheckoutForm />
        </div>
    );
}
