import Header from '@app/components/shop/Header';
import Footer from '@app/components/ui/Footer';
import { CartProvider } from '@app/context/CartContext';
import CartDrawer from '@app/components/shop/CartDrawer';
import { getSiteSettings } from '@app/lib/getSiteSettings';

export default async function ShopLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const settings = await getSiteSettings();

    return (
        <CartProvider>
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
                <Header />
                <main className="flex-1">
                    {children}
                </main>
                <Footer settings={settings} />
                <CartDrawer />
            </div>
        </CartProvider>
    );
}
