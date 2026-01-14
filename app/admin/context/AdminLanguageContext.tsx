'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'th' | 'en';

// Admin translations
const adminTranslations = {
    th: {
        // Sidebar
        'nav.overview': 'ภาพรวม',
        'nav.dashboard': 'แดชบอร์ด',
        'nav.orders': 'คำสั่งซื้อ',
        'nav.management': 'จัดการข้อมูล',
        'nav.products': 'สินค้า',
        'nav.bundles': 'ชุดสินค้า',
        'nav.stock': 'คลังสินค้า',
        'nav.system': 'ระบบ',
        'nav.settings': 'ตั้งค่า',
        'nav.signOut': 'ออกจากระบบ',

        // Dashboard
        'dashboard.title': 'แดชบอร์ด',
        'dashboard.subtitle': 'ภาพรวมประสิทธิภาพร้านค้าของคุณ',
        'dashboard.todaySales': 'ยอดขายวันนี้',
        'dashboard.totalOrders': 'จำนวนคำสั่งซื้อ',
        'dashboard.activeProducts': 'สินค้าที่เปิดขาย',
        'dashboard.fromYesterday': 'จากเมื่อวาน',
        'dashboard.lifetimeVolume': 'ยอดรวมทั้งหมด',
        'dashboard.inCatalog': 'ในแคตตาล็อก',
        'dashboard.recentOrders': 'คำสั่งซื้อล่าสุด',
        'dashboard.viewAll': 'ดูทั้งหมด',
        'dashboard.quickActions': 'ทางลัด',
        'dashboard.manageProducts': 'จัดการสินค้า',
        'dashboard.manageProductsDesc': 'เพิ่มหรือแก้ไขสินค้า',
        'dashboard.processOrders': 'จัดการคำสั่งซื้อ',
        'dashboard.processOrdersDesc': 'อัปเดตสถานะการจัดส่ง',
        'dashboard.shopSettings': 'ตั้งค่าร้าน',
        'dashboard.shopSettingsDesc': 'แก้ไข Hero และข้อมูลติดต่อ',

        // Orders
        'orders.title': 'คำสั่งซื้อ',
        'orders.orderNo': 'เลขที่คำสั่งซื้อ',
        'orders.customer': 'ลูกค้า',
        'orders.total': 'ยอดรวม',
        'orders.status': 'สถานะ',
        'orders.date': 'วันที่',
        'orders.actions': 'จัดการ',
        'orders.view': 'ดู',
        'orders.noOrders': 'ไม่มีคำสั่งซื้อ',

        // Products
        'products.title': 'สินค้า',
        'products.addProduct': '+ เพิ่มสินค้า',
        'products.name': 'ชื่อ',
        'products.sku': 'รหัสสินค้า',
        'products.price': 'ราคา',
        'products.status': 'สถานะ',
        'products.actions': 'จัดการ',
        'products.edit': 'แก้ไข',
        'products.delete': 'ลบ',
        'products.noProducts': 'ไม่พบสินค้า',
        'products.active': 'เปิดขาย',
        'products.inactive': 'ปิดการขาย',
        'products.previous': '← ก่อนหน้า',
        'products.next': 'ถัดไป →',
        'products.page': 'หน้า',
        'products.of': 'จาก',

        // Bundles
        'bundles.title': 'ชุดสินค้า',
        'bundles.addBundle': '+ เพิ่มชุดสินค้า',
        'bundles.type': 'ประเภท',
        'bundles.category': 'หมวดหมู่',

        // Stock
        'stock.title': '📋 จัดการคลังสินค้า',
        'stock.lowStockWarning': '⚠️ สินค้าใกล้หมด',
        'stock.items': 'รายการ',
        'stock.product': 'สินค้า',
        'stock.stockLevel': 'จำนวนคงเหลือ',
        'stock.totalProducts': 'สินค้าทั้งหมด',
        'stock.lowStock': 'ใกล้หมด',
        'stock.outOfStock': 'หมดสต็อก',

        // Settings
        'settings.title': 'ตั้งค่าเว็บไซต์',
        'settings.homepageContent': 'เนื้อหาหน้าแรก',
        'settings.heroTitle': 'หัวข้อหลัก',
        'settings.heroSubtitle': 'คำบรรยาย',
        'settings.heroImages': 'รูปภาพหน้าแรก',
        'settings.heroImagesHelp': '(ใส่ URL ทีละบรรทัด) ปล่อยว่างเพื่อใช้รูปเริ่มต้น',
        'settings.announcement': 'ประกาศ (ไม่บังคับ)',
        'settings.contactInfo': 'ข้อมูลติดต่อ',
        'settings.phone': 'โทรศัพท์',
        'settings.lineId': 'LINE ID',
        'settings.email': 'อีเมล',
        'settings.lineUrl': 'LINE URL',
        'settings.address': 'ที่อยู่',
        'settings.mapEmbed': 'Google Maps Embed URL',
        'settings.mapEmbedHelp': 'ได้จาก Google Maps > Share > Embed a map',
        'settings.mapLink': 'Google Maps Link (สำหรับปุ่มเปิดแผนที่)',
        'settings.saveChanges': 'บันทึกการเปลี่ยนแปลง',

        // Common
        'common.loading': 'กำลังโหลด...',
        'common.save': 'บันทึก',
        'common.cancel': 'ยกเลิก',
        'common.error': 'เกิดข้อผิดพลาด',
        'common.success': 'สำเร็จ',
        'common.confirm': 'ยืนยัน',
        'common.active': 'เปิดใช้งาน',
        'common.inactive': 'ปิดใช้งาน',
    },
    en: {
        // Sidebar
        'nav.overview': 'Overview',
        'nav.dashboard': 'Dashboard',
        'nav.orders': 'Orders',
        'nav.management': 'Management',
        'nav.products': 'Products',
        'nav.bundles': 'Bundles',
        'nav.stock': 'Stock',
        'nav.system': 'System',
        'nav.settings': 'Settings',
        'nav.signOut': 'Sign Out',

        // Dashboard
        'dashboard.title': 'Dashboard',
        'dashboard.subtitle': "Overview of your shop's performance.",
        'dashboard.todaySales': "Today's Sales",
        'dashboard.totalOrders': 'Total Orders',
        'dashboard.activeProducts': 'Active Products',
        'dashboard.fromYesterday': 'from yesterday',
        'dashboard.lifetimeVolume': 'Lifetime volume',
        'dashboard.inCatalog': 'In catalog',
        'dashboard.recentOrders': 'Recent Orders',
        'dashboard.viewAll': 'View All',
        'dashboard.quickActions': 'Quick Actions',
        'dashboard.manageProducts': 'Manage Products',
        'dashboard.manageProductsDesc': 'Add or edit catalog items.',
        'dashboard.processOrders': 'Process Orders',
        'dashboard.processOrdersDesc': 'Update shipping status.',
        'dashboard.shopSettings': 'Shop Settings',
        'dashboard.shopSettingsDesc': 'Configure hero & contacts.',

        // Orders
        'orders.title': 'Orders',
        'orders.orderNo': 'Order No',
        'orders.customer': 'Customer',
        'orders.total': 'Total',
        'orders.status': 'Status',
        'orders.date': 'Date',
        'orders.actions': 'Actions',
        'orders.view': 'View',
        'orders.noOrders': 'No orders found.',

        // Products
        'products.title': 'Products',
        'products.addProduct': '+ Add Product',
        'products.name': 'Name',
        'products.sku': 'SKU',
        'products.price': 'Price',
        'products.status': 'Status',
        'products.actions': 'Actions',
        'products.edit': 'Edit',
        'products.delete': 'Delete',
        'products.noProducts': 'No products found.',
        'products.active': 'Active',
        'products.inactive': 'Inactive',
        'products.previous': '← Previous',
        'products.next': 'Next →',
        'products.page': 'Page',
        'products.of': 'of',

        // Bundles
        'bundles.title': 'Bundles',
        'bundles.addBundle': '+ Add Bundle',
        'bundles.type': 'Type',
        'bundles.category': 'Category',

        // Stock
        'stock.title': '📋 Stock Management',
        'stock.lowStockWarning': '⚠️ Low Stock Items',
        'stock.items': 'items',
        'stock.product': 'Product',
        'stock.stockLevel': 'Stock',
        'stock.totalProducts': 'Total Products',
        'stock.lowStock': 'Low Stock',
        'stock.outOfStock': 'Out of Stock',

        // Settings
        'settings.title': 'Site Settings',
        'settings.homepageContent': 'Homepage Content',
        'settings.heroTitle': 'Hero Title',
        'settings.heroSubtitle': 'Hero Subtitle',
        'settings.heroImages': 'Hero Images',
        'settings.heroImagesHelp': '(One URL per line) Leave empty to use default image.',
        'settings.announcement': 'Announcement Banner (Optional)',
        'settings.contactInfo': 'Contact Info',
        'settings.phone': 'Phone',
        'settings.lineId': 'LINE ID',
        'settings.email': 'Email',
        'settings.lineUrl': 'LINE URL',
        'settings.address': 'Address',
        'settings.mapEmbed': 'Google Maps Embed URL',
        'settings.mapEmbedHelp': 'Get from Google Maps > Share > Embed a map',
        'settings.mapLink': 'Google Maps Link (for open map button)',
        'settings.saveChanges': 'Save Changes',

        // Common
        'common.loading': 'Loading...',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.confirm': 'Confirm',
        'common.active': 'Active',
        'common.inactive': 'Inactive',
    }
};

type TranslationKey = keyof typeof adminTranslations.en;

interface AdminLanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const AdminLanguageContext = createContext<AdminLanguageContextType | undefined>(undefined);

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('th');

    useEffect(() => {
        // Load saved language from localStorage
        const saved = localStorage.getItem('adminLanguage') as Language;
        if (saved && (saved === 'th' || saved === 'en')) {
            setLanguage(saved);
        }
    }, []);

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('adminLanguage', lang);
    };

    const t = (key: TranslationKey): string => {
        return adminTranslations[language][key] || key;
    };

    return (
        <AdminLanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
            {children}
        </AdminLanguageContext.Provider>
    );
}

export function useAdminLanguage() {
    const context = useContext(AdminLanguageContext);
    if (!context) {
        throw new Error('useAdminLanguage must be used within AdminLanguageProvider');
    }
    return context;
}
