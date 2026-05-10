'use client';

import { createProduct, updateProduct } from '../actions';
import { useFormStatus } from 'react-dom';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Flame,
    ImageIcon,
    LayoutGrid,
    Search as SearchIcon,
    Package,
    Ruler,
} from 'lucide-react';
import { slugifyProductName } from '@/lib/slugifyProduct';
import {
    ADMIN_PRODUCT_IMAGE_ACCEPT,
    ADMIN_PRODUCT_IMAGE_HELP_TH,
    PRODUCT_IMAGE_MAX_BYTES,
    resolveProductImageMime,
} from '@/lib/adminProductImageUpload';

interface ProductFormProps {
    product?: Record<string, unknown>;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-500 disabled:opacity-50"
        >
            {pending ? 'กำลังบันทึก…' : label}
        </button>
    );
}

const inputBase =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 outline-none ring-sky-500/25 placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2';

interface ImageUploadProps {
    index: number;
    defaultValue?: string;
    onUrlChange: (index: number, url: string) => void;
}

function ImageUpload({ index, defaultValue, onUrlChange }: ImageUploadProps) {
    const [url, setUrl] = useState(defaultValue || '');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const mime = resolveProductImageMime(file);
        if (!mime) {
            setError(ADMIN_PRODUCT_IMAGE_HELP_TH);
            e.target.value = '';
            return;
        }
        if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
            setError('ไฟล์ใหญ่เกินไป (สูงสุด 5 MB)');
            e.target.value = '';
            return;
        }

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'อัพโหลดไม่สำเร็จ');
            }

            setUrl(data.url);
            onUrlChange(index, data.url);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'อัพโหลดไม่สำเร็จ');
        } finally {
            setUploading(false);
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        onUrlChange(index, newUrl);
    };

    const clearImage = () => {
        setUrl('');
        onUrlChange(index, '');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <span className="w-6 py-2 text-center text-sm text-slate-500">{index + 1}.</span>
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <input
                            name="image_urls"
                            value={url}
                            onChange={handleUrlChange}
                            className={`${inputBase} min-w-[200px] flex-1`}
                            placeholder={index === 0 ? 'URL รูปหลัก หรืออัปโหลด' : 'URL รูปเพิ่มเติม'}
                        />

                        <label className="cursor-pointer">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ADMIN_PRODUCT_IMAGE_ACCEPT}
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                            <span
                                className={`inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                                    uploading
                                        ? 'cursor-wait bg-slate-700 text-slate-400'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                }`}
                            >
                                {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
                            </span>
                        </label>

                        {url ? (
                            <button
                                type="button"
                                onClick={clearImage}
                                className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                            >
                                ลบ
                            </button>
                        ) : null}
                    </div>

                    {url ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                            <img
                                src={url}
                                alt=""
                                className="h-16 w-16 rounded-lg border border-slate-700 object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error';
                                }}
                            />
                            <span className="flex-1 truncate text-xs text-slate-500">{url.slice(0, 56)}…</span>
                        </div>
                    ) : null}

                    {error ? <p className="text-xs text-rose-400">{error}</p> : null}
                </div>
            </div>
        </div>
    );
}

type TabId = 'main' | 'seo' | 'extra';

