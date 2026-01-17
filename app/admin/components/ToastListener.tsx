'use client';

import { Suspense } from 'react';
import { useToastFromUrl } from '@app/admin/context/useToastFromUrl';

// Component that uses searchParams hook
function ToastHandler() {
    useToastFromUrl();
    return null;
}

// Wrapper with Suspense for searchParams
export default function ToastListener() {
    return (
        <Suspense fallback={null}>
            <ToastHandler />
        </Suspense>
    );
}
