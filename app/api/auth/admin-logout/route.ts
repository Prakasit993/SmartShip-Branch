import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    cookieStore.delete('admin_role');
    cookieStore.getAll().forEach((cookie) => {
        if (cookie.name.startsWith('sb-')) {
            cookieStore.delete(cookie.name);
        }
    });

    // Redirect to login
    return NextResponse.json({ success: true });
}
