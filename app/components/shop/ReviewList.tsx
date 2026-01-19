'use client';

import { useState } from 'react';
import { useLanguage } from '@app/context/LanguageContext';

interface Review {
    id: number;
    customer_name: string;
    rating: number;
    title: string | null;
    content: string | null;
    created_at: string;
    is_featured: boolean;
}

interface ReviewListProps {
    reviews: Review[];
    bundleId: number;
    averageRating?: number;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    style={{ fontSize: size }}
                    className={star <= rating ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}
                >
                    ★
                </span>
            ))}
        </div>
    );
}

export default function ReviewList({ reviews, bundleId, averageRating }: ReviewListProps) {
    const { language } = useLanguage();
    const [showForm, setShowForm] = useState(false);

    // Calculate average if not provided
    const avgRating = averageRating || (reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <span>⭐</span>
                        {language === 'th' ? 'รีวิวจากลูกค้า' : 'Customer Reviews'}
                    </h2>
                    {reviews.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                            <StarRating rating={Math.round(avgRating)} size={16} />
                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                {avgRating.toFixed(1)} ({reviews.length} {language === 'th' ? 'รีวิว' : 'reviews'})
                            </span>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm"
                >
                    {showForm
                        ? (language === 'th' ? 'ยกเลิก' : 'Cancel')
                        : (language === 'th' ? '✍️ เขียนรีวิว' : '✍️ Write Review')
                    }
                </button>
            </div>

            {/* Review Form */}
            {showForm && (
                <ReviewForm
                    bundleId={bundleId}
                    onSuccess={() => {
                        setShowForm(false);
                        alert(language === 'th'
                            ? 'ขอบคุณสำหรับรีวิว! รีวิวจะแสดงหลังจากผ่านการตรวจสอบ'
                            : 'Thank you! Your review will be displayed after moderation.');
                    }}
                />
            )}

            {/* Reviews List */}
            {reviews.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-zinc-500">
                        {language === 'th' ? 'ยังไม่มีรีวิว เป็นคนแรกที่รีวิวสินค้านี้!' : 'No reviews yet. Be the first to review!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div
                            key={review.id}
                            className={`p-4 bg-white dark:bg-zinc-900 rounded-xl border ${review.is_featured
                                    ? 'border-yellow-300 dark:border-yellow-700 ring-1 ring-yellow-200 dark:ring-yellow-900'
                                    : 'border-zinc-200 dark:border-zinc-800'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                            {review.customer_name}
                                        </span>
                                        {review.is_featured && (
                                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full font-medium">
                                                ⭐ แนะนำ
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                                        <StarRating rating={review.rating} />
                                        <span>•</span>
                                        <span>{formatDate(review.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {review.title && (
                                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mt-3">
                                    {review.title}
                                </h4>
                            )}
                            {review.content && (
                                <p className="text-zinc-600 dark:text-zinc-400 mt-2 text-sm leading-relaxed">
                                    {review.content}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Inline Review Form Component
function ReviewForm({ bundleId, onSuccess }: { bundleId: number; onSuccess: () => void }) {
    const { language } = useLanguage();
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const res = await fetch('/api/reviews/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bundle_id: bundleId,
                    customer_name: formData.get('name'),
                    customer_email: formData.get('email'),
                    rating,
                    title: formData.get('title'),
                    content: formData.get('content'),
                }),
            });

            if (res.ok) {
                form.reset();
                onSuccess();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to submit review');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        {language === 'th' ? 'ชื่อ *' : 'Name *'}
                    </label>
                    <input
                        name="name"
                        required
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        placeholder={language === 'th' ? 'ชื่อของคุณ' : 'Your name'}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        {language === 'th' ? 'อีเมล' : 'Email'}
                    </label>
                    <input
                        name="email"
                        type="email"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        placeholder={language === 'th' ? 'อีเมล (ไม่บังคับ)' : 'Email (optional)'}
                    />
                </div>
            </div>

            {/* Star Rating */}
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {language === 'th' ? 'คะแนน *' : 'Rating *'}
                </label>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                            className="p-1 text-2xl transition"
                        >
                            <span className={star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}>
                                ★
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {language === 'th' ? 'หัวข้อ' : 'Title'}
                </label>
                <input
                    name="title"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    placeholder={language === 'th' ? 'สรุปรีวิวของคุณ' : 'Summarize your review'}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {language === 'th' ? 'รีวิว *' : 'Review *'}
                </label>
                <textarea
                    name="content"
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
                    placeholder={language === 'th' ? 'เล่าประสบการณ์ของคุณ...' : 'Share your experience...'}
                />
            </div>

            {error && (
                <div className="text-red-500 text-sm">{error}</div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition"
            >
                {loading
                    ? (language === 'th' ? 'กำลังส่ง...' : 'Submitting...')
                    : (language === 'th' ? 'ส่งรีวิว' : 'Submit Review')
                }
            </button>
        </form>
    );
}
