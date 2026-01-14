import Header from '@app/components/shop/Header';
import Footer from '@app/components/ui/Footer';
import { CartProvider } from '@app/context/CartContext';
import CartDrawer from '@app/components/shop/CartDrawer';

export default function ShopLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <CartProvider>
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
                <Header />
                <main className="flex-1">
                    {children}
                </main>
                <Footer />
                <CartDrawer />
            </div>
        </CartProvider>
    );
}
