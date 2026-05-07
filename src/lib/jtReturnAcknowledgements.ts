export const JT_RETURN_ACKNOWLEDGEMENTS_TABLE = 'jt_return_acknowledgements';

export type JtReturnAcknowledgement = {
    id?: number;
    awb_number: string;
    reason: string;
    status?: 'active' | 'cancelled';
    acknowledged_by?: string | null;
    acknowledged_at: string;
    cancelled_reason?: string | null;
    cancelled_at?: string | null;
};
