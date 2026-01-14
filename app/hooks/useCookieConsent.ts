'use client';

import { useState, useEffect } from 'react';
import { CookiePreferences, DEFAULT_PREFERENCES, COOKIE_STORAGE_KEY } from '@app/types/cookies';

export function useCookieConsent() {
    const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load preferences from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(COOKIE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as CookiePreferences;
                setPreferences(parsed);
            }
        } catch (error) {
            console.error('Failed to load cookie preferences:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save preferences to localStorage
    const updatePreferences = (newPreferences: Partial<CookiePreferences>) => {
        const updated: CookiePreferences = {
            ...(preferences || DEFAULT_PREFERENCES),
            ...newPreferences,
            essential: true, // Always true
            timestamp: Date.now(),
        };

        try {
            localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(updated));
            setPreferences(updated);
        } catch (error) {
            console.error('Failed to save cookie preferences:', error);
        }
    };

    // Accept all cookies
    const acceptAll = () => {
        updatePreferences({
            analytics: true,
            marketing: true,
        });
    };

    // Reject non-essential cookies
    const rejectAll = () => {
        updatePreferences({
            analytics: false,
            marketing: false,
        });
    };

    // Check if a specific category is allowed
    const hasConsent = (category: 'essential' | 'analytics' | 'marketing'): boolean => {
        if (!preferences) return category === 'essential';
        return preferences[category];
    };

    // Check if user has made a choice
    const hasChoice = (): boolean => {
        return preferences !== null;
    };

    return {
        preferences,
        isLoading,
        updatePreferences,
        acceptAll,
        rejectAll,
        hasConsent,
        hasChoice,
    };
}
