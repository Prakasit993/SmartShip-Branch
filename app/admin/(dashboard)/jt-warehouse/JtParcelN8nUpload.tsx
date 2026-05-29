'use client';

import { SimpleUploadModal } from '@app/admin/components/SimpleUploadModal';

/**
 * JtParcelN8nUpload — ปุ่มอัปโหลดข้อมูลคลังพัสดุ J&T
 *
 * Phase 3.7 — refactor ให้ใช้ SimpleUploadModal + UploadJobsProvider
 * Tracking ทำผ่าน UploadJobsTray (ขวาล่างของ admin layout)
 */
export function JtParcelN8nUpload() {
    return (
        <SimpleUploadModal
            kind="jt_parcel"
            title="อัปโหลดข้อมูลคลังพัสดุ J&T"
            triggerAriaLabel="อัปโหลดข้อมูลคลังพัสดุ J&T"
        />
    );
}
