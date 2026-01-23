import Link from 'next/link';
import Image from 'next/image';
import BusinessPackingSection from '@app/components/home/BusinessPackingSection';
import { supabase } from '@/lib/supabaseClient';
import Header from '@app/components/shop/Header';
import { CartProvider } from '@app/context/CartContext';
import CartDrawer from '@app/components/shop/CartDrawer';
import HeroCarousel from '@app/components/home/HeroCarousel';
import Footer from '@app/components/ui/Footer';

export const revalidate = 20; // Revalidate every 20 seconds for better performance

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

  // Fetch recent approved reviews for homepage
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, reviewer_name, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(6);

  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-white dark:bg-black selection:bg-blue-500 selection:text-white">
        <Header />

        {/* Announcement Banner - Premium Animated Design */}
        {announcement && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 text-black text-center py-3 font-bold text-sm tracking-wide shadow-lg z-20">
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer"
              style={{ animation: 'shimmer 3s ease-in-out infinite' }} />

            <div className="relative flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="text-lg animate-bounce">🔥</span>
                <span className="hidden sm:inline text-orange-800">โปรโมชั่นพิเศษ!</span>
              </span>
              <span className="border-l border-orange-500/50 h-4" />
              <span className="font-extrabold tracking-wide">
                {announcement}
              </span>
              <span className="border-l border-orange-500/50 h-4" />
              <span className="text-lg animate-bounce delay-100">🎁</span>
            </div>
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

        {/* Best Sellers Section */}
        <section className="relative py-24 overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-zinc-900 dark:via-black dark:to-zinc-900" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 mb-6">
                <span className="animate-bounce">🔥</span>
                สินค้าขายดี
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🔥</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 bg-clip-text text-transparent">
                สินค้ายอดนิยม
              </h2>
              <p className="text-zinc-500 text-lg max-w-md mx-auto">สินค้าที่ลูกค้าเลือกซื้อมากที่สุด คุณภาพเกินราคา!</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featuredBundles?.map((bundle, index) => (
                <Link href={`/shop/bundle/${bundle.slug}`} key={bundle.id} className="group block">
                  <div className="relative bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border-2 border-transparent hover:border-orange-400 shadow-lg hover:shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-3 transition-all duration-500 h-full flex flex-col">
                    {/* Ranking Badge */}
                    <div className="absolute top-3 right-3 z-20">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-lg ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-500' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                            'bg-gradient-to-br from-orange-400 to-red-500'
                        }`}>
                        {index + 1}
                      </div>
                    </div>

                    <div className="aspect-square relative overflow-hidden">
                      {bundle.image_urls?.[0] && !bundle.image_urls[0].includes('placehold') ? (
                        <Image
                          src={bundle.image_urls[0]}
                          alt={bundle.name}
                          fill
                          className="object-cover group-hover:scale-110 transition duration-700 ease-in-out"
                          sizes="(max-width: 768px) 50vw, 25vw"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                          <div className="w-16 h-16 mb-3 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-3xl shadow-lg">
                            📦
                          </div>
                          <span className="text-xs text-zinc-400 font-medium">สินค้าพร้อมส่ง</span>
                        </div>
                      )}
                      {/* Hot Badge */}
                      <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <span className="animate-pulse">🔥</span> HOT
                      </div>
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    <div className="p-5 flex-1 flex flex-col bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
                      <h3 className="font-bold text-base line-clamp-2 mb-3 group-hover:text-orange-600 transition-colors">{bundle.name}</h3>
                      <div className="mt-auto flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                            ฿{bundle.price?.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {(!featuredBundles || featuredBundles.length === 0) && (
                <div className="col-span-4 text-center py-20 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-dashed border-orange-200 dark:border-zinc-800">
                  <div className="text-6xl mb-4">📦</div>
                  <p className="text-zinc-500 text-lg">เร็วๆ นี้จะมีสินค้าขายดี!</p>
                </div>
              )}
            </div>

            <div className="text-center mt-14">
              <Link href="/shop" className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-full font-bold text-lg shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-1 transition-all duration-500">
                ดูสินค้าทั้งหมด
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="bg-zinc-900 text-white py-24 px-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative z-10">
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">บริการรวดเร็ว</h3>
              <p className="text-zinc-400 leading-relaxed">สั่งซื้อออนไลน์ สินค้าพร้อมรับทันทีเมื่อมาถึงร้าน</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-purple-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">คุณภาพมั่นใจ</h3>
              <p className="text-zinc-400 leading-relaxed">คัดสรรเฉพาะวัสดุบรรจุภัณฑ์คุณภาพสูงสำหรับคุณ</p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition duration-500">
              <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-green-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-3">ทีมงานผู้เชี่ยวชาญ</h3>
              <p className="text-zinc-400 leading-relaxed">ต้องการคำแนะนำ? แชทหาเราทาง LINE หรือถามพนักงาน</p>
            </div>
          </div>
        </section>

        <BusinessPackingSection />

        {/* Customer Reviews Section */}
        <section className="bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-black py-24 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-semibold text-xs tracking-wider uppercase mb-4">
                ⭐ รีวิวจากลูกค้า
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-4">เสียงจากลูกค้าของเรา</h2>
              <p className="text-zinc-500 text-lg">ความประทับใจจากผู้ใช้บริการจริง</p>
              <div className="w-24 h-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {reviews && reviews.length > 0 ? (
                reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-700 shadow-lg hover:shadow-xl transition-all duration-300 relative">
                    <div className="absolute -top-3 left-6">
                      <span className="text-4xl">❝</span>
                    </div>
                    <div className="flex items-center gap-1 mb-4 mt-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-lg ${star <= review.rating ? 'text-yellow-400' : 'text-zinc-300'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 mb-6 leading-relaxed">{review.comment || 'ลูกค้าให้คะแนนสินค้า'}</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {(review.reviewer_name || 'ลูกค้า').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">{review.reviewer_name || 'ลูกค้า'}</p>
                        <p className="text-sm text-zinc-500">{new Date(review.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-16 rounded-2xl bg-white dark:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="text-zinc-500 text-lg">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวสินค้าของเราได้เลย!</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <Footer settings={settings?.reduce((acc, s) => ({ ...acc, [s.key]: String(s.value).replace(/^"|"$/g, '') }), {} as Record<string, string>)} />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
