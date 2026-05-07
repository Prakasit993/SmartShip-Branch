import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

const PRODUCT_IMAGE_PREFIX = 'products/';
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

function isSafeProductImagePath(fileName: unknown): fileName is string {
    if (typeof fileName !== 'string') return false;
    if (!fileName.startsWith(PRODUCT_IMAGE_PREFIX)) return false;
    if (fileName.includes('..') || fileName.includes('\\')) return false;
    return /^products\/[a-zA-Z0-9._-]+$/.test(fileName);
}

export async function POST(request: NextRequest) {
    try {
        const denied = await requireAdminApiAuth('admin-only', request);
        if (denied) return denied;

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
        }

        const extension = EXTENSION_BY_MIME[file.type];
        if (!extension) {
            return NextResponse.json({
                error: 'ประเภทไฟล์ไม่รองรับ กรุณาใช้ JPG, PNG, WebP หรือ GIF'
            }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            return NextResponse.json({
                error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)'
            }, { status: 400 });
        }

        const timestamp = Date.now();
        const randomId = crypto.randomUUID();
        const fileName = `${PRODUCT_IMAGE_PREFIX}${timestamp}-${randomId}.${extension}`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin.storage
            .from('product-images')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (error) {
            console.error('Upload error:', error);
            return NextResponse.json({
                error: 'อัพโหลดไม่สำเร็จ: ' + error.message
            }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('product-images')
            .getPublicUrl(fileName);

        return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            fileName: fileName
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: 'เกิดข้อผิดพลาดในการอัพโหลด'
        }, { status: 500 });
    }
}

// Delete image
export async function DELETE(request: NextRequest) {
    try {
        const denied = await requireAdminApiAuth('admin-only', request);
        if (denied) return denied;

        const { fileName } = await request.json();

        if (!isSafeProductImagePath(fileName)) {
            return NextResponse.json({ error: 'ไม่พบชื่อไฟล์' }, { status: 400 });
        }

        const { error } = await supabaseAdmin.storage
            .from('product-images')
            .remove([fileName]);

        if (error) {
            console.error('Delete error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 });
    }
}
