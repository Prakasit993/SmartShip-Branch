import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({
                error: 'ประเภทไฟล์ไม่รองรับ กรุณาใช้ JPG, PNG, WebP หรือ GIF'
            }, { status: 400 });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)'
            }, { status: 400 });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `products/${timestamp}-${randomId}.${extension}`;

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
        const { fileName } = await request.json();

        if (!fileName) {
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
