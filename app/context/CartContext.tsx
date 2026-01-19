'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export type CartItem = {
    bundle_id: number;
    bundle_name: string;
    price: number;
    quantity: number;
    image_url?: string;
    // For configurable bundles
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
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;
    toggleCart: () => void;
    isCartOpen: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const processedCallsRef = useRef<Set<string>>(new Set());
    const callCounterRef = useRef(0);

    useEffect(() => {
        const saved = localStorage.getItem('cart');
        if (saved) {
            try {
                setItems(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse cart', e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(items));
    }, [items]);

    const addToCart = useCallback((newItem: CartItem) => {
        // Generate unique call ID based on bundle and current counter
        const callId = `${newItem.bundle_id}-${Date.now()}-${callCounterRef.current++}`;

        // If we've seen a very similar call recently (within last 100 calls), skip
        const recentCallKey = `${newItem.bundle_id}-${Math.floor(Date.now() / 1000)}`;

        if (processedCallsRef.current.has(recentCallKey)) {
            console.log('Blocked duplicate addToCart:', recentCallKey);
            return;
        }

        // Mark this call as processed
        processedCallsRef.current.add(recentCallKey);

        // Clean up old entries after 2 seconds
        setTimeout(() => {
            processedCallsRef.current.delete(recentCallKey);
        }, 2000);

        setItems((prev) => {
            // Check if identical item exists (same bundle and options)
            const existingIdx = prev.findIndex(item =>
                item.bundle_id === newItem.bundle_id &&
                JSON.stringify(item.options) === JSON.stringify(newItem.options)
            );

            if (existingIdx > -1) {
                const newItems = [...prev];
                newItems[existingIdx].quantity += newItem.quantity;
                return newItems;
            }
            return [...prev, newItem];
        });
        setIsCartOpen(true);
    }, []);

    const removeFromCart = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const clearCart = () => setItems([]);

    const toggleCart = () => setIsCartOpen(!isCartOpen);

    const cartTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, cartTotal, cartCount, toggleCart, isCartOpen }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
