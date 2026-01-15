'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

const toastStyles: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: {
        bg: 'bg-green-50 dark:bg-green-900/30',
        icon: '✅',
        border: 'border-green-200 dark:border-green-800'
    },
    error: {
        bg: 'bg-red-50 dark:bg-red-900/30',
        icon: '❌',
        border: 'border-red-200 dark:border-red-800'
    },
    warning: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/30',
        icon: '⚠️',
        border: 'border-yellow-200 dark:border-yellow-800'
    },
    info: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        icon: 'ℹ️',
        border: 'border-blue-200 dark:border-blue-800'
    }
};

const textColors: Record<ToastType, string> = {
    success: 'text-green-800 dark:text-green-300',
    error: 'text-red-800 dark:text-red-300',
    warning: 'text-yellow-800 dark:text-yellow-300',
    info: 'text-blue-800 dark:text-blue-300'
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto
                            flex items-start gap-3 p-4 rounded-xl shadow-lg border
                            ${toastStyles[toast.type].bg}
                            ${toastStyles[toast.type].border}
                            animate-slide-in
                        `}
                    >
                        <span className="text-xl shrink-0">{toastStyles[toast.type].icon}</span>
                        <p className={`flex-1 text-sm font-medium ${textColors[toast.type]}`}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => hideToast(toast.id)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>

            {/* Animation Styles */}
            <style jsx global>{`
                @keyframes slide-in {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
            `}</style>
        </ToastContext.Provider>
    );
}
