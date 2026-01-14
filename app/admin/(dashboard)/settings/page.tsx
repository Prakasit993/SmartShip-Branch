import { supabase } from '@/lib/supabaseClient';
import { updateSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const { data: settings } = await supabase.from('settings').select('*');

    const getSetting = (key: string) => {
        const item = settings?.find(s => s.key === key);
        // Remove quotes from JSON string if simple string
        return item ? String(item.value).replace(/^"|"$/g, '') : '';
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Site Settings</h1>

            <form action={updateSettings} className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-6">
                <h2 className="font-semibold text-lg border-b dark:border-zinc-800 pb-2">Homepage Content</h2>

                <div>
                    <label className="block text-sm font-medium mb-1">Hero Title</label>
                    <input
                        name="hero_title"
                        defaultValue={getSetting('hero_title') || 'Exclusive Express Add-ons'}
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Hero Subtitle</label>
                    <textarea
                        name="hero_subtitle"
                        rows={3}
                        defaultValue={getSetting('hero_subtitle') || 'Premium boxes, tape, and packing essentials available instantly.'}
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Hero Images (One URL per line)</label>
                    <p className="text-xs text-zinc-500 mb-2">Leave empty to use default image.</p>
                    <textarea
                        name="hero_images"
                        rows={4}
                        defaultValue={(() => {
                            const val = getSetting('hero_images');
                            try {
                                if (val && (val.startsWith('[') || val.startsWith('{'))) {
                                    const parsed = JSON.parse(val);
                                    if (Array.isArray(parsed)) return parsed.join('\n');
                                }
                                return val || '/smartship-storefront.png';
                            } catch (e) {
                                return val;
                            }
                        })()}
                        placeholder="/image1.png&#10;/image2.png"
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700 font-mono text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Announcement Banner (Optional)</label>
                    <input
                        name="announcement"
                        defaultValue={getSetting('announcement')}
                        placeholder="e.g. Free shipping on orders over 500฿"
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <h2 className="font-semibold text-lg border-b dark:border-zinc-800 pb-2 pt-4">Contact Info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                            name="contact_phone"
                            defaultValue={getSetting('contact_phone') || '081-234-5678'}
                            placeholder="081-234-5678"
                            className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">LINE ID</label>
                        <input
                            name="contact_line"
                            defaultValue={getSetting('contact_line') || '@expressshop'}
                            placeholder="@yourshop"
                            className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            name="contact_email"
                            type="email"
                            defaultValue={getSetting('contact_email') || 'info@expressshop.com'}
                            placeholder="info@yourshop.com"
                            className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">LINE URL</label>
                        <input
                            name="contact_line_url"
                            defaultValue={getSetting('contact_line_url') || 'https://line.me/ti/p/@expressshop'}
                            placeholder="https://line.me/ti/p/@yourshop"
                            className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <textarea
                        name="contact_address"
                        rows={2}
                        defaultValue={getSetting('contact_address') || '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110'}
                        placeholder="Address in Thai"
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Google Maps Embed URL</label>
                    <p className="text-xs text-zinc-500 mb-2">Get from Google Maps &gt; Share &gt; Embed a map</p>
                    <input
                        name="map_embed_url"
                        defaultValue={getSetting('map_embed_url')}
                        placeholder="https://www.google.com/maps/embed?pb=..."
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700 font-mono text-xs"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Google Maps Link (สำหรับปุ่มเปิดแผนที่)</label>
                    <input
                        name="map_link"
                        defaultValue={getSetting('map_link') || 'https://maps.app.goo.gl/u8xZxi6XjyWpgm54A'}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div className="pt-4 text-right">
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}
