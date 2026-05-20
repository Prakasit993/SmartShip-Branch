import QuoteForm from './QuoteForm';

export const metadata = {
    title: 'ขอใบเสนอราคาธุรกิจ | NYXEL B2B',
    description: 'ใบเสนอราคา IT สำหรับธุรกิจ — ทีม NYXEL B2B พร้อมช่วยจัดสเปก ราคาพิเศษสำหรับจำนวนมาก และประสานงานรับประกัน',
};

export default function PackingQuotePage() {
    return (
        <div className="container mx-auto px-4 py-12 min-h-screen bg-zinc-50 dark:bg-black">
            <QuoteForm />
        </div>
    );
}
