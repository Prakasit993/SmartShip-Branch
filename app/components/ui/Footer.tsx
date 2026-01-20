'use client';

import Link from 'next/link';
import CookieSettingsButton from '@app/components/ui/CookieSettingsButton';
import { useLanguage } from '@app/context/LanguageContext';

interface FooterProps {
    settings?: Record<string, string>;
}

export default function Footer({ settings = {} }: FooterProps) {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    // Helper to get setting with fallback
    const getVal = (key: string, fallback: string) => settings[key] || fallback;

    const contactPhone = getVal('contact_phone', '02-XXX-XXXX');
    const contactLine = getVal('contact_line', '@expressshop');
    const contactEmail = getVal('contact_email', 'contact@expressshop.com');
    const contactAddress = getVal('contact_address', 'กรุงเทพมหานคร, ประเทศไทย');
    const contactLineUrl = getVal('contact_line_url', 'https://line.me');
    const mapLink = getVal('map_link', 'https://maps.app.goo.gl/u8xZxi6XjyWpgm54A');
    const openingHours = getVal('contact_opening_hours', 'จ-ส 09:00 - 18:00');

    return (
        <footer className="bg-gradient-to-b from-zinc-900 to-black text-white py-16 px-4 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <div className="container mx-auto max-w-6xl relative z-10">
                {/* Main Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    {/* Brand Section */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-blue-900/40">
                                📦
                            </div>
                            <div>
                                <h3 className="font-bold text-xl">Express Shop</h3>
                                <p className="text-xs text-zinc-400">Premium Packing</p>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                            อุปกรณ์แพ็คกิ้งพรีเมียมและชุดบริการสำหรับความต้องการในการจัดส่งของคุณ
                        </p>

                        {/* Social Links */}
                        <div className="flex gap-3">
                            <a
                                href="https://facebook.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-blue-600 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-600/30"
                                aria-label="Facebook"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                                </svg>
                            </a>
                            <a
                                href={contactLineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-green-500 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-green-500/30"
                                aria-label="Line"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                </svg>
                            </a>
                            <a
                                href={mapLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/30"
                                aria-label="Google Maps"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-bold text-white mb-5 flex items-center gap-2">
                            <span className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-transparent rounded" />
                            ลิงก์ด่วน
                        </h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/shop" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    สินค้า
                                </Link>
                            </li>
                            <li>
                                <Link href="/track" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    ติดตามคำสั่งซื้อ
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    ติดต่อเรา
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-bold text-white mb-5 flex items-center gap-2">
                            <span className="w-8 h-0.5 bg-gradient-to-r from-purple-500 to-transparent rounded" />
                            กฎหมาย
                        </h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/cookie-policy" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    นโยบายคุกกี้
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy-policy" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    ความเป็นส่วนตัว
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    ข้อกำหนด
                                </Link>
                            </li>
                            <li className="pt-1">
                                <CookieSettingsButton />
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="font-bold text-white mb-5 flex items-center gap-2">
                            <span className="w-8 h-0.5 bg-gradient-to-r from-green-500 to-transparent rounded" />
                            ติดต่อ
                        </h4>
                        <ul className="space-y-4 text-sm">
                            <li className="flex items-start gap-3 text-zinc-400">
                                <span className="text-lg">📍</span>
                                <span>{contactAddress}</span>
                            </li>
                            <li className="flex items-center gap-3 text-zinc-400">
                                <span className="text-lg">📞</span>
                                <span>{contactPhone}</span>
                            </li>
                            <li className="flex items-center gap-3 text-zinc-400">
                                <span className="text-lg">✉️</span>
                                <span>{contactEmail}</span>
                            </li>
                            <li className="flex items-center gap-3 text-zinc-400">
                                <span className="text-lg">🕐</span>
                                <span>{openingHours}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-zinc-500">
                        © {currentYear} Express Shop. สงวนลิขสิทธิ์
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <span>Made with</span>
                        <span className="text-red-500 animate-pulse">❤️</span>
                        <span>in Thailand</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
