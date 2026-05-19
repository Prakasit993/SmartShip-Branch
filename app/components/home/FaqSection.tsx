import HomeReveal from '@app/components/home/HomeReveal';
import NyxelCard from '@app/components/ui/NyxelCard';
import { HOME_FAQ } from '@app/lib/home-faq';

/**
 * NYXEL FAQ — uses shared NyxelCard (variant="lab").
 * All cards open by default for SEO crawl + scanning.
 */
export default function FaqSection() {
  return (
    <section className="relative home-section-y overflow-hidden bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800">
      {/* Ambient blobs */}
      <div className="hidden md:block absolute top-1/3 -left-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl -translate-y-1/2" aria-hidden />
      <div className="hidden md:block absolute bottom-1/3 -right-40 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl translate-y-1/2" aria-hidden />

      {/* Faint grid overlay (dark mode only) */}
      <div
        className="hidden dark:block absolute inset-0 opacity-[0.04] pointer-events-none"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(rgb(34 211 238 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(34 211 238 / 0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header — lab-style */}
        <HomeReveal className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-bold tracking-[0.25em] uppercase mb-5 ring-1 ring-cyan-500/30 shadow-[0_0_24px_-8px_rgb(34_211_238/0.5)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            // FAQ.LOG
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <h2 className="home-type-section font-black mb-3 sm:mb-4 px-1 text-balance text-zinc-900 dark:text-white">
            คำถามที่พบบ่อย
          </h2>
          <p className="home-type-intro text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto text-pretty mb-6">
            คำตอบสำหรับคำถามทั่วไปเกี่ยวกับสินค้า รับประกัน และการจัดส่ง
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-cyan-500/40" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-600 dark:text-cyan-400">
              {String(HOME_FAQ.length).padStart(2, '0')} ENTRIES
            </span>
            <span className="h-px w-12 bg-cyan-500/40" />
          </div>
        </HomeReveal>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {HOME_FAQ.map((item, idx) => (
            <HomeReveal key={idx} delayMs={idx * 50}>
              <NyxelCard
                variant="lab"
                index={idx + 1}
                subLabel={`Q.${String(idx + 1).padStart(2, '0')}`}
                subLabelTag="NYXEL // FAQ"
              >
                <h3 className="font-bold text-zinc-900 dark:text-white text-base sm:text-lg leading-snug mb-3 text-pretty">
                  {item.question}
                </h3>
                <div className="h-px w-10 bg-cyan-500/30 group-hover:w-20 group-hover:bg-cyan-500/60 transition-all duration-500 mb-3" aria-hidden />
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                  {item.answer}
                </p>
              </NyxelCard>
            </HomeReveal>
          ))}
        </div>

        {/* Footer hint line */}
        <HomeReveal className="text-center mt-12">
          <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-400 dark:text-zinc-600 uppercase">
            <span className="text-cyan-500 dark:text-cyan-400">$</span> ยังมีคำถามอื่น? ทักทีม NYXEL ผ่าน LINE หรือหน้าติดต่อ
          </p>
        </HomeReveal>
      </div>
    </section>
  );
}
