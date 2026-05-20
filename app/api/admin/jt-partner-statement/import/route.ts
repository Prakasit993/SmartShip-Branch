import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as XLSX from 'xlsx';

/** คอลัมน์ที่คาดหวังจากไฟล์ statement J&T — รองรับหลายชื่อหัวตาราง */
const COLUMN_ALIASES = {
    franchise_code: ['รหัสเจ้าสำรอง', 'franchise_code', 'franchisecode', 'franchise code'],
    awb_number: ['รหัสเงินสำรอง', 'หมายเลข awb', 'หมายเลขawb', 'awb_number', 'awb number', 'awb', 'เลขพัสดุ', 'tracking number'],
    branch_code: ['รหัสสาขา', 'branch_code', 'branch code', 'branchcode'],
    charge_type: [
        'ประเภทย่อยของค่าใช้จ่าย',
        'ประเภทของยอดค่าใช้จ่าย',
        'charge_type',
        'charge type',
        'chargetype',
        'ประเภทค่าใช้จ่าย',
        'ประเภท',
        'type',
    ],
    amount: ['จำนวนเงิน', 'amount', 'จำนวน', 'ยอดเงิน', 'sum of จำนวนเงิน'],
    transaction_date: [
        'วันที่ทำธุรกรรม',
        'transaction_date',
        'transaction date',
        'transactiondate',
        'วันที่',
        'date',
    ],
    remarks: ['หมายเหตุ', 'remarks', 'note', 'notes', 'remark'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

/** แมป header จริงในไฟล์ → field key */
function buildHeaderMap(headers: string[]): Map<string, ColumnKey> {
    const map = new Map<string, ColumnKey>();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, readonly string[]][]) {
        for (const header of headers) {
            const normalized = header.trim().toLowerCase();
            if (aliases.some((a) => a.toLowerCase() === normalized)) {
                map.set(header, field);
                break;
            }
        }
    }
    return map;
}

/** แปลง CSV string → array of rows */
function parseCsvRows(text: string): string[][] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    return lines
        .map((line) => {
            const cols: string[] = [];
            let current = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    inQuote = !inQuote;
                } else if (ch === ',' && !inQuote) {
                    cols.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
            cols.push(current);
            return cols;
        })
        .filter((row) => row.some((c) => c.trim() !== ''));
}

/** แปลงค่าวันที่หลายรูปแบบ → YYYY-MM-DD */
function parseDate(value: string): string | null {
    const v = value.trim();
    if (!v) return null;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // DD/MM/YYYY หรือ D/M/YYYY (ปี ค.ศ. หรือ พ.ศ.)
    const dmyMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        const year = parseInt(y, 10) > 2500 ? parseInt(y, 10) - 543 : parseInt(y, 10);
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Excel serial number (days since 1899-12-30)
    const serial = parseFloat(v);
    if (!isNaN(serial) && serial > 30000 && serial < 60000) {
        const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
        const iso = d.toISOString().slice(0, 10);
        return iso;
    }

    return null;
}

