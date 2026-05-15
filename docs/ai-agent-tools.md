# AI Agent — Tool Schema & n8n Integration

แนวทาง Phase 1 ของ AI Chat บน admin dashboard: **n8n AI Agent node** เรียก HTTP tools
ที่ Next.js expose ไว้ (read-only). Phase 2 จะเพิ่ม read-only SQL tool (สำหรับคำถามที่
predefined tools ตอบไม่ได้) — ดูหัวข้อท้ายเอกสาร

---

## สถาปัตยกรรม (Phase 1)

```
[AdminAiChatDock]
  ↓ POST /api/admin/ai-chat  (admin/staff session)
[Next.js proxy]
  ↓ POST $N8N_AI_WEBHOOK_URL  (forward message + history + context)
[n8n AI Agent]
  ↓ tool_call: get_dashboard_kpi / get_cod_summary
[HTTP Request Tool] → GET https://<deploy>/api/admin/jt-shipments/...
                       Authorization: Bearer $N8N_AI_TOOLS_SECRET
[Next.js endpoint] → JSON
  ↑ tool_result
[n8n AI Agent] → final text answer
  ↑
[Next.js proxy] → { answer: "..." }
  ↑
[AdminAiChatDock] render
```

ไม่ต้อง install LLM SDK ใน repo — agent loop รันใน n8n ทั้งหมด

---

## Env vars ที่ต้องตั้ง

### ฝั่ง Next.js (Vercel env vars / `.env.local`)

| Var | Purpose |
|---|---|
| `N8N_AI_WEBHOOK_URL` | URL ของ Webhook node ที่ trigger AI Agent workflow (เช่น `https://n8n.mybabymeal.com/webhook/ai_chat_bot`) |
| `N8N_AI_TOOLS_SECRET` | Shared bearer — Next.js ใช้ verify request ที่ n8n ส่งมาเรียก tool endpoints |

### ฝั่ง n8n

**ไม่ใช้ `$env.X` ใน HTTP Request Tool** เพราะ self-hosted n8n บล็อกการเข้าถึง env vars ในนิพจน์
โดย default (error: `access to env vars denied`). ใช้แทนด้วย:

| ที่เก็บ | เก็บอะไร |
|---|---|
| **Credential** (Header Auth) ชื่อ `SmartShip AI Tools Bearer` | `Bearer <secret>` — ค่าเดียวกันกับ `N8N_AI_TOOLS_SECRET` ฝั่ง Next.js |
| **Hard-coded ใน HTTP Request Tool URL** | `https://box.mybabymeal.com/api/admin/jt-shipments/...` (URL ไม่ใช่ secret) |

> ทางเลือก: ถ้าควบคุม n8n host ได้และอยากใช้ `$env` ต่อ — ตั้ง `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
> ใน n8n docker/env config แล้ว restart container แต่จะลด isolation ระหว่าง workflow

> Secret rotation: เปลี่ยน secret พร้อมกัน 2 ฝั่ง — ไม่มี grace period เพราะเป็น single-tenant tool credential

> Tip generate secret: ใน PowerShell —
> `[Convert]::ToBase64String((1..32 | %{[byte](Get-Random -Max 256)}))`

---

## Tools (source of truth: `src/lib/aiAgentTools.ts`)

### 1. `get_dashboard_kpi`

```
GET /api/admin/jt-shipments/dashboard?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

**Purpose**: KPI ครบทุกอย่างของช่วงวันที่ + delta เทียบช่วงก่อนหน้า + Top cases

**Response fields ที่ AI ควรใช้**:
- `count` / `closedCount` — จำนวนพัสดุทั้งหมด / ปิดงานแล้ว
- `sumCod` — ยอด COD รวม
- `codPaidCount` / `codPaidAmount` / `codPendingCount` / `codPendingAmount` / `codNoCollectionCount` — breakdown
- `codCollectionRate` — % ชำระ COD
- `avgShippingFee` / `sumTotalShippingFee` / `sumTotalFeeJms`
- `returnCount` — พัสดุตีกลับ
- `exceptionCount` / `topExceptionReasons[]` / `topExceptionCases[]`
- `topCodPendingCases[]` — เคส COD ค้าง top 20 พร้อม awb_number / receiver
- `topReturnTypeCases[]` — เคสตีกลับ top 10
- `previous` — เทียบช่วงก่อนหน้า (เฉพาะเมื่อตั้ง date ครบทั้งคู่)

