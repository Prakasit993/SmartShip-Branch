'use client';

import { useState } from 'react';
import { HOME_DEFAULTS } from '@/lib/home-defaults';
import { ADMIN_PRODUCT_IMAGE_ACCEPT } from '@/lib/adminProductImageUpload';
import { normalizeHeroSlidesFromRaw, type HeroSlide } from '@app/lib/home-seo';
import { CollapsibleSection, InputField } from './SettingsComponents';
import { uploadImage } from './actions';

interface SettingsFormProps {
    initialSettings: Record<string, string>;
    saved?: boolean;
    error?: boolean;
}

export default function SettingsForm({ initialSettings, saved, error }: SettingsFormProps) {
    const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
        const val = initialSettings.hero_images || '';
        try {
            if (!val.trim()) return normalizeHeroSlidesFromRaw(null);
            const parsed = JSON.parse(val);
            return normalizeHeroSlidesFromRaw(parsed);
        } catch {
            return normalizeHeroSlidesFromRaw(val ? [val] : null);
        }
    });
    const [uploading, setUploading] = useState(false);

    const patchSlide = (index: number, patch: Partial<HeroSlide>) => {
        setHeroSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    };

    const getSetting = (key: string, defaultValue: string = '') => {
        return initialSettings[key] || defaultValue;
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploading(true);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                const result = await uploadImage(formData);
                if ('url' in result) {
                    setHeroSlides((prev) =>
                        prev.length >= 5
                            ? prev
                            : [...prev, { url: result.url, alt: '', title: '' }],
                    );
                } else {
                    alert('อัปโหลดไม่สำเร็จ: ' + result.error);
                }
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('อัปโหลดไม่สำเร็จ');
        } finally {
            setUploading(false);
        }
    };

    const removeSlide = (index: number) => {
        setHeroSlides((prev) => prev.filter((_, i) => i !== index));
    };

    const moveSlide = (index: number, direction: 'up' | 'down') => {
        const next = [...heroSlides];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= next.length) return;
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        setHeroSlides(next);
    };

    return (
        <div className="space-y-6">
            {saved && (
                <div className="bg-green-900/30 text-green-300 p-4 rounded-lg border border-green-800 flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <span>บันทึกการตั้งค่าเรียบร้อยแล้ว!</span>
                </div>
            )}

            {error && (
                <div className="bg-red-900/30 text-red-300 p-4 rounded-lg border border-red-800 flex items-center gap-3">
                    <span className="text-xl">❌</span>
                    <span>เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง</span>
                </div>
            )}

            <form action="/admin/settings" method="POST" className="space-y-4">
                <input type="hidden" name="hero_images" value={JSON.stringify(heroSlides)} />

                {/* Homepage Section */}
                <CollapsibleSection title="หน้าแรก (Homepage)" icon="🏠" defaultOpen={true}>
                    <InputField
                        name="hero_title"
                        label="หัวข้อหลัก (Hero Title)"
                        defaultValue={getSetting('hero_title', HOME_DEFAULTS.heroTitle)}
                        placeholder="เช่น สินค้าคุณภาพ ราคาดี"
                    />

                    <InputField
                        name="hero_subtitle"
                        label="คำอธิบาย (Hero Subtitle)"
                        defaultValue={getSetting('hero_subtitle', HOME_DEFAULTS.heroSubtitle)}
                        placeholder="คำอธิบายสั้นๆ เกี่ยวกับร้าน"
                        rows={3}
                    />

                    {/* Hero Images */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">รูปภาพหน้าแรก (Hero Images)</label>
                        <p className="text-xs text-zinc-500 mb-3">
                            รูปแรกจะแสดงเป็นหลักและใช้เป็นรูปแชร์ (OG) • สูงสุด 5 รูป • กรอกข้อความ alt เพื่อ SEO และการเข้าถึง
                            (ถ้าเว้นว่าง ระบบจะใส่ข้อความสำรองเมื่อบันทึก)
                        </p>

                        <div className="space-y-4">
                            {heroSlides.map((slide, index) => (
                                <div
                                    key={`${slide.url}-${index}`}
                                    className="rounded-xl border border-zinc-700 bg-zinc-900/40 overflow-hidden"
                                >
                                    <div className="flex flex-col sm:flex-row gap-4 p-4">
                                        <div className="relative w-full sm:w-44 aspect-video shrink-0 rounded-lg overflow-hidden border border-zinc-600 bg-zinc-800 group">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                                            <img
                                                src={slide.url}
                                                alt={slide.alt?.trim() || `ตัวอย่างสไลด์ ${index + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder.png';
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => moveSlide(index, 'up')}
                                                        className="p-1.5 bg-white/20 rounded hover:bg-white/40 text-sm"
                                                        title="เลื่อนขึ้น / ไปซ้ายในคารูเซล"
                                                    >
                                                        ←
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeSlide(index)}
                                                    className="p-1.5 bg-red-500/80 rounded hover:bg-red-500 text-sm"
                                                    title="ลบรูปนี้"
                                                >
                                                    🗑️
                                                </button>
                                                {index < heroSlides.length - 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => moveSlide(index, 'down')}
                                                        className="p-1.5 bg-white/20 rounded hover:bg-white/40 text-sm"
                                                        title="เลื่อนลง / ไปขวาในคารูเซล"
                                                    >
                                                        →
                                                    </button>
                                                )}
                                            </div>
                                            <div className="absolute bottom-1 left-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                {index === 0 ? '★ หลัก / OG' : index + 1}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">
                                                    ข้อความ alt รูป <span className="text-zinc-500">(SEO + ผู้พิการทางสายตา)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slide.alt}
                                                    onChange={(e) => patchSlide(index, { alt: e.target.value })}
                                                    maxLength={220}
                                                    className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder={`เช่น ร้านกล่อง J&T — มุมหน้าร้าน`}
                                                />
                                                <p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
                                                    {(slide.alt ?? '').length} / 220
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">
                                                    Title (tooltip) <span className="text-zinc-500">— ไม่บังคับ</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slide.title ?? ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value.trim();
                                                        patchSlide(index, { title: v || undefined });
                                                    }}
                                                    maxLength={120}
                                                    className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="แสดงเมื่อชี้เมาส์ที่รูปบนหน้าแรก"
                                                />
                                            </div>
                                            <p className="text-[11px] text-zinc-500 break-all">
                                                URL: {slide.url}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {heroSlides.length < 5 && (
                                <label className="flex aspect-video max-h-28 sm:max-h-none sm:aspect-auto sm:min-h-[8rem] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-800/50 hover:border-blue-500 hover:bg-zinc-800 transition px-4">
                                    {uploading ? (
                                        <span className="text-zinc-400 text-sm">⏳ กำลังอัปโหลด...</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <span className="text-2xl">➕</span>
                                            <span className="text-xs text-zinc-400">เพิ่มรูป (สูงสุด 5)</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept={ADMIN_PRODUCT_IMAGE_ACCEPT}
                                        multiple
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    <InputField
                        name="announcement"
                        label="ข้อความประกาศ (Announcement Banner)"
                        defaultValue={getSetting('announcement')}
                        placeholder="เช่น ส่งฟรีเมื่อสั่งซื้อ 500 บาทขึ้นไป"
                        helpText="แสดงเป็นแถบด้านบนสุดของเว็บ (เว้นว่างถ้าไม่ต้องการ)"
                    />
                </CollapsibleSection>

                {/* Contact Info Section */}
                <CollapsibleSection title="ข้อมูลติดต่อ (Contact)" icon="📞" defaultOpen={false}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField
                            name="contact_phone"
                            label="เบอร์โทรศัพท์"
                            defaultValue={getSetting('contact_phone', '081-234-5678')}
                            placeholder="081-234-5678"
                        />
                        <InputField
                            name="contact_line"
                            label="LINE ID"
                            defaultValue={getSetting('contact_line', '@expressshop')}
                            placeholder="@yourshop"
                        />
                        <InputField
                            name="contact_email"
                            label="Email"
                            type="email"
                            defaultValue={getSetting('contact_email', 'info@expressshop.com')}
                            placeholder="info@yourshop.com"
                        />
                        <InputField
                            name="contact_line_url"
                            label="LINE URL (ลิงก์เพิ่มเพื่อน)"
                            defaultValue={getSetting('contact_line_url', 'https://line.me/ti/p/@expressshop')}
                            placeholder="https://line.me/ti/p/@yourshop"
                        />
                    </div>

                    <InputField
                        name="contact_address"
                        label="ที่อยู่ร้าน"
                        defaultValue={getSetting('contact_address', '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110')}
                        placeholder="ที่อยู่เต็ม"
                        rows={2}
                    />
                </CollapsibleSection>

                {/* Map Section */}
                <CollapsibleSection title="แผนที่ (Google Maps)" icon="📍" defaultOpen={false}>
                    <InputField
                        name="map_embed_url"
                        label="Google Maps Embed URL"
                        defaultValue={getSetting('map_embed_url')}
                        placeholder="https://www.google.com/maps/embed?pb=..."
                        helpText="ได้จาก Google Maps > Share > Embed a map > Copy src URL"
                    />

                    <InputField
                        name="map_link"
                        label="Google Maps Link (สำหรับปุ่มเปิดแผนที่)"
                        defaultValue={getSetting('map_link', 'https://maps.app.goo.gl/u8xZxi6XjyWpgm54A')}
                        placeholder="https://maps.app.goo.gl/..."
                    />
                </CollapsibleSection>

                {/* Bundle Dimensions Sync Section */}
                <CollapsibleSection title="ซิงค์ขนาดสินค้า (Bundle Dimensions Sync)" icon="📐" defaultOpen={false}>
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-300 mb-2">🔄 ซิงค์ขนาด Bundle จาก Products</h4>
                        <p className="text-sm text-zinc-400 mb-4">
                            กดปุ่มด้านล่างเพื่อดึงข้อมูลขนาด (กว้าง, ยาว, สูง) จากสินค้าตัวแรกใน Bundle มาใส่ในตาราง Bundles
                            เพื่อให้การค้นหาด้วยขนาดทำงานได้ถูกต้อง
                        </p>
                        <button
                            type="button"
                            onClick={async () => {
                                if (!confirm('ยืนยันการซิงค์ขนาด Bundle ทั้งหมด?')) return;

                                try {
                                    const res = await fetch('/api/admin/sync-bundle-dimensions', {
                                        method: 'POST'
                                    });
                                    const data = await res.json();

                                    if (data.success) {
                                        alert(`✅ ซิงค์สำเร็จ!\n\nอัปเดต: ${data.updated} รายการ\nทั้งหมด: ${data.total} รายการ`);
                                    } else {
                                        alert('❌ เกิดข้อผิดพลาด: ' + data.error);
                                    }
                                } catch (err: any) {
                                    alert('❌ เกิดข้อผิดพลาด: ' + err.message);
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            🔄 ซิงค์ขนาด Bundle ทั้งหมด
                        </button>
                        <p className="text-xs text-zinc-500 mt-3">
                            หมายเหตุ: จะอัปเดตเฉพาะ Bundle ที่ยังไม่มีข้อมูลขนาด และมีสินค้าที่มีข้อมูลขนาดครบถ้วน
                        </p>
                    </div>
                </CollapsibleSection>

                {/* Payment Section */}
                <CollapsibleSection title="การชำระเงิน (Payment)" icon="💳" defaultOpen={false}>
                    <InputField
                        name="bank_name"
                        label="ชื่อธนาคาร"
                        defaultValue={getSetting('bank_name')}
                        placeholder="เช่น ธนาคารกสิกรไทย"
                    />
                    <InputField
                        name="bank_account_number"
                        label="เลขบัญชี"
                        defaultValue={getSetting('bank_account_number')}
                        placeholder="xxx-x-xxxxx-x"
                    />
                    <InputField
                        name="bank_account_name"
                        label="ชื่อบัญชี"
                        defaultValue={getSetting('bank_account_name')}
                        placeholder="ชื่อ-สกุล"
                    />
                    <InputField
                        name="promptpay_number"
                        label="หมายเลข PromptPay"
                        defaultValue={getSetting('promptpay_number')}
                        placeholder="เบอร์โทรหรือเลข ID"
                    />

                    {/* QR Code Payment */}
                    <div className="border-t border-zinc-700 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                            📱 QR Code สำหรับชำระเงิน
                        </h4>
                        <p className="text-xs text-zinc-500 mb-3">อัพโหลด QR Code PromptPay หรือ QR บัญชีธนาคาร เพื่อแสดงในหน้าชำระเงิน</p>

                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <InputField
                                    name="payment_qr_code"
                                    label="URL รูป QR Code"
                                    defaultValue={getSetting('payment_qr_code')}
                                    placeholder="https://... หรือกดอัพโหลด"
                                    helpText="ใส่ลิงก์รูป QR Code หรืออัพโหลดรูปใหม่"
                                />
                            </div>

                            {/* QR Preview */}
                            {getSetting('payment_qr_code') && (
                                <div className="flex-shrink-0">
                                    <p className="text-xs text-zinc-500 mb-1">ตัวอย่าง:</p>
                                    <img
                                        src={getSetting('payment_qr_code')}
                                        alt="ตัวอย่าง QR Code ชำระเงิน (หลังบ้าน)"
                                        title="ตัวอย่าง QR Code ชำระเงิน"
                                        className="w-24 h-24 object-contain bg-white rounded-lg border border-zinc-600"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="mt-3">
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition text-sm font-medium">
                                📷 อัพโหลด QR Code
                                <input
                                    type="file"
                                    accept={ADMIN_PRODUCT_IMAGE_ACCEPT}
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        const formData = new FormData();
                                        formData.append('file', file);

                                        try {
                                            const result = await uploadImage(formData);
                                            if ('url' in result) {
                                                // Update the input field
                                                const input = document.querySelector('input[name="payment_qr_code"]') as HTMLInputElement;
                                                if (input) {
                                                    input.value = result.url;
                                                    // Trigger change event
                                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                                }
                                                alert('✅ อัพโหลด QR Code สำเร็จ! กดบันทึกเพื่อยืนยัน');
                                            } else {
                                                alert('❌ อัพโหลดไม่สำเร็จ: ' + result.error);
                                            }
                                        } catch (err) {
                                            alert('❌ เกิดข้อผิดพลาดในการอัพโหลด');
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        formAction="/api/admin/settings"
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:from-blue-500 hover:to-cyan-500 transition-all flex items-center gap-2"
                    >
                        💾 บันทึกการเปลี่ยนแปลง
                    </button>
                </div>
            </form>
        </div>
    );
}
