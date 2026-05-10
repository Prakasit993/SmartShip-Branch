import type { Metadata } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { getSiteUrl } from '@/lib/site-url';
import { notFound } from 'next/navigation';
import BundleDetail from '@app/components/shop/BundleDetail';

export const dynamic = 'force-dynamic';

type ProductSeo = {
    meta_title: string | null;
    meta_description: string | null;
    image_alt: string | null;
};

function absoluteImageUrl(url: string | undefined | null): string | undefined {
    if (!url?.trim()) return undefined;
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    const origin = getSiteUrl().origin;
    return u.startsWith('/') ? `${origin}${u}` : `${origin}/${u}`;
}

async function getLinkedProductSeo(bundleId: number, bundleType: string): Promise<ProductSeo | null> {
    if (bundleType === 'fixed') {
        const { data: item } = await supabase
            .from('bundle_items')
            .select('product_id')
            .eq('bundle_id', bundleId)
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (!item?.product_id) return null;

        const { data: prod } = await supabase
            .from('products')
            .select('meta_title, meta_description, image_alt')
            .eq('id', item.product_id)
            .maybeSingle();

        return prod as ProductSeo | null;
    }

    const { data: group } = await supabase
        .from('bundle_option_groups')
        .select('id')
        .eq('bundle_id', bundleId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!group?.id) return null;

    const { data: opt } = await supabase
        .from('bundle_options')
        .select('product_id')
        .eq('group_id', group.id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!opt?.product_id) return null;

    const { data: prod } = await supabase
        .from('products')
        .select('meta_title, meta_description, image_alt')
        .eq('id', opt.product_id)
        .maybeSingle();

    return prod as ProductSeo | null;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;

    const { data: bundle } = await supabase
        .from('bundles')
        .select('id, name, slug, description, image_urls, type, meta_title, meta_description, image_alt')
        .eq('slug', slug)
        .maybeSingle();

    if (!bundle) {
        return { title: 'สินค้า' };
    }

    const seo = await getLinkedProductSeo(bundle.id, bundle.type);

    const title = (bundle.meta_title?.trim() || seo?.meta_title?.trim() || bundle.name).slice(0, 120);
    const description = (
        bundle.meta_description?.trim() ||
        seo?.meta_description?.trim() ||
        bundle.description?.trim() ||
        `ซื้อ ${bundle.name} — สั่งออนไลน์ได้ทันที`
    ).slice(0, 320);

    const site = getSiteUrl();
    const canonical = new URL(`/shop/bundle/${bundle.slug}`, site);

    const ogFromBundle = Array.isArray(bundle.image_urls) ? bundle.image_urls[0] : undefined;
    const ogImage = absoluteImageUrl(ogFromBundle);

    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'SmartShip';

    return {
        title,
        description,
        alternates: {
            canonical: canonical.toString(),
        },
        openGraph: {
            title,
            description,
            url: canonical.toString(),
            siteName,
            locale: 'th_TH',
            type: 'website',
            images: ogImage
                ? [
                      {
                          url: ogImage,
                          alt: bundle.image_alt?.trim() || seo?.image_alt?.trim() || bundle.name,
                      },
                  ]
                : undefined,
        },
        twitter: {
            card: ogImage ? 'summary_large_image' : 'summary',
            title,
            description,
            images: ogImage ? [ogImage] : undefined,
        },
    };
}

export default async function BundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const { data: bundle } = await supabase.from('bundles').select('*').eq('slug', slug).single();

    if (!bundle) notFound();

    let items = [];
    let optionGroups = [];

    if (bundle.type === 'fixed') {
        const { data } = await supabase
            .from('bundle_items')
            .select(
                `*, products(name, stock_quantity, width, length, height, dimension_unit, thickness, color, size_label)`,
            )
            .eq('bundle_id', bundle.id);
        items = data || [];
    } else if (bundle.type === 'configurable') {
        const { data } = await supabase
            .from('bundle_option_groups')
            .select(
                `
             *,
             options:bundle_options(*)
        `,
            )
            .eq('bundle_id', bundle.id)
            .order('sort_order');
        optionGroups = data || [];
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user?.email) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const staffEmails = (process.env.STAFF_EMAILS || '').split(',').map((e) => e.trim());
        if (user.email === adminEmail || staffEmails.includes(user.email)) {
            isAdmin = true;
        }
    }

    const seo = await getLinkedProductSeo(bundle.id, bundle.type);
    const primaryImageAlt = (
        bundle.image_alt?.trim() ||
        seo?.image_alt?.trim() ||
        bundle.name ||
        'สินค้า'
    ).slice(0, 220);

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <BundleDetail
                bundle={bundle}
                items={items}
                optionGroups={optionGroups}
                isAdmin={isAdmin}
                primaryImageAlt={primaryImageAlt}
            />
        </div>
    );
}
