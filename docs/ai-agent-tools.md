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

### 3. `get_top_not_closed_cases`

```
GET /api/admin/jt-shipments/top-not-closed?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&limit=100
```

**Purpose**: Top N พัสดุที่ "ยังไม่ปิดงาน" — ครอบคลุมทุกประเภท (COD pending, non-COD ยัง
ไม่ส่งสำเร็จ, exception, ตีกลับ) ต่างจาก `topCodPendingCases[]` ของ `get_dashboard_kpi`
ที่ส่งคืนเฉพาะ COD pending

นิยาม "ปิดงาน": `signer_name IS NOT NULL AND trim(signer_name) NOT IN ('', 'NULL')`

**Response**:
- `total` — จำนวนเคสที่ filter ได้จาก over-fetch
- `limit` — limit ที่ใช้จริง
- `truncated` — `true` ถ้ามีโอกาสมีเคสเพิ่มเติมเกิน limit
- `cases[]` — array ของ NotClosedCase:
  ```
  awb_number, booking_date, receiver_name, receiver_phone,
  shipping_fee, cod_amount, cod_status,
  latest_scan_type, issue_status
  ```

**เมื่อไหร่ควรเรียก**: ผู้ใช้ขอ **รายการ AWB** ของพัสดุที่ยังไม่ปิดงาน เช่น
"พัสดุชิ้นไหนยังไม่ส่งบ้าง" / "AWB ที่ค้างเดือนนี้"

> ปกติ AI ไม่ควรเรียก tool นี้ถ้าผู้ใช้แค่ถาม "จำนวน" — ใช้ `count - closedCount`
> จาก `get_dashboard_kpi` แทน (เบากว่า)

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
- Send Query Parameters: **on** → **`Using Fields Below`** (สำคัญ! อย่าใช้ "Using JSON"
  เพราะ mode นั้นแค่ describe schema ไม่ได้ bind ค่าจาก AI เข้า URL query — ผลคือ
  tool ถูกเรียกโดยไม่มี date params → endpoint คืน aggregate ทั้งตาราง)
  - Add Parameter:
    - Name: `date_from`
    - Value: `={{ $fromAI('date_from', 'YYYY-MM-DD วันที่เริ่มต้นช่วง booking_date', 'string') }}`
  - Add Parameter:
    - Name: `date_to`
    - Value: `={{ $fromAI('date_to', 'YYYY-MM-DD วันที่สิ้นสุดช่วง inclusive', 'string') }}`
- Send Headers: **off** (Credential ใส่ Authorization ให้แล้ว — ใส่ซ้ำจะชน)

**Tool 2: get_cod_summary** — เหมือนตัวที่ 1 แค่:
- URL: `https://box.mybabymeal.com/api/admin/jt-shipments/cod-summary`
- Description: ใช้ของ `get_cod_summary` ใน `aiAgentTools.ts`

**Tool 3: get_top_not_closed_cases** — เหมือนตัวที่ 1 แค่:
- URL: `https://box.mybabymeal.com/api/admin/jt-shipments/top-not-closed`
- Description: ใช้ของ `get_top_not_closed_cases` ใน `aiAgentTools.ts`
- เพิ่ม **Add Parameter** ตัวที่ 3:
  - Name: `limit`
  - Value: `={{ $fromAI('limit', 'จำนวน case สูงสุด (default 100, max 500)', 'number') }}`
  - หรือไม่ใส่ก็ได้ (จะใช้ default 100)

### ⚠️ Pitfall: "Using JSON" ไม่ bind AI args

ถ้าเห็น banner ใน Tool node ว่า
> "No parameters are set up to be filled by AI. Click on the ✨ button next to
> a parameter to allow AI to set its value."

แปลว่า AI generate args ออกมาแล้ว (อยู่ใน tool_call payload) แต่ n8n ไม่เอาไปใส่ URL —
ทำให้ HTTP request ออกไปแบบไม่มี query string → endpoint คืน aggregate ทั้งตาราง
แทนที่จะเป็นช่วงวันที่ที่ระบุ → user เห็นตัวเลขใหญ่ผิดวัน

วิธีแก้: เปลี่ยน "Specify Query Parameters" จาก `Using JSON` → `Using Fields Below`
แล้วใส่ `$fromAI(...)` expression ในแต่ละ field

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
ตอบเป็นภาษาไทย กระชับ ใช้ตัวเลขจากเครื่องมือเท่านั้น

บริบทในทุกคำถาม:
- context.today: วันที่วันนี้ Asia/Bangkok (YYYY-MM-DD) — ใช้เป็น "วันนี้" เสมอ
- context.page / context.pathname: หน้าที่ผู้ใช้ดูอยู่

