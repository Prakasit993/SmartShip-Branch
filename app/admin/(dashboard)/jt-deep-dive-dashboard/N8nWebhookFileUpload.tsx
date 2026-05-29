'use client';

import { SimpleUploadModal } from '@app/admin/components/SimpleUploadModal';

/**
 * N8nWebhookFileUpload — ปุ่มอัปโหลด J&T Shipments
 *
 * Phase 3.7 — refactor ให้ใช้ SimpleUploadModal + UploadJobsProvider
 * Tracking ผ่าน UploadJobsTray
 */
export function N8nWebhookFileUpload() {
    return (
        <SimpleUploadModal
            kind="jt_shipment"
            title="อัปโหลดข้อมูล J&T Shipments"
            triggerAriaLabel="อัปโหลดข้อมูล J&T Shipments"
        />
    );
}
