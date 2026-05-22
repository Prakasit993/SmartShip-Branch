export const TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE = 'tiktok_return_acknowledgements';

/**
 * Acknowledgement kind สำหรับ TikTok Shop (ตารางแยกจาก jt_return_acknowledgements
 * เพื่อกัน awb ของ tiktok ชน awb ของ jt — ดู migration 20260522_tiktok_return_acknowledgements)
 * - 'return'   : พัสดุถูกตีกลับ (default)
 * - 'stagnant' : พัสดุตกค้างไม่เคลื่อนไหว
 */
export const TIKTOK_ACK_KINDS = ['return', 'stagnant'] as const;
export type TiktokAckKind = (typeof TIKTOK_ACK_KINDS)[number];

export type TiktokReturnAcknowledgement = {
    id?: number;
    awb_number: string;
    reason: string;
    kind?: TiktokAckKind;
    status?: 'active' | 'cancelled';
    /** ปิดเรื่องแล้ว → ซ่อน AWB จากการ์ด (default true). false = ยังต้องตามต่อ */
    mute_aging?: boolean;
    acknowledged_by?: string | null;
    acknowledged_at: string;
    cancelled_reason?: string | null;
    cancelled_at?: string | null;
};
