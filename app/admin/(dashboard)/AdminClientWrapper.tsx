'use client';

import { AdminLanguageProvider } from '@app/admin/context/AdminLanguageContext';
import ToastProviderWithStyles from '@app/admin/context/ToastContext';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AdminLanguageProvider>
            <ToastProviderWithStyles>
                {children}
            </ToastProviderWithStyles>
        </AdminLanguageProvider>
    );
}
