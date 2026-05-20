import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";
import { ThemeProvider } from "@app/context/ThemeContext";
import { LanguageProvider } from "@app/context/LanguageContext";
import { CartProvider } from "@app/context/CartContext";
import CartDrawerGate from "@app/components/shop/CartDrawerGate";
import CookieConsent from "@app/components/ui/CookieConsent";
import { ToastProvider } from "@app/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "NYXEL — สินค้า IT พรีเมียม ส่งไวทั่วไทย",
    template: "%s | NYXEL",
  },
  description:
    "NYXEL — Notebook · การ์ดจอ · RAM · หูฟัง · คีย์บอร์ด คัดสรรของแท้พร้อมรับประกัน จัดส่งด่วนทั่วไทยผ่าน J&T Express",
  applicationName: "NYXEL",
  authors: [{ name: "NYXEL" }],
  creator: "NYXEL",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "NYXEL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='app-theme';var t=localStorage.getItem(k);var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}else if(t==='light'){r.classList.remove('dark');}else{if(window.matchMedia('(prefers-color-scheme: dark)').matches){r.classList.add('dark');}else{r.classList.remove('dark');}}}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <LanguageProvider>
            <CartProvider>
              <ToastProvider>
                {children}
                <CartDrawerGate />
                <CookieConsent />
              </ToastProvider>
            </CartProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

