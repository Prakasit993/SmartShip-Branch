import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <h2 className="text-3xl font-bold mb-2">404 - Page Not Found</h2>
            <p className="text-zinc-500 mb-6 font-medium">Could not find the requested resource.</p>
            <Link
                href="/"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
                Return Home
            </Link>
        </div>
    );
}
