# SmartShip — J&T Warehouse n8n Setup Guide

> อัปเดต: 2026-05-28 | ใช้คู่กับ [jt-warehouse-guide.md](jt-warehouse-guide.md)

ขั้นตอนสร้าง n8n workflows สำหรับซิงค์ข้อมูลพัสดุ J&T ลง Supabase — แบ่ง 2 ตัว:

1. **Manual Upload Workflow** — รับไฟล์จากปุ่มหน้า admin (มีอยู่แล้ว ต้องแก้)
2. **Auto-Sync Workflow** — Schedule + Playwright scrape J&T portal (สร้างใหม่)

---

## 📋 Pre-requisites

- [x] n8n instance ที่ `n8n.mybabymeal.com`
- [x] Postgres credentials ของ Supabase (service_role)
- [x] J&T portal credentials (username/password)
- [x] LINE OA channel + access token (สำหรับ alert — Phase 5)

---

## 🟢 Workflow A — Manual Upload (มีอยู่ — ต้องแก้)

### สถานะปัจจุบัน

มี workflow ที่:
- Webhook `POST /webhook/upload_stock` (path `upload_stock`)
- Extract from File (อ่าน .xlsx/.csv)
- Loop + Edit Fields
- TRUNCATE + Insert ลง `warehouse_jt_parcels`
- Audit log

**ปัญหาที่พบ**:
- มี node "Insert rows in a table" ที่พยายามเขียนลง `warehouse_jt_last_upload` → **error 42809: not a table**

### ✅ Task #1 — Cleanup workflow ที่มีอยู่

#### Step 1.1 — ลบ Insert node ที่ error

1. เปิด workflow บน n8n editor
2. หา node ที่เขียนลง `warehouse_jt_last_upload`
3. **ลบทิ้ง** (เพราะ `warehouse_jt_last_upload` เป็น **VIEW** ที่อ่านจาก parcels โดยตรง — ไม่ต้องเขียน meta แยก)

#### Step 1.2 — ตรวจ schema ของ webhook

ต้องตอบกลับ JSON เพื่อให้ frontend แสดงผลถูก:

**Response node settings**:
```json
{
  "status": "processing",
  "message": "รับไฟล์เรียบร้อย ระบบกำลังประมวลผล..."
}
```

หรือ
```json
{
  "status": "success",
  "message": "นำเข้าสำเร็จ {{ $('Audit Log').first().json.affected_rows }} รายการ"
}
```

| `status` | ความหมาย | UI แสดงผล |
|---|---|---|
| `processing` / `pending` | กำลังประมวลผล | Toast เหลือง + กล่องเขียว |
| `success` / `ok` / `done` / `completed` | สำเร็จ | Badge เขียว |
| `error` / `failed` | ผิดพลาด | Badge แดง |

#### Step 1.3 — เปิดใช้งาน (Activate)

1. กดสวิตช์ **Active** มุมขวาบนของ workflow ให้เป็นสีเขียว
2. URL จะเปลี่ยนจาก Test → Production
3. Copy Production URL จาก Webhook node

#### Step 1.4 — ตรวจ env vars บน Vercel

ตั้งค่า:
```
JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL=https://n8n.mybabymeal.com/webhook/upload_stock
```

- **Environments**: Production + Preview (+ Development ถ้าจะทดสอบ local)
- **Sensitive**: ✓ ติ๊กไว้
- หลังเพิ่ม env ใหม่ → **Redeploy** Vercel deployment (env ไม่ apply กับ deployment เดิม)

#### Step 1.5 — ทดสอบ end-to-end

1. เปิด `/admin/jt-warehouse` ในเบราว์เซอร์
2. กดปุ่ม 📋 มุมขวาบน → modal เปิด
3. เลือกไฟล์ Excel จาก J&T (export "การควบคุมนำจ่ายของ DP ปลายทาง" → "รายละเอียด")
4. กด "ส่งไฟล์เพื่อนำเข้า"
5. ควรเห็น "ส่งไฟล์สำเร็จ" สีเขียว
6. ปิด modal → รีเฟรชหน้า → ดูยอด `รวม` / `อัปเดตล่าสุด` เปลี่ยน

---

## 🔵 Workflow B — Auto-Sync (ต้องสร้างใหม่)

### Goal

ทุก 15 นาทีในเวลาทำงาน (06:00–21:00 Asia/Bangkok):
1. Login J&T portal
2. Navigate ไปหน้า "การควบคุมนำจ่ายของ DP ปลายทาง"
3. Filter สาขา `04Thanyaburi062` → tab "รายละเอียด"
4. คลิกปุ่ม "ส่งออกข้อมูล" → download .xlsx
5. ส่งไฟล์เข้า Workflow A (re-use)

