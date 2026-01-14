'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import CookiePreferencesModal from './CookiePreferencesModal';
import { useLanguage } from '@app/context/LanguageContext';

export default function CookieSettingsButton() {
    const [showModal, setShowModal] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        // Listen for custom event to open settings
        const handleOpen = () => setShowModal(true);
        window.addEventListener('openCookieSettings', handleOpen);
        return () => window.removeEventListener('openCookieSettings', handleOpen);
    }, []);

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors py-1 min-h-[44px]"
            >
                <Settings size={16} />
                {t('footer.cookie_settings') || 'Cookie Settings'}
            </button>

            <CookiePreferencesModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
            />
        </>
    );
}
