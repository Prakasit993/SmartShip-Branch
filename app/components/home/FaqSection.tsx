import { ChevronDown } from 'lucide-react';
import HomeReveal from '@app/components/home/HomeReveal';
import { HOME_FAQ } from '@app/lib/home-faq';

export default function FaqSection() {
  return (
    <section className="relative home-section-y overflow-hidden bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800">
      <div className="hidden md:block absolute top-1/2 -left-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl -translate-y-1/2" aria-hidden />
      <div className="hidden md:block absolute top-1/2 -right-32 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl -translate-y-1/2" aria-hidden />

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <HomeReveal className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-semibold text-xs tracking-wider uppercase mb-4 ring-1 ring-cyan-500/20">
            ◆ FAQ
          </div>
          <h2 className="home-type-section font-black mb-3 sm:mb-4 px-1 text-balance text-zinc-900 dark:text-white">
            คำถามที่พบบ่อย
          </h2>
          <p className="home-type-intro text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto text-pretty">
            คำตอบสำหรับคำถามทั่วไปเกี่ยวกับสินค้า รับประกัน และการจัดส่ง
          </p>
        </HomeReveal>

        <div className="space-y-3 sm:space-y-4">
          {HOME_FAQ.map((item, idx) => (
            <HomeReveal key={idx} delayMs={idx * 40}>
              <details className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-cyan-400/60 dark:hover:border-cyan-500/40 transition-colors overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-zinc-900 dark:text-white text-pretty">
                    {item.question}
                  </span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180 group-open:text-cyan-500"
                    aria-hidden
                  />
                </summary>
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 -mt-1">
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                    {item.answer}
                  </p>
                </div>
              </details>
            </HomeReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
