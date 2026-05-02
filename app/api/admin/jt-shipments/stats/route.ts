import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { channelBucketLabelFromRow } from '@/lib/jtChannel';
import { parseJtChannelPriorityFromSettingValue, uniqueFieldsForSelect } from '@/lib/jtChannelSettings';
import { parseJtDashboardSectionsJson } from '@/lib/jtDashboardSections';
import { buildUtcDayWindow, utcDayKeyFromIso } from '@/lib/utcDayKey';

export async function GET() {
    try {
        const [{ data: latestRow }, settingsRes] = await Promise.all([
            supabaseAdmin.from('jt_shipments').select('booking_date').order('booking_date', { ascending: false }).limit(1).maybeSingle(),
            supabaseAdmin.from('settings').select('key, value').in('key', ['jt_dashboard_sections', 'jt_channel_field_priority']),
        ]);

        const settingsRows = (settingsRes.data || []) as { key: string; value: unknown }[];
        const priority = parseJtChannelPriorityFromSettingValue(
            settingsRows.find((r) => r.key === 'jt_channel_field_priority')?.value,
        );
        const channelFields = uniqueFieldsForSelect(priority);
        const platformSelect = channelFields.length ? channelFields.join(',') : 'platform,order_source';
        const recentSelect = [...new Set(['awb_number', 'booking_date', 'sender_name', 'receiver_name', 'shipping_fee', ...channelFields])].join(',');

        const anchorMs = latestRow?.booking_date ? Date.parse(String(latestRow.booking_date)) : Date.now();
        const anchorSafe = Number.isNaN(anchorMs) ? Date.now() : anchorMs;
        const now = new Date(anchorSafe);

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { keys: dayKeys, startIso: rangeStartIso } = buildUtcDayWindow(anchorSafe, 30);

        const [
            totalRes,
            todayRes,
            weekRes,
            monthRes,
            feeRes,
            recentRes,
            topSendersRes,
            topReceiversRes,
            daily30Res,
            platformRes,
        ] = await Promise.all([
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true }),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', todayStart.toISOString()),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', weekStart.toISOString()),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', monthStart.toISOString()),
            supabaseAdmin.from('jt_shipments').select('shipping_fee'),
            supabaseAdmin
                .from('jt_shipments')
                .select(recentSelect)
                .order('booking_date', { ascending: false })
                .limit(10),
            supabaseAdmin.from('jt_shipments').select('sender_name').not('sender_name', 'is', null),
            supabaseAdmin.from('jt_shipments').select('receiver_name').not('receiver_name', 'is', null),
            supabaseAdmin
                .from('jt_shipments')
                .select('booking_date')
                .gte('booking_date', rangeStartIso)
                .order('booking_date', { ascending: true }),
            supabaseAdmin.from('jt_shipments').select(platformSelect),
        ]);

        const fees = (feeRes.data || []).map((r: { shipping_fee: string | number }) => Number(r.shipping_fee) || 0);
        const totalFee = fees.reduce((a, b) => a + b, 0);
        const avgFee = fees.length ? totalFee / fees.length : 0;
        const maxFee = fees.length ? Math.max(...fees) : 0;

        const dayKeySet = new Set(dayKeys);
        const dailyMap: Record<string, number> = {};
        dayKeys.forEach((k) => {
            dailyMap[k] = 0;
        });
        (daily30Res.data || []).forEach((row: Record<string, string>) => {
            const key = utcDayKeyFromIso(row.booking_date);
            if (key && dayKeySet.has(key)) {
                dailyMap[key] = (dailyMap[key] || 0) + 1;
            }
        });
        const daily30 = dayKeys.map((date) => ({ date, count: dailyMap[date] ?? 0 }));

        const platformCounts: { name: string; count: number }[] = [];
        if (!platformRes.error && platformRes.data) {
            const pMap: Record<string, number> = {};
            const rows = platformRes.data as unknown as Record<string, unknown>[];
            rows.forEach((row) => {
                const name = channelBucketLabelFromRow(row, priority);
                pMap[name] = (pMap[name] || 0) + 1;
            });
            const entries = Object.entries(pMap).sort((a, b) => b[1] - a[1]);
            platformCounts.push(...entries.map(([name, count]) => ({ name, count })));
        }

        const sMap: Record<string, number> = {};
        (topSendersRes.data || []).forEach((r: Record<string, string>) => {
            if (r.sender_name) sMap[r.sender_name] = (sMap[r.sender_name] || 0) + 1;
        });
        const topSenders = Object.entries(sMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        const rMap: Record<string, number> = {};
        (topReceiversRes.data || []).forEach((r: Record<string, string>) => {
            if (r.receiver_name) rMap[r.receiver_name] = (rMap[r.receiver_name] || 0) + 1;
        });
        const topReceivers = Object.entries(rMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        const sectionsVal = settingsRows.find((r) => r.key === 'jt_dashboard_sections')?.value;

        return NextResponse.json({
            total: totalRes.count || 0,
            today: todayRes.count || 0,
            week: weekRes.count || 0,
            month: monthRes.count || 0,
            totalFee: Math.round(totalFee * 100) / 100,
            avgFee: Math.round(avgFee * 100) / 100,
            maxFee: Math.round(maxFee * 100) / 100,
            recent: recentRes.data || [],
            topSenders,
            topReceivers,
            daily30,
            platformCounts,
            channelFieldPriority: priority,
            ui: {
                sections: parseJtDashboardSectionsJson(sectionsVal),
            },
        });
    } catch (e) {
        console.error('[jt-stats]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
