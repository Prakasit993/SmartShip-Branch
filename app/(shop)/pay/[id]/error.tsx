'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Payment Page Error:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong!</h2>
            <p className="text-zinc-500 mb-6">{error.message}</p>
            <button
                onClick={reset}
                className="bg-black text-white px-4 py-2 rounded hover:bg-zinc-800"
            >
                Try again
            </button>
        </div>
    );
}