### โครงสร้างที่แนะนำ

```
[Schedule Trigger]
       ↓
[Set: prepare context]
       ↓
[Code: get/load storage state]  ← optional: cookie reuse
       ↓
[Playwright Login + Export]
       ↓
[Execute Workflow]  ← เรียก Workflow A
       ↓
[Audit Log]
       ↓
[On Error → LINE OA alert]
```

### ✅ Task #2 — สร้าง Auto-Sync Workflow

#### Step 2.1 — Schedule Trigger node

- **Trigger Interval**: Cron
- **Mode**: Multiple → ใส่ 2 expressions
- **Cron 1**: `*/15 6-20 * * *` (ทุก 15 นาที 06:00–20:45)
- **Cron 2**: `0 21 * * *` (ครอบ 21:00 พอดี)
- **Timezone**: `Asia/Bangkok` (สำคัญ — ถ้าใส่ผิดจะรันเวลา UTC = เพี้ยน 7 ชม.)

> ทางเลือก: ใช้ `*/15 6-21 * * *` เพียง expression เดียว — จะยิงเพิ่ม 21:15, 21:30, 21:45 ด้วย (4 ครั้งเกิน)

#### Step 2.2 — Playwright node

ติดตั้ง Playwright ใน n8n (ถ้ายังไม่มี):
- ติด Custom Node `n8n-nodes-playwright` หรือใช้ Code node + npm package
- หรือใช้ external Playwright service ผ่าน HTTP

**Pseudo-code**:
```javascript
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ 
  storageState: $vars.STORAGE_STATE_JSON  // โหลด session ที่บันทึกไว้
});
const page = await context.newPage();

// ถ้า session หมดอายุ → login ใหม่
await page.goto('https://jtportal.example/login');
if (await page.url().includes('login')) {
  await page.fill('input[name="username"]', $env.JT_PORTAL_USER);
  await page.fill('input[name="password"]', $env.JT_PORTAL_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  // บันทึก storageState ใหม่
  await context.storageState({ path: 'storage.json' });
}

// Navigate
await page.goto('https://jtportal.example/dp-control');
await page.click('text=รายละเอียด');
await page.fill('input[placeholder*="สาขา"]', '04Thanyaburi062');
await page.click('button:has-text("ค้นหา")');

// Export + รอ download
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('button:has-text("ส่งออกข้อมูล")'),
]);

const buffer = await download.createReadStream().toArray();
return [{
  json: { filename: download.suggestedFilename() },
  binary: { data: { data: Buffer.concat(buffer), fileName: ..., mimeType: '...' } },
}];
```

#### Step 2.3 — Execute Workflow node

แทนที่จะ copy parse + insert nodes ของ Workflow A → ใช้ **Execute Workflow** เรียก A:

- **Workflow**: เลือก Workflow A (Manual Upload) ที่ refactor แล้ว
- **Mode**: "Wait for completion"
- **Pass binary**: ✓ ส่ง buffer ที่ได้จาก Playwright

> ทางเลือก: refactor Workflow A เป็น sub-workflow รับ binary จาก parent — ดู [n8n docs: Execute Workflow Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflowtrigger/)

#### Step 2.4 — Concurrency Guard

ป้องกันรันซ้อนกัน (รอบใหม่เริ่มก่อนรอบเก่าจบ):

**Workflow Settings**:
- **Execution Order**: `Save execution: only on error` ลด DB load
- **Timeout**: `300` วินาที (5 นาที — กัน Playwright ค้าง)
- **Save manual executions**: `Off`

ถ้ายังกังวล concurrent → เพิ่ม lock flag ใน DB:
```sql
-- ก่อน start: ตรวจว่ามี run อื่นไหม
SELECT pg_try_advisory_lock(123456789);
-- ถ้า return false = run อื่นยังไม่จบ → exit
```

#### Step 2.5 — Error Trigger + Notification

สร้าง workflow แยก:

**Error Trigger node** (ดักจาก workflow ทุกตัวในระบบ)
   ↓
**Switch node** — กรองเฉพาะ workflow id ของ Auto-Sync
   ↓
**HTTP Request → LINE OA**
```http
POST https://api.line.me/v2/bot/message/push
Authorization: Bearer {{ $env.LINE_OA_TOKEN }}
Content-Type: application/json

{
  "to": "{{ $env.LINE_OA_ADMIN_ID }}",
  "messages": [{
    "type": "text",
    "text": "🔴 J&T Auto-Sync ล้มเหลว\nเวลา: {{ $now }}\nสาเหตุ: {{ $json.execution.error.message }}\nWorkflow ID: {{ $json.execution.workflowId }}"
  }]
}
```

---

## 🧪 ทดสอบ Auto-Sync

