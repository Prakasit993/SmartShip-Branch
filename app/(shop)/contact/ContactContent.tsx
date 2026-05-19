'use client';

import {
    Mail,
    Phone,
    MapPin,
    MessageCircle,
    ArrowUpRight,
    Copy,
    MapPinned,
} from 'lucide-react';
import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';
import { useToast } from '@app/components/ui/Toast';

interface ContactContentProps {
    contactPhone: string;
    contactLine: string;
    contactLineUrl: string;
    contactEmail: string;
    contactAddress: string;
    mapEmbedUrl: string;
    mapLink: string;
}

/** ดึง URL จาก iframe หรือลิงก์ embed ที่วางจากแอดมิน */
function extractMapUrl(input: string): string {
    if (!input) return '';

    let cleaned = input
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

    if (cleaned.trim().startsWith('https://www.google.com/maps')) {
        return cleaned.trim();
    }

    const patterns = [
        /src="([^"]+)"/,
        /src='([^']+)'/,
        /src=\\?"([^"\\]+)\\?"/,
        /src=\\?'([^'\\]+)\\?'/,
        /https:\/\/www\.google\.com\/maps\/embed[^"'\s<>]+/,
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            const url = match[1] || match[0];
            if (url.startsWith('http')) {
                return url;
            }
        }
    }

    return '';
}

function telHref(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : '#';
}

const FALLBACK_MAP_EMBED =
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.5463969499!2d100.5619!3d13.7374!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQ0JzE0LjYiTiAxMDDCsDMzJzQyLjgiRQ!5e0!3m2!1sth!2sth!4v1234567890';

export default function ContactContent({
    contactPhone,
    contactLine,
    contactLineUrl,
    contactEmail,
    contactAddress,
    mapEmbedUrl,
    mapLink,
}: ContactContentProps) {
    const { t } = useLanguage();
    const { showToast } = useToast();

    const cleanMapUrl = extractMapUrl(mapEmbedUrl);
    const iframeSrc = cleanMapUrl || FALLBACK_MAP_EMBED;

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(t('contact.copied_toast'), 'success');
        } catch {
            showToast(t('contact.copy'), 'warning');
        }
    };

    const channelCards = [
        {
            key: 'phone',
            icon: Phone,
            iconWrap: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
            title: t('contact.phone_title'),
            hint: t('contact.phone_hint'),
            body: (
                <a
                    href={telHref(contactPhone)}
                    className="group inline-flex items-center gap-1 text-lg font-bold text-zinc-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                    {contactPhone}
                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
            ),
            actions: (
                <button
                    type="button"
                    onClick={() => copyToClipboard(contactPhone)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:border-cyan-400/60 hover:text-cyan-600 transition-colors"
                >
                    <Copy className="h-3.5 w-3.5" />
                    {t('contact.copy')}
                </button>
            ),
        },
        {
            key: 'line',
            icon: MessageCircle,
            iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300',
            title: t('contact.line_title'),
            hint: t('contact.line_hint'),
            body: (
                <a
                    href={contactLineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1 text-lg font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                    {contactLine}
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                </a>
            ),
            actions: (
                <div className="flex flex-wrap gap-2">
                    <a
                        href={contactLineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                        {t('contact.chat_line')}
                    </a>
                    <button
                        type="button"
                        onClick={() => copyToClipboard(contactLine)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:border-cyan-400/60 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        {t('contact.copy')}
                    </button>
                </div>
            ),
        },
        {
            key: 'email',
            icon: Mail,
            iconWrap: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300',
            title: t('contact.email_title'),
            hint: t('contact.email_hint'),
            body: (
                <a
                    href={`mailto:${contactEmail}`}
                    className="group inline-flex items-center gap-1 break-all text-lg font-bold text-violet-700 dark:text-violet-300 hover:underline"
                >
                    {contactEmail}
                    <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
                </a>
            ),
            actions: (
                <button
                    type="button"
                    onClick={() => copyToClipboard(contactEmail)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:border-cyan-400/60 transition-colors"
                >
                    <Copy className="h-3.5 w-3.5" />
                    {t('contact.copy')}
                </button>
            ),
        },
        {
            key: 'address',
            icon: MapPin,
            iconWrap: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300',
            title: t('contact.address_title'),
            hint: t('contact.address_hint'),
            body: <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-200">{contactAddress}</p>,
            actions: (
                <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-600 transition-colors"
                >
                    <MapPinned className="h-3.5 w-3.5" />
                    {t('contact.navigate')}
                </a>
            ),
        },
    ];

    return (
        <div className="home-typography min-h-[70vh] bg-[var(--background)] font-sans">
            {/* Hero */}
            <header className="border-b border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-b from-cyan-50/80 via-zinc-50/50 to-transparent dark:from-cyan-950/25 dark:via-zinc-950/50 dark:to-transparent">
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
                    <nav aria-label="ตำแหน่งในหน้าเว็บ" className="mb-6">
                        <ol className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-500 dark:text-zinc-400">
                            <li>
                                <Link
                                    href="/"
                                    className="font-medium text-zinc-600 hover:text-cyan-600 underline-offset-4 hover:underline dark:text-zinc-300"
                                >
                                    {t('contact.breadcrumb_home')}
                                </Link>
                            </li>
                            <li aria-hidden className="text-zinc-300 dark:text-zinc-600">
                                /
                            </li>
                            <li className="font-semibold text-zinc-800 dark:text-zinc-100" aria-current="page">
                                {t('contact.breadcrumb_current')}
                            </li>
                        </ol>
                    </nav>
                    <p className="inline-block rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-950/50 dark:text-cyan-200 mb-4">
                        {t('contact.badge')}
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 dark:text-white text-balance tracking-tight">
                        {t('contact.title')}
                    </h1>
                    <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                        {t('contact.lead')}
                    </p>
                </div>
            </header>

            {/* Channels */}
            <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
                    {channelCards.map((card) => (
                        <article
                            key={card.key}
                            className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm transition-all hover:border-cyan-300/80 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-cyan-500/30"
                        >
                            <div className="flex items-start gap-3 mb-4">
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconWrap}`}>
                                    <card.icon className="h-5 w-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-bold text-zinc-900 dark:text-white">{card.title}</h2>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{card.hint}</p>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[3rem]">{card.body}</div>
                            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">{card.actions}</div>
                        </article>
                    ))}
                </div>

                {/* Map */}
                <div className="mt-14 sm:mt-20">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                                <MapPinned className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                                    {t('contact.map_title')}
                                </h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                                    {t('contact.map_lead')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
                        <div className="relative aspect-[16/10] min-h-[260px] w-full bg-zinc-100 dark:bg-zinc-800">
                            <iframe
                                title={t('contact.map_title')}
                                src={iframeSrc}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="absolute inset-0 h-full w-full"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                        <a
                            href={mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
                        >
                            <MapPin className="h-5 w-5" />
                            {t('contact.open_maps')}
                        </a>
                    </div>
                </div>

                {/* Footer nav */}
                <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 border-t border-zinc-200 dark:border-zinc-800 pt-10">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-zinc-600 hover:text-cyan-600 dark:text-zinc-400 dark:hover:text-cyan-400 transition-colors"
                    >
                        ← {t('contact.back_home')}
                    </Link>
                    <Link
                        href="/shop"
                        className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-cyan-500 bg-transparent px-6 py-2.5 text-sm font-bold text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40 transition-colors"
                    >
                        {t('contact.shop_cta')}
                    </Link>
                </div>
            </section>
        </div>
    );
}
