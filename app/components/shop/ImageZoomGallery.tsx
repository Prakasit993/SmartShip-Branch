'use client';

import { useState, useRef, useEffect } from 'react';

interface ImageZoomGalleryProps {
    images: string[];
    alt?: string;
}

export default function ImageZoomGallery({ images, alt = 'Product image' }: ImageZoomGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
    const imageRef = useRef<HTMLDivElement>(null);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isLightboxOpen) return;

            if (e.key === 'Escape') setIsLightboxOpen(false);
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, activeIndex]);

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        if (isLightboxOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isLightboxOpen]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imageRef.current || !isZoomed) return;

        const rect = imageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setZoomPosition({ x, y });
    };

    const handleNext = () => {
        setActiveIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = () => {
        setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    if (!images || images.length === 0) {
        return (
            <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                ไม่มีรูปภาพ
            </div>
        );
    }

    return (
        <>
            {/* Main Image with Zoom */}
            <div className="relative">
                <div
                    ref={imageRef}
                    className="w-full aspect-square bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden cursor-zoom-in relative group"
                    onClick={() => setIsLightboxOpen(true)}
                    onMouseEnter={() => setIsZoomed(true)}
                    onMouseLeave={() => setIsZoomed(false)}
                    onMouseMove={handleMouseMove}
                >
                    <img
                        src={images[activeIndex]}
                        alt={`${alt} ${activeIndex + 1}`}
                        className={`w-full h-full object-contain transition-transform duration-200 ${isZoomed ? 'scale-150' : 'scale-100'
                            }`}
                        style={isZoomed ? {
                            transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
                        } : undefined}
                    />

                    {/* Zoom indicator */}
                    <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                        🔍 คลิกเพื่อขยาย
                    </div>
                </div>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-zinc-800/80 rounded-full shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 transition"
                        >
                            ‹
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-zinc-800/80 rounded-full shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 transition"
                        >
                            ›
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {images.map((url, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${activeIndex === idx
                                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                        >
                            <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox Modal */}
            {isLightboxOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setIsLightboxOpen(false)}
                        className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition z-10"
                    >
                        ✕
                    </button>

                    {/* Image counter */}
                    <div className="absolute top-4 left-4 text-white/60 text-sm">
                        {activeIndex + 1} / {images.length}
                    </div>

                    {/* Main lightbox image */}
                    <div
                        className="relative max-w-[90vw] max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={images[activeIndex]}
                            alt={`${alt} ${activeIndex + 1}`}
                            className="max-w-full max-h-[90vh] object-contain"
                        />
                    </div>

                    {/* Navigation */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition"
                            >
                                ‹
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition"
                            >
                                ›
                            </button>
                        </>
                    )}

                    {/* Lightbox thumbnails */}
                    {images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4">
                            {images.map((url, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { e.stopPropagation(); setActiveIndex(idx); }}
                                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${activeIndex === idx
                                            ? 'border-white'
                                            : 'border-transparent opacity-50 hover:opacity-100'
                                        }`}
                                >
                                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