export default function ProductForm({ product }: ProductFormProps) {
    const action = product ? updateProduct.bind(null, product.id as number) : createProduct;
    const [tab, setTab] = useState<TabId>('main');

    const [slugVal, setSlugVal] = useState((product?.slug as string) || '');
    const [metaTitle, setMetaTitle] = useState((product?.meta_title as string) || '');
    const [metaDesc, setMetaDesc] = useState((product?.meta_description as string) || '');
    const [imageAlt, setImageAlt] = useState((product?.image_alt as string) || '');

    const [imageUrls, setImageUrls] = useState<string[]>(() => {
        const urls = (product?.image_urls as string[]) || [];
        return [...urls, ...Array(5 - urls.length).fill('')].slice(0, 5) as string[];
    });

    const handleImageUrlChange = (index: number, url: string) => {
        const newUrls = [...imageUrls];
        newUrls[index] = url;
        setImageUrls(newUrls);
    };

    const fillSlugFromName = () => {
        const el = document.querySelector<HTMLInputElement>('input[name="name"]');
        if (el?.value) setSlugVal(slugifyProductName(el.value));
    };

    const previewTitle =
        metaTitle.trim() || '(ถ้าไม่ระบุ Meta title จะใช้ชื่อสินค้าที่แท็บข้อมูลหลัก)';
    const previewUrl = slugVal.trim() ? `/shop/…/${slugVal.trim()}` : '/shop/…';

    const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
        { id: 'main', label: 'ข้อมูลหลัก', icon: <Package className="h-4 w-4" aria-hidden /> },
        { id: 'seo', label: 'SEO & การค้นหา', icon: <SearchIcon className="h-4 w-4" aria-hidden /> },
        {
            id: 'extra',
            label: 'สเปค · โปร · รูป',
            icon: <LayoutGrid className="h-4 w-4" aria-hidden />,
        },
    ];

    return (
        <form
            action={action}
            className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/45 ring-1 ring-white/[0.04]"
        >
            <div className="flex flex-wrap gap-2 border-b border-slate-800/80 bg-slate-900/40 px-3 py-3 sm:px-4">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                            tab === t.id
                                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/35'
                                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="space-y-6 p-4 sm:p-6">
                {/* —— Main —— */}
                <div className={tab === 'main' ? 'space-y-4' : 'hidden'}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-400">ชื่อสินค้า *</label>
                            <input
                                name="name"
                                defaultValue={product?.name as string | undefined}
                                required
                                className={inputBase}
                                placeholder="เช่น กล่องไปรษณีย์ A3"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-400">รหัสสินค้า (SKU)</label>
                            <input
                                name="sku"
                                defaultValue={(product?.sku as string) || ''}
                                className={inputBase}
                                placeholder="เช่น BOX-A3"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-400">ราคา (บาท) *</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                required
                                defaultValue={product?.price as number | undefined}
                                className={inputBase}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-400">จำนวนในสต็อก</label>
                            <input
                                name="stock_quantity"
                                type="number"
                                defaultValue={(product?.stock_quantity as number) || 0}
                                className={inputBase}
                            />
                        </div>
                    </div>
                </div>

                {/* —— SEO —— */}
                <div className={tab === 'seo' ? 'space-y-5' : 'hidden'}>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/35 p-4 ring-1 ring-white/[0.03]">
                        <p className="text-xs leading-relaxed text-slate-500">
                            ใช้เมื่อนำสินค้าไปแสดงบนหน้าเว็บหรือแชร์ลิงก์ — ถ้าไม่กรอก Meta title ระบบจะใช้ชื่อสินค้าเป็นค่าเริ่มต้นที่ฝั่งร้าน
                        </p>
                    </div>

                    <div>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <label className="text-xs font-medium text-slate-400">Slug (URL)</label>
                            <button
                                type="button"
                                onClick={fillSlugFromName}
                                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                            >
                                สร้างจากชื่อสินค้า
                            </button>
                        </div>
                        <input
                            name="slug"
                            value={slugVal}
                            onChange={(e) => setSlugVal(e.target.value)}
                            className={`${inputBase} font-mono text-xs sm:text-sm`}
                            placeholder="เช่น box-c1-white-premium"
                            autoComplete="off"
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                            ใช้ตัวอักษร a–z ตัวเลข และขีดกลาง — เว้นว่างได้ถ้ายังไม่ใช้ URL แยกสำหรับสินค้านี้
                        </p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">
                            Meta title <span className="font-normal text-slate-600">(แนะนำ ~60 ตัวอักษร)</span>
                        </label>
                        <input
                            name="meta_title"
                            value={metaTitle}
                            onChange={(e) => setMetaTitle(e.target.value)}
                            maxLength={120}
                            className={inputBase}
                            placeholder="หัวข้อในแท็บเบราว์เซอร์และผลการค้นหา"
                        />
                        <p className="mt-1 text-[11px] tabular-nums text-slate-600">{metaTitle.length} / 120</p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">
                            Meta description{' '}
                            <span className="font-normal text-slate-600">(แนะนำ ~150–160 ตัวอักษร)</span>
                        </label>
                        <textarea
                            name="meta_description"
                            value={metaDesc}
                            onChange={(e) => setMetaDesc(e.target.value)}
                            maxLength={320}
                            rows={4}
                            className={`${inputBase} resize-y text-sm leading-relaxed`}
                            placeholder="คำอธิบายสั้นๆ ให้ Google และโซเชียลแสดงเป็นตัวอย่าง"
                        />
                        <p className="mt-1 text-[11px] tabular-nums text-slate-600">{metaDesc.length} / 320</p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">
                            ข้อความ alt รูปหลัก <span className="font-normal text-slate-600">(SEO + ผู้พิการทางสายตา)</span>
                        </label>
                        <input
                            name="image_alt"
                            value={imageAlt}
                            onChange={(e) => setImageAlt(e.target.value)}
                            maxLength={200}
                            className={inputBase}
                            placeholder="อธิบายสั้นๆ ว่ารูปแรกคืออะไร"
                        />
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            ตัวอย่างผลค้นหา (จำลอง)
                        </p>
                        <p className="line-clamp-2 text-sm text-emerald-400">{previewTitle}</p>
                        <p className="mt-1 truncate text-[11px] text-sky-400/80">{previewUrl}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {metaDesc.trim() || 'คำอธิบายจะแสดงตรงนี้เมื่อคุณกรอก Meta description'}
                        </p>
                    </div>
                </div>

                {/* —— Extra: specs, promo, images —— */}
                <div className={tab === 'extra' ? 'space-y-8' : 'hidden'}>
                    <section>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                            <Ruler className="h-4 w-4 text-sky-400" aria-hidden />
                            ขนาดและสเปค
                        </h3>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {(
                                [
                                    ['width', 'กว้าง (ซม.)'],
                                    ['length', 'ยาว (ซม.)'],
                                    ['height', 'สูง (ซม.)'],
                                    ['weight', 'น้ำหนัก (กก.)'],
                                ] as const
                            ).map(([field, label]) => (
                                <div key={field}>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
                                    <input
                                        name={field}
                                        type="number"
                                        step="0.01"
                                        defaultValue={(product?.[field] as number) || 0}
                                        className={inputBase}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-400">สี</label>
                                <input
                                    name="color"
                                    defaultValue={(product?.color as string) || ''}
                                    className={inputBase}
                                    placeholder="เช่น White"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-400">ขนาด / รุ่น</label>
                                <input
                                    name="size_label"
                                    defaultValue={(product?.size_label as string) || ''}
                                    className={inputBase}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-400">ความหนา</label>
                                <input
                                    name="thickness"
                                    defaultValue={(product?.thickness as string) || ''}
                                    className={inputBase}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-slate-800/80 pt-6">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                            <Flame className="h-4 w-4 text-amber-400" aria-hidden />
                            โปรโมชั่น
                        </h3>
                        <p className="mb-4 text-xs text-slate-500">ตั้งราคาพิเศษเมื่อซื้อจำนวนถึงเกณฑ์</p>

                        <div className="grid grid-cols-1 gap-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 md:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-amber-200/90">ราคาโปร (บาท)</label>
                                <input
                                    name="promotional_price"
                                    type="number"
                                    step="0.01"
                                    defaultValue={(product?.promotional_price as number) || ''}
                                    className={inputBase}
                                    placeholder="ไม่บังคับ"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-amber-200/90">ซื้อขั้นต่ำ (ชิ้น)</label>
                                <input
                                    name="promo_min_quantity"
                                    type="number"
                                    min={1}
                                    defaultValue={(product?.promo_min_quantity as number) || 1}
                                    className={inputBase}
                                />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                                    <input
                                        name="is_featured"
                                        type="checkbox"
                                        defaultChecked={Boolean(product?.is_featured)}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-600 focus:ring-sky-500/40"
                                    />
                                    สินค้าแนะนำ
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-slate-800/80 pt-6">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                            <ImageIcon className="h-4 w-4 text-sky-400" aria-hidden />
                            รูปสินค้า (สูงสุด 5 รูป)
                        </h3>
                        <p className="mb-4 text-xs text-slate-500">{ADMIN_PRODUCT_IMAGE_HELP_TH}</p>
                        <div className="space-y-4">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <ImageUpload
                                    key={index}
                                    index={index}
                                    defaultValue={imageUrls[index]}
                                    onUrlChange={handleImageUrlChange}
                                />
                            ))}
                        </div>

                        <div className="mt-6">
                            <label className="mb-1 block text-sm font-medium text-slate-400">รายละเอียดสินค้า (เนื้อหายาว)</label>
                            <textarea
                                name="description"
                                rows={5}
                                defaultValue={(product?.description as string) || ''}
                                className={`${inputBase} resize-y leading-relaxed`}
                                placeholder="รายละเอียดที่แสดงในร้าน — แยกจาก Meta description"
                            />
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                            <input
                                name="is_active"
                                type="checkbox"
                                defaultChecked={(product?.is_active as boolean) ?? true}
                                id="is_active"
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-600 focus:ring-emerald-500/40"
                            />
                            <label htmlFor="is_active" className="cursor-pointer text-sm text-slate-300">
                                เปิดขายสินค้านี้
                            </label>
                        </div>
                    </section>
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800/80 bg-slate-900/30 px-4 py-4 sm:px-6">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                    ยกเลิก
                </button>
                <SubmitButton label={product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'} />
            </div>
        </form>
    );
}