/** แปลงค่าตัวเลขเงิน (รองรับ comma thousands separator) */
function parseAmount(value: string): number | null {
    const v = value.trim().replace(/,/g, '').replace(/\s/g, '');
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

type StatementRow = {
    franchise_code: string | null;
    awb_number: string | null;
    branch_code: string | null;
    charge_type: string | null;
    amount: number | null;
    transaction_date: string | null;
    remarks: string | null;
};

export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const contentType = req.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json(
                { error: 'ต้องส่งแบบ multipart/form-data' },
                { status: 400 },
            );
        }

        const formData = await req.formData();
        const file = formData.get('file');
        const statementPeriod = ((formData.get('statement_period') as string) ?? '').trim() || null;

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'ไม่พบไฟล์ในฟอร์ม (field: file)' }, { status: 400 });
        }

        const filename = file.name;
        const ext = filename.split('.').pop()?.toLowerCase() ?? '';

        if (!['csv', 'txt', 'xlsx', 'xls'].includes(ext)) {
            return NextResponse.json(
                {
                    error: 'รองรับไฟล์ CSV (.csv) และ Excel (.xlsx, .xls)',
                },
                { status: 415 },
            );
        }

        let rows: string[][];

        if (ext === 'xlsx' || ext === 'xls') {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
            rows = jsonRows.map((row) => row.map((cell) => String(cell)));
        } else {
            const rawText = await file.text();
            rows = parseCsvRows(rawText);
        }

        if (rows.length < 2) {
            return NextResponse.json({ error: 'ไฟล์ว่างหรือมีแค่ header — ไม่มีข้อมูลให้นำเข้า' }, { status: 400 });
        }

        const headers = rows[0].map((h) => h.trim());
        const headerMap = buildHeaderMap(headers);

        if (!headerMap.has(headers.find((h) => [...headerMap.keys()].includes(h)) ?? '')) {
            // ตรวจว่ามี awb_number และ amount อย่างน้อย
        }

        const awbColHeader = headers.find((h) => headerMap.get(h) === 'awb_number');
        const amountColHeader = headers.find((h) => headerMap.get(h) === 'amount');

        if (!awbColHeader || !amountColHeader) {
            const missing = [];
            if (!awbColHeader) missing.push('หมายเลข AWB');
            if (!amountColHeader) missing.push('จำนวนเงิน');
            return NextResponse.json(
                {
                    error: `ไม่พบคอลัมน์ที่จำเป็น: ${missing.join(', ')}`,
                    hint: `header ที่พบในไฟล์: ${headers.join(' | ')}`,
                },
                { status: 400 },
            );
        }

        // แปลงแต่ละแถว
        const dataRows = rows.slice(1);
        const parsed: StatementRow[] = [];
        const parseErrors: string[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const rowNum = i + 2; // 1-indexed + header
            const cols = dataRows[i];
            const get = (field: ColumnKey): string => {
                const hdr = headers.find((h) => headerMap.get(h) === field);
                if (!hdr) return '';
                const idx = headers.indexOf(hdr);
                return (cols[idx] ?? '').trim();
            };

            const awb = get('awb_number').replace(/\s/g, '');
            const amountStr = get('amount');
            const dateStr = get('transaction_date');

            if (!awb && !amountStr) continue; // แถวว่าง

            const amount = parseAmount(amountStr);
            if (amount === null && amountStr) {
                parseErrors.push(`แถว ${rowNum}: จำนวนเงิน "${amountStr}" ไม่ใช่ตัวเลข — ข้ามแถวนี้`);
                continue;
            }

            const txDate = parseDate(dateStr);

            parsed.push({
                franchise_code: get('franchise_code') || null,
                awb_number: awb || null,
                branch_code: get('branch_code') || null,
                charge_type: get('charge_type') || null,
                amount: amount,
                transaction_date: txDate,
                remarks: get('remarks') || null,
            });
        }

        if (parsed.length === 0) {
            return NextResponse.json(
                {
                    error: 'ไม่มีแถวที่ parse ได้เลย — ตรวจสอบรูปแบบไฟล์',
                    parseErrors: parseErrors.slice(0, 20),
                },
                { status: 400 },
            );
        }

        // Batch insert (chunks of 500 rows)
        const BATCH = 500;
        let imported = 0;
        let skipped = 0;
        const insertErrors: string[] = [];

        for (let start = 0; start < parsed.length; start += BATCH) {
            const chunk = parsed.slice(start, start + BATCH).map((r) => ({
                ...r,
                statement_period: statementPeriod,
                source_filename: filename,
            }));

            const { error, count } = await supabaseAdmin
                .from('jt_partner_statement')
                .upsert(chunk, {
                    onConflict: 'awb_number,charge_type,amount,transaction_date,source_filename',
                    ignoreDuplicates: true,
                })
                .select('id');

            if (error) {
                console.error('[jt-partner-statement/import] upsert error', error);
                insertErrors.push(error.message);
            } else {
                imported += count ?? chunk.length;
                skipped += chunk.length - (count ?? chunk.length);
            }
        }

        return NextResponse.json({
            ok: true,
            filename,
            statement_period: statementPeriod,
            total_parsed: parsed.length,
            imported,
            skipped,
            parseErrors: parseErrors.slice(0, 50),
            insertErrors: insertErrors.slice(0, 10),
        });
    } catch (e) {
        console.error('[jt-partner-statement/import]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
