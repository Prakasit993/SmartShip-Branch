import { cookies } from 'next/headers';

/** True if request carries admin password session or post-middleware admin/staff role cookie */
export async function isAdminApiRequest(): Promise<boolean> {
    const store = await cookies();
    const s = store.get('admin_session')?.value;
    const hasPwd = s === 'true' || s === 'admin';
    const hasRole = Boolean(store.get('admin_role')?.value);
    return hasPwd || hasRole;
}