**เมื่อไหร่ควรเรียก**: ผู้ใช้ถามภาพรวม / สรุป / "เป็นยังไงบ้าง" / ขอเทียบเดือนที่แล้ว

### 2. `get_cod_summary`

```
GET /api/admin/jt-shipments/cod-summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

**Purpose**: เฉพาะตัวเลข COD — เร็วกว่า dashboard ~10x (RPC ตัวเดียว)

**Response**: `sumCod`, `paidCount`, `paidAmount`, `pendingCount`, `pendingAmount`,
`noCollectionCount`, `paymentRate`

**เมื่อไหร่ควรเรียก**: ผู้ใช้ถามแค่ COD — ไม่ต้องการ exception/return data

---

## ตั้งค่า n8n AI Agent node

### Tool config (ใส่ใน "Tools" ของ AI Agent node)

> **⚠️ n8n บล็อก `{{ $env.X }}` ในนิพจน์โดย default** — ถ้าใช้ `$env` จะเห็น error
> `access to env vars denied` ที่ทั้ง URL และ Header value
>
> แก้โดยใช้ **Credentials + hard-coded URL** (แนะนำ) แทนการอ่าน env ใน expression

### ขั้นที่ 1: สร้าง Credential สำหรับ bearer

n8n → **Credentials** → **Create credential** → **Header Auth**
- Name: `SmartShip AI Tools Bearer`
- Header Name: `Authorization`
- Header Value: `Bearer <paste secret ตรงๆ — ห้ามใช้ expression>`

Credential ถูก encrypt ใน n8n DB และไม่โผล่ใน workflow export — ปลอดภัยกว่า `$env`

### ขั้นที่ 2: เพิ่ม HTTP Request Tool 2 ตัว

ใช้ **HTTP Request Tool**:

**Tool 1: get_dashboard_kpi**
- Name: `get_dashboard_kpi`
- Description: คัดจาก `description` ใน `aiAgentTools.ts`
- Method: `GET`
- URL: `https://box.mybabymeal.com/api/admin/jt-shipments/dashboard` (hard-code — URL ไม่ใช่ secret)
- Authentication: **Generic Credential Type** → **Header Auth** → เลือก `SmartShip AI Tools Bearer`
- Send Query Parameters: **on** → "Using JSON":
  ```json
  {
    "type": "object",
    "properties": {
      "date_from": {
        "type": "string",
        "format": "date",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "จุดเริ่มต้นช่วงวันที่ (YYYY-MM-DD, booking_date)"
      },
      "date_to": {
        "type": "string",
        "format": "date",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "จุดสิ้นสุดช่วงวันที่ (YYYY-MM-DD, inclusive)"
      }
    },
    "additionalProperties": false
  }
  ```
- Send Headers: **off** (Credential ใส่ Authorization ให้แล้ว — ใส่ซ้ำจะชน)

**Tool 2: get_cod_summary** — เหมือนตัวที่ 1 แค่:
- URL: `https://box.mybabymeal.com/api/admin/jt-shipments/cod-summary`
- Description: ใช้ของ `get_cod_summary` ใน `aiAgentTools.ts`

### User Prompt template (Prompt source = "Define below")

**สำคัญ**: ค่าจาก `context` ไม่ได้ inject เข้า system message โดยอัตโนมัติ ต้องใส่ลง user prompt
ไม่งั้น LLM จะอ่าน system prompt เห็นว่า "ใช้ context.today" แต่ค่าจริงไม่เคยส่งมาถึง → AI เดา/ถามกลับ

