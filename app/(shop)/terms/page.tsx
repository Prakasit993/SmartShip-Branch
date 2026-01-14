'use client';

import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';

export default function TermsPage() {
    const { language } = useLanguage();

    const lastUpdated = language === 'th' ? '14 มกราคม 2569' : 'January 14, 2026';

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 py-12 px-4 font-sans">
            <div className="container mx-auto max-w-3xl">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                        {language === 'th' ? 'ข้อกำหนดและเงื่อนไข' : 'Terms of Service'}
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
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. การยอมรับข้อกำหนด</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    การใช้บริการเว็บไซต์ Express Shop ถือว่าคุณยอมรับและตกลงที่จะปฏิบัติตามข้อกำหนดและเงื่อนไขเหล่านี้ หากคุณไม่เห็นด้วยกับข้อกำหนดใดๆ กรุณาหยุดใช้บริการ
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. การสั่งซื้อและชำระเงิน</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>ราคาสินค้าแสดงเป็นสกุลเงินบาท (฿) และรวมภาษีมูลค่าเพิ่มแล้ว</li>
                                    <li>เรารับชำระเงินผ่านการโอนเงินธนาคาร, พร้อมเพย์ และชำระเงินที่ร้าน</li>
                                    <li>คำสั่งซื้อจะได้รับการยืนยันหลังจากตรวจสอบการชำระเงินเรียบร้อยแล้ว</li>
                                    <li>เราสงวนสิทธิ์ในการยกเลิกคำสั่งซื้อหากพบความผิดปกติ</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. การจัดส่งสินค้า</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>ระยะเวลาจัดส่งโดยประมาณ 1-3 วันทำการ</li>
                                    <li>ค่าจัดส่งคำนวณตามน้ำหนักและปลายทาง</li>
                                    <li>กรุณาตรวจสอบสินค้าก่อนลงนามรับ หากพบความเสียหายให้ปฏิเสธรับสินค้า</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. การคืนสินค้าและการคืนเงิน</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>รับคืนสินค้าภายใน 7 วันหลังได้รับสินค้า</li>
                                    <li>สินค้าต้องอยู่ในสภาพสมบูรณ์ ไม่ถูกใช้งาน และมีบรรจุภัณฑ์ครบ</li>
                                    <li>การคืนเงินจะดำเนินการภายใน 7-14 วันทำการ</li>
                                    <li>ค่าจัดส่งคืนสินค้าเป็นความรับผิดชอบของลูกค้า ยกเว้นกรณีสินค้าชำรุด</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. ทรัพย์สินทางปัญญา</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    เนื้อหา รูปภาพ โลโก้ และทรัพย์สินทางปัญญาทั้งหมดบนเว็บไซต์นี้เป็นของ Express Shop ห้ามคัดลอก ดัดแปลง หรือนำไปใช้โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. ข้อจำกัดความรับผิดชอบ</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    เราไม่รับผิดชอบต่อความเสียหายทางอ้อม ความเสียหายพิเศษ หรือความเสียหายที่เป็นผลสืบเนื่องจากการใช้บริการ ยกเว้นที่กฎหมายกำหนด
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">7. การเปลี่ยนแปลงข้อกำหนด</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    เราสงวนสิทธิ์ในการเปลี่ยนแปลงข้อกำหนดเหล่านี้ได้ตลอดเวลา การเปลี่ยนแปลงจะมีผลทันทีเมื่อเผยแพร่บนเว็บไซต์
                                </p>
                            </section>
                        </>
                    ) : (
                        <>
                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    By using Express Shop website, you agree to comply with and be bound by these Terms of Service. If you do not agree to any terms, please stop using our services.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. Orders and Payment</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Prices are displayed in Thai Baht (฿) and include VAT</li>
                                    <li>We accept bank transfer, PromptPay, and in-store payment</li>
                                    <li>Orders are confirmed after payment verification</li>
                                    <li>We reserve the right to cancel orders if irregularities are detected</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. Shipping</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Estimated delivery time is 1-3 business days</li>
                                    <li>Shipping costs are calculated based on weight and destination</li>
                                    <li>Please inspect items before signing. Refuse delivery if damaged</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. Returns and Refunds</h2>
                                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                                    <li>Returns accepted within 7 days of delivery</li>
                                    <li>Items must be unused, in original condition with packaging</li>
                                    <li>Refunds processed within 7-14 business days</li>
                                    <li>Return shipping costs are the customer's responsibility, except for defective items</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. Intellectual Property</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    All content, images, logos, and intellectual property on this website belong to Express Shop. Copying, modifying, or using without written permission is prohibited.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. Limitation of Liability</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    We are not liable for indirect, special, or consequential damages arising from the use of our services, except as required by law.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">7. Changes to Terms</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    We reserve the right to modify these terms at any time. Changes take effect immediately upon posting on the website.
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
