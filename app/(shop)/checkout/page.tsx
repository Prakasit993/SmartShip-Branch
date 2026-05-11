'use client';

import CheckoutForm from '@app/components/shop/CheckoutForm';
import { useLanguage } from '@app/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CustomerProfile {
    phone: string | null;
    address: string | null;
    name: string | null;
}

export default function CheckoutPage() {
    const { t, language } = useLanguage();
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [profileMissing, setProfileMissing] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            try {
                // Use getSession for the gate: getUser() throws AuthSessionMissingError when
                // there is no session, which is expected for guests and spams the dev console.
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) {
                    console.error('Auth error:', sessionError);
                    router.push('/login?next=/checkout');
                    return;
                }
                const user = session?.user;
                if (!user) {
                    router.push('/login?next=/checkout');
                    return;
                }

                // Check if user has phone and address in profile
                const { data: customer } = await supabase
                    .from('customers')
                    .select('phone, address, name')
                    .eq('line_user_id', user.id)
                    .single();

                if (!customer?.phone || !customer?.address) {
                    setProfile(customer);
                    setProfileMissing(true);
                    setChecking(false);
                    return;
                }

                setProfile(customer);
                setChecking(false);
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
                <p className="text-zinc-500">
                    {language === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...'}
                </p>
            </div>
        );
    }

    // Show prompt to complete profile
    if (profileMissing) {
        const missingFields = [];
        if (!profile?.phone) missingFields.push(language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone');
        if (!profile?.address) missingFields.push(language === 'th' ? 'ที่อยู่จัดส่ง' : 'Address');

        return (
            <div className="container mx-auto px-4 py-8 max-w-lg">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                    {/* Warning Icon */}
                    <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">📝</span>
                    </div>

                    <h1 className="text-2xl font-bold mb-3">
                        {language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please Complete Your Profile'}
                    </h1>

                    <p className="text-zinc-500 mb-6">
                        {language === 'th'
                            ? 'เพื่อทำการสั่งซื้อ กรุณากรอกข้อมูลต่อไปนี้:'
                            : 'To place an order, please fill in the following:'}
                    </p>

                    {/* Missing Fields */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-6">
                        <ul className="space-y-2">
                            {missingFields.map((field, i) => (
                                <li key={i} className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                    <span className="w-5 h-5 bg-yellow-200 dark:bg-yellow-800 rounded-full flex items-center justify-center text-xs">
                                        ⚠️
                                    </span>
                                    {field}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Current Info */}
                    {profile?.name && (
                        <div className="text-sm text-zinc-500 mb-6">
                            <span className="font-medium">{language === 'th' ? 'ชื่อ:' : 'Name:'}</span> {profile.name}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <Link
                            href="/profile?from=checkout"
                            className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:opacity-90 transition text-center"
                        >
                            {language === 'th' ? '✏️ ไปกรอกข้อมูล' : '✏️ Complete Profile'}
                        </Link>

                        <Link
                            href="/cart"
                            className="block w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-3 px-6 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-center"
                        >
                            {language === 'th' ? '← กลับไปตะกร้า' : '← Back to Cart'}
                        </Link>
                    </div>
                </div>
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
