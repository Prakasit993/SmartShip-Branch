# แผน: AI Agent Tools ผ่าน MCP (future-proof) — แยก JT / TikTok

> เป้าหมาย: เปิดให้ "ถามตอบข้อมูล JT และ TikTok" ผ่าน MCP โดย **แยกขนส่งกันชัดเจน** (ใช้งานแยก ไม่รวมข้อมูล)
> และรองรับอนาคต (Claude Code / Cursor / Claude Desktop / Phase 2 in-process agent ใช้ tool ชุดเดียวกัน)
>
> สถานะอ้างอิง: n8n `v2.20.8` — **Instance-level MCP (Preview) = Enabled**
> Server URL: `https://n8n.mybabymeal.com/mcp-server/http` · Auth: OAuth หรือ Access token

---

## สิ่งที่เปลี่ยนจากแผนเดิม (สำคัญ)

เดิมเสนอให้ **Next.js host MCP server เอง** แล้วให้ n8n AI Agent เป็น MCP client.
แต่ n8n v2.20.8 มี **Instance-level MCP** = **n8n เป็น MCP server** อยู่แล้ว → expose "workflow เป็น tool" ให้ MCP client (Claude Code/Cursor) ค้นหา+รันได้

**ผลคือ:**
- ❌ ไม่ต้องเขียน MCP route (`tools/list`/`tools/call`) เองใน Next.js — n8n จัดการ protocol ให้
- ✅ เราทำแค่: (1) endpoint อ่านข้อมูลใน Next.js ให้พร้อม → (2) n8n workflow บาง ๆ ห่อ endpoint = 1 tool → (3) Enable workflow ใน Instance-level MCP
- ✅ tool ชุดเดียวใช้ได้ทั้ง Claude Code, Cursor, Claude Desktop และ n8n AI Agent (ผ่าน MCP Client node ชี้กลับ instance ตัวเอง) — future-proof

---

## สถาปัตยกรรมเป้าหมาย

```
                         ┌─────────── n8n (MCP SERVER, v2.20.8) ───────────┐
[Claude Code / Cursor] → │  /mcp-server/http  (OAuth / Access token)        │
[Claude Desktop]       → │                                                  │
[n8n AI Agent (chatbot)]→ │  Enabled workflows = MCP tools:                 │
                         │   • wf_jt_*      (กลุ่ม JT)                       │
                         │   • wf_tiktok_*  (กลุ่ม TikTok)                   │
                         └───────────────┬──────────────────────────────────┘
                                         │ HTTP + Bearer N8N_AI_TOOLS_SECRET
                                         ▼
                         ┌─────────── Next.js (box.mybabymeal.com) ─────────┐
                         │  GET /api/admin/jt-shipments/*      (JT only)     │
                         │  GET /api/admin/tiktok-shipments/*  (TikTok only) │
                         │  POST /api/admin/ai-tools/sql        (jt dataset) │
                         │  POST /api/admin/ai-tools/tiktok-sql (tiktok only)│
                         └───────────────┬──────────────────────────────────┘
                                         ▼
                              Supabase (jt_shipments | tiktok_shipments — แยกตาราง/role)
```

**หลักการแยก JT / TikTok:**
- workflow คนละกลุ่ม (prefix `wf_jt_` / `wf_tiktok_`) → ใน Instance-level MCP เลือก enable แยกได้
- SQL tool แยก dataset: `query_sql` (jt + cost master) กับ `query_tiktok_sql` (tiktok เท่านั้น) — คนละ readonly role / whitelist
- ไม่มี view รวม, ไม่มี cross-join — ข้อมูล 2 ขนส่งไม่ปนกัน

---

## เฟส

