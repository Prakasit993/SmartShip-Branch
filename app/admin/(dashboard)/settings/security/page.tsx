'use client';

import { useState, useEffect } from 'react';
import { FingerprintRegisterButton } from '@app/admin/components/FingerprintButtons';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

type LoginLog = {
    id: number;
    username: string | null;
    ip_address: string;
    user_agent: string;
    status: 'success' | 'failed';
    failure_reason: string | null;
    created_at: string;
};

export default function SecurityPage() {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/admin/login-logs');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">🔒 Security Settings</h1>
                <p className="text-zinc-500 mt-1">ดูประวัติการเข้าสู่ระบบและจัดการความปลอดภัย</p>
            </div>

            {/* WebAuthn Devices Section */}
            <div className="mb-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">🔐 ลงทะเบียนลายนิ้วมือ</h2>
                </div>
                <div className="p-6">
                    <p className="text-zinc-500 mb-4">ลงทะเบียนลายนิ้วมือเพื่อล็อกอินได้เร็วและปลอดภัยยิ่งขึ้น</p>
                    <FingerprintRegisterButton />
                    <p className="text-xs text-zinc-400 mt-4">* ต้องใช้เบราว์เซอร์ที่รองรับ WebAuthn (Chrome, Firefox, Safari, Edge)</p>
                </div>
            </div>

            {/* Login History */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">📋 ประวัติการล็อกอิน (50 รายการล่าสุด)</h2>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-zinc-500">กำลังโหลด...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">เวลา</th>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">Username</th>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">สถานะ</th>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">IP Address</th>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">อุปกรณ์</th>
                                    <th className="text-left p-3 font-semibold text-zinc-600 dark:text-zinc-400">เหตุผล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                                            ยังไม่มีประวัติการล็อกอิน
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                            <td className="p-3 text-zinc-600 dark:text-zinc-400">
                                                {new Date(log.created_at).toLocaleString('th-TH')}
                                            </td>
                                            <td className="p-3 font-medium text-zinc-900 dark:text-white">
                                                {log.username || '-'}
                                            </td>
                                            <td className="p-3">
                                                {log.status === 'success' ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        ✅ สำเร็จ
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                        ❌ ล้มเหลว
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-xs text-zinc-500">
                                                {log.ip_address}
                                            </td>
                                            <td className="p-3 text-xs text-zinc-500 max-w-[200px] truncate" title={log.user_agent}>
                                                {log.user_agent}
                                            </td>
                                            <td className="p-3 text-xs text-zinc-500">
                                                {log.failure_reason || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
