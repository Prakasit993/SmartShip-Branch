'use client';

import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';
import { useCookieConsent } from '@app/hooks/useCookieConsent';
import CookiePreferencesModal from './CookiePreferencesModal';
import { useLanguage } from '@app/context/LanguageContext';

export default function CookieConsent() {
    const { acceptAll, rejectAll } = useCookieConsent();
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);

    // Show banner after delay if user hasn't made a choice
    useEffect(() => {
        // Check localStorage directly
        const hasPreferences = localStorage.getItem('cookie_preferences');
        if (!hasPreferences) {
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAcceptAll = () => {
        acceptAll();
        setIsVisible(false);
    };

    const handleRejectAll = () => {
        rejectAll();
        setIsVisible(false);
    };

    const handleCustomize = () => {
        setShowPreferences(true);
    };

    const handleClosePreferences = () => {
        setShowPreferences(false);
        setIsVisible(false);
    };

    if (!isVisible && !showPreferences) return null;

    return (
        <>
            {/* Cookie Preferences Modal */}
            <CookiePreferencesModal
                isOpen={showPreferences}
                onClose={handleClosePreferences}
            />

            {/* Cookie Consent Banner */}
            {isVisible && !showPreferences && (
                <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 rounded-2xl shadow-2xl">
                        <div className="flex items-start justify-between mb-3 md:mb-4">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="p-1.5 md:p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                    <Cookie className="w-4 h-4 md:w-5 md:h-5 text-zinc-900 dark:text-zinc-100" />
                                </div>
                                <h3 className="font-bold text-sm md:text-base text-zinc-900 dark:text-zinc-100">
                                    {t('cookie.title') || 'We use cookies'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 md:mb-5">
                            {t('cookie.description') || 'We use cookies to enhance your experience, analyze site traffic, and personalize content. Choose your preferences below.'}
                        </p>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleAcceptAll}
                                className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-2.5 md:py-3 rounded-xl hover:opacity-80 transition-all text-sm min-h-[44px]"
                            >
                                {t('cookie.accept_all') || 'Accept All'}
                            </button>
                            {/* Stack buttons on mobile, row on desktop */}
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
                                <button
                                    onClick={handleRejectAll}
                                    className="w-full bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold py-2.5 md:py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-sm min-h-[44px]"
                                >
                                    {t('cookie.reject_all') || 'Reject All'}
                                </button>
                                <button
                                    onClick={handleCustomize}
                                    className="w-full bg-blue-600 text-white font-bold py-2.5 md:py-3 rounded-xl hover:bg-blue-700 transition-all text-sm min-h-[44px]"
                                >
                                    {t('cookie.customize') || 'Customize'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
