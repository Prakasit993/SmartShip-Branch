'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { HeroSlide } from '@app/lib/home-seo';

interface HeroCarouselProps {
    slides: HeroSlide[];
}

export default function HeroCarousel({ slides }: HeroCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    const SLIDE_DURATION = 5000;

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        setProgress(0);
    }, [slides.length]);

    const goToPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
        setProgress(0);
    }, [slides.length]);

    if (!slides || slides.length === 0) {
        return (
            <div className="relative w-full h-auto aspect-[4/3] max-h-[min(68vh,560px)] rounded-2xl sm:rounded-3xl overflow-hidden mx-auto">
                <Image
                    src="/nyxel-hero.svg"
                    alt="NYXEL — สินค้า IT พรีเมียม"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 45vw, 640px"
                    priority
                />
            </div>
        );
    }

    useEffect(() => {
        const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        if (slides.length <= 1 || isHovered || isMobileViewport) return;

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
    }, [slides.length, isHovered, isMobileViewport, goToNext]);

    return (
        <div
            className="relative w-full h-auto aspect-[4/3] max-h-[min(68vh,560px)] rounded-2xl sm:rounded-3xl overflow-hidden group mx-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="region"
            aria-roledescription="carousel"
            aria-label="ภาพโปรโมชันหน้าแรก"
        >
            {slides.map((slide, index) => (
                <div
                    key={`${slide.url}-${index}`}
                    className={`absolute inset-0 transition-all duration-700 ease-out ${index === currentIndex
                        ? 'opacity-100 z-10 scale-100'
                        : index === (currentIndex - 1 + slides.length) % slides.length
                            ? 'opacity-0 z-0 -translate-x-full'
                            : 'opacity-0 z-0 translate-x-full'
                        }`}
                    aria-hidden={index !== currentIndex}
                >
                    <div className={`relative w-full h-full transition-transform duration-[8000ms] ease-linear ${index === currentIndex ? 'scale-110' : 'scale-100'}`}>
                        <Image
                            src={slide.url}
                            alt={slide.alt}
                            title={slide.title || undefined}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 45vw, 640px"
                            priority={index === 0}
                        />
                    </div>
                </div>
            ))}

            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 z-20 pointer-events-none"></div>

            {slides.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={goToPrev}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 min-h-11 min-w-11 h-11 w-11 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:bg-white/45 active:scale-95 hover:scale-105 shadow-lg"
                        aria-label="สไลด์ก่อนหน้า"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={goToNext}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 min-h-11 min-w-11 h-11 w-11 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:bg-white/45 active:scale-95 hover:scale-105 shadow-lg"
                        aria-label="สไลด์ถัดไป"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {slides.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 z-30">
                    <div
                        className="h-full bg-gradient-to-r from-white via-white to-white/90 shadow-[0_0_12px_rgba(255,255,255,0.45)] transition-all duration-50 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {slides.length > 1 && (
                <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-2 z-30 px-2">
                    {slides.map((slide, index) => (
                        <button
                            type="button"
                            key={`dot-${slide.url}-${index}`}
                            onClick={() => {
                                setCurrentIndex(index);
                                setProgress(0);
                            }}
                            className="min-h-10 min-w-10 flex items-center justify-center p-2 rounded-full transition-all duration-300 touch-manipulation"
                            aria-label={`ไปสไลด์ ${index + 1}: ${slide.alt}`}
                        >
                            <span
                                className={`block rounded-full transition-all duration-300 ${index === currentIndex
                                    ? 'bg-white h-2 w-8 shadow-lg'
                                    : 'bg-white/50 h-2 w-2 hover:bg-white/85'
                                    }`}
                            />
                        </button>
                    ))}
                </div>
            )}

            {slides.length > 1 && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 px-2.5 py-1 sm:px-3 bg-black/45 backdrop-blur-md rounded-full text-white text-[11px] sm:text-xs font-medium">
                    {currentIndex + 1} / {slides.length}
                </div>
            )}
        </div>
    );
}
