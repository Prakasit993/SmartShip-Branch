export const JT_RETURN_ACKNOWLEDGEMENTS_TABLE = 'jt_return_acknowledgements';

export type JtReturnAcknowledgement = {
    id?: number;
    awb_number: string;
    reason: string;
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
