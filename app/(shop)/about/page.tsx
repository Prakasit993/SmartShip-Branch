'use client';

import { Package, Truck, Shield, Users, Star, Clock } from 'lucide-react';
import { useLanguage } from '@app/context/LanguageContext';
import Link from 'next/link';

export default function AboutPage() {
    const { language } = useLanguage();

    const features = [
        {
            icon: Package,
            titleEn: 'Premium Quality',
            titleTh: 'คุณภาพพรีเมียม',
            descEn: 'We source only the best packing materials for your shipping needs.',
            descTh: 'เราคัดสรรวัสดุบรรจุภัณฑ์คุณภาพดีที่สุดสำหรับการจัดส่งของคุณ',
            color: 'blue'
        },
        {
            icon: Truck,
            titleEn: 'Fast Delivery',
            titleTh: 'จัดส่งรวดเร็ว',
            descEn: 'Quick dispatch and reliable delivery across Thailand.',
            descTh: 'ส่งของไวและจัดส่งได้ทุกที่ทั่วประเทศไทย',
            color: 'green'
        },
        {
            icon: Shield,
            titleEn: 'Secure Packaging',
            titleTh: 'แพ็คแน่นหนา',
            descEn: 'Professional packing ensures your items arrive safely.',
            descTh: 'การแพ็คอย่างมืออาชีพรับประกันของถึงมือลูกค้าอย่างปลอดภัย',
            color: 'purple'
        },
        {
            icon: Users,
            titleEn: 'Expert Support',
            titleTh: 'ทีมงานเชี่ยวชาญ',
            descEn: 'Our team is ready to help you with any questions.',
            descTh: 'ทีมงานพร้อมให้คำปรึกษาและแก้ปัญหาทุกข้อสงสัย',
            color: 'cyan'
        }
    ];

    const stats = [
        { value: '5,000+', labelEn: 'Happy Customers', labelTh: 'ลูกค้าที่พึงพอใจ' },
        { value: '10,000+', labelEn: 'Orders Shipped', labelTh: 'ออเดอร์ที่จัดส่ง' },
        { value: '99%', labelEn: 'Satisfaction Rate', labelTh: 'อัตราความพึงพอใจ' },
        { value: '24/7', labelEn: 'LINE Support', labelTh: 'ซัพพอร์ตผ่าน LINE' }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
            {/* Hero Section */}
            <section className="py-16 px-4 bg-gradient-to-br from-blue-50 to-white dark:from-zinc-900 dark:to-zinc-950">
                <div className="container mx-auto max-w-4xl text-center">
                    <h1 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6">
                        {language === 'th' ? 'เกี่ยวกับ Express Shop' : 'About Express Shop'}
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        {language === 'th'
                            ? 'เราคือผู้เชี่ยวชาญด้านอุปกรณ์แพ็คกิ้งและบริการจัดส่ง ให้บริการธุรกิจและบุคคลทั่วไปด้วยสินค้าคุณภาพและบริการที่เป็นเลิศ'
                            : 'We are experts in packing supplies and shipping services, serving businesses and individuals with quality products and excellent service.'}
                    </p>
                </div>
            </section>

            {/* Story Section */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-6">
                                {language === 'th' ? 'เรื่องราวของเรา' : 'Our Story'}
                            </h2>
                            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                <p>
                                    {language === 'th'
                                        ? 'Express Shop ก่อตั้งขึ้นในปี 2567 ด้วยเป้าหมายเดียว - ทำให้การแพ็คและจัดส่งเป็นเรื่องง่ายสำหรับทุกคน'
                                        : 'Express Shop was founded in 2024 with one goal - to make packing and shipping easy for everyone.'}
                                </p>
                                <p>
                                    {language === 'th'
                                        ? 'จากประสบการณ์ในธุรกิจโลจิสติกส์มากกว่า 10 ปี เราเข้าใจความท้าทายที่ผู้ขายออนไลน์และธุรกิจต้องเผชิญในเรื่องการบรรจุภัณฑ์'
                                        : 'With over 10 years of experience in logistics, we understand the packaging challenges that online sellers and businesses face.'}
                                </p>
                                <p>
                                    {language === 'th'
                                        ? 'วันนี้ เราให้บริการลูกค้ามากกว่า 5,000 รายทั่วประเทศ และมุ่งมั่นที่จะเป็นพาร์ทเนอร์ด้านการจัดส่งที่คุณไว้วางใจได้'
                                        : 'Today, we serve over 5,000 customers nationwide and are committed to being your trusted shipping partner.'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-3xl p-8 text-center">
                            <div className="text-6xl mb-4">📦</div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">SmartShip</h3>
                            <p className="text-zinc-500 dark:text-zinc-400">
                                {language === 'th' ? 'แพ็ค. ส่ง. เสร็จ.' : 'Pack. Ship. Done.'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 px-4 bg-zinc-50 dark:bg-zinc-900">
                <div className="container mx-auto max-w-4xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white text-center mb-12">
                        {language === 'th' ? 'ทำไมต้องเลือกเรา' : 'Why Choose Us'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            const colorClasses: Record<string, string> = {
                                blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                                green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                                purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                                cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                            };
                            return (
                                <div key={index} className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700">
                                    <div className={`w-12 h-12 rounded-xl ${colorClasses[feature.color]} flex items-center justify-center mb-4`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">
                                        {language === 'th' ? feature.titleTh : feature.titleEn}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {language === 'th' ? feature.descTh : feature.descEn}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 px-4 bg-zinc-900 dark:bg-black">
                <div className="container mx-auto max-w-4xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {stats.map((stat, index) => (
                            <div key={index}>
                                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                                <div className="text-sm text-zinc-400">
                                    {language === 'th' ? stat.labelTh : stat.labelEn}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                        {language === 'th' ? 'พร้อมเริ่มต้นหรือยัง?' : 'Ready to Get Started?'}
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                        {language === 'th'
                            ? 'เลือกดูสินค้าและบริการของเราได้เลย'
                            : 'Browse our products and services today.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/shop" className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-colors">
                            {language === 'th' ? 'ดูสินค้า' : 'Shop Now'}
                        </Link>
                        <Link href="/contact" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold py-3 px-8 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            {language === 'th' ? 'ติดต่อเรา' : 'Contact Us'}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Back Link */}
            <div className="py-8 text-center">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                    ← {language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
                </Link>
            </div>
        </div>
    );
}
