'use client';

import { useState, useEffect } from 'react';
import { X, Cookie, Settings, Shield, BarChart3, Target } from 'lucide-react';
import { useCookieConsent } from '@app/hooks/useCookieConsent';
import { useLanguage } from '@app/context/LanguageContext';
import { COOKIES_LIST } from '@app/types/cookies';

interface CookiePreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CookiePreferencesModal({ isOpen, onClose }: CookiePreferencesModalProps) {
    const { preferences, updatePreferences, acceptAll, rejectAll } = useCookieConsent();
    const { t } = useLanguage();

    const [localAnalytics, setLocalAnalytics] = useState(preferences?.analytics ?? false);
    const [localMarketing, setLocalMarketing] = useState(preferences?.marketing ?? false);

    // Load saved preferences when modal opens
    useEffect(() => {
        if (isOpen && preferences) {
            setLocalAnalytics(preferences.analytics);
            setLocalMarketing(preferences.marketing);
        }
    }, [isOpen, preferences]);

    if (!isOpen) return null;

    const handleSave = () => {
        updatePreferences({
            analytics: localAnalytics,
            marketing: localMarketing,
        });
        onClose();
    };

    const handleAcceptAll = () => {
        setLocalAnalytics(true);
        setLocalMarketing(true);
        acceptAll();
        onClose();
    };

    const handleRejectAll = () => {
        setLocalAnalytics(false);
        setLocalMarketing(false);
        rejectAll();
        onClose();
    };

    const essentialCookies = COOKIES_LIST.filter(c => c.category === 'essential');
    const analyticsCookies = COOKIES_LIST.filter(c => c.category === 'analytics');
    const marketingCookies = COOKIES_LIST.filter(c => c.category === 'marketing');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                            <Settings className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            {t('cookie.preferences_title') || 'Cookie Preferences'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-6 space-y-6">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {t('cookie.preferences_desc') || 'We use cookies to improve your experience on our site. You can choose which categories of cookies to allow below.'}
                    </p>

                    {/* Essential Cookies */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-zinc-50/50 dark:bg-zinc-800/30">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mt-0.5">
                                    <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                                        {t('cookie.essential_title') || 'Essential Cookies'}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                        {t('cookie.essential_desc') || 'These cookies are necessary for the website to function and cannot be disabled.'}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                                    {t('cookie.always_on') || 'Always On'}
                                </div>
                            </div>
                        </div>
                        <details className="mt-3">
                            <summary className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                                {t('cookie.view_cookies') || 'View cookies'} ({essentialCookies.length})
                            </summary>
                            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                {essentialCookies.map((cookie, idx) => (
                                    <li key={idx} className="flex justify-between pl-4">
                                        <span className="font-mono">{cookie.name}</span>
                                        <span className="text-zinc-400">{cookie.duration}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </div>

                    {/* Analytics Cookies */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mt-0.5">
                                    <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                                        {t('cookie.analytics_title') || 'Analytics Cookies'}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                        {t('cookie.analytics_desc') || 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.'}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <button
                                    onClick={() => setLocalAnalytics(!localAnalytics)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${localAnalytics
                                        ? 'bg-blue-600 dark:bg-blue-500'
                                        : 'bg-zinc-300 dark:bg-zinc-700'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localAnalytics ? 'translate-x-6' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <details className="mt-3">
                            <summary className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                                {t('cookie.view_cookies') || 'View cookies'} ({analyticsCookies.length})
                            </summary>
                            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                {analyticsCookies.map((cookie, idx) => (
                                    <li key={idx} className="flex justify-between pl-4">
                                        <span className="font-mono">{cookie.name}</span>
                                        <span className="text-zinc-400">{cookie.duration}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </div>

                    {/* Marketing Cookies */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mt-0.5">
                                    <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                                        {t('cookie.marketing_title') || 'Marketing Cookies'}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                        {t('cookie.marketing_desc') || 'These cookies are used to track visitors across websites to display relevant ads and measure their effectiveness.'}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <button
                                    onClick={() => setLocalMarketing(!localMarketing)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${localMarketing
                                        ? 'bg-purple-600 dark:bg-purple-500'
                                        : 'bg-zinc-300 dark:bg-zinc-700'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localMarketing ? 'translate-x-6' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <details className="mt-3">
                            <summary className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                                {t('cookie.view_cookies') || 'View cookies'} ({marketingCookies.length})
                            </summary>
                            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                {marketingCookies.map((cookie, idx) => (
                                    <li key={idx} className="flex justify-between pl-4">
                                        <span className="font-mono">{cookie.name}</span>
                                        <span className="text-zinc-400">{cookie.duration}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handleRejectAll}
                        className="flex-1 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-sm"
                    >
                        {t('cookie.reject_all') || 'Reject All'}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-80 transition-all text-sm"
                    >
                        {t('cookie.save_preferences') || 'Save Preferences'}
                    </button>
                    <button
                        onClick={handleAcceptAll}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm"
                    >
                        {t('cookie.accept_all') || 'Accept All'}
                    </button>
                </div>
            </div>
        </div>
    );
}
