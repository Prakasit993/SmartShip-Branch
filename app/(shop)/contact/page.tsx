import { supabase } from '@/lib/supabaseClient';
import ContactContent from './ContactContent';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
    // Fetch settings
    const { data: settings } = await supabase.from('settings').select('*');

    const getSetting = (key: string, defaultValue: string = '') => {
        const item = settings?.find(s => s.key === key);
        if (!item) return defaultValue;
        // Remove quotes from JSON string if simple string
        let val = String(item.value).replace(/^"|"$/g, '');
        return val || defaultValue;
    };

    const contactPhone = getSetting('contact_phone', '081-234-5678');
    const contactLine = getSetting('contact_line', '@expressshop');
    const contactLineUrl = getSetting('contact_line_url', 'https://line.me/ti/p/@expressshop');
    const contactEmail = getSetting('contact_email', 'info@expressshop.com');
    const contactAddress = getSetting('contact_address', '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110');
    const mapEmbedUrl = getSetting('map_embed_url', '');
    const mapLink = getSetting('map_link', 'https://maps.app.goo.gl/u8xZxi6XjyWpgm54A');

    return (
        <ContactContent
            contactPhone={contactPhone}
            contactLine={contactLine}
            contactLineUrl={contactLineUrl}
            contactEmail={contactEmail}
            contactAddress={contactAddress}
            mapEmbedUrl={mapEmbedUrl}
            mapLink={mapLink}
        />
    );
}
