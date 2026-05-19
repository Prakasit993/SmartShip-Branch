import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import Header from '@app/components/shop/Header';
import HeroCarousel from '@app/components/home/HeroCarousel';
import dynamic from 'next/dynamic';
import { getSiteUrl } from '@/lib/site-url';
import { getHomePageData } from '@app/lib/getHomePageData';
import { getHeroSlidesFromSettings, getHomeSeoFromSettings } from '@app/lib/home-seo';
import { splitHeroTitle } from '@app/lib/split-hero-title';
import HomeReveal from '@app/components/home/HomeReveal';
import { HOME_DEFAULTS } from '@/lib/home-defaults';

const BusinessPackingSection = dynamic(() => import('@app/components/home/BusinessPackingSection'), {
  loading: () => <section className="py-16" aria-hidden="true" />,
});

const Footer = dynamic(() => import('@app/components/ui/Footer'), {
  loading: () => <footer className="py-16" aria-hidden="true" />,
});

export const revalidate = 20; // Revalidate every 20 seconds for better performance

function absoluteFromSiteBase(pathOrUrl: string, base: URL): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return new URL(path, base).toString();
}

export async function generateMetadata(): Promise<Metadata> {
  const { settingsResult } = await getHomePageData();
  const seo = getHomeSeoFromSettings(settingsResult.data);
  const base = getSiteUrl();
  const ogImageUrl = absoluteFromSiteBase(seo.ogImagePath, base);

  return {
    title: seo.title,
    description: seo.description,
    keywords: [
      'NYXEL',
      'สินค้า IT',
      'อุปกรณ์ IT',
      'Notebook',
      'การ์ดจอ',
      'การ์ดจอมือสอง',
      'RAM',
      'หูฟัง gaming',
      'คีย์บอร์ด mechanical',
      'gadget พรีเมียม',
      'IT shop ของแท้',
      'ส่งด่วนทั่วไทย',
    ],
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: base.toString(),
      siteName: seo.siteName,
      locale: 'th_TH',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: seo.ogImageAlt || seo.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  };
}

