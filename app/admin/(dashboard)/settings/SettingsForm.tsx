'use client';

import { useEffect, useState } from 'react';
import {
    DEFAULT_JT_CHANNEL_PRIORITY,
    JT_CHANNEL_FIELD_OPTIONS,
    parseJtChannelPriorityFromSettingValue,
} from '@/lib/jtChannelSettings';
import {
    JT_DASHBOARD_SECTION_KEYS,
    JT_DASHBOARD_SECTION_LABELS,
    parseJtDashboardSectionsJson,
} from '@/lib/jtDashboardSections';
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

    const [jtSections, setJtSections] = useState(() =>
        parseJtDashboardSectionsJson(getSetting('jt_dashboard_sections', ''))
    );

    const [channelSlots, setChannelSlots] = useState<string[]>(() => {
        const p = parseJtChannelPriorityFromSettingValue(getSetting('jt_channel_field_priority', ''));
        return [...p, '', '', '', '', ''].slice(0, 5);
    });

    const setChannelSlot = (index: number, value: string) => {
        setChannelSlots((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    /** ชื่อคอลัมน์จริงในตาราง jt_shipments (จาก API) — null = กำลังโหลด */
    const [jtTableColumnNames, setJtTableColumnNames] = useState<string[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/jt-shipments/columns');
                const data = (await res.json()) as { names?: string[] };
                if (!cancelled && Array.isArray(data.names)) {
                    setJtTableColumnNames(data.names);
                } else if (!cancelled) {
                    setJtTableColumnNames([]);
                }
            } catch {
                if (!cancelled) setJtTableColumnNames([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const applyChannelPreset = (fields: string[]) => {
        const padded = [...fields, '', '', '', '', ''].slice(0, 5);
        setChannelSlots(padded);
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

                <div id="jt-dashboard-sections">
                    <CollapsibleSection title="แดชบอร์ด J&T — เลือกข้อมูลที่แสดง" icon="📊" defaultOpen={false}>
                        <input type="hidden" name="jt_dashboard_sections" value={JSON.stringify(jtSections)} />
                        <input
                            type="hidden"
                            name="jt_channel_field_priority"
                            value={JSON.stringify(channelSlots.filter((s) => s !== ''))}
                        />
                        <p className="text-xs text-zinc-500 mb-3">
                            กำหนดบล็อกที่เห็นในหน้า <span className="text-zinc-400">/admin/jt-dashboard</span>
                            — ผู้ใช้แต่ละคนยังเลือกซ้อนทับในเบราว์เซอร์ของตัวเองได้ (ไม่กระทบผู้อื่น)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {JT_DASHBOARD_SECTION_KEYS.map((key) => (
                                <label
                                    key={key}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/80 cursor-pointer hover:bg-zinc-800/60"
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-1 rounded border-zinc-600"
                                        checked={jtSections[key]}
                                        onChange={(e) =>
                                            setJtSections((prev) => ({ ...prev, [key]: e.target.checked }))
                                        }
                                    />
                                    <span className="text-sm text-zinc-200 leading-snug">
                                        {JT_DASHBOARD_SECTION_LABELS[key]}
                                    </span>
                                </label>
                            ))}
                        </div>

                        <div id="jt-channel-fields" className="mt-6 pt-6 border-t border-zinc-700/80">
                            <h4 className="text-sm font-semibold text-zinc-100 mb-1">ฟิลด์แพลตฟอร์ม / ช่องทาง</h4>
                            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                                กำหนดลำดับความสำคัญว่าจะอ่านค่าจากคอลัมน์ไหนก่อน (ใช้ค่าจากฟิลด์แรกที่ไม่ว่าง) — ใช้กับแดชบอร์ด J&amp;T และตาราง Shipments
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <span className="text-[11px] text-zinc-500 shrink-0">ชุดลำดับด่วน:</span>
                                <button
                                    type="button"
                                    onClick={() => applyChannelPreset([...DEFAULT_JT_CHANNEL_PRIORITY])}
                                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/80"
                                >
                                    ค่าเริ่มต้น (platform → order_source)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyChannelPreset(['platform'])}
                                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/80"
                                >
                                    เฉพาะ platform
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyChannelPreset(['order_source'])}
                                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/80"
                                >
                                    เฉพาะ order_source
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyChannelPreset([])}
                                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/70"
                                    title="ล้างช่องทั้งหมด — ตอนบันทึกระบบจะใช้ค่าเริ่มต้นเดียวกับปุ่มแรก"
                                >
                                    ล้างช่อง (ใช้ค่าเริ่มต้นของระบบ)
                                </button>
                            </div>

                            {jtTableColumnNames === null ? (
                                <p className="text-[11px] text-zinc-600 mb-3">กำลังโหลดรายชื่อคอลัมน์ในตาราง…</p>
                            ) : jtTableColumnNames.length === 0 ? (
                                <p className="text-[11px] text-amber-600/90 mb-3">
                                    โหลดรายชื่อคอลัมน์ไม่ได้ — เช็ค RPC ในฐานข้อมูลหรือสิทธิ์ API แต่ยังตั้งลำดับฟิลด์ได้ตามปกติ
                                </p>
                            ) : (
                                <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                                    <span className="text-zinc-400">คอลัมน์ที่เลือกได้ซึ่งมีในตารางตอนนี้:</span>{' '}
                                    {JT_CHANNEL_FIELD_OPTIONS.filter((opt) => jtTableColumnNames.includes(opt)).length >
                                    0 ? (
                                        JT_CHANNEL_FIELD_OPTIONS.filter((opt) => jtTableColumnNames.includes(opt)).map(
                                            (opt, i, arr) => (
                                                <span key={opt}>
                                                    <code className="text-emerald-400/90">{opt}</code>
                                                    {i < arr.length - 1 ? ', ' : ''}
                                                </span>
                                            )
                                        )
                                    ) : (
                                        <span className="text-zinc-500">ไม่มีชื่อตรงกับตัวเลือกด้านล่าง — อาจต้องเพิ่มคอลัมน์ในฐานข้อมูล</span>
                                    )}
                                </p>
                            )}

                            <div className="space-y-2 max-w-md">
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-500 w-24 shrink-0">ลำดับ {i + 1}</span>
                                        <select
                                            value={channelSlots[i] ?? ''}
                                            onChange={(e) => setChannelSlot(i, e.target.value)}
                                            className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        >
                                            <option value="">— ว่าง (ข้าม) —</option>
                                            {JT_CHANNEL_FIELD_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-zinc-600 mt-3">
                                ถ้าไม่เลือกเลย ระบบใช้ค่าเริ่มต้น: platform → order_source — คอลัมน์ต้องมีในตาราง jt_shipments (เช่น sales_channel ต้องสร้างในฐานข้อมูลก่อน)
                            </p>
                        </div>
                    </CollapsibleSection>
                </div>

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
                                        alt="QR Code Preview"
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
                                    accept="image/*"
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
