'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useToast } from './ToastContext';

/**
 * Hook to display toast notifications from URL params
 * Usage: Add ?toast=success&message=... or ?toast=error&message=... to URL
 */
export function useToastFromUrl() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { showSuccess, showError, showInfo, showWarning } = useToast();

    useEffect(() => {
        const toastType = searchParams.get('toast');
        const message = searchParams.get('message');

        if (toastType && message) {
            // Show the toast
            switch (toastType) {
                case 'success':
                    showSuccess(decodeURIComponent(message));
                    break;
                case 'error':
                    showError(decodeURIComponent(message));
                    break;
                case 'warning':
                    showWarning(decodeURIComponent(message));
                    break;
                case 'info':
                default:
                    showInfo(decodeURIComponent(message));
            }

            // Clean URL without triggering navigation
            const params = new URLSearchParams(searchParams.toString());
            params.delete('toast');
            params.delete('message');
            const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams, pathname, router, showSuccess, showError, showInfo, showWarning]);
}

// Common toast messages in Thai
export const toastMessages = {
    productCreated: 'สร้างสินค้าใหม่สำเร็จ',
    productUpdated: 'บันทึกการแก้ไขสินค้าสำเร็จ',
    productDeleted: 'ลบสินค้าสำเร็จ',
    bundleCreated: 'สร้างชุดสินค้าสำเร็จ',
    bundleUpdated: 'บันทึกชุดสินค้าสำเร็จ',
    bundleDeleted: 'ลบชุดสินค้าสำเร็จ',
    categoryCreated: 'สร้างหมวดหมู่สำเร็จ',
    categoryUpdated: 'บันทึกหมวดหมู่สำเร็จ',
    categoryDeleted: 'ลบหมวดหมู่สำเร็จ',
    settingsSaved: 'บันทึกการตั้งค่าสำเร็จ',
    orderUpdated: 'อัพเดตสถานะออเดอร์สำเร็จ',
    uploadSuccess: 'อัพโหลดไฟล์สำเร็จ',
    uploadError: 'อัพโหลดไฟล์ไม่สำเร็จ',
    saveError: 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
    deleteError: 'ลบไม่สำเร็จ กรุณาลองใหม่',
    networkError: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
};
