// แมประหว่างชื่อจังหวัดอังกฤษ (ตรงกับ public/geo/thailand-provinces.json) กับชื่อไทย
// ใช้สำหรับ choropleth: dest_province (ไทย) → ชื่ออังกฤษ เพื่อจับคู่ขอบเขตในแผนที่

/** ชื่ออังกฤษใน GeoJSON → ชื่อไทย (ใช้แสดงผล) */
export const EN_TO_TH: Record<string, string> = {
    'Amnat Charoen': 'อำนาจเจริญ',
    'Ang Thong': 'อ่างทอง',
    'Bangkok Metropolis': 'กรุงเทพมหานคร',
    'Bueng Kan': 'บึงกาฬ',
    'Buri Ram': 'บุรีรัมย์',
    'Chachoengsao': 'ฉะเชิงเทรา',
    'Chai Nat': 'ชัยนาท',
    'Chaiyaphum': 'ชัยภูมิ',
    'Chanthaburi': 'จันทบุรี',
    'Chiang Mai': 'เชียงใหม่',
    'Chiang Rai': 'เชียงราย',
    'Chon Buri': 'ชลบุรี',
    'Chumphon': 'ชุมพร',
    'Kalasin': 'กาฬสินธุ์',
    'Kamphaeng Phet': 'กำแพงเพชร',
    'Kanchanaburi': 'กาญจนบุรี',
    'Khon Kaen': 'ขอนแก่น',
    'Krabi': 'กระบี่',
    'Lampang': 'ลำปาง',
    'Lamphun': 'ลำพูน',
    'Loei': 'เลย',
    'Lop Buri': 'ลพบุรี',
    'Mae Hong Son': 'แม่ฮ่องสอน',
    'Maha Sarakham': 'มหาสารคาม',
    'Mukdahan': 'มุกดาหาร',
    'Nakhon Nayok': 'นครนายก',
    'Nakhon Pathom': 'นครปฐม',
    'Nakhon Phanom': 'นครพนม',
    'Nakhon Ratchasima': 'นครราชสีมา',
    'Nakhon Sawan': 'นครสวรรค์',
    'Nakhon Si Thammarat': 'นครศรีธรรมราช',
    'Nan': 'น่าน',
    'Narathiwat': 'นราธิวาส',
    'Nong Bua Lam Phu': 'หนองบัวลำภู',
    'Nong Khai': 'หนองคาย',
    'Nonthaburi': 'นนทบุรี',
    'Pathum Thani': 'ปทุมธานี',
    'Pattani': 'ปัตตานี',
    'Phangnga': 'พังงา',
    'Phatthalung': 'พัทลุง',
    'Phayao': 'พะเยา',
    'Phetchabun': 'เพชรบูรณ์',
    'Phetchaburi': 'เพชรบุรี',
    'Phichit': 'พิจิตร',
    'Phitsanulok': 'พิษณุโลก',
    'Phra Nakhon Si Ayutthaya': 'พระนครศรีอยุธยา',
    'Phrae': 'แพร่',
    'Phuket': 'ภูเก็ต',
    'Prachin Buri': 'ปราจีนบุรี',
    'Prachuap Khiri Khan': 'ประจวบคีรีขันธ์',
    'Ranong': 'ระนอง',
    'Ratchaburi': 'ราชบุรี',
    'Rayong': 'ระยอง',
    'Roi Et': 'ร้อยเอ็ด',
    'Sa Kaeo': 'สระแก้ว',
    'Sakon Nakhon': 'สกลนคร',
    'Samut Prakan': 'สมุทรปราการ',
    'Samut Sakhon': 'สมุทรสาคร',
    'Samut Songkhram': 'สมุทรสงคราม',
    'Saraburi': 'สระบุรี',
    'Satun': 'สตูล',
    'Si Sa Ket': 'ศรีสะเกษ',
    'Sing Buri': 'สิงห์บุรี',
    'Songkhla': 'สงขลา',
    'Sukhothai': 'สุโขทัย',
    'Suphan Buri': 'สุพรรณบุรี',
    'Surat Thani': 'สุราษฎร์ธานี',
    'Surin': 'สุรินทร์',
    'Tak': 'ตาก',
    'Trang': 'ตรัง',
    'Trat': 'ตราด',
    'Ubon Ratchathani': 'อุบลราชธานี',
    'Udon Thani': 'อุดรธานี',
    'Uthai Thani': 'อุทัยธานี',
    'Uttaradit': 'อุตรดิตถ์',
    'Yala': 'ยะลา',
    'Yasothon': 'ยโสธร',
};

/** ชื่อไทย → ชื่ออังกฤษ (reverse ของ EN_TO_TH) */
const TH_TO_EN: Record<string, string> = Object.fromEntries(
    Object.entries(EN_TO_TH).map(([en, th]) => [th, en]),
);

/** ชื่อเล่น / รูปแบบที่พบบ่อยในข้อมูล import → ชื่ออังกฤษมาตรฐาน */
const ALIASES: Record<string, string> = {
    'กทม': 'Bangkok Metropolis',
    'กทม.': 'Bangkok Metropolis',
    'กรุงเทพ': 'Bangkok Metropolis',
    'กรุงเทพฯ': 'Bangkok Metropolis',
    'บางกอก': 'Bangkok Metropolis',
    'อยุธยา': 'Phra Nakhon Si Ayutthaya',
    'ศรีษะเกษ': 'Si Sa Ket',
    'บุรีรัมย': 'Buri Ram',
    'หนองบัวลำพู': 'Nong Bua Lam Phu',
};

/** ตัด prefix "จังหวัด"/"จ." + ช่องว่าง + อักขระแปลกปลอม */
function cleanThai(raw: string): string {
    return raw
        .trim()
        .replace(/^จังหวัด\s*/, '')
        .replace(/^จ\.?\s*/, '')
        .replace(/\s+/g, '')
        .replace(/[​-‍﻿]/g, ''); // zero-width chars
}

/**
 * normalize dest_province (ไทย อาจมีรูปแบบหลากหลาย) → ชื่ออังกฤษใน GeoJSON
 * คืน null ถ้าจับคู่ไม่ได้
 */
export function provinceToEn(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = cleanThai(raw);
    if (!cleaned) return null;
    if (TH_TO_EN[cleaned]) return TH_TO_EN[cleaned];
    if (ALIASES[cleaned]) return ALIASES[cleaned];
    // เผื่อข้อมูลเก็บเป็นชื่ออังกฤษอยู่แล้ว
    if (EN_TO_TH[raw.trim()]) return raw.trim();
    return null;
}
