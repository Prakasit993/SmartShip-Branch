import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

const DEMO_CATEGORIES = [
  { name: 'การ์ดจอ (GPU)', slug: 'gpu', sort_order: 1 },
  { name: 'Notebook', slug: 'notebook', sort_order: 2 },
  { name: 'RAM & Storage', slug: 'ram-storage', sort_order: 3 },
  { name: 'อุปกรณ์ Gaming', slug: 'gaming', sort_order: 4 },
];

// Picsum photos that look like tech products (consistent seeds)
const DEMO_BUNDLES = [
  // GPU
  {
    cat: 'การ์ดจอ (GPU)',
    name: 'RTX 4060 Ti 8GB GDDR6',
    slug: 'rtx-4060-ti-8gb',
    description: 'การ์ดจอ NVIDIA RTX 4060 Ti 8GB GDDR6 มือสอง ผ่านการตรวจสอบเต็มระบบ พร้อมรับประกัน 3 เดือน',
    price: 9800,
    image: 'https://picsum.photos/seed/gpu1/600/600',
  },
  {
    cat: 'การ์ดจอ (GPU)',
    name: 'RX 6700 XT 12GB GDDR6',
    slug: 'rx-6700-xt-12gb',
    description: 'การ์ดจอ AMD RX 6700 XT 12GB ประสิทธิภาพสูง เล่นเกม 1440p ลื่น ผ่านการทดสอบ benchmark',
    price: 8500,
    image: 'https://picsum.photos/seed/gpu2/600/600',
  },
  {
    cat: 'การ์ดจอ (GPU)',
    name: 'GTX 1080 Ti 11GB (Classic)',
    slug: 'gtx-1080-ti-11gb',
    description: 'ตำนานการ์ดจอ GTX 1080 Ti 11GB ยังแรงอยู่ ราคาคุ้มที่สุด เล่น 1080p เฟรมเรทสูง',
    price: 4200,
    image: 'https://picsum.photos/seed/gpu3/600/600',
  },
  // Notebook
  {
    cat: 'Notebook',
    name: 'ASUS ROG Strix G15 RTX 3060',
    slug: 'asus-rog-strix-g15-rtx3060',
    description: 'Notebook Gaming ทรงพลัง AMD Ryzen 7 + RTX 3060 RAM 16GB SSD 512GB พร้อมใช้งาน',
    price: 28900,
    image: 'https://picsum.photos/seed/nb1/600/600',
  },
  {
    cat: 'Notebook',
    name: 'Lenovo ThinkPad X1 Carbon Gen 10',
    slug: 'thinkpad-x1-carbon-gen10',
    description: 'Business Notebook พรีเมียม Intel Core i7 Gen12 RAM 16GB SSD 512GB น้ำหนักเบา 1.1 กก.',
    price: 32500,
    image: 'https://picsum.photos/seed/nb2/600/600',
  },
  {
    cat: 'Notebook',
    name: 'MacBook Pro M3 14" Space Gray',
    slug: 'macbook-pro-m3-14',
    description: 'MacBook Pro M3 chip 14 นิ้ว RAM 16GB SSD 512GB ประสิทธิภาพสูง ใช้งานได้ยาวนาน',
    price: 52000,
    image: 'https://picsum.photos/seed/nb3/600/600',
  },
  // RAM & Storage
  {
    cat: 'RAM & Storage',
    name: 'Kingston DDR5 32GB 5600MHz Kit',
    slug: 'kingston-ddr5-32gb-5600',
    description: 'แรม DDR5 32GB (16GB x2) ความเร็ว 5600MHz พร้อมติดตั้ง สำหรับ Intel 12th/13th/14th Gen',
    price: 3200,
    image: 'https://picsum.photos/seed/ram1/600/600',
  },
  {
    cat: 'RAM & Storage',
    name: 'Samsung 990 Pro NVMe 1TB',
    slug: 'samsung-990-pro-nvme-1tb',
    description: 'SSD NVMe Gen4 ความเร็วสูงสุด 7,450MB/s Samsung 990 Pro 1TB รับประกัน 5 ปี',
    price: 2800,
    image: 'https://picsum.photos/seed/ssd1/600/600',
  },
  {
    cat: 'RAM & Storage',
    name: 'Corsair Vengeance DDR4 16GB 3200',
    slug: 'corsair-ddr4-16gb-3200',
    description: 'แรม DDR4 16GB (8GB x2) 3200MHz สีดำ ติดตั้งง่าย ใช้ได้ทั้ง AMD และ Intel',
    price: 1650,
    image: 'https://picsum.photos/seed/ram2/600/600',
  },
  // Gaming
  {
    cat: 'อุปกรณ์ Gaming',
    name: 'Keychron K2 Pro QMK Wireless',
    slug: 'keychron-k2-pro-qmk',
    description: 'Mechanical Keyboard Keychron K2 Pro พร้อม RGB แบตในตัว Wireless Bluetooth / USB-C',
    price: 3900,
    image: 'https://picsum.photos/seed/kb1/600/600',
  },
  {
    cat: 'อุปกรณ์ Gaming',
    name: 'Logitech G Pro X Superlight 2',
    slug: 'logitech-g-pro-x-superlight2',
    description: 'Gaming Mouse ไร้สาย น้ำหนักเพียง 60g Hero 2 sensor 32000 DPI ระดับ Pro',
    price: 5200,
    image: 'https://picsum.photos/seed/mouse1/600/600',
  },
  {
    cat: 'อุปกรณ์ Gaming',
    name: 'HyperX Cloud III Wireless',
    slug: 'hyperx-cloud-3-wireless',
    description: 'หูฟัง Gaming ไร้สาย HyperX Cloud III ดีเลย์ต่ำ 2.4GHz เสียงเซอร์ราวด์ DTS',
    price: 4500,
    image: 'https://picsum.photos/seed/hp1/600/600',
  },
];

