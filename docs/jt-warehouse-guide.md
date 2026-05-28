# SmartShip — J&T Warehouse Module

> อัปเดต: 2026-05-28 | สถานะ: Phase 1 + Phase 2 เสร็จแล้ว (ตัว code), รอ n8n auto-sync (Phase 1 task #1 + #2)

หน้า `/admin/jt-warehouse` สำหรับ admin/staff ตรวจสอบพัสดุ J&T ที่ค้างจ่ายและพนักงานนำส่งของสาขา — ข้อมูลซิงค์อัตโนมัติทุก 15 นาทีในเวลาทำงาน

---

## 📍 สถานะปัจจุบัน

| Feature | สถานะ |
|---|---|
| ✅ Manual Upload (ปุ่มมุมขวา) | Live — Vercel: `box.mybabymeal.com/admin/jt-warehouse` |
| ✅ Branch + Staff summary cards | Live |
| ✅ Banner "ยังอยู่ในคลัง" (พัสดุยังไม่ assign พนักงาน) | Live |
| ✅ "ปิดงาน" definition: 6 ฟิลด์ครบ (2026-05-28) | Live |
| ✅ Health badge (ข้อมูลค้าง > 30 นาทีในเวลาทำงาน) | Live |
| ✅ Lazy-load detail รายพนักงาน (drawer + COD breakdown + top 20 pending) | Live |
| ⏳ Auto-sync ทุก 15 นาที (n8n cron + Playwright) | รอตั้งค่า — ดู `docs/jt-warehouse-n8n-setup.md` |
| ⏳ COD bucket card หน้าหลัก (Phase 3) | Plan |
| ⏳ Mid-day KPI gate (Phase 4) | Plan |
| ⏳ AI Tools + LINE OA alert (Phase 5) | Plan |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ผู้ใช้ Admin/Staff                                            │
│   ↓                                                          │
│ /admin/jt-warehouse (Next.js page.tsx)                       │
│   ├─ ปุ่ม "อัปโหลด" — manual                                  │
│   ├─ Card สาขา + ตารางพนักงาน — RPC                          │
│   ├─ Banner "ยังอยู่ในคลัง" — row ที่ staff_id ว่าง            │
│   ├─ คลิกพนักงาน → drawer (lazy-load)                        │
│   └─ Health badge — เตือนถ้าค้าง > 30 นาที                    │
│                                                              │
│ ┌──────────────────┐                                         │
│ │ Server Component │ ← supabaseAdmin (service_role)          │
│ └─────┬────────────┘                                         │
│       ↓                                                      │
│ Postgres / Supabase                                          │
│   ├─ warehouse_jt_parcels (62 columns, ทุก col text)         │
│   ├─ View warehouse_jt_last_upload (live aggregate)          │
│   ├─ RPC get_warehouse_jt_branch_summary                     │
│   ├─ RPC get_warehouse_jt_branch_staff_summary               │
│   ├─ RPC get_warehouse_jt_staff_detail (lazy-load)           │
│   └─ Helper jt_parcel_is_closed / jt_text_is_filled          │
│                                                              │
│       ↑                                                      │
│ ┌──────────────────────────────────────┐                     │
│ │ n8n (n8n.mybabymeal.com)             │                     │
│ │   Manual:  Webhook upload_stock      │                     │
│ │            → Extract → TRUNCATE+INSERT│                     │
│ │   Auto:    Schedule + Playwright     │                     │
│ │            (ดู n8n-setup.md)         │                     │
│ └──────────────────────────────────────┘                     │
│       ↑                                                      │
│ J&T portal (Playwright scrape)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ ตาราง `warehouse_jt_parcels`

- **PK**: `awb_number` (เลขพัสดุ)
- **62 columns** — ทุก column เป็น `text` (รับ Excel serial, `"-"`, `""` ปนกันได้)
- **Index หลัก**:
  - `(delivery_branch_code, delivery_staff_id)` — aggregate per staff
  - `warehouse_jt_parcels_closed_idx` — partial index เร่ง count ปิดงาน
- **Migrations**:
  - [20260528_warehouse_jt_parcels.sql](../database/db/migrations/20260528_warehouse_jt_parcels.sql) — schema หลัก
  - [20260528_warehouse_jt_summary_rpc.sql](../database/db/migrations/20260528_warehouse_jt_summary_rpc.sql) — RPC + view
  - [20260528_warehouse_jt_closed_predicate.sql](../database/db/migrations/20260528_warehouse_jt_closed_predicate.sql) — closed rule + index
  - [20260528_warehouse_jt_staff_detail.sql](../database/db/migrations/20260528_warehouse_jt_staff_detail.sql) — detail RPC

### Field groups

| Group | ตัวอย่าง column | ใช้งาน |
|---|---|---|
| **เขต/แฟรนไชส์** | `region_name`, `region_code`, `franchise_name`, `franchise_code` | ตาราง / filter |
| **เวลา scan** | `gateway_dispatch_time`, `earliest_scan_time`, `latest_scan_time`, `arrived_branch_time` | Phase 4 รอบเข้า |
| **สาขานำจ่าย** ★ | `delivery_branch_code`, `delivery_branch_name`, `delivery_staff_id`, `delivery_staff_name`, `delivery_staff_position`, `delivery_staff_phone` | Index หลัก + tab |
| **ตกค้าง** | `stuck_time`, `stuck_reason`, `stuck_scan_branch`, `stuck_flag` (Y/N) | Card "ตกค้าง" |
| **ปัญหา** | `problem_time`, `problem_reason`, `problem_scan_branch` | Card "ปัญหา" |
| **เซ็นรับ** ★ | `signed_time`, `sign_branch_name`, `signed_record_time`, `signed_by_staff`, `signer_name`, `sign_time_status`, `signed_flag` | "ปิดงาน" rule (6 ฟิลด์) |
| **ปิดงาน** | `closed_branch`, `closed_time` | (Phase 4 ใช้) |
| **เงิน** | `cod_amount`, `total_shipping_fee`, `billed_weight`, `payment_method` | COD breakdown |
| **ผู้ส่ง/รับ** | `sender_name`, `receiver_name`, `receiver_phone`, `receiver_address` | Drawer detail |

---

## 📊 Business Rules

> Source of truth: memory `project-jt-warehouse-business-rules`

### 1. "ปิดงาน" — 6 ฟิลด์ครบ (2026-05-28)

```sql
public.jt_parcel_is_closed(
    signed_time, sign_branch_name, signed_record_time,
    signed_by_staff, signer_name, sign_time_status
)
```

จะเป็น `true` เมื่อทั้ง 6 ฟิลด์ filled — ไม่ใช่ NULL/`""`/`"-"`

**ก่อนหน้านี้** ใช้ `signed_flag = 'Y'` — เปลี่ยนใหม่เพราะแม่นยำกว่า (มีเคสที่ flag='Y' แต่ฟิลด์ไม่ครบ)

ใช้ predicate นี้ทุกที่ที่ต้อง count `delivered_count` / `pending_count`

### 2. "พัสดุยังอยู่ในคลัง"

Row ที่ `delivery_staff_id` ว่าง = ยังไม่ assign พนักงาน → แสดงเป็น **banner แยก** เหนือตารางพนักงาน (ห้ามรวมเป็นแถวในตาราง)

### 3. รอบรับเข้า (Phase 4 — ยังไม่ implement)

ใช้ `arrived_branch_time` เป็นเกณฑ์:
- รอบเช้า: 06:00–10:00
- รอบบ่าย: 13:00–16:00
- นอกรอบ: เวลาอื่น

### 4. COD buckets (Phase 3 — ยังไม่ implement หน้าหลัก, มีใน drawer แล้ว)

| Bucket | ช่วง |
|---|---|
| ต่ำ | < ฿1,000 |
| กลาง | ฿1,000–2,000 |
| สูง | ฿2,000–5,000 |
| สูงมาก ⚠️ | > ฿5,000 |

Alert priority: **สูงมาก ที่ยังไม่ปิดงาน → เร่งให้พนักงานออกจ่ายก่อน**

### 5. Mid-day KPI Gate (Phase 4)

- เป้าก่อนเที่ยง: ≥ **20%** ของยอดรับเข้าวันนั้น
- Cutoff: **12:00 Asia/Bangkok**
- ปรับเป้าได้ผ่าน config

---

## 🔌 RPC Reference

### `get_warehouse_jt_branch_summary()`

สรุปต่อสาขา — ใช้ใน card สาขา

**Returns**: rows ของ `(delivery_branch_code, delivery_branch_name, parcel_count, staff_count, delivered_count, pending_count, stuck_count)`

### `get_warehouse_jt_branch_staff_summary()`

สรุปต่อพนักงาน — ใช้ในตารางและ banner

**Returns**: rows ของ `(branch_*, staff_*, parcel_count, delivered_count, pending_count, stuck_count, cod_total)`

### `get_warehouse_jt_staff_detail(p_delivery_branch_code, p_delivery_staff_id)` ★ ใหม่

Lazy-load รายละเอียดพนักงาน 1 คน — ใช้ใน drawer

**Returns**: jsonb 1 object โครงสร้าง:
```json
{
  "staff": { "delivery_staff_id", "delivery_staff_name", "delivery_staff_position", "delivery_staff_phone", "delivery_branch_code", "delivery_branch_name" },
  "counts": { "total", "delivered", "pending", "stuck", "problem" },
  "cod": { "total", "pending_total", "low_count", "mid_count", "high_count", "very_high_count" },
  "pending_parcels": [ { "awb_number", "cod_amount", "cod_num", "receiver_name", "receiver_phone", "receiver_address", "stuck_flag", "stuck_reason", "problem_reason", "arrived_branch_time" }, ... ] // top 20 เรียงตาม COD
}
```

### View `warehouse_jt_last_upload`

Aggregate live — ใช้แสดง "อัปเดตล่าสุด: X นาทีที่แล้ว"

**Returns** (1 row):
- `last_uploaded_at` = `MAX(updated_at)` จาก parcels
- `total_parcels`, `branch_count`, `staff_count`

⚠️ เป็น **VIEW** ไม่ใช่ table — ห้าม TRUNCATE/INSERT, อัปเดตเอง

---

## 🛣️ API Routes

| Path | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/jt-parcel-n8n-upload` | POST | admin-or-staff | Proxy multipart → n8n webhook (manual upload) |
| `/api/admin/jt-warehouse/staff-detail` ★ | GET | admin-or-staff | Lazy-load detail รายพนักงาน |

ทั้งหมดใช้ `requireAdminApiAuth('admin-or-staff', request)` — แค่ admin หรือ staff role เข้าได้

---

## 🖥️ Frontend Components

| File | Purpose |
|---|---|
| [page.tsx](../app/admin/(dashboard)/jt-warehouse/page.tsx) | Server component — fetch RPC ขนานกัน 3 ตัว, ส่งเข้า BranchStaffView |
| [BranchStaffView.tsx](../app/admin/(dashboard)/jt-warehouse/BranchStaffView.tsx) | Client — tab สาขา + ตารางพนักงาน + ค้นหา + banner + health badge + click handler |
| [StaffDetailModal.tsx](../app/admin/(dashboard)/jt-warehouse/StaffDetailModal.tsx) ★ | Drawer ขวา — fetch staff-detail API, แสดง counts/COD/pending list |
| [JtParcelN8nUpload.tsx](../app/admin/(dashboard)/jt-warehouse/JtParcelN8nUpload.tsx) | Modal upload สีส้ม |

### Health Badge

- คำนวณใน client ด้วย `useState(nowMs)` + `setInterval(60s)`
- Stale = อยู่ใน 06:00–20:59 TZ Bangkok **AND** `last_uploaded_at` ค้าง > 30 นาที
- แสดง badge แดง pulse + tooltip
- ใช้ `bangkokHour()` อ่าน TZ Bangkok โดยไม่พึ่ง browser TZ

### Hydration safety

`nowMs` เริ่มเป็น `null` → set ใน `useEffect` — ไม่มี SSR/client mismatch

---

## 🔐 Environment Variables

```bash
# n8n webhook ปลายทาง (manual upload)
JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL=https://n8n.mybabymeal.com/webhook/upload_stock

# จำกัดขนาดไฟล์ upload (default 4.5 MB)
NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB=4.5

# AI tools secret (Phase 5)
N8N_AI_TOOLS_SECRET=...
```

ตั้งทั้งใน Vercel (Production + Preview) และ `.env.local` (dev)

---

## 🎨 UX Rules

- **Section B รายพนักงาน**: ตารางแสดงข้อมูลพื้นฐาน → คลิกแถว → drawer lazy-load (ไม่โหลด detail ทุกคนพร้อม initial render)
- **"อยู่ในคลัง"**: banner แยก (ห้ามรวมในตาราง)
- **Drawer**: เลื่อนจากขวา, ปิดด้วย Esc, lock body scroll, focus trap (ทำง่าย ๆ ด้วย `aria-modal`)
- **Phone masking**: เลขผู้รับใน drawer แสดง `******XXXX` 4 ตัวท้าย (ปัจจุบันแสดงเต็ม — TODO ทำ mask)
- **Alert channel**: LINE OA (ไม่ใช้ LINE Notify — กำลัง deprecate)

---

## 🔄 Snapshot Mode (Upload Strategy)

- **Manual + Auto upload** ทั้งคู่ใช้ `TRUNCATE warehouse_jt_parcels` ก่อน `INSERT`
- DB ตรงกับไฟล์ล่าสุดเสมอ — **ไม่สะสมประวัติ**
- Trade-off: 5-30s window ที่ table ว่าง → ผู้ใช้เห็น empty state ชั่วคราว
- **ห้ามลบ TRUNCATE step** — ไม่งั้น stale records จะสะสม

### View `warehouse_jt_last_upload` รับมือ snapshot ยังไง?

อ่านจาก parcels โดยตรง (live aggregate) → ไม่ต้องเขียน meta แยก → ไม่ break ตอน TRUNCATE

---

## 📚 Related Docs / Memory

- [docs/jt-warehouse-n8n-setup.md](jt-warehouse-n8n-setup.md) — ขั้นตอน setup n8n workflow (manual + auto-sync)
- Memory: `project_jt_warehouse` — technical architecture (file paths + env)
- Memory: `project_jt_warehouse_business_rules` — business rules (closed def, COD buckets, KPI gate)
- Memory: `project_ai_chat_architecture` — pattern AI tools (Phase 5)

---

## 🧭 Phase Roadmap

| Phase | งาน | สถานะ |
|---|---|---|
| **1** | Auto-sync (n8n) + Health badge + Foundation | 1/3 (badge เสร็จ, n8n ค้าง) |
| **2** | Refactor "ปิดงาน" + Lazy-load detail | ✅ Done |
| **3** | COD bucket card หน้าหลัก + drill-down | Plan |
| **4** | Mid-day KPI gate + config table | Plan |
| **5** | AI Tools (GET endpoints) + LINE OA alerts | Plan |

ดูรายละเอียดแต่ละ phase ในไฟล์ memory `project_jt_warehouse_business_rules.md`