| เฟส | งาน | สถานะ |
|---|---|---|
| **P0** | ยืนยัน Instance-level MCP เปิด + เลือก auth (OAuth vs Access token) + ทดสอบ connect จาก Claude Code | ✅ MCP เปิดแล้ว (รอเลือก auth) |
| **P1** | **(Next.js) เตรียม endpoint ให้เป็น AI tool** — switch auth + เพิ่ม tiktok tool schema + query_tiktok_sql | ✅ stats/stagnant + schema + query_tiktok_sql เสร็จ · ⏳ issues รอ RPC |
| **P2** | **(n8n) ชั้น MCP ตามรูป** — สร้าง "tool workflow" ห่อ endpoint + Enable ใน Instance-level MCP + connect client | 🔨 ร่างด้านล่าง |
| **P3** | ย้าย admin chatbot (n8n AI Agent) ให้ใช้ workflow/tool ชุดเดียวกัน (ลด config ซ้ำ) | ภายหลัง |
| **P4** | เปิดให้ Phase 2 in-process agent (ถ้าทำ) อ่าน registry เดียวกัน | ภายหลัง |

---

## P1 (ร่าง) — เตรียม endpoint ฝั่ง Next.js ให้เป็น AI tool

> หลักการ: tool = endpoint อ่านอย่างเดียว, gate ด้วย `requireAiToolAuth` (admin session หรือ Bearer `N8N_AI_TOOLS_SECRET`).
> เขียน (POST ack) คง `requireAdminApiAuth` — ไม่เปิดให้ MCP

### 1.1 สลับ auth ของ GET endpoints TikTok
ปัจจุบันใช้ `requireAdminApiAuth('admin-or-staff')` → เปลี่ยนเป็น `requireAiToolAuth(request)`:
- `app/api/admin/tiktok-shipments/stats/route.ts`
- `app/api/admin/tiktok-shipments/stagnant-parcels/route.ts`
- `app/api/admin/tiktok-shipments/issues/route.ts`  ⚠️ **ทำ RPC optimize ก่อน** (ดูหมายเหตุ perf) ไม่งั้น tool ช้า
- (`POST parcel-acknowledgements` คงเดิม — admin only)

### 1.2 เพิ่ม tool schema (แยกกลุ่มใน `src/lib/aiAgentTools.ts`)
เพิ่ม field `group: 'jt' | 'tiktok'` ในแต่ละ tool แล้วเติม tiktok tools:
- `get_tiktok_stats` → GET `/api/admin/tiktok-shipments/stats`
- `get_tiktok_stagnant_parcels` → GET `/api/admin/tiktok-shipments/stagnant-parcels`
- `get_tiktok_issue_summary` → GET `/api/admin/tiktok-shipments/issues` (หลัง RPC)
- `query_tiktok_sql` → POST `/api/admin/ai-tools/tiktok-sql`

### 1.3 query_tiktok_sql (แยกจาก jt) — ✅ เสร็จ (2026-05-23)
- ✅ `validateSelectSql(sql, allowedTables?)` รับ whitelist เป็น param — `src/lib/sqlValidator.ts`
  exports `JT_ALLOWED_TABLES` (default) และ `TIKTOK_ALLOWED_TABLES` (`tiktok_shipments` เท่านั้น, disjoint)
- ✅ route ใหม่ `app/api/admin/ai-tools/tiktok-sql/route.ts` mirror `sql/route.ts` แต่ส่ง `TIKTOK_ALLOWED_TABLES`
- ✅ migration `database/db/migrations/20260523_ai_readonly_grant_tiktok.sql` (รันใน Supabase) —
  `GRANT SELECT ON public.tiktok_shipments TO smartship_ai_readonly;`
  (หมายเหตุ: role dormant, GRANT เป็น documentation/future-proof — ตัวกั้นจริงคือ validator whitelist)
- ✅ unit test แยก dataset `src/lib/sqlValidator.test.ts` (`npm test`, node --test native TS, ไม่เพิ่ม dep) —
  พิสูจน์ jt↔tiktok ถามข้ามกันไม่ได้ (รวม join/subquery) + regression guards
- ⚠️ ระหว่างทางเจอ + แก้ bug เดิม: `extractFunctionName` ไม่รู้จัก shape ของ node-sql-parser v5
  ทำให้ `BLOCKED_FUNCTIONS` (pg_sleep / pg_read_file / dblink …) ไม่เคยทำงานทั้ง jt และ tiktok — แก้แล้ว
