'use client';

import Link from 'next/link';

export default function ChatWidget() {
    return (
        <Link
            href="/chat"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 border border-zinc-700"
        >
            <span className="text-xl">💬</span>
            <span className="font-medium">Chat</span>
        </Link>
    );
}
