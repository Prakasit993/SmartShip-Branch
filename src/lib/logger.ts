import { supabase } from './supabaseClient';

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

        // 2. Database Log (Best Effort)
        try {
            const { error } = await supabase.from('system_logs').insert({
                action: entry.action,
                details: entry.details,
                level: entry.level,
                ip_address: entry.ip,
                user_id: entry.user_id,
            });

            if (error) {
                // Silent fail for DB log to avoid crashing app, but warn console
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
