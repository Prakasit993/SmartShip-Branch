'use client';

import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';
import { Package, Truck, ShieldCheck, ArrowRight } from 'lucide-react';

export default function BusinessPackingSection() {
    const { t } = useLanguage();

    return (
        <section className="w-full home-section-y bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 lg:gap-12">

                    {/* Minimal Left Content */}
                    <div className="space-y-4 sm:space-y-6 max-w-2xl w-full">
                        <h2 className="home-type-packing-title font-light tracking-tight text-black dark:text-white text-balance">
                            {t('packing.title')}
                        </h2>
                        <p className="home-type-packing-lead text-zinc-600 dark:text-zinc-400 font-light text-pretty">
                            {t('packing.subtitle')}
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 pt-2 sm:pt-4">
                            <Link
                                href="/shop/packing-quote"
                                className="group inline-flex min-h-11 items-center text-sm font-medium text-zinc-900 dark:text-white border-b border-zinc-900 dark:border-white pb-0.5 hover:opacity-70 transition-opacity"
                            >
                                {t('packing.cta_quote')}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                            <Link
                                href="/shop"
                                className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                            >
                                {t('packing.cta_view')}
                            </Link>
                        </div>
                    </div>

                    {/* Minimal Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full lg:w-auto lg:max-w-xl xl:max-w-2xl shrink-0">
                        <div className="flex flex-col gap-2 sm:gap-3 p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <Package className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="home-type-feature-label font-medium text-zinc-900 dark:text-white">{t('packing.feature_materials')}</span>
                        </div>
                        <div className="flex flex-col gap-2 sm:gap-3 p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <ShieldCheck className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="home-type-feature-label font-medium text-zinc-900 dark:text-white">{t('packing.feature_protection')}</span>
                        </div>
                        <div className="flex flex-col gap-2 sm:gap-3 p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-sm transition-all">
                            <Truck className="h-6 w-6 text-zinc-700 dark:text-white stroke-[1.5]" />
                            <span className="home-type-feature-label font-medium text-zinc-900 dark:text-white">{t('packing.feature_bulk')}</span>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
