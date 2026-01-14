'use client';

import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';
import { Package, Truck, ShieldCheck, ArrowRight } from 'lucide-react';

export default function BusinessPackingSection() {
    const { t } = useLanguage();

    return (
        <section className="w-full py-24 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-12">

                    {/* Minimal Left Content */}
                    <div className="space-y-6 max-w-2xl">
                        <h2 className="text-3xl font-light tracking-tight text-black dark:text-white sm:text-4xl">
                            {t('packing.title')}
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed font-light">
                            {t('packing.subtitle')}
                        </p>

                        <div className="flex items-center gap-6 pt-4">
                            <Link
                                href="/shop/packing-quote"
                                className="group flex items-center text-sm font-medium text-zinc-900 dark:text-white border-b border-zinc-900 dark:border-white pb-0.5 hover:opacity-70 transition-opacity"
                            >
                                {t('packing.cta_quote')}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                            <Link
                                href="/shop"
                                className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                            >
                                {t('packing.cta_view')}
                            </Link>
                        </div>
                    </div>

                    {/* Minimal Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full md:w-auto">
                        <div className="flex flex-col gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <Package className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('packing.feature_materials')}</span>
                        </div>
                        <div className="flex flex-col gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <ShieldCheck className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('packing.feature_protection')}</span>
                        </div>
                        <div className="flex flex-col gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <Truck className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('packing.feature_bulk')}</span>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
