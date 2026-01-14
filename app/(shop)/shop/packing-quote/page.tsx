import QuoteForm from './QuoteForm';

export const metadata = {
    title: 'Request Packing Quote | Express Shop',
    description: 'Get a professional packing quote for your business.',
};

export default function PackingQuotePage() {
    return (
        <div className="container mx-auto px-4 py-12 min-h-screen bg-zinc-50 dark:bg-black">
            <QuoteForm />
        </div>
    );
}
