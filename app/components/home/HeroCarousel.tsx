'use client';

import { useState, useEffect, useCallback } from 'react';

interface HeroCarouselProps {
    images: string[];
}

export default function HeroCarousel({ images }: HeroCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(0);

    const SLIDE_DURATION = 5000; // 5 seconds per slide

    // Navigate to next/prev slide
    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setProgress(0);
    }, [images.length]);

    const goToPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setProgress(0);
    }, [images.length]);

    // If no images, show placeholder
    if (!images || images.length === 0) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src="/smartship-storefront.png"
                alt="SmartShip Storefront"
                className="w-full h-auto object-cover aspect-[4/3] rounded-3xl"
            />
        );
    }

    // Auto-advance with progress
    useEffect(() => {
        if (images.length <= 1 || isHovered) return;

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    goToNext();
                    return 0;
                }
                return prev + (100 / (SLIDE_DURATION / 50));
            });
        }, 50);

        return () => clearInterval(progressInterval);
    }, [images.length, isHovered, goToNext]);

    return (
        <div
            className="relative w-full h-auto aspect-[4/3] rounded-3xl overflow-hidden group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Images with Ken Burns / Zoom effect */}
            {images.map((src, index) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-all duration-700 ease-out ${index === currentIndex
                            ? 'opacity-100 z-10 scale-100'
                            : index === (currentIndex - 1 + images.length) % images.length
                                ? 'opacity-0 z-0 -translate-x-full'
                                : 'opacity-0 z-0 translate-x-full'
                        }`}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={`Slide ${index + 1}`}
                        className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${index === currentIndex ? 'scale-110' : 'scale-100'
                            }`}
                    />
                </div>
            ))}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 z-20 pointer-events-none"></div>

            {/* Arrow Navigation */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={goToPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/40 hover:scale-110"
                        aria-label="Previous slide"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/40 hover:scale-110"
                        aria-label="Next slide"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Progress Bar */}
            {images.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 z-30">
                    <div
                        className="h-full bg-white transition-all duration-50 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Navigation Dots */}
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                    {images.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setCurrentIndex(index);
                                setProgress(0);
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? 'bg-white w-8 shadow-lg'
                                    : 'bg-white/50 w-2 hover:bg-white/80'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Slide Counter */}
            {images.length > 1 && (
                <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium">
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    );
}
