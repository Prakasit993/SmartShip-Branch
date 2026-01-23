'use client';

import { Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';

interface ContactContentProps {
    contactPhone: string;
    contactLine: string;
    contactLineUrl: string;
    contactEmail: string;
    contactAddress: string;
    mapEmbedUrl: string;
    mapLink: string;
}

// Helper to extract src from iframe HTML if user pasted full iframe code
function extractMapUrl(input: string): string {
    if (!input) return '';

    // First, unescape HTML entities that might be in the string
    let cleaned = input
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\\"/g, '"')  // Handle escaped quotes
        .replace(/\\\\/g, '\\'); // Handle double escaped backslashes

    // If it's already a clean URL starting with https
    if (cleaned.trim().startsWith('https://www.google.com/maps')) {
        return cleaned.trim();
    }

    // Try to extract src from iframe tag with various quote patterns
    const patterns = [
        /src="([^"]+)"/,
        /src='([^']+)'/,
        /src=\\?"([^"\\]+)\\?"/,
        /src=\\?'([^'\\]+)\\?'/,
        /https:\/\/www\.google\.com\/maps\/embed[^"'\s<>]+/
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

export default function ContactContent({
    contactPhone,
    contactLine,
    contactLineUrl,
    contactEmail,
    contactAddress,
    mapEmbedUrl,
    mapLink
}: ContactContentProps) {
    const { language } = useLanguage();

    // Extract clean URL from mapEmbedUrl
    const cleanMapUrl = extractMapUrl(mapEmbedUrl);

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 py-12 px-4 font-sans">
            <div className="container mx-auto max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                        {language === 'th' ? 'ติดต่อเรา' : 'Contact Us'}
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        {language === 'th'
                            ? 'มีคำถามหรือต้องการความช่วยเหลือ? ติดต่อเราได้หลายช่องทาง'
                            : 'Have questions or need assistance? Reach out to us through any of our channels.'}
                    </p>
                </div>

                {/* Contact Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {/* Phone */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">
                                    {language === 'th' ? 'โทรศัพท์' : 'Phone'}
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {language === 'th' ? 'จันทร์-เสาร์ 9:00-18:00' : 'Mon-Sat 9:00-18:00'}
                                </p>
                            </div>
                        </div>
                        <a href={`tel:${contactPhone.replace(/-/g, '')}`} className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:underline">
                            {contactPhone}
                        </a>
                    </div>

                    {/* LINE */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">LINE</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {language === 'th' ? 'ตอบกลับภายใน 24 ชม.' : 'Reply within 24 hrs'}
                                </p>
                            </div>
                        </div>
                        <a href={contactLineUrl} target="_blank" rel="noopener noreferrer" className="text-xl font-bold text-green-600 dark:text-green-400 hover:underline">
                            {contactLine}
                        </a>
                    </div>

                    {/* Email */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">Email</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {language === 'th' ? 'สอบถามทั่วไป' : 'General inquiries'}
                                </p>
                            </div>
                        </div>
                        <a href={`mailto:${contactEmail}`} className="text-xl font-bold text-purple-600 dark:text-purple-400 hover:underline break-all">
                            {contactEmail}
                        </a>
                    </div>

                    {/* Address */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                <MapPin className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">
                                    {language === 'th' ? 'ที่อยู่ร้าน' : 'Store Address'}
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {language === 'th' ? 'มารับสินค้าได้ที่ร้าน' : 'Pick up available'}
                                </p>
                            </div>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300">
                            {contactAddress}
                        </p>
                    </div>
                </div>

                {/* Google Map */}
                <div className="mb-12">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 text-center">
                        {language === 'th' ? '📍 ที่ตั้งร้าน' : '📍 Store Location'}
                    </h2>
                    <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg">
                        <iframe
                            src={cleanMapUrl || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.5463969499!2d100.5619!3d13.7374!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQ0JzE0LjYiTiAxMDDCsDMzJzQyLjgiRQ!5e0!3m2!1sth!2sth!4v1234567890"}
                            width="100%"
                            height="350"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="w-full"
                        ></iframe>
                    </div>
                    <div className="text-center mt-4">
                        <a
                            href={mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors shadow-lg"
                        >
                            <MapPin className="w-5 h-5" />
                            {language === 'th' ? 'เปิดดูใน Google Maps' : 'Open in Google Maps'}
                        </a>
                    </div>
                </div>

                {/* Back Link */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                        ← {language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
                    </Link>
                </div>
            </div>
        </div>
    );
}
