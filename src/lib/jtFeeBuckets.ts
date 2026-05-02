/**
 * แยกกลุ่มสำหรับคิดค่าเฉลี่ยค่าส่งต่อรายการ — marketplace (TikTok, Shopee, …) vs JMS
 * อิงจากป้ายช่องทางที่ได้จาก channelBucketLabelFromRow (ลำดับฟิลด์ตามการตั้งค่า)
 */
export type JtShippingFeeBucket = 'marketplace' | 'jms' | 'other';

/** ค่าที่ตรงกับที่ผู้ใช้ระบุ + รูปแบบที่เกี่ยวข้อง */
const MARKETPLACE_EXACT = ['tiktok_reverse', 'tiktok', 'shein', 'temu', 'shopee'] as const;

export function classifyShippingFeeBucket(channelLabel: string): JtShippingFeeBucket {
    const raw = channelLabel.trim();
    if (!raw || raw === 'ไม่ระบุ') return 'other';
    const n = raw.toLowerCase();

    for (const id of MARKETPLACE_EXACT) {
        if (n === id) return 'marketplace';
    }
    if (n.includes('tiktok')) return 'marketplace';
    if (n.includes('shein')) return 'marketplace';
    if (n.includes('temu')) return 'marketplace';
    if (n.includes('shopee')) return 'marketplace';

    if (n === 'jms' || n.includes('jms')) return 'jms';

    return 'other';
}
