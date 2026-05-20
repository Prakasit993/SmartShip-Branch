'use client';

const TICKER_ITEMS = [
  { icon: '⚡', label: 'ส่งด่วน J&T Express' },
  { icon: '✓', label: 'สินค้าของแท้ 100%' },
  { icon: '🔄', label: 'รับประกันคุณภาพ' },
  { icon: '💳', label: 'ชำระสะดวก QR/โอน' },
  { icon: '📦', label: 'แพ็คแน่นทุกออเดอร์' },
  { icon: '🛡️', label: 'GPU มือสองตรวจสอบแล้ว' },
  { icon: '⚙️', label: 'RAM / SSD พร้อมส่ง' },
  { icon: '🎮', label: 'อุปกรณ์ Gaming' },
];

export default function InfiniteTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="relative overflow-hidden bg-zinc-950 dark:bg-black border-y border-zinc-800 py-3 select-none" aria-hidden="true">
      {/* Left fade */}
      <div className="pointer-events-none absolute left-0 inset-y-0 w-16 bg-gradient-to-r from-zinc-950 dark:from-black to-transparent z-10" />
      {/* Right fade */}
      <div className="pointer-events-none absolute right-0 inset-y-0 w-16 bg-gradient-to-l from-zinc-950 dark:from-black to-transparent z-10" />

      <div className="flex nyxel-ticker-track">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0 px-5 sm:px-8">
            <span className="text-sm">{item.icon}</span>
            <span className="font-mono text-[11px] sm:text-xs tracking-[0.18em] uppercase font-semibold text-zinc-300">
              {item.label}
            </span>
            <span className="ml-4 sm:ml-6 w-1 h-1 rounded-full bg-cyan-500/60 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
