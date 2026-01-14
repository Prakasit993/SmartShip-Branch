'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Send, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { submitQuoteRequest } from './actions';

import { useLanguage } from '@app/context/LanguageContext';

export default function QuoteForm() {
    const router = useRouter();
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        setError('');

        try {
            const result = await submitQuoteRequest(formData);
            if (result.success) {
                setSubmitted(true);
            } else {
                setError(result.error || 'Something went wrong. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">{t('quote.success_title')}</h2>
                <p className="text-zinc-600 max-w-md">
                    {t('quote.success_msg')}
                </p>
                <Link
                    href="/"
                    className="mt-6 text-black dark:text-white font-medium hover:underline inline-flex items-center"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('quote.back')}
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg border border-zinc-100 dark:border-zinc-700">
            <div className="mb-8 border-b border-zinc-100 dark:border-zinc-700 pb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="w-6 h-6 text-black dark:text-white" />
                    {t('quote.title')}
                </h1>
                <p className="text-zinc-500 mt-2">
                    {t('quote.desc')}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6 text-sm">
                    {error}
                </div>
            )}

            <form action={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="companyName" className="text-sm font-medium">{t('quote.business_name')}</label>
                        <input
                            type="text"
                            name="companyName"
                            className="w-full px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-transparent"
                            placeholder="e.g. SmartShip Co."
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="contactName" className="text-sm font-medium">{t('quote.contact_name')} *</label>
                        <input
                            type="text"
                            name="contactName"
                            required
                            className="w-full px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-transparent"
                            placeholder="Your Name"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">{t('quote.phone')} *</label>
                    <input
                        type="tel"
                        name="phone"
                        required
                        className="w-full px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-transparent"
                        placeholder="0XX-XXX-XXXX"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="details" className="text-sm font-medium">{t('quote.details')} *</label>
                    <textarea
                        name="details"
                        required
                        rows={4}
                        className="w-full px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-transparent resize-none"
                        placeholder="e.g. 50 Ceramic mugs, fragile, about 5kg total weight."
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-md font-bold hover:opacity-80 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? t('quote.sending') : t('quote.submit')}
                    {!isSubmitting && <Send className="w-4 h-4" />}
                </button>
            </form>
        </div>
    );
}
