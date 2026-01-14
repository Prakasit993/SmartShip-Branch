'use client';

import Link from 'next/link';
import CookieSettingsButton from '@app/components/ui/CookieSettingsButton';
import { useLanguage } from '@app/context/LanguageContext';

export default function Footer() {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-8 px-4 font-sans">
            <div className="container mx-auto max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Company Info */}
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Express Shop</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {t('footer.description') || 'Premium packing essentials and bundles for your shipping needs.'}
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-3">
                            {t('footer.quick_links') || 'Quick Links'}
                        </h3>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link href="/shop" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors inline-block py-1">
                                    {t('footer.shop') || 'Shop'}
                                </Link>
                            </li>
                            <li>
                                <Link href="/track" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors inline-block py-1">
                                    {t('footer.track_order') || 'Track Order'}
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors inline-block py-1">
                                    {t('footer.contact') || 'Contact Us'}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal & Privacy */}
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-3">
                            {t('footer.legal') || 'Legal'}
                        </h3>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link href="/cookie-policy" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors inline-block py-1">
                                    {t('footer.cookie_policy') || 'Cookie Policy'}
                                </Link>
                            </li>
                            <li>
                                <CookieSettingsButton />
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
                    <p className="text-center md:text-left">
                        © {currentYear} Express Shop. {t('footer.rights') || 'All rights reserved.'}
                    </p>
                    <div className="flex gap-6">
                        <Link href="/privacy-policy" className="hover:text-zinc-900 dark:hover:text-white transition-colors py-2">
                            {t('footer.privacy') || 'Privacy'}
                        </Link>
                        <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white transition-colors py-2">
                            {t('footer.terms') || 'Terms'}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
