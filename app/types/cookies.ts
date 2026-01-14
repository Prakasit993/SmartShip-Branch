export interface CookiePreferences {
    essential: boolean;    // Always true, required for site functionality
    analytics: boolean;    // Google Analytics, performance tracking
    marketing: boolean;    // Ads, social media pixels
    timestamp: number;     // When consent was given
    version: string;       // Policy version
}

export const DEFAULT_PREFERENCES: CookiePreferences = {
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: Date.now(),
    version: '1.0',
};

export const COOKIE_STORAGE_KEY = 'cookie_preferences';

export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieInfo {
    name: string;
    category: CookieCategory;
    purpose: string;
    duration: string;
}

// List of cookies used by the site
export const COOKIES_LIST: CookieInfo[] = [
    {
        name: 'cookie_preferences',
        category: 'essential',
        purpose: 'Stores your cookie preferences',
        duration: '1 year',
    },
    {
        name: 'admin_session',
        category: 'essential',
        purpose: 'Admin authentication session',
        duration: '1 day',
    },
    {
        name: '_ga',
        category: 'analytics',
        purpose: 'Google Analytics - track user behavior',
        duration: '2 years',
    },
    {
        name: '_gid',
        category: 'analytics',
        purpose: 'Google Analytics - identify unique users',
        duration: '24 hours',
    },
    {
        name: '_fbp',
        category: 'marketing',
        purpose: 'Facebook Pixel - track conversions',
        duration: '3 months',
    },
];
