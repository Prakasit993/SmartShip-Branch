'use client';

import { useCart } from '@app/context/CartContext';
import CartPanel from '@app/components/shop/CartPanel';

export default function CartPageClient() {
    const {
        items,
        removeFromCart,
        updateLineQuantity,
        clearCart,
        cartTotal,
        cartCount,
    } = useCart();

    return (
        <CartPanel
            variant="page"
            items={items}
            cartTotal={cartTotal}
            cartCount={cartCount}
            removeFromCart={removeFromCart}
            updateLineQuantity={updateLineQuantity}
            clearCart={clearCart}
        />
    );
}
