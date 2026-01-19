'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'th';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<string, Record<Language, string>> = {
    // Navigation
    'nav.catalog': { en: 'Catalog', th: 'สินค้าทั้งหมด' },
    'nav.track': { en: 'Track Order', th: 'ติดตามคำสั่งซื้อ' },
    'nav.cart': { en: 'Cart', th: 'ตะกร้า' },

    // Hero (Static buttons)
    'hero.shop_now': { en: 'Shop Bundles', th: 'เลือกซื้อสินค้า' },
    'hero.view_all': { en: 'View All Products', th: 'ดูสินค้าทั้งหมด' },
    'home.featured': { en: 'Featured Sets', th: 'สินค้ายอดนิยม' },

    // Business Packing Section
    'packing.title': { en: 'Professional Business Packing', th: 'บริการแพ็คสินค้าระดับมืออาชีพ' },
    'packing.subtitle': { en: 'Elevate your brand with our premium packing services. We handle the boxing, protection, and sealing so you can focus on scaling your business.', th: 'ยกระดับแบรนด์ของคุณด้วยบริการแพ็คสินค้าพรีเมียม เราดูแลทั้งการบรรจุและห่อกันกระแทก เพื่อให้คุณโฟกัสกับการเติบโตของธุรกิจ' },
    'packing.cta_quote': { en: 'Request a Quote', th: 'ขอใบเสนอราคา' },
    'packing.cta_view': { en: 'View Packing Materials', th: 'ดูอุปกรณ์แพ็คกิ้ง' },
    'packing.feature_materials': { en: 'Premium Materials', th: 'วัสดุเกรดพรีเมียม' },
    'packing.feature_protection': { en: 'Secure Protection', th: 'ห่อกันกระแทกแน่นหนา' },
    'packing.feature_bulk': { en: 'Bulk Shipping', th: 'รองรับจำนวนมาก' },
    'packing.card_title': { en: 'SmartShip Packing Station', th: 'จุดบริการแพ็ค SmartShip' },
    'packing.card_desc': { en: 'We use industry-standard techniques to ensure your products arrive safely and professionally presented.', th: 'เราใช้เทคนิคมาตรฐานอุตสาหกรรม เพื่อให้สินค้าถึงมือลูกค้าอย่างปลอดภัยและสวยงาม' },

    // Quote Form
    'quote.title': { en: 'Request Packing Quote', th: 'ขอใบเสนอราคาบริการแพ็ค' },
    'quote.desc': { en: 'Tell us about your items and we will provide a custom packing solution.', th: 'แจ้งรายละเอียดสินค้าของคุณ เพื่อให้เรานำเสนอโซลูชั่นการแพ็คที่เหมาะสม' },
    'quote.business_name': { en: 'Business / Company Name', th: 'ชื่อร้านค้า / บริษัท' },
    'quote.contact_name': { en: 'Contact Person', th: 'ชื่อผู้ติดต่อ' },
    'quote.phone': { en: 'Phone Number', th: 'เบอร์โทรศัพท์' },
    'quote.details': { en: 'Item Details (Type, Quantity, Weight)', th: 'รายละเอียดสินค้า (ประเภท, จำนวน, น้ำหนัก)' },
    'quote.submit': { en: 'Submit Request', th: 'ส่งคำขอ' },
    'quote.sending': { en: 'Sending...', th: 'กำลังส่ง...' },
    'quote.success_title': { en: 'Request Sent!', th: 'ส่งคำขอเรียบร้อย!' },
    'quote.success_msg': { en: 'Thank you for confirming your interest. We have received your packing request and will contact you shortly via the provided phone number.', th: 'ขอบคุณที่สนใจบริการของเรา เราได้รับข้อมูลเรียบร้อยแล้วและจะติดต่อกลับโดยเร็วที่สุด' },
    'quote.back': { en: 'Back to Home', th: 'กลับหน้าหลัก' },

    // Features (Static)
    'feature.fast.title': { en: 'Fast Service', th: 'บริการรวดเร็ว' },
    'feature.fast.desc': { en: 'Order online and your items will be ready when you arrive.', th: 'สั่งออนไลน์ล่วงหน้า ของพร้อมรับเมื่อมาถึงร้าน' },
    'feature.quality.title': { en: 'Quality Assured', th: 'รับประกันคุณภาพ' },
    'feature.quality.desc': { en: 'We carefully select the best packaging materials for shipping.', th: 'เราคัดสรรวัสดุบรรจุภัณฑ์ที่ดีที่สุดสำหรับการขนส่ง' },
    'feature.support.title': { en: 'Support', th: 'บริการลูกค้า' },
    'feature.support.desc': { en: 'Need help? Chat with us via LINE or ask for a recommendation.', th: 'ต้องการความช่วยเหลือ? ทัก LINE หาเราได้เลย' },

    // Shop & Product
    'shop.title': { en: 'Product Catalog', th: 'รายการสินค้า' },
    'shop.back': { en: 'Back to Catalog', th: 'กลับไปหน้าสินค้า' },
    'product.no_description': { en: 'No description available for this set.', th: 'ไม่มีคำอธิบายเพิ่มเติมสำหรับสินค้านี้' },
    'product.included_items': { en: 'Included Items', th: 'สินค้าในชุด' },
    'product.option_required': { en: '* Required', th: '* จำเป็นต้องเลือก' },
    'product.in_stock': { en: 'In Stock', th: 'มีสินค้า' },
    'product.out_of_stock': { en: 'Out of Stock', th: 'สินค้าหมด' },
    'product.buy_now': { en: 'Buy Now', th: 'ซื้อเลย' },
    'product.add_to_cart': { en: 'Add to Cart', th: 'หยิบใส่ตะกร้า' },
    'product.chat': { en: 'Chat', th: 'ทักแชท' },
    'product.quantity': { en: 'Qty', th: 'จำนวน' },

    // Cart
    'cart.title': { en: 'Shopping Cart', th: 'ตะกร้าสินค้า' },
    'cart.empty': { en: 'Your cart is empty', th: 'ตะกร้าสินค้าว่างเปล่า' },
    'cart.empty_desc': { en: 'Looks like you haven\'t added any items yet.', th: 'คุณยังไม่ได้เลือกสินค้าลงตะกร้าเลย' },
    'cart.items_selected': { en: 'items selected', th: 'รายการที่เลือก' },
    'cart.subtotal': { en: 'Subtotal', th: 'ยอดรวมสินค้า' },
    'cart.total': { en: 'Total', th: 'ยอดรวมทั้งสิ้น' },
    'cart.checkout': { en: 'Checkout', th: 'ชำระเงิน' },
    'cart.start_shopping': { en: 'Start Shopping', th: 'เลือกซื้อสินค้า' },

    // Checkout
    'checkout.title': { en: 'Checkout', th: 'ชำระเงิน' },
    'checkout.shipping_info': { en: 'Shipping Information', th: 'ข้อมูลการจัดส่ง' },
    'checkout.payment_notes': { en: 'Payment & Notes', th: 'การชำระเงิน & เพิ่มเติม' },
    'checkout.order_summary': { en: 'Order Summary', th: 'สรุปคำสั่งซื้อ' },
    'checkout.shipping': { en: 'Shipping', th: 'ค่าจัดส่ง' },
    'checkout.free': { en: 'Free', th: 'ฟรี' },
    'checkout.confirm_order': { en: 'Confirm Order', th: 'ยืนยันคำสั่งซื้อ' },
    'checkout.processing': { en: 'Processing...', th: 'กำลังดำเนินการ...' },
    'checkout.secure': { en: 'Secure Checkout', th: 'ชำระเงินปลอดภัย 100%' },

    // Form Labels
    'form.fullname': { en: 'Full Name', th: 'ชื่อ-นามสกุล' },
    'form.fullname_placeholder': { en: 'Enter your name', th: 'กรอกชื่อ-นามสกุล' },
    'form.phone': { en: 'Phone Number', th: 'เบอร์โทรศัพท์' },
    'form.phone_placeholder': { en: 'e.g. 0812345678', th: 'เช่น 0812345678' },
    'form.email': { en: 'Email (for receipt)', th: 'อีเมล (สำหรับรับใบเสร็จ)' },
    'form.email_placeholder': { en: 'example@email.com', th: 'example@email.com' },
    'form.address': { en: 'Shipping Address', th: 'ที่อยู่จัดส่ง' },
    'form.address_placeholder': { en: 'Enter full address details...', th: 'กรอกที่อยู่จัดส่งให้ครบถ้วน...' },
    'form.payment_method': { en: 'Payment Method', th: 'ช่องทางชำระเงิน' },
    'form.method.transfer': { en: 'Bank Transfer (Upload Slip)', th: 'โอนเงินธนาคาร (แนบสลิป)' },
    'form.method.promptpay': { en: 'PromptPay / QR Code', th: 'พร้อมเพย์ / QR Code' },
    'form.method.cash': { en: 'Cash at Store', th: 'ชำระเงินสดที่หน้าร้าน' },
    'form.notes': { en: 'Notes (Optional)', th: 'หมายเหตุ (ถ้ามี)' },
    'form.notes_placeholder': { en: 'Any special instructions for delivery...', th: 'รายละเอียดเพิ่มเติม เช่น จุดสังเกต...' },
    'search.placeholder': { en: 'Search by name, size (A2), or dimensions (30x20x5)...', th: 'ค้นหาชื่อ ขนาด (A2) หรือ กว้างxยาวxสูง (30x20x5)...' },

    // Cookie Consent
    'cookie.title': { en: 'We use cookies', th: 'เราใช้คุกกี้' },
    'cookie.description': { en: 'We use cookies to enhance your experience, analyze site traffic, and personalize content. Choose your preferences below.', th: 'เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์ วิเคราะห์การเข้าใช้งาน และปรับเนื้อหาให้เหมาะสม เลือกการตั้งค่าได้ด้านล่าง' },
    'cookie.accept_all': { en: 'Accept All', th: 'ยอมรับทั้งหมด' },
    'cookie.reject_all': { en: 'Reject All', th: 'ปฏิเสธทั้งหมด' },
    'cookie.customize': { en: 'Customize', th: 'ปรับแต่ง' },
    'cookie.save_preferences': { en: 'Save Preferences', th: 'บันทึกการตั้งค่า' },

    // Cookie Preferences Modal
    'cookie.preferences_title': { en: 'Cookie Preferences', th: 'ตั้งค่าคุกกี้' },
    'cookie.preferences_desc': { en: 'We use cookies to improve your experience on our site. You can choose which categories of cookies to allow below.', th: 'เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์ของคุณ สามารถเลือกประเภทคุกกี้ที่ต้องการอนุญาตได้ด้านล่าง' },
    'cookie.essential_title': { en: 'Essential Cookies', th: 'คุกกี้จำเป็น' },
    'cookie.essential_desc': { en: 'These cookies are necessary for the website to function and cannot be disabled.', th: 'คุกกี้เหล่านี้จำเป็นต่อการทำงานของเว็บไซต์และไม่สามารถปิดได้' },
    'cookie.analytics_title': { en: 'Analytics Cookies', th: 'คุกกี้วิเคราะห์' },
    'cookie.analytics_desc': { en: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.', th: 'คุกกี้เหล่านี้ช่วยให้เราเข้าใจว่าผู้เยี่ยมชมใช้งานเว็บไซต์อย่างไร โดยรวบรวมข้อมูลแบบไม่ระบุตัวตน' },
    'cookie.marketing_title': { en: 'Marketing Cookies', th: 'คุกกี้การตลาด' },
    'cookie.marketing_desc': { en: 'These cookies are used to track visitors across websites to display relevant ads and measure their effectiveness.', th: 'คุกกี้เหล่านี้ใช้เพื่อติดตามผู้เยี่ยมชมเพื่อแสดงโฆษณาที่เกี่ยวข้องและวัดประสิทธิภาพ' },
    'cookie.always_on': { en: 'Always On', th: 'เปิดอยู่เสมอ' },
    'cookie.view_cookies': { en: 'View cookies', th: 'ดูรายการคุกกี้' },

    // Footer
    'footer.description': { en: 'Premium packing essentials and bundles for your shipping needs.', th: 'อุปกรณ์แพ็คกิ้งพรีเมียมและชุดบริการสำหรับความต้องการในการจัดส่งของคุณ' },
    'footer.quick_links': { en: 'Quick Links', th: 'ลิงก์ด่วน' },
    'footer.shop': { en: 'Shop', th: 'สินค้า' },
    'footer.track_order': { en: 'Track Order', th: 'ติดตามคำสั่งซื้อ' },
    'footer.contact': { en: 'Contact Us', th: 'ติดต่อเรา' },
    'footer.legal': { en: 'Legal', th: 'กฎหมาย' },
    'footer.cookie_policy': { en: 'Cookie Policy', th: 'นโยบายคุกกี้' },
    'footer.cookie_settings': { en: 'Cookie Settings', th: 'ตั้งค่าคุกกี้' },
    'footer.rights': { en: 'All rights reserved.', th: 'สงวนลิขสิทธิ์' },
    'footer.privacy': { en: 'Privacy', th: 'ความเป็นส่วนตัว' },
    'footer.terms': { en: 'Terms', th: 'ข้อกำหนด' },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    useEffect(() => {
        const saved = localStorage.getItem('app-language') as Language;
        if (saved) setLanguage(saved);
    }, []);

    const changeLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('app-language', lang);
    };

    const t = (key: string) => {
        return translations[key]?.[language] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