เครื่องมือที่ใช้ได้ (เลือกตัวที่ specific สุดก่อน):

Predefined endpoints:
- get_cod_summary: ตัวเลข COD ของช่วงวันที่ (sumCod, paidCount/Amount, pendingCount/Amount, paymentRate) — เร็วที่สุด ใช้เมื่อคำถามเฉพาะ COD
- get_dashboard_kpi: KPI ครบ + Top cases + delta เทียบช่วงก่อน — ใช้เมื่อถามภาพรวม กำไร เทียบ จำนวนพัสดุ ค่าส่ง returnCount exceptionCount JMS
- get_top_not_closed_cases: รายการ AWB ของพัสดุที่ยังไม่ปิดงาน (ทั่วไป ไม่จำกัด COD) — ใช้เมื่อผู้ใช้ขอ "เลข AWB ที่ค้าง" / "พัสดุชิ้นไหนยังไม่ส่ง"

หลักการเลือก tool:
1. เฉพาะ COD → get_cod_summary
2. ภาพรวม / กำไร / เทียบช่วง / จำนวนรวม → get_dashboard_kpi
3. ขอรายการ AWB ของพัสดุที่ยังไม่ปิดงาน → get_top_not_closed_cases
4. ขอรายการ AWB ของประเภทอื่น (เฉพาะ sender X, ค่าส่ง > N, staff X) → Phase 1 ไม่รองรับ แจ้งผู้ใช้

การ resolve ช่วงเวลา (อ้างอิง context.today):
- "วันนี้" = date_from = date_to = context.today
- "เมื่อวาน" = วันก่อน context.today 1 วัน
- "เดือนนี้" = วันที่ 1 ของเดือน context.today ถึง context.today
- "เดือนที่แล้ว" = ทั้งเดือนก่อน
- ถ้าไม่ระบุช่วงเลย — ถามผู้ใช้สั้น ๆ

หลักการตอบ:
- ตอบเฉพาะตัวเลขที่ผู้ใช้ถาม ไม่ลิสต์ KPI อื่นเพิ่มเอง
- ถ้าคำถามขอ "จำนวน" พัสดุยังไม่ปิดงาน → ใช้ count - closedCount จาก get_dashboard_kpi
  (อย่าเรียก get_top_not_closed_cases ถ้าผู้ใช้ไม่ได้ขอ AWB)
- รายงาน "กำไร" ระบุว่ารวมเฉพาะส่วน JMS ยังไม่หักต้นทุนอื่น
- ถ้า response มี truncated=true → บอกผู้ใช้ว่า "แสดง N ตัวแรก อาจมีมากกว่านี้"
- bullet list สั้น 5-8 จุด
- ข้อเสนอแนะ ระบุชัดว่าเป็น "ข้อเสนอแนะ"

การทักทาย / small talk: ตอบสั้น 1 ประโยค + ชวนถามเรื่องข้อมูล

ห้ามตอบ "ขอตรวจสอบสักครู่" — เรียก tool และตอบในข้อความเดียว
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

---

## Conversation logging (F2 — เพิ่มหลัง Phase 1)

แต่ละ turn ของแชท (user msg + AI reply) ถูกเก็บลงตาราง
`admin_ai_chat_logs` (Supabase) — migration:
[database/db/migrations/20260515_admin_ai_chat_logs.sql](database/db/migrations/20260515_admin_ai_chat_logs.sql)

Admin UI: `/admin/ai-chat-logs` (admin-only)

### Capturing tool calls จาก n8n

Phase 1 endpoint รู้แค่คำตอบสุดท้ายของ AI — ไม่รู้ว่า AI Agent เรียก tool ไหน
ด้วย args อะไร. ถ้าอยากเก็บข้อมูลนี้ลง log ให้แก้ n8n workflow:

#### ขั้นที่ 1: ดึง tool calls จาก AI Agent execution

หลัง AI Agent node, เพิ่ม **Code** node ชื่อ `Extract Tools Called`

> **⚠️ ตั้ง Language เป็น `JavaScript`** (dropdown ตัวล่าง Mode) — บาง n8n install
> default เป็น Python จะ error `Python runner unavailable: Python 3 is missing`
> เพราะ host ไม่ได้ติดตั้ง Python interpreter

