'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showInfo: (message: string) => void;
    showWarning: (message: string) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const toast: Toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
    const showError = useCallback((message: string) => showToast(message, 'error', 6000), [showToast]);
    const showInfo = useCallback((message: string) => showToast(message, 'info'), [showToast]);
    const showWarning = useCallback((message: string) => showToast(message, 'warning', 5000), [showToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, showSuccess, showError, showInfo, showWarning, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onClose={removeToast} />
        </ToastContext.Provider>
    );
}

// Toast Container Component
function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm w-full pointer-events-none">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
            ))}
        </div>
    );
}

// Individual Toast Item
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const typeStyles = {
        success: {
            bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
            icon: '✅',
            border: 'border-green-400',
        },
        error: {
            bg: 'bg-gradient-to-r from-red-500 to-rose-600',
            icon: '❌',
            border: 'border-red-400',
        },
        info: {
            bg: 'bg-gradient-to-r from-blue-500 to-cyan-600',
            icon: 'ℹ️',
            border: 'border-blue-400',
        },
        warning: {
            bg: 'bg-gradient-to-r from-yellow-500 to-orange-600',
            icon: '⚠️',
            border: 'border-yellow-400',
        },
    };

    const style = typeStyles[toast.type];

    return (
        <div
            className={`${style.bg} text-white px-4 py-3 rounded-xl shadow-2xl border ${style.border} pointer-events-auto animate-slide-in flex items-start gap-3`}
            role="alert"
        >
            <span className="text-xl">{style.icon}</span>
            <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
            <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors text-lg leading-none"
                aria-label="ปิด"
            >
                ×
            </button>
        </div>
    );
}

// CSS Animation (add to your global CSS or use style tag)
const ToastStyles = () => (
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
            animation: slide-in 0.3s ease-out forwards;
        }
    `}</style>
);

// Export default provider with styles
export default function ToastProviderWithStyles({ children }: ToastProviderProps) {
    return (
        <ToastProvider>
            <ToastStyles />
            {children}
        </ToastProvider>
    );
}
