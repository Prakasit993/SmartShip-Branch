import { DeepDiveDashboardPageClient } from './DeepDiveDashboardPageClient';

export const dynamic = 'force-dynamic';

/** ตั้ง ENABLE_N8N_FILE_UPLOAD=false เพื่อไม่แสดงการ์ดอัปโหลดเลย (ซ่อนทั้งบล็อกจากหน้า) */
export default function JtDeepDiveDashboardPage() {
    const showN8nFileUpload = process.env.ENABLE_N8N_FILE_UPLOAD !== 'false';
    return <DeepDiveDashboardPageClient showN8nFileUpload={showN8nFileUpload} />;
}
