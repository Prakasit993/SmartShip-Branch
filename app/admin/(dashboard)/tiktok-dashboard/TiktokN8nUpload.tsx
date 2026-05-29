'use client';

import { SimpleUploadModal } from '@app/admin/components/SimpleUploadModal';

type Props = {
    /** @deprecated — Phase 3.7: tracking ทำผ่าน UploadJobsProvider แล้ว — prop นี้ถูก ignore */
    onUploadSuccess?: () => void;
};

/**
 * TiktokN8nUpload — ปุ่มอัปโหลดข้อมูล TikTok Shop
 *
 * Phase 3.7 — refactor ให้ใช้ SimpleUploadModal + UploadJobsProvider
 */
export function TiktokN8nUpload(_props: Props = {}) {
    return (
        <SimpleUploadModal
            kind="tiktok"
            title="อัปโหลดข้อมูล TikTok Shop"
            triggerAriaLabel="อัปโหลดข้อมูล TikTok Shop"
            triggerClassName="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/25 hover:ring-emerald-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        />
    );
}
