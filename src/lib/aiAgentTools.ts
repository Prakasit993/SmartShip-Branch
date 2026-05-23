/**
 * AI Agent — Tool Schema (Phase 1: Predefined API tools)
 *
 * Single source of truth for tool definitions exposed to the n8n AI Agent node.
 * The schemas are written in JSON Schema (draft-7) so they can be pasted directly
 * into n8n's "HTTP Request Tool" / "Tool" parameters block, and so that a future
 * Phase 2 (in-process Claude/OpenAI agent) can read them without conversion.
 *
 * IMPORTANT: keep this file in sync with the actual route handlers:
 *   - app/api/admin/jt-shipments/dashboard/route.ts     → get_dashboard_kpi
 *   - app/api/admin/jt-shipments/cod-summary/route.ts   → get_cod_summary
 *
 * Auth: n8n calls these endpoints with header
 *   Authorization: Bearer ${N8N_AI_TOOLS_SECRET}
 * (see src/lib/adminApiAuth.ts → verifyN8nAiToolsSecret)
 */

export type AiToolHttpMethod = 'GET' | 'POST';

export interface AiAgentToolDefinition {
    /** Stable tool identifier the agent uses in `tool_calls`. snake_case. */
    name: string;
    /** กลุ่มขนส่ง — แยก registry jt / tiktok (ไม่ระบุ = 'jt'). ดู docs/ai-agent-mcp-plan.md */
    group?: 'jt' | 'tiktok';
    /** Human-readable purpose — surfaced to the LLM. Keep it tight. */
    description: string;
    /** Internal endpoint the tool wraps (path-only, host comes from n8n env). */
    endpoint: {
        method: AiToolHttpMethod;
        path: string;
    };
    /**
     * JSON Schema (draft-7) for the tool input. Use this verbatim in the n8n
     * Tool node's "Parameters" → "JSON" mode.
     */
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties: false;
    };
    /** Free-form notes for n8n setup (when this tool should be called, defaults, etc.). */
    usageNotes: string;
}

/** Shared YYYY-MM-DD param shape — booking_date filter for both KPIs and COD. */
const DATE_RANGE_PROPS = {
    date_from: {
        type: 'string',
        format: 'date',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'จุดเริ่มต้นช่วงวันที่ (YYYY-MM-DD, อ้างอิงคอลัมน์ booking_date). ละไว้ = ไม่กรองวันเริ่ม',
    },
    date_to: {
        type: 'string',
        format: 'date',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'จุดสิ้นสุดช่วงวันที่ (YYYY-MM-DD, inclusive). ละไว้ = ไม่กรองวันสิ้นสุด',
    },
} as const;

