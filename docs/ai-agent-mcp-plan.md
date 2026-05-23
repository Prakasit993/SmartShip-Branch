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
| **P1** | **(Next.js) เตรียม endpoint ให้เป็น AI tool** — switch auth + เพิ่ม tiktok tool schema + query_tiktok_sql | 🔨 ร่างด้านล่าง |
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

### 1.3 query_tiktok_sql (แยกจาก jt)
- สร้าง route ใหม่ mirror `app/api/admin/ai-tools/sql/route.ts` แต่ whitelist = `tiktok_shipments` เท่านั้น
- migration (รันใน Supabase): `GRANT SELECT ON public.tiktok_shipments TO smartship_ai_readonly;`
- คง SELECT-only, auto LIMIT 1000, statement_timeout 5s, บังคับ WHERE booking_date

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
1. **P1.1 + P1.2** (สลับ auth tiktok GET + เพิ่ม tiktok tool schema) — โค้ด Next.js, ปลอดภัย, ทำได้ทันที
2. **P1.3** query_tiktok_sql + migration grant (รันใน Supabase)
3. **P2** สร้าง wf_tiktok_* / wf_jt_* + Enable ใน Instance-level MCP + connect Claude Code ทดสอบ
4. (ขนาน) RPC optimize `issues` แล้วค่อยเปิด `get_tiktok_issue_summary`
