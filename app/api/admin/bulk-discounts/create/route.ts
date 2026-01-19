import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const {
            name,
            description,
            min_quantity,
            discount_type,
            discount_value,
            applies_to,
            target_id,
            is_active,
            starts_at,
            expires_at,
        } = body;

        if (!name || !min_quantity || !discount_type || !discount_value || !applies_to) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('bulk_discounts')
            .insert({
                name,
                description: description || null,
                min_quantity,
                discount_type,
                discount_value,
                applies_to,
                target_id: target_id || null,
                is_active: is_active ?? true,
                starts_at: starts_at || null,
                expires_at: expires_at || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating bulk discount:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error in create bulk discount:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