- คง SELECT-only, auto LIMIT 1000, statement_timeout 5s
- หมายเหตุ: validator reject SQL ที่ใช้ table alias (`t.col`) — AI ต้องเขียน SQL แบบไม่มี alias (ข้อจำกัดเดิม)

### หมายเหตุ perf (กันซ้ำกับที่คุยไว้)
`issues` ตอนนี้สแกนทั้งตารางในแอป → ก่อนเปิดเป็น tool ควรทำ RPC `tiktok_issue_summary()` (COUNT FILTER + NOT EXISTS) ให้เหลือ ~1 query

---

## P2 (ร่าง — ข้อ 3 "ตามรูป") — ชั้น MCP บน n8n Instance-level MCP

### 2.1 รูปแบบ "workflow = tool"
แต่ละ tool = 1 n8n workflow บาง ๆ (deterministic, ไม่มี LLM ข้างใน):
```
[Trigger ที่ MCP รองรับ + input schema]
   → [HTTP Request] GET/POST  https://box.mybabymeal.com/api/admin/<endpoint>
        Auth: Credential (Header Auth) "SmartShip AI Tools Bearer" = Bearer <N8N_AI_TOOLS_SECRET>
        Query/Body: "Using Fields Below" + ={{ $fromAI('date_from','...','string') }}  (กัน gotcha)
   → [Respond / return JSON]
```
ตั้งชื่อแยกกลุ่ม:
- `wf_jt_dashboard_kpi`, `wf_jt_cod_summary`, `wf_jt_query_sql`, …
- `wf_tiktok_stats`, `wf_tiktok_stagnant`, `wf_tiktok_query_sql`, …

> ⚠️ ต้องยืนยันใน n8n: "compatible workflows" สำหรับ Instance-level MCP ใช้ trigger ชนิดใด
> (ดูปุ่ม **Enable workflows** + ลิงก์ Learn more ในหน้า Settings → Instance-level MCP).
> ถ้า trigger ที่รองรับคือชนิดเฉพาะ ให้สร้าง workflow ด้วย trigger นั้น แล้วแมป input → HTTP node

### 2.2 Enable ใน Instance-level MCP (ตามรูป)
1. Settings → **Instance-level MCP** → tab **Workflows** → **Enable workflows** → เลือก `wf_jt_*` / `wf_tiktok_*`
2. tab **Connection details** → เลือก **Access token** (แนะนำเริ่มต้น ง่ายกว่า OAuth) → คัดลอก token
3. Server URL: `https://n8n.mybabymeal.com/mcp-server/http`

### 2.3 ต่อ client (future-proof)
**Claude Code (remote HTTP MCP):**
```
claude mcp add --transport http n8n-smartship https://n8n.mybabymeal.com/mcp-server/http \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```
**Claude Desktop / Cursor:** ใส่ใน mcp config (type: http / url + header เดียวกัน)

→ client จะเห็น tool ตามชื่อ workflow ที่ enable — เรียก `wf_tiktok_stats` ถาม TikTok, `wf_jt_*` ถาม JT แยกกัน

### 2.4 (ทางเลือก) ให้ admin chatbot ใช้ของชุดเดียวกัน
n8n AI Agent (chatbot ในแอป) เพิ่ม node **"MCP Client Tool"** ชี้ `…/mcp-server/http` → ใช้ workflow tools ชุดเดียวกับ Claude Code (P3)

---

## ของเดิม (Phase 1 chatbot tools) ต้องปรับให้เข้ากับ MCP ไหม?

**สรุป: ไม่ต้องแตะของเดิมเพื่อให้ chatbot ทำงานต่อ — แต่ของเดิมเอาไปเป็น MCP tool ตรงๆ ไม่ได้ ต้องสร้าง workflow ห่อเพิ่ม (endpoint Next.js เดิมใช้ซ้ำได้เลย ไม่ต้องแก้โค้ด).**

n8n มี "tool" 2 แบบที่เป็นคนละกลไกกัน — มักสับสน:

