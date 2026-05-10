/**
 * URL-safe slug for products (ASCII). Thai/other scripts are stripped;
 * combine with SKU in admin if you need uniqueness without Latin letters.
 */
export function slugifyProductName(input: string): string {
    const base = input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
    return base || 'product';
}
