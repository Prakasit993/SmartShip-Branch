'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { useLanguage } from '@app/context/LanguageContext';

export default function ProductSearch() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();
    const { t } = useLanguage();

    const [term, setTerm] = useState(searchParams.get('q') || '');

    // Debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            const params = new URLSearchParams(searchParams);
            if (term) {
                params.set('q', term);
            } else {
                params.delete('q');
            }
            startTransition(() => {
                replace(`${pathname}?${params.toString()}`);
            });
        }, 300);

        return () => clearTimeout(handler);
    }, [term, pathname, replace, searchParams]);

    return (
        <div className="relative w-full max-w-md mx-auto mb-8">
            <div className="relative">
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    placeholder={t('search.placeholder') || 'Search products...'}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                {isPending && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
