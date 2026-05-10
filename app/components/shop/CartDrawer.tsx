'use client';

import { useEffect } from 'react';
import { useCart } from '@app/context/CartContext';
import CartPanel from './CartPanel';

export default function CartDrawer() {
    const {
        isCartOpen,
        closeCart,
        items,
        removeFromCart,
        updateLineQuantity,
        clearCart,
        cartTotal,
        cartCount,
    } = useCart();

    useEffect(() => {
        if (!isCartOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeCart();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isCartOpen, closeCart]);

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end font-sans">
            <button
                type="button"
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-default border-0 p-0"
                aria-label="ปิดตะกร้า"
                onClick={closeCart}
            />
            <CartPanel
                variant="drawer"
                items={items}
                cartTotal={cartTotal}
                cartCount={cartCount}
                removeFromCart={removeFromCart}
                updateLineQuantity={updateLineQuantity}
                clearCart={clearCart}
                onRequestClose={closeCart}
            />
        </div>
    );
}
