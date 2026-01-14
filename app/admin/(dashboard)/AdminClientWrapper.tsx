'use client';

import { AdminLanguageProvider } from '@app/admin/context/AdminLanguageContext';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AdminLanguageProvider>
            {children}
        </AdminLanguageProvider>
    );
}
