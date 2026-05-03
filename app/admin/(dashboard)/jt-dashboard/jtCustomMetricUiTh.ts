import type { JtCustomMetricIcon } from '@/lib/jtCustomMetricCards';

/** ชื่อไอคอนแบบอ่านง่าย (ค่าเก็บใน DB ยังเป็น key เดิม) */
export const CUSTOM_METRIC_ICON_TH: Record<JtCustomMetricIcon, string> = {
    package: 'พัสดุ / กล่อง',
    banknote: 'เงิน / ธนบัตร',
    scale: 'ตาชั่ง / น้ำหนัก',
    'rotate-ccw': 'ย้อนกลับ / ตีกลับ',
    truck: 'รถส่ง / ขนส่ง',
    'bar-chart': 'กราฟแท่ง',
    'map-pin': 'ที่ตั้ง / จังหวัด',
};

/** คอลัมน์ใช้กรอง — แสดงภาษาไทยเป็นหลัก */
export const FILTER_COLUMN_TH: Record<string, string> = {
    latest_scan_type: 'สถานะสแกนล่าสุด',
    sender_name: 'ชื่อผู้ส่ง',
    receiver_name: 'ชื่อผู้รับ',
    dest_province: 'จังหวัดปลายทาง',
    order_source: 'แหล่งที่มาออเดอร์',
    shop_name: 'ชื่อร้าน',
    cod_status: 'สถานะ COD',
    delivery_method: 'วิธีจัดส่ง',
    platform: 'แพลตฟอร์ม',
};

/** คอลัมน์ตัวเลข — แสดงภาษาไทยเป็นหลัก */
export const VALUE_COLUMN_TH: Record<string, string> = {
    shipping_fee: 'ค่าส่ง',
    cod_amount: 'ยอดเก็บปลายทาง (COD)',
    remote_area_fee: 'ค่าพื้นที่ห่างไกล',
    return_fee: 'ค่าธรรมเนียมตีกลับ',
    insurance_fee: 'ค่าประกัน',
    total_shipping_fee: 'ค่าส่งรวม',
    discount_amount: 'ส่วนลด',
    amount_before_discount: 'ยอดก่อนส่วนลด',
    other_fees: 'ค่าอื่น ๆ',
};

export function labelFilterColumn(key: string): string {
    return FILTER_COLUMN_TH[key] ?? key;
}

export function labelValueColumn(key: string): string {
    return VALUE_COLUMN_TH[key] ?? key;
}

/** ตัวเลือกใน dropdown: ไทย + ชื่อฟิลด์ย่อยสำหรับผู้ดูแลระบบ */
export function optionFilterColumn(key: string): string {
    const th = labelFilterColumn(key);
    return th === key ? key : `${th} (${key})`;
}

export function optionValueColumn(key: string): string {
    const th = labelValueColumn(key);
    return th === key ? key : `${th} (${key})`;
}