| | AI Agent attached tool (ของเดิม) | MCP tool (Instance-level MCP) |
|---|---|---|
| คืออะไร | "HTTP Request Tool" sub-node ที่ต่อเข้ากับ AI Agent node | **workflow** ที่ published + Enable ใน Instance-level MCP |
| ใครเรียก | LLM agent ภายใน workflow chatbot ตัวนั้น | MCP client ภายนอก (Claude Code / Cursor / Desktop) |
| expose ผ่าน MCP? | ❌ ไม่ | ✅ ใช่ |

→ tool เดิม 5 ตัวของ jt (`get_dashboard_kpi`, `get_cod_summary`, `get_top_not_closed_cases`, `get_not_closed_overdue_cases`, `query_sql`) เป็นแบบคอลัมน์ซ้าย → **ไม่โผล่ใน MCP โดยอัตโนมัติ**

**ชั้น endpoint พร้อม MCP อยู่แล้ว** (ยืนยัน 2026-05-23): ทั้ง 5 jt endpoints ใช้ `requireAiToolAuth` (Bearer `N8N_AI_TOOLS_SECRET`) เหมือน tiktok → **ไม่ต้องแก้โค้ด Next.js**. งานที่เหลืออยู่ฝั่ง n8n ล้วนๆ: สร้าง `wf_jt_*` (trigger + HTTP node ชี้ endpoint เดิม) แล้ว Enable ใน MCP

**2 แนวทาง:**
- **(a) อยู่คู่กัน:** เก็บ chatbot Phase 1 ไว้เหมือนเดิม + สร้าง `wf_*`/MCP แยกสำหรับ Claude Code → ดูแล config **2 ชุด** (tool ใน agent + workflow) ที่ซ้ำกัน
- **(b) รวมเป็นชุดเดียว — P3, แนะนำเป็นปลายทาง:** สร้าง `wf_jt_*` / `wf_tiktok_*` ครบ → ใน chatbot **เปลี่ยน HTTP Request Tool nodes ทั้งหมดเป็น "MCP Client Tool" node เดียว** ชี้กลับ `…/mcp-server/http` → chatbot กับ Claude Code ใช้ registry (workflows) ชุดเดียวกัน, แก้ schema ที่เดียวจบ

**`src/lib/aiAgentTools.ts` ยังเป็น source of truth ของ schema** — ตอนสร้าง `wf_*` ให้ก๊อป description/parameters จากไฟล์นี้ไปใส่ใน trigger input ของแต่ละ workflow (jt อยู่ใน `aiAgentToolsByGroup('jt')`, tiktok อยู่ใน `('tiktok')`)

---

## Auth & Security
- **MCP layer (n8n ↔ client):** Access token / OAuth ของ Instance-level MCP (n8n ออกให้)
- **Tool layer (n8n ↔ Next.js):** Bearer `N8N_AI_TOOLS_SECRET` (เดิม) ใน Header Auth credential
- **อ่านอย่างเดียว:** ไม่ expose endpoint เขียน (ack) ผ่าน MCP — คง admin REST
- **แยก dataset:** jt readonly role ↔ jt tables, tiktok readonly role/grant ↔ tiktok_shipments เท่านั้น
- หมุน secret/token: เปลี่ยนพร้อมกันทั้ง 2 ฝั่ง (single-tenant, ไม่มี grace period)

---

## ยืนยันแล้ว (2026-05-23)
1. ✅ **Compatible workflow trigger** = workflow ต้อง **published** + มี node trigger ชนิด **webhook / form / schedule / chat** เท่านั้นถึง enable MCP ได้
2. ✅ **Auth = Access token** — Configuration JSON: `type:"http"`, `url:"https://n8n.mybabymeal.com/mcp-server/http"`, header `Authorization: Bearer <ACCESS_TOKEN>` (token เป็นความลับ เก็บฝั่ง client เท่านั้น)
3. ✅ **Scope รอบแรก** = jt 5 ตัวเดิม + tiktok `stats`/`stagnant` (issues รอ RPC)

## ยังเหลือ
- workflow execution ของ tiktok ไม่ควรชน N8N timeout 300s (endpoint เร็วอยู่แล้ว ยกเว้น issues — รอ RPC)

---

