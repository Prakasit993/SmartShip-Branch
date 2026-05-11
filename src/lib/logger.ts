import { supabaseAdmin } from '@app/lib/supabaseAdmin';

export type LogLevel = 'info' | 'warn' | 'error' | 'security';

interface LogEntry {
    action: string;
    details?: Record<string, any>;
    level: LogLevel;
    ip?: string;
    user_id?: string;
}

export const logger = {
    log: async (entry: LogEntry) => {
        // 1. Console Log (Always)
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${entry.level.toUpperCase()}] ${entry.action}`, entry.details || '');

        // 2. Database Log (เฉพาะเซิร์ฟเวอร์ — ใช้ service role; อย่า import logger จาก client)
        if (typeof window !== 'undefined') {
            return;
        }

        try {
            const { error } = await supabaseAdmin.from('system_logs').insert({
                action: entry.action,
                details: entry.details,
                level: entry.level,
                ip_address: entry.ip,
                user_id: entry.user_id,
            });

            if (error) {
                console.warn('Failed to write to system_logs:', error.message);
            }
        } catch (err) {
            console.warn('Error in logger:', err);
        }
    },

    info: (action: string, details?: any) => logger.log({ action, details, level: 'info' }),
    warn: (action: string, details?: any) => logger.log({ action, details, level: 'warn' }),
    error: (action: string, details?: any) => logger.log({ action, details, level: 'error' }),
    security: (action: string, details?: any, ip?: string) => logger.log({ action, details, level: 'security', ip }),
};
