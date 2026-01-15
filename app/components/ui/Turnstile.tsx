'use client';

import { Turnstile as TurnstileWidget } from '@marsidev/react-turnstile';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface TurnstileRef {
    reset: () => void;
    getToken: () => string | null;
}

interface TurnstileProps {
    onSuccess?: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
    theme?: 'light' | 'dark' | 'auto';
}

const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
    ({ onSuccess, onError, onExpire, theme = 'auto' }, ref) => {
        const widgetRef = useRef<any>(null);
        const [token, setToken] = useState<string | null>(null);

        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

        useImperativeHandle(ref, () => ({
            reset: () => {
                widgetRef.current?.reset();
                setToken(null);
            },
            getToken: () => token,
        }));

        if (!siteKey) {
            console.warn('Turnstile: NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured');
            return null;
        }

        return (
            <div className="flex justify-center my-4">
                <TurnstileWidget
                    ref={widgetRef}
                    siteKey={siteKey}
                    onSuccess={(token) => {
                        setToken(token);
                        onSuccess?.(token);
                    }}
                    onError={() => {
                        setToken(null);
                        onError?.();
                    }}
                    onExpire={() => {
                        setToken(null);
                        onExpire?.();
                    }}
                    options={{
                        theme,
                        size: 'normal',
                    }}
                />
            </div>
        );
    }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
