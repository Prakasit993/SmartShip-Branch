'use client';

import AdminAiChatDock from '@app/admin/components/AdminAiChatDock';
import { AdminLanguageProvider } from '@app/admin/context/AdminLanguageContext';
import ToastProviderWithStyles from '@app/admin/context/ToastContext';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AdminLanguageProvider>
            <ToastProviderWithStyles>
                {children}
                <AdminAiChatDock />
            </ToastProviderWithStyles>
        </AdminLanguageProvider>
    );
}
