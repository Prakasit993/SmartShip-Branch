'use client';

import { useState } from 'react';
import { CollapsibleSection, InputField } from './SettingsComponents';
import { uploadImage } from './actions';

interface SettingsFormProps {
    initialSettings: Record<string, string>;
    saved?: boolean;
    error?: boolean;
}

export default function SettingsForm({ initialSettings, saved, error }: SettingsFormProps) {
    const [heroImages, setHeroImages] = useState<string[]>(() => {
        const val = initialSettings.hero_images || '';
        try {
            if (val.startsWith('[')) {
                return JSON.parse(val);
            }
            return val ? [val] : ['/smartship-storefront.png'];
        } catch {
            return val ? [val] : ['/smartship-storefront.png'];
        }
    });
    const [uploading, setUploading] = useState(false);

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
                    setHeroImages(prev => [...prev, result.url]);
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

    const removeImage = (index: number) => {
        setHeroImages(prev => prev.filter((_, i) => i !== index));
    };

    const moveImage = (index: number, direction: 'up' | 'down') => {
        const newImages = [...heroImages];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= heroImages.length) return;
        [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
        setHeroImages(newImages);
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
                <input type="hidden" name="hero_images" value={heroImages.join('\n')} />

                {/* Homepage Section */}
                <CollapsibleSection title="หน้าแรก (Homepage)" icon="🏠" defaultOpen={true}>
                    <InputField
                        name="hero_title"
                        label="หัวข้อหลัก (Hero Title)"
                        defaultValue={getSetting('hero_title', 'Exclusive Express Add-ons')}
                        placeholder="เช่น สินค้าคุณภาพ ราคาดี"
                    />

                    <InputField
                        name="hero_subtitle"
                        label="คำอธิบาย (Hero Subtitle)"
                        defaultValue={getSetting('hero_subtitle', 'Premium boxes, tape, and packing essentials available instantly.')}
                        placeholder="คำอธิบายสั้นๆ เกี่ยวกับร้าน"
                        rows={3}
                    />

                    {/* Hero Images */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">รูปภาพหน้าแรก (Hero Images)</label>
                        <p className="text-xs text-zinc-500 mb-3">รูปแรกจะแสดงเป็นหลัก • สูงสุด 5 รูป • ลากเพื่อสลับตำแหน่ง</p>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {heroImages.map((url, index) => (
                                <div key={index} className="relative group aspect-video bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                                    <img
                                        src={url}
                                        alt={`Image ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/placeholder.png';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                        {index > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => moveImage(index, 'up')}
                                                className="p-1.5 bg-white/20 rounded hover:bg-white/40 text-sm"
                                                title="Move left"
                                            >
                                                ←
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="p-1.5 bg-red-500/80 rounded hover:bg-red-500 text-sm"
                                            title="Remove"
                                        >
                                            🗑️
                                        </button>
                                        {index < heroImages.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => moveImage(index, 'down')}
                                                className="p-1.5 bg-white/20 rounded hover:bg-white/40 text-sm"
                                                title="Move right"
                                            >
                                                →
                                            </button>
                                        )}
                                    </div>
                                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                        {index === 0 ? '★ หลัก' : index + 1}
                                    </div>
                                </div>
                            ))}

                            {/* Add Button */}
                            {heroImages.length < 5 && (
                                <label className="aspect-video bg-zinc-800/50 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-zinc-800 transition cursor-pointer">
                                    {uploading ? (
                                        <span className="text-zinc-400 text-sm">⏳ กำลังอัปโหลด...</span>
                                    ) : (
                                        <>
                                            <span className="text-2xl">➕</span>
                                            <span className="text-xs text-zinc-400">เพิ่มรูป</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
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
