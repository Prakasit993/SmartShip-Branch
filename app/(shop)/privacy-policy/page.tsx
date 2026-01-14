'use client';

import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
    const { language } = useLanguage();

    const lastUpdated = language === 'th' ? '14 มกราคม 2569' : 'January 14, 2026';

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 py-12 px-4 font-sans">
            <div className="container mx-auto max-w-3xl">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                        {language === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        {language === 'th' ? `อัปเดตล่าสุด: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
                    </p>
                </div>

                {/* Content */}
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                    {language === 'th' ? (
                        <>
                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. ข้อมูลที่เรารวบรวม</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    เราอาจรวบรวมข้อมูลส่วนบุคคลของคุณเมื่อคุณใช้บริการของเรา รวมถึง:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>ชื่อ-นามสกุล และข้อมูลติดต่อ (อีเมล, เบอร์โทรศัพท์)</li>
                                    <li>ที่อยู่สำหรับจัดส่งสินค้า</li>
                                    <li>ข้อมูลการสั่งซื้อและประวัติการทำธุรกรรม</li>
                                    <li>ข้อมูลการใช้งานเว็บไซต์ (Cookies, IP Address)</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. การใช้ข้อมูล</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    เราใช้ข้อมูลของคุณเพื่อ:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>ดำเนินการจัดส่งสินค้าตามคำสั่งซื้อ</li>
                                    <li>ติดต่อสื่อสารเกี่ยวกับสถานะคำสั่งซื้อ</li>
                                    <li>ปรับปรุงบริการและประสบการณ์การใช้งาน</li>
                                    <li>ส่งข้อมูลโปรโมชั่น (เฉพาะเมื่อได้รับความยินยอม)</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. การเปิดเผยข้อมูล</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    เราจะไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนบุคคลของคุณให้แก่บุคคลที่สาม ยกเว้นเพื่อวัตถุประสงค์ในการจัดส่งสินค้า หรือตามที่กฎหมายกำหนด
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. ความปลอดภัยของข้อมูล</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    เรามีมาตรการรักษาความปลอดภัยที่เหมาะสมเพื่อปกป้องข้อมูลส่วนบุคคลของคุณจากการเข้าถึงโดยไม่ได้รับอนุญาต การเปลี่ยนแปลง หรือการสูญหาย
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. สิทธิ์ของคุณ</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณมีสิทธิ์:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>ขอเข้าถึงข้อมูลส่วนบุคคลของคุณ</li>
                                    <li>ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                                    <li>ขอลบข้อมูลส่วนบุคคล</li>
                                    <li>ถอนความยินยอมในการประมวลผลข้อมูล</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. ติดต่อเรา</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    หากมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อ: <a href="mailto:privacy@expressshop.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@expressshop.com</a>
                                </p>
                            </section>
                        </>
                    ) : (
                        <>
                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. Information We Collect</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    We may collect personal information when you use our services, including:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Name and contact information (email, phone number)</li>
                                    <li>Shipping address</li>
                                    <li>Order and transaction history</li>
                                    <li>Website usage data (Cookies, IP Address)</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. How We Use Your Information</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    We use your information to:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Process and deliver your orders</li>
                                    <li>Communicate about order status</li>
                                    <li>Improve our services and user experience</li>
                                    <li>Send promotional information (with consent only)</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. Information Sharing</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    We do not sell, trade, or share your personal information with third parties except for delivery purposes or as required by law.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. Data Security</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or loss.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. Your Rights</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                    Under applicable data protection laws, you have the right to:
                                </p>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Access your personal data</li>
                                    <li>Request correction of inaccurate data</li>
                                    <li>Request deletion of your data</li>
                                    <li>Withdraw consent for data processing</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. Contact Us</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    If you have questions about this Privacy Policy, please contact: <a href="mailto:privacy@expressshop.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@expressshop.com</a>
                                </p>
                            </section>
                        </>
                    )}
                </div>

                {/* Back Link */}
                <div className="mt-10 text-center">
                    <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                        ← {language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
                    </Link>
                </div>
            </div>
        </div>
    );
}
