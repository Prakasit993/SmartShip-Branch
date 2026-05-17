import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/jt-shipments/not-closed-overdue
 *
 * รายการพัสดุที่ "ยังไม่ปิดงาน" และ "ค้างสถานะเกินระยะเวลา" — ใช้สำหรับสำรวจเคส
 * aging / เร่งด่วน ที่ admin ต้องไล่ปิด.
 *
 * เงื่อนไข:
 *   1. signer_name เป็น null / ว่าง / 'NULL'   (= ยังไม่ปิดงาน)
 *   2. age_field <= (วันนี้ - min_age_days)    (= ค้างเกิน N วัน)
 *
 * Query params:
 *   min_age_days   จำนวนวัน aging ขั้นต่ำ (default 7, ค่าจริง 1-365)
 *   age_field      'booking_date' | 'latest_scan_time' (default booking_date)
 *                   - booking_date: นับจากวันคีย์พัสดุ (เคสที่คีย์ไปนานแล้วแต่ยังไม่ปิดงาน)
 *                   - latest_scan_time: นับจาก scan ล่าสุด (เคสที่ค้าง ไม่มีความเคลื่อนไหว);
 *                     NULL/empty = ไม่มี scan เลย → จัดเป็น overdue สูงสุด
 *   date_from      YYYY-MM-DD (optional, lower bound บน booking_date — "ดูย้อนหลังไม่เกินวันนี้")
 *   date_to        YYYY-MM-DD (optional, ใช้ได้เฉพาะ age_field='latest_scan_time' —
 *                  ถูก ignore เมื่อ age_field='booking_date' เพราะ cutoff_date ทำหน้าที่ upper bound แล้ว
 *                  ป้องกัน range ทับซ้อนจนได้ผลลัพธ์ว่าง)
 *   limit          (default 100, max 500)
 *
 * Response (200):
 * {
 *   total            : number   — จำนวนเคสที่ผ่าน filter (จากที่ดึงมา)
 *   limit            : number
 *   truncated        : boolean  — true ถ้ามีโอกาส row เกิน limit
 *   min_age_days     : number
 *   age_field        : 'booking_date' | 'latest_scan_time'
 *   cutoff_date      : string YYYY-MM-DD — ตัด aging ที่วันนี้
 *   today            : string YYYY-MM-DD — UTC calendar today
 *   date_from        : string | null
 *   date_to          : string | null
 *   cases            : Array<OverdueCase>   (มี age_days ติดมาด้วย)
 *   _elapsed_ms      : number
 * }
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_MIN_AGE_DAYS = 7;
const MAX_MIN_AGE_DAYS = 365;

type AgeField = 'booking_date' | 'latest_scan_time';

function isNotClosed(signerName: unknown): boolean {
    if (signerName === null || signerName === undefined) return true;
    const v = String(signerName).trim();
    if (v === '' || v.toUpperCase() === 'NULL') return true;
    return false;
}

/** YYYY-MM-DD ของ UTC calendar day จาก ms epoch. */
function utcYmd(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/** วันที่ที่ "อยู่ก่อน" cutoffYmd แบบ inclusive-of-cutoff-day. ใช้คู่กับ < operator */
function dayAfter(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, 0, 0, 0, 0);
    return utcYmd(t);
}

/** จำนวนวันที่ระหว่าง ymd (YYYY-MM-DD) ถึง today (UTC). ค่าลบ = อนาคต. null = parse ไม่ได้. */
function ageDaysFromYmd(value: string | null | undefined, todayMs: number): number | null {
    if (!value) return null;
    const s = String(value).trim();
    if (!s) return null;
    // booking_date / latest_scan_time อาจเป็น "YYYY-MM-DD HH:MM:SS" — ตัดเอาแค่วัน
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!ymdMatch) return null;
    const t = Date.UTC(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]), 0, 0, 0, 0);
    if (Number.isNaN(t)) return null;
    return Math.floor((todayMs - t) / 86_400_000);
}

type ShipmentRow = {
    awb_number: string | null;
    booking_date: string | null;
    sender_name: string | null;
    sender_phone: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    total_shipping_fee: string | null;
    cod_amount: string | null;
    cod_status: string | null;
    latest_scan_time: string | null;
    issue_status: string | null;
    issue_registered_time: string | null;
    exception_reason: string | null;
    return_type: string | null;
    signer_name: string | null;
    updated_at: string | null;
};

type OverdueCase = {
    awb_number: string;
    booking_date: string;
    sender_name: string;
    sender_phone: string;
    receiver_name: string;
    receiver_phone: string;
    total_shipping_fee: string;
    cod_amount: string;
    cod_status: string;
    latest_scan_time: string;
    issue_status: string;
    issue_registered_time: string;
    exception_reason: string;
    return_type: string;
    signer_name: string;
    updated_at: string;
    age_days: number | null;
};

