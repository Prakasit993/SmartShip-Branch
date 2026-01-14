'use client';

import Link from 'next/link';
import { COOKIES_LIST } from '@app/types/cookies';
import { useState } from 'react';
import CookiePreferencesModal from '@app/components/ui/CookiePreferencesModal';

export default function CookiePolicyPage() {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <CookiePreferencesModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
            />

            <div className="container mx-auto px-4 py-12 max-w-4xl font-sans">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 md:p-12">
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-white mb-2">Cookie Policy</h1>
                    <p className="text-sm text-zinc-500 mb-8">Last updated: January 12, 2026</p>

                    {/* Introduction */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">What Are Cookies?</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.
                        </p>
                    </section>

                    {/* Why We Use Cookies */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">Why We Use Cookies</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                            We use cookies for several important reasons:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-zinc-600 dark:text-zinc-400 pl-4">
                            <li>To ensure our website functions properly and securely</li>
                            <li>To remember your preferences and settings</li>
                            <li>To analyze how you use our website and improve your experience</li>
                            <li>To provide personalized content and relevant advertisements</li>
                        </ul>
                    </section>

                    {/* Cookie Categories */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Types of Cookies We Use</h2>

                        {/* Essential Cookies */}
                        <div className="mb-8 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 bg-green-50/50 dark:bg-green-900/10">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">Essential</span>
                                Essential Cookies
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                These cookies are necessary for the website to function and cannot be switched off.
                            </p>
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                                    View Essential Cookies ({COOKIES_LIST.filter(c => c.category === 'essential').length})
                                </summary>
                                <table className="w-full mt-4 text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Name</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Purpose</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COOKIES_LIST.filter(c => c.category === 'essential').map((cookie, idx) => (
                                            <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                                                <td className="py-3 font-mono text-zinc-900 dark:text-white">{cookie.name}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.purpose}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.duration}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        </div>

                        {/* Analytics Cookies */}
                        <div className="mb-8 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 bg-blue-50/50 dark:bg-blue-900/10">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">Analytics</span>
                                Analytics Cookies
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.
                            </p>
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                                    View Analytics Cookies ({COOKIES_LIST.filter(c => c.category === 'analytics').length})
                                </summary>
                                <table className="w-full mt-4 text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Name</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Purpose</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COOKIES_LIST.filter(c => c.category === 'analytics').map((cookie, idx) => (
                                            <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                                                <td className="py-3 font-mono text-zinc-900 dark:text-white">{cookie.name}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.purpose}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.duration}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        </div>

                        {/* Marketing Cookies */}
                        <div className="mb-8 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 bg-purple-50/50 dark:bg-purple-900/10">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full">Marketing</span>
                                Marketing Cookies
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                These cookies may be set through our site by our advertising partners.
                            </p>
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                                    View Marketing Cookies ({COOKIES_LIST.filter(c => c.category === 'marketing').length})
                                </summary>
                                <table className="w-full mt-4 text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Name</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Purpose</th>
                                            <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COOKIES_LIST.filter(c => c.category === 'marketing').map((cookie, idx) => (
                                            <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                                                <td className="py-3 font-mono text-zinc-900 dark:text-white">{cookie.name}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.purpose}</td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.duration}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        </div>
                    </section>

                    {/* Managing Cookies */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">How to Manage Cookies</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                            You have the right to decide whether to accept or reject cookies. You can manage your cookie preferences by clicking the button below:
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                        >
                            Manage Cookie Preferences
                        </button>
                        <p className="text-sm text-zinc-500 mt-4">
                            You can also set or amend your web browser controls to accept or refuse cookies.
                        </p>
                    </section>

                    {/* Contact & Updates */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">Updates to This Policy</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons.
                        </p>
                    </section>

                    {/* Footer Links */}
                    <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <Link
                            href="/"
                            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                        >
                            ← Back to Home
                        </Link>
                        <div className="flex gap-4 text-sm">
                            <Link href="/contact" className="text-blue-600 hover:underline">
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
