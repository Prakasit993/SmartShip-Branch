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
    const [isZoomed, setIsZoomed] = useState(false);

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
            <div className="p-6">
                {/* QR Code Image - Centered & Zoomable */}
                <div className="flex justify-center mb-4">
                    {settings.payment_qr_code ? (
                        <div className={`relative ${isExpired ? 'opacity-40' : ''}`}>
                            <button
                                type="button"
                                onClick={() => setIsZoomed(!isZoomed)}
                                className="bg-white p-3 rounded-xl shadow-lg border border-zinc-200 inline-block cursor-zoom-in hover:shadow-xl transition-shadow"
                            >
                                <img
                                    src={settings.payment_qr_code}
                                    alt="PromptPay QR Code"
                                    className="w-44 h-44 object-contain"
                                />
                            </button>
                            <p className="text-xs text-zinc-400 text-center mt-2">
                                {language === 'th' ? '(กดเพื่อขยาย)' : '(Tap to zoom)'}
                            </p>
                            {isExpired && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={resetTimer}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition"
                                    >
                                        🔄 {language === 'th' ? 'รีเฟรช QR' : 'Refresh QR'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-zinc-100 dark:bg-zinc-800 w-44 h-44 rounded-xl flex items-center justify-center">
                            <span className="text-zinc-400">No QR Code</span>
                        </div>
                    )}
                </div>

                {/* Shop Name - Below QR */}
                {settings.bank_account_name && (
                    <p className="text-center text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        {language === 'th' ? 'ชื่อร้าน:' : 'Shop:'} <span className="font-semibold">{settings.bank_account_name}</span>
                    </p>
                )}

                {/* Amount Box */}
                {amount > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 mb-4 text-center border border-blue-100 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                            {language === 'th' ? 'ยอดที่ต้องชำระ' : 'Amount to pay'}
                        </p>
                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                            ฿{amount.toLocaleString()}
                        </p>
                    </div>
                )}

                {/* PromptPay Number + Scan Button - Same Row */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
                    {settings.promptpay_number && (
                        <div className="text-center sm:text-left">
                            <p className="text-xs text-zinc-500">PromptPay</p>
                            <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                                {settings.promptpay_number}
                            </p>
                        </div>
                    )}

                    {paymentUrl && !isExpired && (
                        <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-lg transition transform hover:scale-105 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            {language === 'th' ? 'สแกน QR' : 'Scan QR'}
                        </a>
                    )}
                </div>
            </div>

            {/* Zoom Modal */}
            {isZoomed && settings.payment_qr_code && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setIsZoomed(false)}
                >
                    <div
                        className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-zinc-800">
                                {language === 'th' ? 'สแกนเพื่อชำระเงิน' : 'Scan to Pay'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsZoomed(false)}
                                className="text-zinc-400 hover:text-zinc-600 transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white p-2 rounded-xl border-2 border-blue-100 mb-4">
                            <img
                                src={settings.payment_qr_code}
                                alt="PromptPay QR Code (Zoomed)"
                                className="w-full object-contain"
                            />
                        </div>

                        {/* Info */}
                        <div className="text-center mb-4">
                            {settings.bank_account_name && (
                                <p className="text-sm text-zinc-600 mb-1">
                                    {settings.bank_account_name}
                                </p>
                            )}
                            {amount > 0 && (
                                <p className="text-2xl font-bold text-blue-600">
                                    ฿{amount.toLocaleString()}
                                </p>
                            )}
                            {settings.promptpay_number && (
                                <p className="text-xs text-zinc-400 mt-1">
                                    PromptPay: {settings.promptpay_number}
                                </p>
                            )}
                        </div>

                        {/* Confirm Button */}
                        <button
                            type="button"
                            onClick={() => setIsZoomed(false)}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02]"
                        >
                            ✓ {language === 'th' ? 'โอนเงินแล้ว ปิดหน้าต่าง' : 'Done, Close Window'}
                        </button>
                    </div>
                </div>
            )}

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