```
Context จากหน้าที่ผู้ใช้กำลังดูอยู่:
- วันนี้ (Asia/Bangkok): {{ $json.body.context.today }}
- หน้า: {{ $json.body.context.page }}
- Focus: {{ $json.body.context.focus }}
- Pathname: {{ $json.body.context.pathname }}

คำถามของผู้ใช้:
{{ $json.body.message }}
```

### System Prompt ที่แนะนำ

```
คุณคือผู้ช่วยวิเคราะห์ข้อมูลของ SmartShip admin dashboard
ตอบเป็นภาษาไทย กระชับ ไม่ต้องอธิบายขั้นตอนภายในการเรียกเครื่องมือ

ข้อมูลบริบทที่จะส่งมาในทุก request:
- context.today: วันที่วันนี้ (YYYY-MM-DD, Asia/Bangkok) — ใช้นี้เป็นวันนี้เสมอ อย่าใช้นาฬิกาภายในของคุณ
- context.page: หน้าที่ผู้ใช้กำลังดูอยู่
- context.pathname: URL path

เครื่องมือที่ใช้ได้:
1. get_dashboard_kpi — KPI ครบทุกตัว + Top cases + เทียบช่วงก่อนหน้า
2. get_cod_summary  — เฉพาะตัวเลข COD (เร็วกว่ามาก)

สำหรับการทักทาย / small talk (เช่น "สวัสดี", "หวัดดี", "hi"):
ตอบสั้น 1 ประโยค + ถามว่าต้องการสรุปอะไร — อย่าแจกแจง option ก่อนผู้ใช้ขอ

แนวทางการตีความคำขอ:
- "วันนี้" → date_from = date_to = context.today
- "เมื่อวาน" → date_from = date_to = (context.today - 1 day)
- "เดือนนี้" → date_from = วันที่ 1 ของเดือน context.today, date_to = context.today
- "เดือนที่แล้ว" → ทั้งเดือนก่อน
- ถ้าผู้ใช้ไม่ระบุช่วง — ถามก่อน อย่าเรียก tool โดยไม่ใส่ date

แนวทางเลือก tool:
- ถามแค่เรื่อง COD → ใช้ get_cod_summary
- ถามภาพรวม / "เป็นยังไงบ้าง" / ขอเทียบ → ใช้ get_dashboard_kpi

ตอบสรุปด้วยตัวเลขจริงที่ได้จาก tool เท่านั้น ห้ามคาดเดา
ถ้าจะแนะนำ insight ให้ระบุชัดเจนว่าเป็นข้อเสนอแนะ
```

---

## ทดสอบด้วย curl (ก่อน wire ใน n8n)

```bash
# ตั้ง secret ใน .env.local ก่อน รีสตาร์ท dev server
# N8N_AI_TOOLS_SECRET=test-secret-please-rotate

curl -H "Authorization: Bearer test-secret-please-rotate" \
  "http://localhost:3000/api/admin/jt-shipments/cod-summary?date_from=2026-05-01&date_to=2026-05-14"

curl -H "Authorization: Bearer test-secret-please-rotate" \
  "http://localhost:3000/api/admin/jt-shipments/dashboard?date_from=2026-05-01&date_to=2026-05-14"
```

ถ้า secret ไม่ตรงหรือไม่ตั้ง → fallback ไปขอ admin/staff session (401 ถ้าไม่ login)

---

## Phase 2 — Read-only SQL tool (ยังไม่ทำ)

แผน:
- `POST /api/admin/ai-tools/sql` รับ `{ sql: "SELECT ..." }`
- Validator (server-side):
  - parse → SELECT only (block INSERT/UPDATE/DELETE/DDL/transaction control)
  - block dangerous functions (`pg_*`, `dblink_*`, file I/O)
  - whitelist tables: `jt_shipments`, `shipping_cost_master`, view `*_dashboard`
  - timeout 5s, max rows 1000
- ใช้ Supabase service_role connection แยกที่ตั้ง role read-only ที่ DB layer
- Same `N8N_AI_TOOLS_SECRET` auth

ไม่ใช้ก่อนกว่า Phase 1 จะ stable + จัด observability/audit log เรียบร้อย
