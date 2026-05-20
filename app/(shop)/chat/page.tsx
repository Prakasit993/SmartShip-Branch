'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ChatPage() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ? 🤖' }
    ]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        // User message
        setMessages(prev => [...prev, { role: 'user', content: input }]);
        const userMessage = input;
        setInput('');

        // Simulate bot response (placeholder)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `ขอบคุณที่ติดต่อเข้ามาครับ ขณะนี้ระบบ Chat Bot กำลังอยู่ระหว่างการพัฒนา หากมีข้อสงสัยเร่งด่วนสามารถติดต่อได้ที่ Line หรือเบอร์โทรศัพท์ในหน้า Contact ได้เลยครับ`
            }]);
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col h-[600px]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-blue-900/20">
                            🤖
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">NYXEL Assistant</h1>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Online
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/shop"
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        ✕
                    </Link>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/20'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200 dark:border-zinc-700'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="พิมพ์ข้อความของคุณ..."
                            className="w-full pl-4 pr-12 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-black focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-light"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-600/20"
                        >
                            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
