export const JT_RETURN_ACKNOWLEDGEMENTS_TABLE = 'jt_return_acknowledgements';

/**
 * Acknowledgement kind — ตารางเดียวเก็บได้หลายบริบท (ดู migration 20260522_jt_parcel_ack_kind)
 * - 'return'   : พัสดุถูกตีกลับ (legacy, default) + ใช้กับ "มีปัญหา" ใน customer-profile
 * - 'stagnant' : พัสดุตกค้างไม่เคลื่อนไหว (dashboard)
 * - 'overdue'  : พัสดุค้างเกิน N วันใน customer-profile (ค้าง>3 / ค้าง>7 ใช้ร่วมกัน)
 */
export const JT_ACK_KINDS = ['return', 'stagnant', 'overdue'] as const;
export type JtAckKind = (typeof JT_ACK_KINDS)[number];

export type JtReturnAcknowledgement = {
    id?: number;
    awb_number: string;
    reason: string;
    kind?: JtAckKind;
    status?: 'active' | 'cancelled';
    /**
     * ปิดเรื่องแล้ว → ซ่อน AWB นี้จาก aging tool (default true).
     * false = ยังต้องตามงาน (เช่น "รอตีกลับมา") AI ยังต้องแจ้ง
     */
    mute_aging?: boolean;
    acknowledged_by?: string | null;
    acknowledged_at: string;
    cancelled_reason?: string | null;
    cancelled_at?: string | null;
};