```javascript
// n8n Code node — ดึง tool calls ของ run ปัจจุบันจาก AI Agent node
// ใส่ก่อน "Respond to Webhook"
//
// ใช้ $input.all() (ข้อมูลไหลเข้าผ่าน pipe) ไม่ใช่ $('AI Agent')
// เพราะ reference แบบหลังบางเวอร์ชันของ n8n จะถูกตีความเป็น
// forward reference → trigger re-execute AI Agent → OpenAI โดน
// ยิงซ้ำ → timeout 300s
const items = $input.all();
const agentOutput = items[0]?.json ?? {};
const intermediates = agentOutput.intermediateSteps ?? [];

const toolsCalled = intermediates.map((step) => ({
  name: step.action?.tool ?? 'unknown',
  args: step.action?.toolInput ?? {},
  status: step.observation?.startsWith?.('Error') ? 'error' : 'success',
  result_preview:
    typeof step.observation === 'string'
      ? step.observation.slice(0, 500)
      : JSON.stringify(step.observation).slice(0, 500),
}));

return [{
  json: {
    output: agentOutput.output ?? '',
    tools_called: toolsCalled,
  },
}];
```

(field name `intermediateSteps` ขึ้นกับเวอร์ชัน n8n LangChain integration —
ถ้าเวอร์ชันไม่ตรงให้ inspect AI Agent output แล้วปรับ path)

#### ขั้นที่ 2: ปรับ Respond to Webhook ให้ส่ง tools_called กลับ

Body ของ Respond to Webhook (Respond With: JSON):

```json
{
  "answer": {{ JSON.stringify($json.output ?? '') }},
  "tools_called": {{ JSON.stringify($json.tools_called ?? []) }}
}
```

ใช้ `JSON.stringify(...)` แทนการครอบด้วย `"..."` เพราะ:
- n8n render expression ผ่าน `.toString()` ตามค่า default — array `[]` กลายเป็น
  empty string → JSON ผิด syntax (`"tools_called": ` ไม่มี value)
- `JSON.stringify` ใส่ quotes + escape ให้อัตโนมัติ ครอบคลุมทุก type
- `?? ''` / `?? []` กัน null/undefined ตอน upstream ส่งฟิลด์ไม่ครบ

#### Verify

หลัง deploy:
1. ส่งข้อความที่ trigger tool — เช่น "COD วันนี้"
2. ดูใน `/admin/ai-chat-logs` — แถวล่าสุดต้องมี chip "1 tool" ขึ้น
3. คลิก expand → ดู args ที่ AI ใส่ (เช่น `{ "date_from": "2026-05-15", "date_to": "2026-05-15" }`)

ถ้า `tools_called: null` หลังแก้ workflow แล้ว → n8n เวอร์ชันใส่ intermediate
steps ใน path อื่น ลอง `$json.steps` หรือ `$json.run` แทน

---

## Phase 2 — Read-only SQL tool

ให้ AI Agent generate `SELECT` query เองสำหรับคำถาม ad-hoc ที่ Phase 1 tools
ไม่ครอบคลุม (เช่น filter เจาะ sender / staff / branch / range ค่าส่ง /
custom aggregation / join ต้นทุน)

### Security layers

1. **Next.js validator** ([src/lib/sqlValidator.ts](src/lib/sqlValidator.ts))
   - parse ผ่าน `node-sql-parser` (Postgres dialect)
   - reject ถ้าไม่ใช่ SELECT, มี multiple statements, table นอก whitelist,
     blocked function (pg_read_file, dblink, pg_sleep, etc.)
   - auto inject `LIMIT 1000` ถ้า AI ไม่ระบุ
   - max input 8000 chars

2. **Postgres role + function** ([migration 20260515_ai_readonly_sql_tool.sql](database/db/migrations/20260515_ai_readonly_sql_tool.sql))
   - `smartship_ai_readonly` role: SELECT only on jt_shipments,
     shipping_cost_master (REVOKE INSERT/UPDATE/DELETE/TRUNCATE)
   - `run_ai_readonly_select(p_sql text)` SECURITY DEFINER function:
     - `SET LOCAL ROLE smartship_ai_readonly`
     - `SET LOCAL transaction_read_only = on`
     - `SET LOCAL statement_timeout = '5s'`
     - wraps user SQL in `SELECT json_agg(...) FROM (USER_SQL) t`
   - EXECUTE granted only to `service_role`; PUBLIC/anon/authenticated revoked

3. **HTTP layer** ([app/api/admin/ai-tools/sql/route.ts](app/api/admin/ai-tools/sql/route.ts))
   - Bearer auth (`requireAiToolAuth` — same as Phase 1 tools)
   - Rate limit: 10/min (stricter than dashboard endpoints)
   - Maps Postgres error 57014 → HTTP 504; 42501 → HTTP 403