function toCase(row: ShipmentRow, ageDays: number | null): OverdueCase {
    const safe = (v: unknown) => String(v ?? '').trim() || '-';
    return {
        awb_number: safe(row.awb_number),
        booking_date: safe(row.booking_date),
        sender_name: safe(row.sender_name),
        sender_phone: safe(row.sender_phone),
        receiver_name: safe(row.receiver_name),
        receiver_phone: safe(row.receiver_phone),
        total_shipping_fee: safe(row.total_shipping_fee),
        cod_amount: safe(row.cod_amount),
        cod_status: safe(row.cod_status),
        latest_scan_time: safe(row.latest_scan_time),
        issue_status: safe(row.issue_status),
        issue_registered_time: safe(row.issue_registered_time),
        exception_reason: safe(row.exception_reason),
        return_type: safe(row.return_type),
        signer_name: safe(row.signer_name),
        updated_at: safe(row.updated_at),
        age_days: ageDays,
    };
}

const SELECT_COLUMNS =
    'awb_number,booking_date,sender_name,sender_phone,receiver_name,receiver_phone,total_shipping_fee,cod_amount,cod_status,latest_scan_time,issue_status,issue_registered_time,exception_reason,return_type,signer_name,updated_at';

export async function GET(req: Request) {
    const t0 = performance.now();
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:not-closed-overdue', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAiToolAuth(req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from')?.trim() ?? '';
        const dateTo = searchParams.get('date_to')?.trim() ?? '';

        const limitRaw = Number(searchParams.get('limit'));
        const limit =
            Number.isFinite(limitRaw) && limitRaw > 0
                ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
                : DEFAULT_LIMIT;

        const minAgeRaw = Number(searchParams.get('min_age_days'));
        const minAgeDays =
            Number.isFinite(minAgeRaw) && minAgeRaw > 0
                ? Math.min(Math.floor(minAgeRaw), MAX_MIN_AGE_DAYS)
                : DEFAULT_MIN_AGE_DAYS;

        const ageFieldRaw = (searchParams.get('age_field') ?? '').trim().toLowerCase();
        const ageField: AgeField =
            ageFieldRaw === 'latest_scan_time' ? 'latest_scan_time' : 'booking_date';

        // วันนี้ (UTC calendar day) — สอดคล้องกับ booking_date ที่เก็บเป็น YYYY-MM-DD HH:MM:SS
        const todayMs = Date.now();
        const today = utcYmd(todayMs);
        // cutoff = today - minAgeDays. items ที่ age_field <= cutoff = overdue
        const cutoffMs = todayMs - minAgeDays * 86_400_000;
        const cutoffYmd = utcYmd(cutoffMs);
        // upper bound exclusive (next day) — ใช้กับ string compare ของ text column
        const cutoffUpperExclusive = dayAfter(cutoffYmd);

        const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
        // Defensive: AI มักจะ resolve "ค้างเกิน N วัน" เป็นช่วงเวลา today-N → today
        // และส่ง date_from = cutoff_date มา filter ซ้อนทำให้ range ว่าง. ตัดออกถ้า
        // ไม่ make sense กับ cutoff (date_from/date_to ต้อง "เก่ากว่า" cutoff_date
        // อย่างเคร่งครัด ถึงจะมีความหมายเป็น tighter bound)
        const effectiveDateFrom =
            ageField === 'booking_date' && dateFrom && YMD_RE.test(dateFrom) && dateFrom >= cutoffYmd
                ? ''
                : dateFrom;
        const effectiveDateTo =
            ageField === 'booking_date' && dateTo && YMD_RE.test(dateTo) && dateTo >= cutoffYmd
                ? ''
                : dateTo;
        const dateFromDropped = effectiveDateFrom === '' && dateFrom !== '';
        const dateToDropped = effectiveDateTo === '' && dateTo !== '';

        let q = supabaseAdmin.from('jt_shipments').select(SELECT_COLUMNS);

        // Filter signer_name = "ยังไม่ปิดงาน" ใน DB เลย — ลด payload จาก ~30k+ เหลือ
        // เฉพาะ not-closed rows. ไม่ catch whitespace-only signer_name (rare) แต่
        // JS filter ด้านล่างจะกรองอีกชั้นเพื่อความถูกต้อง.
        q = q.or('signer_name.is.null,signer_name.eq.,signer_name.eq.NULL');

        if (ageField === 'booking_date') {
            // ใช้ DB filter ตัด rows ที่ booking_date ใหม่กว่า cutoff (ลด payload)
            q = q.lt('booking_date', cutoffUpperExclusive);
            // date_from/date_to ใช้ได้เฉพาะตอนเก่ากว่า cutoff (ดูใน effective* ด้านบน)
            q = applyBookingDateRangeFilters(q, effectiveDateFrom, effectiveDateTo);
        } else {
            // age_field=latest_scan_time: cutoff filter อยู่บนคนละ column —
            // date_from/date_to กรอง booking_date ได้ปกติ (ไม่ทับซ้อน)
            // ไม่ filter scan_time ใน DB เพราะต้องรวม NULL (no-scan = overdue สูงสุด)
            q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
        }

        // Order ตาม age_field ASC = เก่าสุดก่อน
        if (ageField === 'booking_date') {
            q = q.order('booking_date', { ascending: true, nullsFirst: false });
        } else {
            // NULL scan_time = no movement = ค้างที่สุด → เอาขึ้นก่อน
            q = q.order('latest_scan_time', { ascending: true, nullsFirst: true });
        }

        // หลังกรอง signer_name + cutoff แล้ว ใช้ DB cap แค่ MAX_LIMIT (500) ก็พอ —
        // ไม่ต้อง over-fetch เพราะ row pool เหลือน้อยมาก ๆ แล้ว
        const { data, error } = await q.range(0, MAX_LIMIT - 1);
        if (error) {
            console.error('[jt-shipments/not-closed-overdue]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ดึง AWB ที่ admin "รับทราบและปิดเรื่อง" (mute_aging=true) เพื่อตัดออกจากผลลัพธ์.
        // AI ไม่ต้องรู้ว่าเคสเหล่านี้ถูก ack — ปล่อยให้ silent skip
        const { data: mutedAcks, error: ackErr } = await supabaseAdmin
            .from('jt_return_acknowledgements')
            .select('awb_number')
            .eq('status', 'active')
            .eq('mute_aging', true);
        if (ackErr) {
            // ไม่ block — log แล้วทำงานต่อ (ดีกว่าโดน 500 เมื่อ ack table มีปัญหา)
            console.warn('[jt-shipments/not-closed-overdue] muted ack fetch failed:', ackErr);
        }
        const mutedSet = new Set<string>(
            ((mutedAcks ?? []) as Array<{ awb_number: string | null }>)
                .map((r) => String(r.awb_number ?? '').trim())
                .filter(Boolean),
        );

        const cutoffStr = cutoffYmd; // ใช้เปรียบเทียบกับ ymd part ของ text field
        const rawRows = (data ?? []) as ShipmentRow[];
        const matched: Array<{ row: ShipmentRow; age: number | null }> = [];

        let mutedSkipped = 0;
        for (const r of rawRows) {
            if (!isNotClosed(r.signer_name)) continue;

            // skip AWB ที่ admin ปิดเรื่องแล้ว (เคลม/ส่งคืน/ไปส่ง/สูญหาย ฯลฯ)
            const awbTrim = String(r.awb_number ?? '').trim();
            if (awbTrim && mutedSet.has(awbTrim)) {
                mutedSkipped++;
                continue;
            }

            const fieldVal = ageField === 'booking_date' ? r.booking_date : r.latest_scan_time;

            if (ageField === 'latest_scan_time') {
                // NULL/empty → overdue เสมอ (no scan = ค้างมากสุด)
                if (!fieldVal || String(fieldVal).trim() === '') {
                    matched.push({ row: r, age: null });
                    continue;
                }
            }

            const valStr = String(fieldVal ?? '').trim();
            if (!valStr) continue;

            // เปรียบเทียบ YYYY-MM-DD part กับ cutoff (string compare ใช้ได้กับ ISO date)
            const ymdPart = valStr.slice(0, 10);
            if (ymdPart > cutoffStr) continue; // ใหม่กว่า cutoff → ไม่ overdue

            matched.push({ row: r, age: ageDaysFromYmd(valStr, todayMs) });
        }

        const cases = matched.slice(0, limit).map(({ row, age }) => toCase(row, age));

        // matched > limit หรือ DB คืนเต็ม MAX_LIMIT = อาจมี row เกินที่ยังไม่ได้ดึง
        const truncated = matched.length > limit || rawRows.length >= MAX_LIMIT;

        const elapsed = Math.round(performance.now() - t0);
        console.log(
            `[jt-shipments/not-closed-overdue] done in ${elapsed}ms — ${cases.length}/${matched.length} returned (age_field=${ageField}, min_age=${minAgeDays}d, muted_skipped=${mutedSkipped}, dropped: from=${dateFromDropped} to=${dateToDropped})`,
        );

        const warnings: string[] = [];
        if (dateFromDropped) {
            warnings.push(
                `date_from='${dateFrom}' ถูก ignore เพราะไม่เก่ากว่า cutoff_date='${cutoffYmd}' — ใช้ cutoff เป็น upper bound แทน`,
            );
        }
        if (dateToDropped) {
            warnings.push(
                `date_to='${dateTo}' ถูก ignore เพราะไม่เก่ากว่า cutoff_date='${cutoffYmd}' — redundant กับ cutoff`,
            );
        }

        return NextResponse.json({
            total: matched.length,
            limit,
            truncated,
            min_age_days: minAgeDays,
            age_field: ageField,
            cutoff_date: cutoffYmd,
            today,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            warnings: warnings.length ? warnings : undefined,
            cases,
            _elapsed_ms: elapsed,
        });
    } catch (err) {
        console.error('[jt-shipments/not-closed-overdue] unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