## สรุปลำดับลงมือ (แนะนำ)
1. ✅ **P1.1 + P1.2** (สลับ auth tiktok stats/stagnant + เพิ่ม tiktok tool schema) — เสร็จ
2. ✅ **P1.3** query_tiktok_sql + validator แยก dataset + migration grant + unit test — เสร็จ (2026-05-23)
3. ⬜ **Deploy + n8n** — ดู [วิธีเริ่มใช้งานตอนนี้](#วิธีเริ่มใช้งานตอนนี้-จากสถานะ-p13-เสร็จ)
4. ⬜ **P2** สร้าง wf_tiktok_* / wf_jt_* + Enable ใน Instance-level MCP + connect Claude Code ทดสอบ
5. ⬜ (ขนาน) RPC optimize `issues` แล้วค่อยเปิด `get_tiktok_issue_summary`

---

## การเทส (Testing)

รัน: `npm test` — ใช้ `node --test` รัน TypeScript **native บน Node 24** (ไม่เพิ่ม dependency ใดๆ)
- ไฟล์: `src/lib/sqlValidator.test.ts` — 19 เทส ผ่านหมด
- `tsconfig.json` ใส่ `exclude: ["**/*.test.ts"]` แล้ว → ไฟล์เทสไม่เข้า `next build`
- node-sql-parser เป็น CommonJS → `sqlValidator.ts` import แบบ `import nodeSqlParser, { type AST }` แล้ว destructure `Parser` (รองรับทั้ง Next swc และ raw Node ESM)

**ครอบคลุม (เน้น security boundary การแยก dataset):**
- `query_tiktok_sql` (ชุด `TIKTOK_ALLOWED_TABLES`) ถาม `jt_shipments` ตรงๆ / JOIN / subquery → reject ทุกแบบ
- `query_sql` (default = `JT_ALLOWED_TABLES`) ถาม `tiktok_shipments` → reject
- whitelist 2 ชุดไม่ overlap (assert ตรงๆ)
- regression: non-SELECT (UPDATE/INSERT) / multi-statement / blocked function (pg_sleep) / LIMIT inject+clamp/no-touch

**bug เดิมที่เทสจับได้ (แก้แล้ว):** `extractFunctionName` ไม่ match shape ของ node-sql-parser v5
(`{ name: [{ value: 'pg_sleep' }] }`) → `BLOCKED_FUNCTIONS` ทั้งชุด (pg_sleep / pg_read_file / dblink …)
ไม่เคยทำงานเลยทั้ง jt และ tiktok. pg_read_file/dblink ไม่ใช่ write จึงไม่โดน `transaction_read_only` กัน = ช่องโหว่จริง — แก้ที่ `src/lib/sqlValidator.ts` (กระทบ `query_sql` เดิมด้วย ตอนนี้บล็อกถูกต้อง)

---

## Tool definitions — copy-paste สำหรับ n8n

> ใช้กับ n8n HTTP Request Tool node (ในกลุ่ม AI Agent ของ chatbot เดิม — ทาง A) หรือเป็น HTTP node ใน wf_tiktok_* (ทาง B/P2)
> **Base URL ทุกตัว:** `https://box.mybabymeal.com`
> **Header ทุกตัว:** `Authorization: Bearer <N8N_AI_TOOLS_SECRET>` (Header Auth credential เดิมที่ jt tools ใช้)

### `get_tiktok_stats`
- **Method / URL:** `GET https://box.mybabymeal.com/api/admin/tiktok-shipments/stats`
- **Parameters:** ไม่มี
- **Description:**
```
สรุปตัวเลขรวมของ TikTok Shop — จำนวนพัสดุทั้งหมด และจำนวนที่ปิดงานแล้ว (มีผู้เซ็นรับ). ใช้เมื่อผู้ใช้ถามภาพรวม TikTok เช่น "พัสดุ TikTok ทั้งหมดกี่ชิ้น" / "ปิดงานไปเท่าไหร่". TikTok ไม่มี date filter — คืนภาพรวมทั้งตาราง. ไม่มีข้อมูลต้นทุน/COD (ตรวจสอบเท่านั้น).
```

### `get_tiktok_stagnant_parcels`
- **Method / URL:** `GET https://box.mybabymeal.com/api/admin/tiktok-shipments/stagnant-parcels`
- **Parameters:** ไม่มี
- **Description:**
```
รายการพัสดุ TikTok ที่ตกค้างไม่เคลื่อนไหว — ไม่มี scan ≥ 2 วัน และยังไม่ปิดงาน. คืน AWB + ผู้ส่ง + เบอร์ + scan ล่าสุด. ใช้เมื่อถาม "TikTok ตกค้าง/ไม่ขยับ". ตัดรายการที่แอดมินรับทราบ/ซ่อนแล้วออกให้. คืนสูงสุด ~200 รายการ.
```

### `query_tiktok_sql`
- **Method / URL:** `POST https://box.mybabymeal.com/api/admin/ai-tools/tiktok-sql`
- **Body field `sql`** map ด้วย `={{ $fromAI('sql', 'SELECT query บน tiktok_shipments เท่านั้น', 'string') }}`
- **Parameters (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "sql": {
      "type": "string",
      "description": "SELECT query บน tiktok_shipments เท่านั้น — ไม่มี alias, ควรมี WHERE"
    }
  },
  "required": ["sql"],
  "additionalProperties": false
}
```
- **Description:**
```
รัน SELECT บน tiktok_shipments เท่านั้น (แยกจาก query_sql ของ JT — ห้าม join/ถาม jt_shipments) เมื่อ predefined tools ตอบไม่ได้. SELECT-only, auto LIMIT 1000, statement timeout 5s, ควรมี WHERE. tiktok_shipments มีคอลัมน์เดียวกับ jt_shipments (awb_number PK, booking_date, sender_name, receiver_name/phone, signer_name, return_type, exception_reason, sign_branch_code, latest_scan_time ฯลฯ) แต่ไม่มีข้อมูลต้นทุน. ถ้า SQL อ้าง jt_shipments (หรือ join/subquery) จะถูก reject (table not allowed). เขียน SQL แบบไม่มี table alias (validator ไม่รองรับ t.col). ถ้า error 400 ให้แก้ SQL ตาม error message แล้ว retry ได้.
```

### ⚠️ `get_tiktok_issue_summary` — อย่าเพิ่งเพิ่ม
endpoint `issues` ยังเป็น admin-only + สแกนทั้งตาราง (ช้า). ถ้าเพิ่มตอนนี้จะได้ 401 หรือช้าจน timeout.
ต้องทำ RPC `tiktok_issue_summary()` + สลับ auth เป็น `requireAiToolAuth` ก่อน (ดูหมายเหตุ perf)

---

## วิธีเริ่มใช้งานตอนนี้ (จากสถานะ P1.3 เสร็จ)

### ขั้นเตรียม (ครั้งเดียว)
1. **Commit + merge เข้า main → deploy** ขึ้น box.mybabymeal.com. ยืนยัน env `N8N_AI_TOOLS_SECRET` มีบน box (jt tools ใช้ตัวเดียวกัน — น่าจะมีแล้ว)
2. **รัน migration ใน Supabase:** `database/db/migrations/20260523_ai_readonly_grant_tiktok.sql`
   (ไม่บล็อกการทำงาน เพราะ role dormant — แต่ควรรันเพื่อ audit trail)

### เชื่อมต่อ — เลือก 1 ทาง
**ทาง A (เร็วสุด) — ใช้ผ่าน admin chatbot เดิม:**
เพิ่ม HTTP Request Tool node 3 ตัวใน n8n AI Agent (ใช้ค่าจาก [Tool definitions](#tool-definitions--copy-paste-สำหรับ-n8n)) → ถามบอทเรื่อง TikTok ได้เลย

**ทาง B (future-proof) — ผ่าน MCP / Claude Code (P2):**
สร้าง wf_tiktok_* → Enable ใน Instance-level MCP → คัดลอก Access token → `claude mcp add ...` (ดู 2.2–2.3)

### สรุปสถานะ tool
- ✅ พร้อมใช้: `get_tiktok_stats` · `get_tiktok_stagnant_parcels` · `query_tiktok_sql`
- ⏳ ยังไม่พร้อม: `get_tiktok_issue_summary` (รอ RPC + สลับ auth)
