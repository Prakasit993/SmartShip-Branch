'use client';

import { useLanguage } from '@app/context/LanguageContext';
import PolicyLayout from '@app/components/ui/PolicyLayout';

export default function PrivacyPolicyPage() {
    const { language } = useLanguage();

    const lastUpdated = language === 'th' ? '14 มกราคม 2569' : 'January 14, 2026';

    return (
        <PolicyLayout
            breadcrumb={language === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
            labTag="// PRIVACY.V1"
            title={language === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
            lastUpdated={language === 'th' ? `อัปเดตล่าสุด: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
            lead={
                language === 'th'
                    ? 'NYXEL เคารพความเป็นส่วนตัวของคุณ — เอกสารนี้อธิบายข้อมูลที่เราเก็บ วิธีที่เราใช้ และสิทธิ์ของคุณภายใต้ PDPA'
                    : 'NYXEL respects your privacy. This page explains what we collect, how we use it, and your rights under PDPA.'
            }
            versionMark="PDPA · V.1 · 2026.01"
            homeLabel={language === 'th' ? 'หน้าแรก' : 'Home'}
        >
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
                                เราจะไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนบุคคลของคุณให้แก่บุคคลที่สาม ยกเว้นเพื่อวัตถุประสงค์ในการจัดส่งสินค้า (เช่น J&T Express) หรือตามที่กฎหมายกำหนด
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
                                หากมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อทีม NYXEL ผ่านหน้า{' '}
                                <a href="/contact" className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold">ติดต่อเรา</a>{' '}
                                หรือ LINE ตามที่ระบุในหน้าติดต่อ
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
                                We do not sell, trade, or share your personal information with third parties except for delivery purposes (e.g. J&T Express) or as required by law.
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
                                If you have questions about this Privacy Policy, please reach out via the{' '}
                                <a href="/contact" className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold">Contact</a>{' '}
                                page or LINE channel listed there.
                            </p>
                        </section>
                    </>
                )}
            </div>
        </PolicyLayout>
    );
}
