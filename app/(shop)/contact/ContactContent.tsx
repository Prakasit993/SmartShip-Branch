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
import NyxelCard from '@app/components/ui/NyxelCard';

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

    /**
     * 4 contact channels — each rendered inside a NyxelCard.
     * Icon background uses cyan to stay unified with NYXEL palette.
     * subLabel acts as the channel identifier (PHONE / LINE / EMAIL / ADDRESS).
     */
    const channelCards = [
        {
            key: 'phone',
            subLabel: 'PHONE',
            icon: Phone,
            title: t('contact.phone_title'),
            hint: t('contact.phone_hint'),
            body: (
                <a
                    href={telHref(contactPhone)}
                    className="group/link inline-flex items-center gap-1 text-lg font-bold text-zinc-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors break-all"
                >
                    {contactPhone}
                    <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
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
            subLabel: 'LINE',
            icon: MessageCircle,
            title: t('contact.line_title'),
            hint: t('contact.line_hint'),
            body: (
                <a
                    href={contactLineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link inline-flex items-center gap-1 text-lg font-bold text-zinc-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors break-all"
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
            subLabel: 'EMAIL',
            icon: Mail,
            title: t('contact.email_title'),
            hint: t('contact.email_hint'),
            body: (
                <a
                    href={`mailto:${contactEmail}`}
                    className="group/link inline-flex items-center gap-1 break-all text-lg font-bold text-zinc-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                    {contactEmail}
                    <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
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
            subLabel: 'ADDRESS',
            icon: MapPin,
            title: t('contact.address_title'),
            hint: t('contact.address_hint'),
            body: (
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-200 break-words">
                    {contactAddress}
                </p>
            ),
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
            {/* Hero — lab-style header matching home FAQ + Services */}
            <header className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                {/* Ambient blobs */}
                <div className="hidden md:block absolute top-0 -left-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" aria-hidden />
                <div className="hidden md:block absolute bottom-0 -right-32 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl" aria-hidden />

                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
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

                    {/* Lab-style pill */}
                    <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-bold tracking-[0.25em] uppercase mb-5 ring-1 ring-cyan-500/30 shadow-[0_0_24px_-8px_rgb(34_211_238/0.5)]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        // CONTACT.LOG
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 dark:text-white text-balance tracking-tight">
                        {t('contact.title')}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                        {t('contact.lead')}
                    </p>

                    {/* Dashed accent line — matches FAQ "08 ENTRIES" */}
                    <div className="mt-5 flex items-center gap-3">
                        <span className="h-px w-12 bg-cyan-500/40" />
                        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-600 dark:text-cyan-400">
                            04 CHANNELS
                        </span>
                        <span className="h-px w-12 bg-cyan-500/40" />
                    </div>
                </div>
            </header>

            {/* Channels — NyxelCard grid */}
            <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
                    {channelCards.map((card, idx) => {
                        const Icon = card.icon;
                        return (
                            <NyxelCard
                                key={card.key}
                                variant="lab"
                                index={idx + 1}
                                subLabel={card.subLabel}
                                subLabelTag="NYXEL // CONTACT"
                            >
                                {/* Icon + title row */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/30 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-300">
                                        <Icon className="h-5 w-5" strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base">
                                            {card.title}
                                        </h2>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            {card.hint}
                                        </p>
                                    </div>
                                </div>

                                {/* Cyan divider — grows on hover */}
                                <div className="h-px w-10 bg-cyan-500/30 group-hover:w-20 group-hover:bg-cyan-500/60 transition-all duration-500 mb-3" aria-hidden />

                                {/* Body (the actual contact value) */}
                                <div className="mb-4 min-h-[2.5rem]">{card.body}</div>

                                {/* Actions */}
                                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    {card.actions}
                                </div>
                            </NyxelCard>
                        );
                    })}
                </div>

                {/* Map */}
                <div className="mt-14 sm:mt-20">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-600 dark:text-cyan-400">
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
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all"
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
