'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@app/context/LanguageContext';

interface PaymentSettings {
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    promptpay_number?: string;
    payment_qr_code?: string;
}

export default function PaymentInfo() {
    const { language } = useLanguage();
    const [settings, setSettings] = useState<PaymentSettings | null>(null);
    const [loading, setLoading] = useState(true);

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
                        // Clean up escaped quotes from JSON storage
                        let value = item.value || '';
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        value = value.replace(/\\"/g, '"');
                        settingsObj[item.key as keyof PaymentSettings] = value;
                    });
                    setSettings(settingsObj);
                    console.log('Payment settings loaded:', settingsObj);
                }
            } catch (err) {
                console.error('Error fetching payment settings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    if (loading) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"></div>
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2"></div>
            </div>
        );
    }

    // Don't show anything if no payment info is configured
    if (!settings?.bank_name && !settings?.promptpay_number && !settings?.payment_qr_code) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 space-y-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                💳 {language === 'th' ? 'ข้อมูลการชำระเงิน' : 'Payment Information'}
            </h3>

            {/* QR Code */}
            {settings.payment_qr_code && (
                <div className="flex flex-col items-center py-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                        📱 {language === 'th' ? 'สแกน QR Code เพื่อชำระเงิน' : 'Scan QR Code to pay'}
                    </p>
                    <img
                        src={settings.payment_qr_code}
                        alt="Payment QR Code"
                        className="w-48 h-48 object-contain bg-white rounded-lg border-2 border-blue-300 shadow-lg"
                    />
                </div>
            )}

            {/* Bank Details */}
            {settings.bank_name && (
                <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-zinc-500">{language === 'th' ? 'ธนาคาร' : 'Bank'}:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{settings.bank_name}</span>
                    </div>
                    {settings.bank_account_number && (
                        <div className="flex justify-between">
                            <span className="text-zinc-500">{language === 'th' ? 'เลขบัญชี' : 'Account'}:</span>
                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{settings.bank_account_number}</span>
                        </div>
                    )}
                    {settings.bank_account_name && (
                        <div className="flex justify-between">
                            <span className="text-zinc-500">{language === 'th' ? 'ชื่อบัญชี' : 'Name'}:</span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{settings.bank_account_name}</span>
                        </div>
                    )}
                </div>
            )}

            {/* PromptPay */}
            {settings.promptpay_number && (
                <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">PromptPay:</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{settings.promptpay_number}</span>
                    </div>
                </div>
            )}

            <p className="text-xs text-zinc-500 text-center">
                {language === 'th'
                    ? '📸 หลังโอนเงินแล้ว กรุณาถ่ายสลิปแนบในหน้าถัดไป'
                    : '📸 After payment, please upload your slip on the next page'}
            </p>
        </div>
    );
}