export async function GET() {
  // 1. Get existing categories
  const { data: existingCats } = await supabaseAdmin
    .from('categories')
    .select('id, name');

  const existingNames = new Set((existingCats ?? []).map((c: any) => c.name));
  const catMap = Object.fromEntries((existingCats ?? []).map((c: any) => [c.name, c.id]));

  // Insert only missing categories
  const newCats = DEMO_CATEGORIES.filter((c) => !existingNames.has(c.name));
  if (newCats.length > 0) {
    const { data: inserted, error: catErr } = await supabaseAdmin
      .from('categories')
      .insert(newCats)
      .select('id, name');
    if (catErr) return NextResponse.json({ error: 'categories: ' + catErr.message }, { status: 500 });
    (inserted ?? []).forEach((c: any) => { catMap[c.name] = c.id; });
  }

  // 2. Get existing bundle slugs to skip duplicates
  const { data: existingSlugs } = await supabaseAdmin
    .from('bundles')
    .select('slug');
  const slugSet = new Set((existingSlugs ?? []).map((b: any) => b.slug));

  const newBundles = DEMO_BUNDLES
    .filter((b) => !slugSet.has(b.slug) && catMap[b.cat])
    .map((b) => ({
      name: b.name,
      slug: b.slug,
      description: b.description,
      price: b.price,
      type: 'fixed' as const,
      category_id: catMap[b.cat],
      image_urls: [b.image],
      is_active: true,
    }));

  if (newBundles.length === 0) {
    return NextResponse.json({ ok: true, message: 'Already seeded — nothing to add', bundles: 0 });
  }

  const { data: inserted, error: bundleErr } = await supabaseAdmin
    .from('bundles')
    .insert(newBundles)
    .select('id, name');

  if (bundleErr) return NextResponse.json({ error: 'bundles: ' + bundleErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    bundles: inserted?.length ?? 0,
    message: `Seeded ${inserted?.length ?? 0} bundles`,
    names: (inserted ?? []).map((b: any) => b.name),
  });
}
