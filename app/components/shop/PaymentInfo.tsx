'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@app/context/LanguageContext';

interface PaymentSettings {
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    promptpay_number?: string;
    payment_qr_code?: string;
}

interface PaymentInfoProps {
    amount?: number;
}

export default function PaymentInfo({ amount = 0 }: PaymentInfoProps) {
    const { language } = useLanguage();
    const [settings, setSettings] = useState<PaymentSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(15 * 60);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['bank_name', 'bank_account_number', 'bank_account_name', 'promptpay_number', 'payment_qr_code']);

                if (error) {
                    console.error('Error fetching settings:', error);
                    setLoading(false);
                    return;
                }

                if (data && data.length > 0) {
                    const settingsObj: PaymentSettings = {};
                    data.forEach((item: { key: string; value: string }) => {
                        let value = item.value || '';
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        value = value.replace(/\\"/g, '"');
                        settingsObj[item.key as keyof PaymentSettings] = value;
                    });
                    setSettings(settingsObj);
                }
            } catch (err) {
                console.error('Error fetching payment settings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (timeLeft <= 0) {
            setIsExpired(true);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setIsExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const resetTimer = () => {
        setTimeLeft(15 * 60);
        setIsExpired(false);
    };

    // Generate PromptPay payment URL
    const getPaymentUrl = () => {
        if (!settings?.promptpay_number) return null;
        // Clean phone number (remove dashes/spaces)
        const cleanNumber = settings.promptpay_number.replace(/[-\s]/g, '');
        // Format: https://promptpay.io/{number}/{amount}
        const url = amount > 0
            ? `https://promptpay.io/${cleanNumber}/${amount}`
            : `https://promptpay.io/${cleanNumber}`;
        return url;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!settings?.payment_qr_code && !settings?.promptpay_number) {
        return null;
    }

    const paymentUrl = getPaymentUrl();

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2 text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-semibold">
                        {language === 'th' ? 'ชำระเงินผ่าน PromptPay' : 'Pay via PromptPay'}
                    </span>
                </div>
            </div>

            {/* QR Code Section */}
            <div className="p-6 text-center">
                {/* Timer */}
                <div className={`mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isExpired
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : timeLeft <= 60
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isExpired ? (
                        <span>{language === 'th' ? 'QR Code หมดอายุ' : 'QR Code Expired'}</span>
                    ) : (
                        <span>
                            {language === 'th' ? 'หมดอายุใน' : 'Expires in'} {formatTime(timeLeft)}
                        </span>
                    )}
                </div>

                {/* QR Code Image */}
                {settings.payment_qr_code ? (
                    <div className={`relative inline-block ${isExpired ? 'opacity-40' : ''}`}>
                        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-zinc-100 inline-block">
                            <img
                                src={settings.payment_qr_code}
                                alt="PromptPay QR Code"
                                className="w-56 h-56 object-contain"
                            />
                        </div>
                        {isExpired && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <button
                                    onClick={resetTimer}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition"
                                >
                                    🔄 {language === 'th' ? 'รีเฟรช QR' : 'Refresh QR'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-zinc-100 dark:bg-zinc-800 w-56 h-56 mx-auto rounded-xl flex items-center justify-center">
                        <span className="text-zinc-400">No QR Code</span>
                    </div>
                )}

                {/* Amount Display */}
                {amount > 0 && (
                    <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2 px-4 inline-block">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            {language === 'th' ? 'ยอดที่ต้องชำระ' : 'Amount to pay'}
                        </p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            ฿{amount.toLocaleString()}
                        </p>
                    </div>
                )}

                {/* PromptPay Number */}
                {settings.promptpay_number && (
                    <div className="mt-4 space-y-1">
                        <p className="text-xs text-zinc-500">PromptPay</p>
                        <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                            {settings.promptpay_number}
                        </p>
                    </div>
                )}

                {/* Shop Name */}
                {settings.bank_account_name && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {language === 'th' ? 'ชื่อร้านค้า:' : 'Shop:'} <span className="font-medium">{settings.bank_account_name}</span>
                    </p>
                )}

                {/* Open Bank App Button */}
                {paymentUrl && !isExpired && (
                    <div className="mt-6">
                        <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-105"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {language === 'th' ? '💳 ชำระผ่าน App ธนาคาร' : '💳 Pay via Bank App'}
                        </a>
                        <p className="text-xs text-zinc-400 mt-2">
                            {language === 'th' ? 'กดเพื่อเปิด App ธนาคารโดยอัตโนมัติ' : 'Tap to open your banking app'}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{language === 'th' ? 'ระบบชำระเงินปลอดภัย 100%' : 'Secure Payment System'}</span>
                </div>
                <p className="text-center text-xs text-zinc-400 mt-2">
                    📸 {language === 'th' ? 'หลังโอนเงินแล้ว กรุณาถ่ายสลิปแนบในหน้าถัดไป' : 'Please upload your payment slip after transfer'}
                </p>
            </div>
        </div>
    );
}
