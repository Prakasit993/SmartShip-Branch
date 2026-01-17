import Link from 'next/link';
import BusinessPackingSection from '@app/components/home/BusinessPackingSection';
import { supabase } from '@/lib/supabaseClient';
import Header from '@app/components/shop/Header';
import { CartProvider } from '@app/context/CartContext';
import CartDrawer from '@app/components/shop/CartDrawer';
import HeroCarousel from '@app/components/home/HeroCarousel';
import Footer from '@app/components/ui/Footer';

export const dynamic = 'force-dynamic'; // Always fetch fresh data from DB

export default async function Home() {
  // Fetch settings
  const { data: settings } = await supabase.from('settings').select('*');
  const getSetting = (key: string) => {
    const item = settings?.find(s => s.key === key);
    return item ? String(item.value).replace(/^"|"$/g, '') : null;
  };

  const getJsonSetting = (key: string) => {
    const item = settings?.find(s => s.key === key);
    if (!item) return null;
    try {
      // If it's already a stringified JSON in the DB
      let val = item.value;
      // Handle potential double stringifying if existing logic is messy, 
      // but usually supabase returns the value. 
      // If the column is text/json, we might need to parse.
      // Assuming text column storing JSON string.
      if (typeof val === 'string') {
        // Try to parse if it looks like array
        if (val.startsWith('[') || val.startsWith('{')) {
          return JSON.parse(val);
        }
        // If it's just a raw string path
        return [val.replace(/^"|"$/g, '')];
      }
      return val; // If already object/array
    } catch (e) {
      return null;
    }
  };

  const heroTitle = getSetting('hero_title') || 'Exclusive Express Add-ons';
  const heroSubtitle = getSetting('hero_subtitle') || 'Premium boxes, tape, and packing essentials available instantly. Order now and pick up at the shop or get it prepared.';
  const announcement = getSetting('announcement');

  // Parse hero images or fallback
  const heroImagesRaw = getJsonSetting('hero_images');
  const heroImages = Array.isArray(heroImagesRaw) && heroImagesRaw.length > 0
    ? heroImagesRaw
    : ['/smartship-storefront.png'];


  // Fetch a few active bundles for display
  const { data: featuredBundles } = await supabase
    .from('bundles')
    .select('*, categories(name)')
    .eq('is_active', true)
    .limit(4);

  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-white dark:bg-black selection:bg-blue-500 selection:text-white">
        <Header />

        {/* Announcement */}
        {announcement && (
          <div className="bg-[#FFD700] text-black text-center py-2.5 font-bold text-sm tracking-wide uppercase shadow-sm relative z-20">
            <span className="animate-pulse mr-2">📢</span>
            {announcement}
          </div>
        )}

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="absolute inset-0 bg-grid-zinc-200/50 dark:bg-grid-zinc-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

          <div className="container mx-auto px-6 py-20 md:py-32 relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="text-left space-y-8">
                <div className="inline-block px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs tracking-wider uppercase mb-2 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
                  ✨ Premium Packing Service
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tight text-zinc-900 dark:text-white leading-[1.1]">
                  {heroTitle.split(' ').map((word, i) => (
                    <span key={i} className={i === 0 ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500" : ""}>
                      {word}{' '}
                    </span>
                  ))}
                </h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
                  {heroSubtitle}
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Link
                    href="/shop"
                    className="group relative px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Shop Bundles <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                  <Link
                    href="/contact"
                    className="px-8 py-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-2 border-zinc-200 dark:border-zinc-700 rounded-full font-bold text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>

              <div className="relative group perspective-1000">
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-3xl opacity-20 blur-2xl group-hover:opacity-40 transition duration-700 animate-tilt"></div>
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transform transition duration-500 hover:scale-[1.02] hover:rotate-1">
                  <HeroCarousel images={heroImages} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Section */}
        <section className="container mx-auto px-4 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Featured Sets</h2>
            <div className="w-24 h-1.5 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {featuredBundles?.map((bundle) => (
              <Link href={`/shop/bundle/${bundle.slug}`} key={bundle.id} className="group block">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full flex flex-col">
                  <div className="aspect-square relative bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    {bundle.image_urls?.[0] ? (
                      <img
                        src={bundle.image_urls[0]}
                        alt={bundle.name}
                        className="object-cover w-full h-full group-hover:scale-110 transition duration-700 ease-in-out"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                        <span className="text-sm uppercase tracking-widest font-medium">No Image</span>
                      </div>
                    )}
                    {/* Badge */}
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded shadow-sm">
                      READY
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg line-clamp-1 mb-2 group-hover:text-blue-600 transition-colors">{bundle.name}</h3>
                    <div className="mt-auto flex items-center justify-between">
                      <p className="text-2xl font-black text-blue-600">฿{bundle.price}</p>
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {(!featuredBundles || featuredBundles.length === 0) && (
              <div className="col-span-4 text-center py-20 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-200">
                <p className="text-zinc-500 text-lg">No featured items yet. Check back soon!</p>
              </div>
            )}
          </div>

          <div className="text-center mt-16">
            <Link href="/shop" className="inline-flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-lg hover:text-blue-600 transition-colors border-b-2 border-transparent hover:border-blue-600 pb-0.5">
              View All Products
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </section>

        {/* Services Section with new Icons */}
        <section className="bg-zinc-900 text-white py-24 px-4 relative overflow-hidden">
          {/* Decorative Circles */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative z-10">
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">Fast Service</h3>
              <p className="text-zinc-400 leading-relaxed">Order online and your items will be ready for pickup immediately upon arrival.</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-purple-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">Quality Assured</h3>
              <p className="text-zinc-400 leading-relaxed">We carefully select only the best heavy-duty packaging materials.</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-green-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">Expert Support</h3>
              <p className="text-zinc-400 leading-relaxed">Need packing advice? Chat with us via LINE or ask our staff.</p>
            </div>
          </div>
        </section>

        <BusinessPackingSection />

        <Footer />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