export const AI_AGENT_TOOLS: readonly AiAgentToolDefinition[] = [
    {
        name: 'get_dashboard_kpi',
        description:
            'สรุป KPI ของ J&T dashboard ในช่วงวันที่ที่ระบุ — จำนวนพัสดุ, ยอด COD รวม, ค่าส่งเฉลี่ย, ' +
            'พัสดุตีกลับ, ส่งโดย JMS, ค่าส่งสุทธิรวม, ปัญหาที่พบบ่อย, เคส COD ค้างชำระสูงสุด, ' +
            'และ delta เทียบช่วงก่อนหน้า. ใช้เมื่อผู้ใช้ถาม "ภาพรวม" / "สรุปวันนี้" / "เทียบเดือนที่แล้ว".',
        endpoint: { method: 'GET', path: '/api/admin/jt-shipments/dashboard' },
        parameters: {
            type: 'object',
            properties: { ...DATE_RANGE_PROPS },
            additionalProperties: false,
        },
        usageNotes:
            'ถ้าผู้ใช้พูด "วันนี้" → date_from = date_to = context.today. ' +
            '"เดือนนี้" → date_from = วันที่ 1 ของเดือน, date_to = context.today. ' +
            'ถ้าไม่ระบุช่วง อย่าเรียกแบบ no-args โดยพร่ำเพรื่อ — ถามผู้ใช้ก่อน เพราะจะ aggregate ทั้งตาราง.',
    },
    {
        name: 'get_cod_summary',
        description:
            'สรุปข้อมูล COD แบบเบา ๆ — ยอด COD รวม, จำนวน/ยอดที่ชำระแล้ว, จำนวน/ยอดที่ค้างชำระ, ' +
            'จำนวนพัสดุที่ไม่เก็บ COD, และอัตราการชำระ (%). เร็วกว่า get_dashboard_kpi มาก. ' +
            'ใช้เมื่อผู้ใช้ถามเฉพาะเรื่อง COD เช่น "ยอดเก็บเงินปลายทางเดือนนี้" / "COD ค้างเท่าไหร่".',
        endpoint: { method: 'GET', path: '/api/admin/jt-shipments/cod-summary' },
        parameters: {
            type: 'object',
            properties: { ...DATE_RANGE_PROPS },
            additionalProperties: false,
        },
        usageNotes:
            'เลือกใช้ tool นี้แทน get_dashboard_kpi เมื่อต้องการเฉพาะตัวเลข COD — ลด payload ' +
            '~10x และคืนผลเร็วกว่า (RPC ตัวเดียว ไม่มี exception/return aggregation).',
    },
    {
        name: 'get_top_not_closed_cases',
        description:
            'รายการพัสดุที่ "ยังไม่ปิดงาน" ในช่วงวันที่ที่ระบุ — รวมทุกประเภท (COD pending, ' +
            'พัสดุ non-COD ที่ยังไม่ส่งมอบ, exception, ตีกลับ ฯลฯ). คืน AWB + receiver + ' +
            'shipping_fee + cod_amount + latest_scan_type + issue_status เพื่อให้ admin ' +
            'ไล่ดูเคสได้ครบไม่ใช่แค่ COD pending list ของ get_dashboard_kpi. ' +
            'ใช้เมื่อผู้ใช้ถาม "พัสดุชิ้นไหนยังไม่ปิดงาน" / "AWB ที่ค้าง" / "เลขพัสดุที่ยังไม่ส่งสำเร็จ".',
        endpoint: { method: 'GET', path: '/api/admin/jt-shipments/top-not-closed' },
        parameters: {
            type: 'object',
            properties: {
                ...DATE_RANGE_PROPS,
                limit: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 500,
                    description: 'จำนวน case คืนสูงสุด (default 100, max 500)',
                },
            },
            additionalProperties: false,
        },
        usageNotes:
            'ขอบเขต "ยังไม่ปิดงาน" คือ signer_name IS NULL หรือเป็น empty/"NULL" — เหมือนกับ ' +
            'ที่ jt_dashboard_fixed_totals.closed_count นับ (closed = inverse). ' +
            'Response มี field `truncated` — ถ้า true แปลว่าอาจมี row เกิน limit ' +
            'ให้ AI บอกผู้ใช้ว่า "แสดง 100 ตัวแรก จากทั้งหมดอาจมีมากกว่านี้".',
    },
    {
        name: 'get_not_closed_overdue_cases',
        description:
            'รายการพัสดุที่ "ยังไม่ปิดงาน" และ "ค้างสถานะเกิน N วัน" — ใช้สำหรับเคส aging/' +
            'เร่งด่วนที่ admin ต้องไล่ปิด (เลข AWB + ผู้รับ + scan ล่าสุด + age_days). ' +
            'เลือกฐานเวลาได้ 2 แบบ: booking_date (นับจากวันคีย์) หรือ latest_scan_time ' +
            '(นับจาก scan ล่าสุด — null/empty = ไม่มี scan = ค้างสูงสุด). ' +
            'ใช้เมื่อผู้ใช้พูดถึง "ค้างเกิน N วัน" / "ยังไม่ปิดงานเกิน 7 วัน" / ' +
            '"พัสดุ aging" / "เคสเร่งด่วนย้อนหลัง". ' +
            'ห้ามเรียก tool นี้ถ้าผู้ใช้ไม่ระบุเงื่อนไขเวลา — ใช้ get_top_not_closed_cases แทน.',
        endpoint: { method: 'GET', path: '/api/admin/jt-shipments/not-closed-overdue' },
        parameters: {
            type: 'object',
            properties: {
                ...DATE_RANGE_PROPS,
                min_age_days: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 365,
                    description: 'จำนวนวัน aging ขั้นต่ำ (default 7, max 365)',
                },
                age_field: {
                    type: 'string',
                    enum: ['booking_date', 'latest_scan_time'],
                    description:
                        'ฐานเวลานับ aging — booking_date (default, ตรงกับความเข้าใจ user "คีย์ไปนานแล้วไม่ปิดงาน") ' +
                        'หรือ latest_scan_time ("ไม่มีความเคลื่อนไหวหลายวัน")',
                },
                limit: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 500,
                    description: 'จำนวน case คืนสูงสุด (default 100, max 500)',
                },
            },
            additionalProperties: false,
        },
        usageNotes:
            'เลือก age_field ตาม intent: ' +
            '- "ค้างเกิน X วัน" / "คีย์ไปแล้วยังไม่ปิด" → age_field = booking_date (default). ' +
            '- "ไม่มี scan หลายวัน" / "เงียบ ไม่ขยับ" → age_field = latest_scan_time. ' +
            '\n\n*** สำคัญเรื่อง date_from/date_to ***: ' +
            'ปกติ **อย่าส่ง date_from/date_to** — endpoint คำนวณ cutoff_date จาก today อยู่แล้ว. ' +
            'ส่งเฉพาะกรณี user ระบุชัดว่าต้องการช่วง booking_date เก่า เช่น ' +
            '"ค้างใน มี.ค." → date_from=2026-03-01, date_to=2026-03-31. ' +
            'ถ้าค่าไม่เก่ากว่า cutoff_date (today - min_age_days) จะถูก ignore อัตโนมัติ ' +
            'และมี warnings[] ใน response. ' +
            '\n\nResponse แต่ละ case มี age_days บอกอายุของเคส (สำหรับ latest_scan_time, ' +
            'null = ไม่มี scan เลย). cutoff_date = วันที่ตัด aging (today - min_age_days). ' +
            'ถ้า truncated = true ให้บอกผู้ใช้ว่า "แสดง N ตัวแรก".',
    },
    {
        name: 'query_sql',
        description:
            'รัน SELECT query บน jt_shipments / shipping_cost_master เมื่อ predefined ' +
            'tools ตอบไม่ได้ (เช่น filter เจาะ sender/staff/branch, custom aggregate, ' +
            'join cost master). อย่าเรียก tool นี้ถ้า predefined tools (get_dashboard_kpi, ' +
            'get_cod_summary, get_top_not_closed_cases, get_not_closed_overdue_cases) ตอบได้ ' +
            '— predefined เร็วกว่าและ safer.\n\n' +
            'ข้อจำกัด:\n' +
            '- SELECT only (INSERT/UPDATE/DELETE/DDL ถูก reject)\n' +
            '- Tables: jt_shipments, shipping_cost_master เท่านั้น (cross-DB, non-public schema ถูก block)\n' +
            '- Auto inject LIMIT 1000 ถ้าไม่ระบุ (max 1000)\n' +
            '- Statement timeout 5 วินาที\n' +
            '- ต้องใส่ WHERE booking_date เสมอ เพื่อ performance (ตารางมี ~30k+ rows)\n\n' +
            'Schema (jt_shipments — main table):\n' +
            '- awb_number text (PK)\n' +
            '- booking_date text "YYYY-MM-DD HH:MM:SS" — string compare ใช้ได้ (เช่น >= \'2026-05-01\')\n' +
            '- sender_name, sender_phone text\n' +
            '- receiver_name, receiver_phone, receiver_address text\n' +
            '- dest_subdistrict, dest_district, dest_province text\n' +
            '- shipping_fee text — cast ::numeric ก่อนคำนวณ (เช่น sum(shipping_fee::numeric))\n' +
            '- total_shipping_fee text — ค่าส่งสุทธิ (cast ::numeric)\n' +
            '- cod_amount text — cast ::numeric\n' +
            '- cod_status text — "ชำระแล้ว" / "ยังไม่ชำระ" / null\n' +
            '- cod_payment_method, cod_payment_time text\n' +
            '- signer_name text — null/empty/"NULL" = ยังไม่ปิดงาน\n' +
            '- latest_scan_type text\n' +
            '- exception_reason, issue_status text\n' +
            '- return_type, return_branch_name text\n' +
            '- shop_name, platform, order_source text\n' +
            '- delivery_staff_id text\n' +
            '- sign_branch_name, sign_branch_code text\n\n' +
            'Schema (shipping_cost_master):\n' +
            '- ใช้สำหรับ lookup ราคาต้นทุน (join ตาม weight/zone)\n' +
            '- ตรวจ column ด้วย SELECT column_name FROM information_schema.columns WHERE table_name = \'shipping_cost_master\' ถ้าจำเป็น\n\n' +
            'ตัวอย่าง query:\n' +
            'SELECT sender_name, count(*) AS parcels, sum(shipping_fee::numeric) AS fee\n' +
            'FROM jt_shipments\n' +
            'WHERE booking_date >= \'2026-05-01\' AND booking_date < \'2026-05-16\'\n' +
            'GROUP BY sender_name\n' +
            'ORDER BY fee DESC NULLS LAST\n' +
            'LIMIT 10',
        endpoint: { method: 'POST', path: '/api/admin/ai-tools/sql' },
        parameters: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description:
                        'SELECT query — whitelist tables (jt_shipments, shipping_cost_master), ' +
                        'auto LIMIT 1000, statement_timeout 5s, ต้องมี WHERE booking_date เพื่อ perf',
                },
            },
            required: ['sql'],
            additionalProperties: false,
        },
        usageNotes:
            'AI ควรตรวจ response.truncated → ถ้า true บอกผู้ใช้ว่า "แสดง 1000 row แรก ' +
            'อาจมีมากกว่านี้" + แนะนำให้ refine WHERE. หาก error 400 (validation) ' +
            'AI สามารถ retry ด้วย SQL ที่แก้ตาม error message ได้ (เช่น add WHERE, ' +
            'remove blocked function). หาก error 504 (timeout) ให้ระบุ booking_date ที่แคบลง.',
    },

    // ── TikTok Shop tools (กลุ่มแยกจาก JT — คนละตาราง tiktok_shipments, ไม่รวมข้อมูล) ──
    // ⚠️ ต้องสลับ endpoint เป็น requireAiToolAuth (P1.1) ก่อน bearer/MCP ถึงเรียกได้
    {
        name: 'get_tiktok_stats',
        group: 'tiktok',
        description:
            'สรุปตัวเลขรวมของ TikTok Shop — จำนวนพัสดุทั้งหมด และจำนวนที่ปิดงานแล้ว (มีผู้เซ็นรับ). ' +
            'ใช้เมื่อผู้ใช้ถามภาพรวม TikTok เช่น "พัสดุ TikTok ทั้งหมดกี่ชิ้น" / "ปิดงานไปเท่าไหร่".',
        endpoint: { method: 'GET', path: '/api/admin/tiktok-shipments/stats' },
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        usageNotes:
            'TikTok ไม่มี date filter — คืนภาพรวมทั้งตาราง. ไม่มีข้อมูลต้นทุน/COD (ตรวจสอบเท่านั้น).',
    },
    {
        name: 'get_tiktok_stagnant_parcels',
        group: 'tiktok',
        description:
            'รายการพัสดุ TikTok ที่ตกค้างไม่เคลื่อนไหว — ไม่มี scan ≥ 2 วัน และยังไม่ปิดงาน. ' +
            'คืน AWB + ผู้ส่ง + เบอร์ + scan ล่าสุด. ใช้เมื่อถาม "TikTok ตกค้าง/ไม่ขยับ".',
        endpoint: { method: 'GET', path: '/api/admin/tiktok-shipments/stagnant-parcels' },
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        usageNotes: 'ตัดรายการที่แอดมินรับทราบ/ซ่อนแล้ว. คืนสูงสุด ~200 รายการ.',
    },
    {
        name: 'get_tiktok_issue_summary',
        group: 'tiktok',
        description:
            'สรุปปัญหา TikTok — จำนวนพัสดุมีปัญหา (ยังไม่มีรหัสสาขาปลายทาง + มี exception_reason) ' +
            'และพัสดุถูกตีกลับ (return_type มีค่า) พร้อมรายการตัวอย่าง. ' +
            'ใช้เมื่อถาม "TikTok มีปัญหา/ตีกลับเท่าไหร่".',
        endpoint: { method: 'GET', path: '/api/admin/tiktok-shipments/issues' },
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        usageNotes:
            '⚠️ ปัจจุบัน endpoint สแกนทั้งตาราง (ช้า) — ควรทำ RPC tiktok_issue_summary ก่อนเปิดเป็น tool จริง.',
    },
    {
        name: 'query_tiktok_sql',
        group: 'tiktok',
        description:
            'รัน SELECT บน tiktok_shipments เท่านั้น (แยกจาก query_sql ของ JT — ห้าม join/ถาม jt_shipments) ' +
            'เมื่อ predefined tools ตอบไม่ได้. SELECT-only, auto LIMIT 1000, statement timeout 5s, ควรมี WHERE. ' +
            'tiktok_shipments มีคอลัมน์เดียวกับ jt_shipments (awb_number PK, booking_date, sender_name, ' +
            'receiver_name/phone, signer_name, return_type, exception_reason, sign_branch_code, ' +
            'latest_scan_time ฯลฯ) แต่ไม่มีข้อมูลต้นทุน.',
        endpoint: { method: 'POST', path: '/api/admin/ai-tools/tiktok-sql' },
        parameters: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'SELECT query บน tiktok_shipments เท่านั้น' },
            },
            required: ['sql'],
            additionalProperties: false,
        },
        usageNotes: 'endpoint + readonly GRANT ต้องสร้างก่อน (P1.3) — ดู docs/ai-agent-mcp-plan.md',
    },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lookup by tool name. Returns undefined if not found. */