export default async function Home() {
  const { settingsResult, featuredBundlesResult, reviewsResult } = await getHomePageData();

  const settings = settingsResult.data;
  const getSetting = (key: string) => {
    const item = settings?.find((s) => s.key === key);
    return item ? String(item.value).replace(/^"|"$/g, '') : null;
  };

  const seo = getHomeSeoFromSettings(settings);
  const base = getSiteUrl();
  const origin = base.origin;

  const heroTitle = getSetting('hero_title') || HOME_DEFAULTS.heroTitle;
  const heroSubtitle = getSetting('hero_subtitle') || HOME_DEFAULTS.heroSubtitle;
  const announcement = getSetting('announcement');

  const heroSlides = getHeroSlidesFromSettings(settings);
  const { first: heroTitleFirst, rest: heroTitleRest } = splitHeroTitle(heroTitle);

  const featuredBundles = featuredBundlesResult.data;
  const reviews = reviewsResult.data;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: seo.siteName,
        description: seo.description,
        inLanguage: 'th-TH',
        publisher: { '@id': `${origin}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/shop?name={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': ['Organization', 'OnlineStore'],
        '@id': `${origin}/#organization`,
        name: seo.siteName,
        alternateName: 'NYXEL IT',
        url: `${origin}/`,
        description: seo.description,
        logo: absoluteFromSiteBase(seo.ogImagePath, base),
        image: absoluteFromSiteBase(seo.ogImagePath, base),
        areaServed: { '@type': 'Country', name: 'Thailand' },
        currenciesAccepted: 'THB',
        paymentAccepted: ['Bank Transfer', 'PromptPay', 'Cash'],
        knowsAbout: [
          'Notebook',
          'Graphics Card',
          'GPU',
          'RAM',
          'Mechanical Keyboard',
          'Gaming Headphones',
          'IT Equipment',
          'Express Shipping',
          'J&T Express',
        ],
        ...(seo.contactPhone
          ? {
              telephone: seo.contactPhone,
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: seo.contactPhone,
                contactType: 'customer service',
                areaServed: 'TH',
                availableLanguage: ['th', 'en'],
              },
            }
          : {}),
        ...(seo.contactAddress
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: seo.contactAddress,
                addressCountry: 'TH',
              },
            }
          : {}),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col min-h-screen bg-white dark:bg-black selection:bg-blue-500 selection:text-white overflow-x-hidden">
        <Header />

        <main id="main-content" className="home-typography flex flex-col flex-1 outline-none" tabIndex={-1}>
        {/* Announcement Banner - Premium Animated Design */}
        {announcement && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 text-black text-center py-2.5 sm:py-3 px-3 font-bold text-xs sm:text-sm tracking-wide shadow-lg z-20">
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer"
              style={{ animation: 'shimmer 3s ease-in-out infinite' }} />

            <div className="relative flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-3 max-w-4xl mx-auto">
              <span className="inline-flex items-center gap-1 shrink-0">
                <span className="text-base sm:text-lg animate-bounce">🔥</span>
                <span className="hidden sm:inline text-orange-800">โปรโมชั่นพิเศษ!</span>
              </span>
              <span className="hidden sm:block border-l border-orange-500/50 h-4 shrink-0" aria-hidden />
              <span className="font-extrabold tracking-wide text-balance px-1 min-w-0">
                {announcement}
              </span>
              <span className="hidden sm:block border-l border-orange-500/50 h-4 shrink-0" aria-hidden />
              <span className="text-base sm:text-lg animate-bounce delay-100 shrink-0">🎁</span>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="absolute inset-0 bg-grid-zinc-200/50 dark:bg-grid-zinc-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden={true}>
            <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl animate-hero-blob dark:bg-blue-500/12" />
            <div className="absolute top-1/4 -right-20 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl animate-hero-blob-alt dark:bg-cyan-400/12" />
          </div>

          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 home-section-y-lg relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 lg:gap-12 xl:gap-14 items-center">
              <div className="text-left space-y-6 sm:space-y-8">
                <div className="inline-block px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-semibold home-type-badge-pill mb-0 sm:mb-2 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 shadow-sm shadow-blue-500/10 animate-home-fade-up">
                  {HOME_DEFAULTS.heroBadge}
                </div>
                <h1 className="home-type-display font-black text-zinc-900 dark:text-white text-balance animate-home-fade-up home-delay-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                    {heroTitleFirst}
                  </span>
                  {heroTitleRest ? (
                    <>
                      {' '}
                      <span className="text-zinc-900 dark:text-white">{heroTitleRest}</span>
                    </>
                  ) : null}
                </h1>
                <p className="home-type-lead text-zinc-600 dark:text-zinc-400 home-prose-width text-pretty animate-home-fade-up home-delay-2">
                  {heroSubtitle}
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4 animate-home-fade-up home-delay-3">
                  <Link
                    href="/shop"
                    className="group relative inline-flex min-h-11 items-center justify-center px-6 py-3 sm:px-8 sm:py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold home-type-cta shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 overflow-hidden ring-1 ring-white/10 dark:ring-black/10 w-full sm:w-auto"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                      {HOME_DEFAULTS.shopCta}{' '}
                      <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex min-h-11 items-center justify-center px-6 py-3 sm:px-8 sm:py-3.5 bg-white/90 dark:bg-zinc-900 text-zinc-900 dark:text-white border-2 border-zinc-200 dark:border-zinc-700 rounded-full font-bold home-type-cta hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 backdrop-blur-sm shadow-md hover:shadow-lg w-full sm:w-auto"
                  >
                    {HOME_DEFAULTS.contactCta}
                  </Link>
                </div>
              </div>

              <div className="relative group perspective-1000 animate-home-fade-up home-delay-5 w-full max-w-xl md:max-w-none mx-auto md:mx-0">
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-3xl opacity-20 blur-2xl group-hover:opacity-40 transition duration-700 animate-hero-glow" />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 transform transition duration-300 ease-out hover:scale-[1.02] hover:rotate-1 hover:shadow-blue-500/10 dark:hover:shadow-blue-400/5">
                  <HeroCarousel slides={heroSlides} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Best Sellers Section */}
        <section className="relative home-section-y-lg overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950" />
          <div className="hidden md:block absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
          <div className="hidden md:block absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
            <HomeReveal className="text-center mb-10 sm:mb-14 lg:mb-16">
              <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 sm:px-5 sm:py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/30 mb-4 sm:mb-6 ring-1 ring-white/20">
                <span className="md:animate-bounce">⚡</span>
                สินค้าขายดี
                <span className="md:animate-bounce" style={{ animationDelay: '0.2s' }}>⚡</span>
              </div>
              <h2 className="home-type-section font-black mb-3 sm:mb-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 dark:from-cyan-300 dark:via-white dark:to-cyan-300 bg-clip-text text-transparent drop-shadow-sm px-1 text-balance">
                สินค้ายอดนิยม
              </h2>
              <p className="home-type-intro text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-pretty px-1">
                สินค้า IT ที่ลูกค้าเลือกซื้อมากที่สุด ของแท้ทุกชิ้น
              </p>
            </HomeReveal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {featuredBundles?.map((bundle, index) => (
                <HomeReveal key={bundle.id} delayMs={index * 50} className="min-h-0 h-full">
                  <Link href={`/shop/bundle/${bundle.slug}`} className="group block h-full">
                  <div className="relative bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border-2 border-transparent hover:border-cyan-400 shadow-lg hover:shadow-2xl hover:shadow-cyan-500/25 hover:-translate-y-2 hover:ring-2 hover:ring-cyan-400/20 transition-all duration-300 h-full flex flex-col">
                    {/* Ranking Badge */}
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm rounded-full flex items-center justify-center font-black text-white shadow-lg ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-500' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                            'bg-gradient-to-br from-cyan-400 to-blue-500'
                        }`}>
                        {index + 1}
                      </div>
                    </div>

                    <div className="aspect-square relative overflow-hidden">
                      {bundle.image_urls?.[0] && !bundle.image_urls[0].includes('placehold') ? (
                        <Image
                          src={bundle.image_urls[0]}
                          alt={bundle.name?.trim() ? `${bundle.name.trim()} — ภาพสินค้า` : 'สินค้า'}
                          title={bundle.name?.trim() || undefined}
                          fill
                          className="object-cover group-hover:scale-110 transition duration-700 ease-in-out"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 33vw, 25vw"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                          <div className="w-16 h-16 mb-3 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-3xl shadow-lg">
                            💻
                          </div>
                          <span className="text-xs text-zinc-400 font-medium">สินค้าพร้อมส่ง</span>
                        </div>
                      )}
                      {/* Hot Badge */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg flex items-center gap-0.5 sm:gap-1">
                        <span className="animate-pulse">⚡</span> HOT
                      </div>
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    <div className="p-3 sm:p-4 md:p-5 flex-1 flex flex-col bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
                      <h3 className="home-type-product-name font-bold line-clamp-2 mb-2 sm:mb-3 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">{bundle.name}</h3>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="home-type-price font-black bg-gradient-to-r from-cyan-500 to-blue-500 dark:from-cyan-300 dark:to-cyan-500 bg-clip-text text-transparent">
                            ฿{bundle.price?.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                </HomeReveal>
              ))}
              {(!featuredBundles || featuredBundles.length === 0) && (
                <div className="col-span-2 md:col-span-4 text-center py-14 sm:py-20 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-2 border-dashed border-cyan-200 dark:border-zinc-800 px-4">
                  <div className="text-6xl mb-4">💻</div>
                  <p className="home-type-intro text-zinc-500">เร็วๆ นี้จะมีสินค้าขายดี!</p>
                </div>
              )}
            </div>

            <HomeReveal className="text-center mt-10 sm:mt-14">
              <Link
                href="/shop"
                className="group inline-flex min-h-11 w-full max-w-md sm:w-auto items-center justify-center gap-2 sm:gap-3 px-8 py-4 sm:px-10 sm:py-5 mx-auto bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-full font-semibold home-type-cta shadow-xl shadow-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/45 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ring-1 ring-white/15"
              >
                ดูสินค้าทั้งหมด
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </HomeReveal>
          </div>
        </section>

        {/* Services Section */}
        <section className="bg-zinc-900 text-white home-section-y px-4 sm:px-6 relative overflow-hidden">
          <div className="hidden md:block absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="hidden md:block absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 text-center relative z-10">
            <HomeReveal className="text-center">
              <div className="p-6 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/12 hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-400 ring-1 ring-blue-400/30 shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="home-type-card-heading font-bold mb-2 sm:mb-3">{HOME_DEFAULTS.services[0].title}</h3>
              <p className="home-type-body-muted text-zinc-400 text-pretty">{HOME_DEFAULTS.services[0].desc}</p>
              </div>
            </HomeReveal>
            <HomeReveal delayMs={65} className="text-center">
              <div className="p-6 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/12 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-purple-400 ring-1 ring-purple-400/30 shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="home-type-card-heading font-bold mb-2 sm:mb-3">{HOME_DEFAULTS.services[1].title}</h3>
              <p className="home-type-body-muted text-zinc-400 text-pretty">{HOME_DEFAULTS.services[1].desc}</p>
              </div>
            </HomeReveal>
            <HomeReveal delayMs={130} className="text-center">
              <div className="p-6 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/12 hover:border-white/20 hover:shadow-lg hover:shadow-green-500/5 hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-green-400 ring-1 ring-green-400/30 shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="home-type-card-heading font-bold mb-2 sm:mb-3">{HOME_DEFAULTS.services[2].title}</h3>
              <p className="home-type-body-muted text-zinc-400 text-pretty">{HOME_DEFAULTS.services[2].desc}</p>
              </div>
            </HomeReveal>
          </div>
        </section>

        <HomeReveal>
          <BusinessPackingSection />
        </HomeReveal>

        {/* Customer Reviews Section */}
        <section className="bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-black home-section-y px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <HomeReveal className="text-center mb-10 sm:mb-14 lg:mb-16">
              <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-semibold text-xs tracking-wider uppercase mb-4 ring-1 ring-yellow-500/20">
                ⭐ รีวิวจากลูกค้า
              </div>
              <h2 className="home-type-review-title font-black mb-3 sm:mb-4 px-1 text-balance">เสียงจากลูกค้าของเรา</h2>
              <p className="home-type-intro text-zinc-500 dark:text-zinc-400 text-pretty max-w-xl mx-auto">ความประทับใจจากผู้ใช้บริการจริง</p>
              <div className="w-24 h-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mt-4 shadow-sm shadow-orange-500/30" />
            </HomeReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
              {reviews && reviews.length > 0 ? (
                reviews.slice(0, 3).map((review, revIndex) => (
                  <HomeReveal key={review.id} delayMs={revIndex * 55}>
                  <div className="bg-white dark:bg-zinc-800 rounded-2xl p-5 sm:p-6 border border-zinc-100 dark:border-zinc-700 shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-yellow-200/60 dark:hover:border-yellow-700/40 transition-all duration-200 relative h-full">
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
                    <p className="home-type-review-body text-zinc-700 dark:text-zinc-300 mb-5 sm:mb-6 text-pretty">{review.comment || 'ลูกค้าให้คะแนนสินค้า'}</p>
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
                  </HomeReveal>
                ))
              ) : (
                <div className="col-span-3 text-center py-16 rounded-2xl bg-white dark:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="home-type-intro text-zinc-500 max-w-md mx-auto">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวสินค้าของเราได้เลย!</p>
                </div>
              )}
            </div>
          </div>
        </section>

        </main>

        <Footer settings={settings?.reduce((acc, s) => ({ ...acc, [s.key]: String(s.value).replace(/^"|"$/g, '') }), {} as Record<string, string>)} />
      </div>
    </>
  );
}
