'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@app/context/LanguageContext';

interface StoreSettings {
    contact_address?: string;
    contact_phone?: string;
    map_link?: string;
}

export default function StoreLocationInfo() {
    const { language } = useLanguage();
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['contact_address', 'contact_phone', 'map_link']);

                if (error) {
                    console.error('Error fetching store settings:', error);
                    setLoading(false);
                    return;
                }

                if (data && data.length > 0) {
                    const settingsObj: StoreSettings = {};
                    data.forEach((item: { key: string; value: string }) => {
                        let value = item.value || '';
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        value = value.replace(/\\"/g, '"');
                        settingsObj[item.key as keyof StoreSettings] = value;
                    });
                    setSettings(settingsObj);
                }
            } catch (err) {
                console.error('Error fetching store settings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
        );
    }

    const mapLink = settings?.map_link || 'https://maps.app.goo.gl/u8xZxi6XjyWpgm54A';

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2 text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-semibold">
                        {language === 'th' ? 'ชำระเงินสดที่หน้าร้าน' : 'Pay Cash at Store'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 text-center space-y-4">
                {/* Info */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <p className="text-green-700 dark:text-green-400 font-medium mb-2">
                        {language === 'th' ? '📍 มารับสินค้าและชำระเงินได้ที่' : '📍 Pick up and pay at'}
                    </p>
                    <p className="text-zinc-700 dark:text-zinc-300 text-sm">
                        {settings?.contact_address || 'สะพานข้ามคลองหมู่บ้านพาทยา 1 ถนนรังสิต-นครนายก คลอง8 ลำลักกุด ธัญบุรี ปทุมธานี 12110'}
                    </p>
                    {settings?.contact_phone && (
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-2">
                            📞 {settings.contact_phone}
                        </p>
                    )}
                </div>

                {/* Map Button */}
                <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-105"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    {language === 'th' ? '🗺️ เปิด Google Maps' : '🗺️ Open Google Maps'}
                </a>
                <p className="text-xs text-zinc-400">
                    {language === 'th' ? 'กดเพื่อดูเส้นทางไปร้าน' : 'Tap to get directions to our store'}
                </p>
            </div>

            {/* Footer */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{language === 'th' ? 'ชำระเงินสดเมื่อรับสินค้า' : 'Pay cash on pickup'}</span>
                </div>
            </div>
        </div>
    );
}
