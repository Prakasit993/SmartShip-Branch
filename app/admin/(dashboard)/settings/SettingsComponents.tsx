'use client';

import { useState, useRef } from 'react';

interface ImageUploaderProps {
    name: string;
    label: string;
    initialUrls: string[];
    maxImages?: number;
    onUpload: (files: File[]) => Promise<string[]>;
}

export function ImageUploader({ name, label, initialUrls, maxImages = 5, onUpload }: ImageUploaderProps) {
    const [urls, setUrls] = useState<string[]>(initialUrls);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploading(true);
        try {
            const uploadedUrls = await onUpload(files);
            setUrls(prev => [...prev, ...uploadedUrls].slice(0, maxImages));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดไม่สำเร็จ');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setUrls(prev => prev.filter((_, i) => i !== index));
    };

    const moveImage = (index: number, direction: 'up' | 'down') => {
        const newUrls = [...urls];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= urls.length) return;
        [newUrls[index], newUrls[newIndex]] = [newUrls[newIndex], newUrls[index]];
        setUrls(newUrls);
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-200">{label}</label>

            {/* Hidden input for form submission */}
            <input type="hidden" name={name} value={urls.join('\n')} />

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {urls.map((url, index) => (
                    <div key={index} className="relative group aspect-video bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                        <img
                            src={url}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {index > 0 && (
                                <button
                                    type="button"
                                    onClick={() => moveImage(index, 'up')}
                                    className="p-1.5 bg-white/20 rounded hover:bg-white/40"
                                    title="Move left"
                                >
                                    ←
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="p-1.5 bg-red-500/80 rounded hover:bg-red-500"
                                title="Remove"
                            >
                                🗑️
                            </button>
                            {index < urls.length - 1 && (
                                <button
                                    type="button"
                                    onClick={() => moveImage(index, 'down')}
                                    className="p-1.5 bg-white/20 rounded hover:bg-white/40"
                                    title="Move right"
                                >
                                    →
                                </button>
                            )}
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}
                        </div>
                    </div>
                ))}

                {/* Add Button */}
                {urls.length < maxImages && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="aspect-video bg-zinc-800/50 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                    >
                        {uploading ? (
                            <span className="text-zinc-400">⏳ กำลังอัปโหลด...</span>
                        ) : (
                            <>
                                <span className="text-2xl">➕</span>
                                <span className="text-xs text-zinc-400">เพิ่มรูป</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            <p className="text-xs text-zinc-500">
                สูงสุด {maxImages} รูป • ลากเพื่อเรียงลำดับ • รูปแรกจะแสดงเป็นหลัก
            </p>
        </div>
    );
}

interface CollapsibleSectionProps {
    title: string;
    icon: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <h2 className="font-semibold text-lg text-white">{title}</h2>
                </div>
                <span className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {isOpen && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-800">
                    {children}
                </div>
            )}
        </div>
    );
}

export function InputField({
    name,
    label,
    defaultValue,
    placeholder,
    type = 'text',
    rows,
    helpText
}: {
    name: string;
    label: string;
    defaultValue?: string;
    placeholder?: string;
    type?: string;
    rows?: number;
    helpText?: string;
}) {
    const baseClass = "w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition";

    return (
        <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
            {helpText && <p className="text-xs text-zinc-500 mb-2">{helpText}</p>}
            {rows ? (
                <textarea
                    name={name}
                    rows={rows}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    className={baseClass}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    className={baseClass}
                />
            )}
        </div>
    );
}