### Test 1 — Manual trigger
1. เปิด workflow B ใน editor
2. กด "Execute Workflow" (รันทันที ไม่รอ schedule)
3. ดู execution log ว่าผ่านทุก node
4. ตรวจ Supabase: `SELECT MAX(updated_at) FROM warehouse_jt_parcels;` → ควรใกล้เวลาปัจจุบัน
5. เปิด `/admin/jt-warehouse` → ดู `อัปเดตล่าสุด: เมื่อสักครู่`

### Test 2 — Schedule trigger
1. รอ slot เวลาถัดไป (เช่น 14:30)
2. ตรวจ n8n executions list → ต้องมี run ที่ 14:30
3. ตรวจ `last_uploaded_at` ของ view

### Test 3 — Health badge
1. ปิด workflow B
2. รออัปเดตเก่ากว่า 30 นาที (ในเวลาทำงาน)
3. เปิด `/admin/jt-warehouse` → ควรเห็น badge แดง 🔴 **"ข้อมูลค้าง"** pulse

### Test 4 — Error alert
1. หยุด J&T portal credential ชั่วคราว (เปลี่ยน password ผิด)
2. รันด้วยมือ → Playwright fail
3. ควรได้ LINE OA notification ใน ≤ 1 นาที

---

## 🔐 Environment Variables (n8n)

ตั้งใน n8n → **Settings → Variables**:

| Key | Value | Sensitive |
|---|---|---|
| `JT_PORTAL_URL` | `https://jt-portal.example.com` | No |
| `JT_PORTAL_USER` | (username) | ✓ |
| `JT_PORTAL_PASS` | (password) | ✓ |
| `JT_BRANCH_CODE` | `04Thanyaburi062` | No |
| `LINE_OA_TOKEN` | (LINE Messaging API access token) | ✓ |
| `LINE_OA_ADMIN_ID` | (LINE user ID ของ admin) | ✓ |
| `SUPABASE_DB_URL` | (Postgres connection) | ✓ |

### storage state สำหรับ Playwright

เก็บใน table แยก หรือใน n8n Files:

```sql
CREATE TABLE n8n_playwright_state (
    key text PRIMARY KEY,
    storage_state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

หรือใช้ n8n built-in: `Data Store` (ถ้ามี plugin)

---

## ⚠️ ข้อระวัง

| เรื่อง | คำแนะนำ |
|---|---|
| **Captcha** | J&T portal อาจมี captcha — ถ้าเจอ ต้อง pause workflow + แจ้ง admin ทำ manual ลงชื่อ |
| **TZ Bangkok** | ตั้งใน Schedule Trigger + container env `TZ=Asia/Bangkok` |
| **5,800 rows × 60 ครั้ง/วัน** | Postgres index `(branch_code, staff_id)` + partial closed_idx ช่วยให้ query เร็ว |
| **Concurrent run** | ใช้ advisory lock หรือ workflow setting `only on error` save |
| **Storage state expiry** | Login ใหม่อัตโนมัติเมื่อเซสชันหมดอายุ — บันทึก state ใหม่ทุกครั้ง |
| **File size > 4.5MB** | ถ้าไฟล์ใหญ่ขึ้น → ปรับ `NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB` |
| **Bandwidth cost** | Auto-sync ทุก 15 นาที = ~96 ครั้ง/วัน — ระวัง bandwidth ของ J&T portal (อาจติด rate limit) |

---

## 📅 Schedule Time Reference

ในเวลาทำงาน 06:00–21:00 Asia/Bangkok = **60 รอบ/วัน**:

```
06:00, 06:15, 06:30, 06:45, 07:00, ... 20:30, 20:45, 21:00
```

| Cron expression | ผล |
|---|---|
| `*/15 6-20 * * *` | 60 runs/day (06:00–20:45 inclusive, ขาด 21:00) |
| `*/15 6-21 * * *` | 64 runs/day (06:00–21:45 inclusive — เกิน 21:00 ไป 3 รอบ) |
| `*/15 6-20 * * *` + `0 21 * * *` | **61 runs/day (06:00–21:00 inclusive, ตรงตามต้องการ)** ★ |

---

## 🚀 ถัดไป — Phase 3+

หลังจาก Workflow B ทำงานเสถียร:

1. **Phase 3 (COD bucket card)** — n8n ส่ง LINE OA สรุป COD แต่ละ bucket ทุก 2 ชม.
2. **Phase 4 (Mid-day gate)** — Cron 11:30 ทุกวัน → เรียก `get_jt_midday_performance` → ถ้า < target → alert
3. **Phase 5 (AI Tools)** — n8n AI Agent + เรียก GET `/api/ai-tools/jt-*` endpoints

ดู section "Phase Roadmap" ใน [jt-warehouse-guide.md](jt-warehouse-guide.md)
