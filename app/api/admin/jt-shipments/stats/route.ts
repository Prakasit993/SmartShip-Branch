import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        // Fetch latest date to base stats on
        const { data: latestRow } = await supabaseAdmin.from('jt_shipments')
            .select('booking_date')
            .order('booking_date', { ascending: false })
            .limit(1)
            .single();

        const now = latestRow?.booking_date ? new Date(latestRow.booking_date) : new Date();
        
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
        const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const day30Start = new Date(now); day30Start.setDate(now.getDate() - 29); day30Start.setHours(0, 0, 0, 0);

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
        ] = await Promise.all([
            // Total count
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true }),
            // Today
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true })
                .gte('booking_date', todayStart.toISOString()),
            // This week
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true })
                .gte('booking_date', weekStart.toISOString()),
            // This month
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true })
                .gte('booking_date', monthStart.toISOString()),
            // Fee stats
            supabaseAdmin.from('jt_shipments').select('shipping_fee'),
            // Recent 10
            supabaseAdmin.from('jt_shipments').select('awb_number,booking_date,sender_name,receiver_name,shipping_fee')
                .order('booking_date', { ascending: false }).limit(10),
            // Top senders (RPC optional - fallback handled below)
            supabaseAdmin.from('jt_shipments').select('sender_name').not('sender_name', 'is', null),
            // Top receivers
            supabaseAdmin.from('jt_shipments').select('receiver_name').not('receiver_name', 'is', null),
            // Daily 30 days - get all records in range and aggregate in JS
            supabaseAdmin.from('jt_shipments').select('booking_date')
                .gte('booking_date', day30Start.toISOString())
                .order('booking_date', { ascending: true }),
        ]);

        // Fee calculations
        const fees = (feeRes.data || []).map((r: { shipping_fee: string | number }) => Number(r.shipping_fee) || 0);
        const totalFee = fees.reduce((a, b) => a + b, 0);
        const avgFee = fees.length ? totalFee / fees.length : 0;
        const maxFee = fees.length ? Math.max(...fees) : 0;

        // Daily aggregation (last 30 days)
        const dailyMap: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            dailyMap[key] = 0;
        }
        (daily30Res.data || []).forEach((row: Record<string, string>) => {
            const key = row.booking_date?.slice(0, 10);
            if (key && dailyMap[key] !== undefined) {
                dailyMap[key] = (dailyMap[key] || 0) + 1;
            }
        });
        const daily30 = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

        // Aggregate top senders from query result
        const sMap: Record<string, number> = {};
        (topSendersRes.data || []).forEach((r: Record<string, string>) => {
            if (r.sender_name) sMap[r.sender_name] = (sMap[r.sender_name] || 0) + 1;
        });
        const topSenders = Object.entries(sMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        // Aggregate top receivers
        const rMap: Record<string, number> = {};
        (topReceiversRes.data || []).forEach((r: Record<string, string>) => {
            if (r.receiver_name) rMap[r.receiver_name] = (rMap[r.receiver_name] || 0) + 1;
        });
        const topReceivers = Object.entries(rMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name, count]) => ({ name, count }));

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
        });
    } catch (e) {
        console.error('[jt-stats]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
