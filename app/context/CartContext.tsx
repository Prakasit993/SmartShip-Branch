'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
} from 'react';

export type CartItem = {
    bundle_id: number;
    bundle_name: string;
    /** ใช้ลิงก์ไปหน้ารายละเอียดจากตะกร้า */
    bundle_slug?: string;
    price: number;
    quantity: number;
    image_url?: string;
    options?: {
        group_name: string;
        option_name: string;
        product_id: number;
        price_modifier: number;
    }[];
};

interface CartContextType {
    items: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (index: number) => void;
    updateLineQuantity: (index: number, quantity: number) => void;
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;
    toggleCart: () => void;
    openCart: () => void;
    closeCart: () => void;
    isCartOpen: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'smartship-cart-v2';

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as CartItem[];
                if (Array.isArray(parsed)) setItems(parsed);
            }
        } catch (e) {
            console.error('Failed to parse cart', e);
            try {
                const legacy = localStorage.getItem('cart');
                if (legacy) {
                    const parsed = JSON.parse(legacy) as CartItem[];
                    if (Array.isArray(parsed)) setItems(parsed);
                }
            } catch {
                /* ignore */
            }
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items, hydrated]);

    const addToCart = useCallback((newItem: CartItem) => {
        setItems((prev) => {
            const existingIdx = prev.findIndex(
                (item) =>
                    item.bundle_id === newItem.bundle_id &&
                    JSON.stringify(item.options) === JSON.stringify(newItem.options)
            );

            if (existingIdx > -1) {
                const next = [...prev];
                next[existingIdx] = {
                    ...next[existingIdx],
                    quantity: next[existingIdx].quantity + newItem.quantity,
                };
                return next;
            }
            return [...prev, newItem];
        });
        setIsCartOpen(true);
    }, []);

    const removeFromCart = useCallback((index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const updateLineQuantity = useCallback((index: number, quantity: number) => {
        setItems((prev) => {
            if (quantity <= 0) return prev.filter((_, i) => i !== index);
            if (index < 0 || index >= prev.length) return prev;
            const next = [...prev];
            next[index] = { ...next[index], quantity };
            return next;
        });
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const toggleCart = useCallback(() => setIsCartOpen((o) => !o), []);
    const openCart = useCallback(() => setIsCartOpen(true), []);
    const closeCart = useCallback(() => setIsCartOpen(false), []);

    const cartTotal = useMemo(
        () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [items]
    );
    const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

    const value = useMemo(
        () => ({
            items,
            addToCart,
            removeFromCart,
            updateLineQuantity,
            clearCart,
            cartTotal,
            cartCount,
            toggleCart,
            openCart,
            closeCart,
            isCartOpen,
        }),
        [
            items,
            addToCart,
            removeFromCart,
            updateLineQuantity,
            clearCart,
            cartTotal,
            cartCount,
            toggleCart,
            openCart,
            closeCart,
            isCartOpen,
        ]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
