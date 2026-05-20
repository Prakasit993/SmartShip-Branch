'use client';

import { COOKIES_LIST } from '@app/types/cookies';
import { useState } from 'react';
import CookiePreferencesModal from '@app/components/ui/CookiePreferencesModal';
import PolicyLayout from '@app/components/ui/PolicyLayout';

export default function CookiePolicyPage() {
    const [showModal, setShowModal] = useState(false);

    const cookieGroups = [
        {
            key: 'essential',
            label: 'Essential',
            title: 'Essential Cookies',
            badge: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/30',
            border: 'border-cyan-300/40 dark:border-cyan-700/40 bg-cyan-50/40 dark:bg-cyan-950/15',
            desc: 'These cookies are necessary for the website to function and cannot be switched off.',
        },
        {
            key: 'analytics',
            label: 'Analytics',
            title: 'Analytics Cookies',
            badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30',
            border: 'border-blue-300/40 dark:border-blue-700/40 bg-blue-50/40 dark:bg-blue-950/15',
            desc: 'These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.',
        },
        {
            key: 'marketing',
            label: 'Marketing',
            title: 'Marketing Cookies',
            badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30',
            border: 'border-amber-300/40 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/15',
            desc: 'These cookies may be set through our site by our advertising partners.',
        },
    ] as const;

    return (
        <>
            <CookiePreferencesModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
            />

            <PolicyLayout
                breadcrumb="Cookie Policy"
                labTag="// COOKIE.POLICY"
                title="Cookie Policy"
                lastUpdated="Last updated: January 12, 2026"
                lead="How NYXEL uses cookies — what we store, why, and how to manage your preferences."
                versionMark="V.1 · 2026.01"
            >
                <div className="prose prose-zinc dark:prose-invert max-w-none">
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

                        {cookieGroups.map((group) => {
                            const items = COOKIES_LIST.filter((c) => c.category === group.key);
                            return (
                                <div
                                    key={group.key}
                                    className={`mb-6 border rounded-xl p-6 ${group.border}`}
                                >
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${group.badge}`}>
                                            {group.label}
                                        </span>
                                        {group.title}
                                    </h3>
                                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                        {group.desc}
                                    </p>
                                    <details className="mt-4 group">
                                        <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="font-mono text-cyan-600 dark:text-cyan-400">{'>'}</span>
                                                View {group.label} Cookies ({items.length})
                                                <span className="font-mono text-zinc-400 group-open:rotate-90 transition-transform inline-block">›</span>
                                            </span>
                                        </summary>
                                        <div className="overflow-x-auto mt-4">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                                        <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Name</th>
                                                        <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Purpose</th>
                                                        <th className="text-left py-2 text-zinc-700 dark:text-zinc-300">Duration</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((cookie, idx) => (
                                                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                                                            <td className="py-3 font-mono text-zinc-900 dark:text-white">{cookie.name}</td>
                                                            <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.purpose}</td>
                                                            <td className="py-3 text-zinc-600 dark:text-zinc-400">{cookie.duration}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                    </section>

                    {/* Managing Cookies */}
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">How to Manage Cookies</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                            You have the right to decide whether to accept or reject cookies. You can manage your cookie preferences by clicking the button below:
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all"
                        >
                            Manage Cookie Preferences
                        </button>
                        <p className="text-sm text-zinc-500 mt-4">
                            You can also set or amend your web browser controls to accept or refuse cookies.
                        </p>
                    </section>

                    {/* Contact & Updates */}
                    <section className="mb-4">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">Updates to This Policy</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons.
                        </p>
                    </section>
                </div>
            </PolicyLayout>
        </>
    );
}
