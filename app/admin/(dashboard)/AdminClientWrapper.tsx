'use client';

import AdminAiChatDock from '@app/admin/components/AdminAiChatDock';
import UploadJobsTray from '@app/admin/components/UploadJobsTray';
import { AdminLanguageProvider } from '@app/admin/context/AdminLanguageContext';
import ToastProviderWithStyles from '@app/admin/context/ToastContext';
import { UploadJobsProvider } from '@app/admin/context/UploadJobsContext';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AdminLanguageProvider>
            <ToastProviderWithStyles>
                <UploadJobsProvider>
                    {children}
                    <UploadJobsTray />
                    <AdminAiChatDock />
                </UploadJobsProvider>
            </ToastProviderWithStyles>
        </AdminLanguageProvider>
    );
}