### Setup checklist (deploy order)

1. **Run migration in Supabase SQL Editor**:
   ```
   database/db/migrations/20260515_ai_readonly_sql_tool.sql
   ```
   - Creates `smartship_ai_readonly` role with SELECT-only grants
   - Creates `run_ai_readonly_select(text)` RPC function
   - REVOKE PUBLIC; GRANT EXECUTE to service_role only

2. **Verify role exists**:
   ```sql
   SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'smartship_ai_readonly';
   -- Expected: smartship_ai_readonly | f (NOLOGIN)
   ```

3. **Verify function exists + perms**:
   ```sql
   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'run_ai_readonly_select';
   -- Expected: run_ai_readonly_select | t (SECURITY DEFINER)
   ```

4. **Smoke test via curl** (after Vercel deploys the new code):
   ```bash
   curl -X POST -H "Authorization: Bearer $secret" \
     -H "Content-Type: application/json" \
     -d '{"sql":"SELECT count(*) AS n FROM jt_shipments WHERE booking_date >= '\''2026-05-01'\''"}' \
     https://box.mybabymeal.com/api/admin/ai-tools/sql
   ```
   Expected: `{ "rows": [{ "n": ... }], "rowCount": 1, "truncated": false, "executedSql": "...LIMIT 1000", ... }`

5. **Test rejection** (should return 400):
   ```bash
   curl -X POST -H "Authorization: Bearer $secret" \
     -H "Content-Type: application/json" \
     -d '{"sql":"DROP TABLE jt_shipments"}' \
     https://box.mybabymeal.com/api/admin/ai-tools/sql
   ```
   Expected: `{ "error": "only SELECT is allowed (got: DROP)" }`

### n8n setup

Add HTTP Request Tool #4 in AI Agent:
- **Name**: `query_sql`
- **Description**: paste จาก `aiAgentTools.ts` ของ `query_sql` (มี inline schema เต็ม
  เพื่อให้ AI รู้ column types โดยไม่ต้องเรียก get_schema)
- **Method**: `POST`
- **URL**: `https://box.mybabymeal.com/api/admin/ai-tools/sql`
- **Authentication**: Generic Credential Type → Header Auth → `SmartShip AI Tools Bearer`
- **Send Body**: on, **Body Content Type**: JSON, **Specify Body**: Using JSON
  ```json
  {
    "sql": "={{ $fromAI('sql', 'SELECT query — see tool description for schema + rules', 'string') }}"
  }
  ```
- **Send Headers**: off (credential ใส่ Authorization ให้แล้ว)

### System prompt update

เพิ่ม `query_sql` ใน "เครื่องมือที่ใช้ได้" และ "หลักการเลือก tool" — ดู template
ใน "System Prompt ที่แนะนำ" ด้านบน (ปรับให้รวม query_sql ด้วย):

```
4. ต้องการ slice/filter ที่ predefined tools ไม่ครอบคลุม → query_sql
   ก่อนเรียก query_sql เสมอ:
   - ลองดูว่า predefined tools ตอบได้ไหม → ใช้ตัวนั้นก่อน (เร็ว+ปลอดภัย+ถูก audit)
   - ระบุ booking_date range ใน WHERE เสมอเพื่อ performance
   - shipping_fee, cod_amount เป็น text — cast ::numeric ก่อนคำนวณ
   - LIMIT default 50-100 (ระบบจะ cap 1000)
   - ถ้า response มี truncated=true → บอกผู้ใช้ + แนะนำ refine WHERE
```

### Audit

ทุก query ถูก log ใน `admin_ai_chat_logs.tools_called` (F2):
- `name`: "query_sql"
- `args`: `{ "sql": "..." }`
- `result_preview`: snippet ของ response JSON
- `status`: success / error

ดูได้ที่ `/admin/ai-chat-logs` (admin-only) → expand row ที่มี chip `1 tool`

### What's NOT covered (by design)

- เขียนข้อมูล — เปิด Phase 3 ถ้าจำเป็น (ต้อง human-in-the-loop confirmation)
- Tables นอก whitelist (auth, settings, orders) — แก้ migration ถ้าต้องการเพิ่ม
- Query > 5 วินาที — strongly suggest add WHERE / GROUP BY / LIMIT
- Cross-database query — block by validator + Postgres role
- Schema introspection via `pg_*` system catalogs — partial: information_schema
  works (smartship_ai_readonly has USAGE on schema public), but pg_class / pg_attribute
  direct access ขึ้นกับ default grant ของ Supabase
