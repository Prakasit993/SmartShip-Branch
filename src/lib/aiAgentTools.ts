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
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lookup by tool name. Returns undefined if not found. */
export function findAiAgentTool(name: string): AiAgentToolDefinition | undefined {
    return AI_AGENT_TOOLS.find((t) => t.name === name);
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