export function findAiAgentTool(name: string): AiAgentToolDefinition | undefined {
    return AI_AGENT_TOOLS.find((t) => t.name === name);
}

/** Tools เฉพาะกลุ่มขนส่ง ('jt' เป็น default เมื่อ tool ไม่ได้ระบุ group) — ใช้แยก registry jt / tiktok */
export function aiAgentToolsByGroup(group: 'jt' | 'tiktok'): AiAgentToolDefinition[] {
    return AI_AGENT_TOOLS.filter((t) => (t.group ?? 'jt') === group);
}

/**
 * Anthropic Messages API tool-use spec — for Phase 2 (in-process agent).
 * Drop-in shape: `tools: aiAgentToolsAsAnthropicTools()` on a Messages.create call.
 */
export function aiAgentToolsAsAnthropicTools(): Array<{
    name: string;
    description: string;
    input_schema: AiAgentToolDefinition['parameters'];
}> {
    return AI_AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
    }));
}

/**
 * OpenAI function-calling spec — kept for parity with Anthropic helper.
 * Not used in Phase 1 (n8n) but useful if Phase 2 lands on OpenAI.
 */
export function aiAgentToolsAsOpenAITools(): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: AiAgentToolDefinition['parameters'] };
}> {
    return AI_AGENT_TOOLS.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
}
