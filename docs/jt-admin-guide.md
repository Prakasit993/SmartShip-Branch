# SmartShip — J&T Admin Module: คู่มือการพัฒนาต่อ

> อัปเดต: 2026-05-02 | ผู้เขียน: ทีมพัฒนา SmartShip Branch

---

## คู่มือแหล่งข้อมูล Dashboard (อ่านก่อนทำกราฟ / ตัวเลขสรุป)

เพื่อไม่ให้สับสนว่าเลขมาจาก **browser + RLS**, **service role API**, หรือ **RPC ฝั่ง Postgres** — อ่าน **`docs/jt-dashboard-data-sources.md`**  
ครอบคลุม: `supabaseAdmin` สองที่ใน repo, migration `jt_shipments_import_columns`, RPC กราฟรายวัน UTC, และข้อควรระวังเมื่อเทียบยอดกับ SQL Editor

---

## 📍 สถานะปัจจุบัน (What's Done)

### ✅ ระบบที่ใช้งานได้แล้ว

| Feature | URL | สถานะ |
|---|---|---|
| Admin Dashboard (Shop) | `/admin` | ✅ Live |
| J&T Shipments (CRUD) | `/admin/shipments` | ✅ Live |
| J&T Dashboard (สรุป + 5 รายการล่าสุด; โหลดผ่าน browser Supabase client) | `/admin/jt-dashboard` | ✅ Live |
| Import Excel Drag & Drop | `/admin/shipments` → ปุ่ม Import | ✅ Live |
| API: CRUD Shipments | `GET/POST/PUT/DELETE /api/admin/jt-shipments` | ✅ Live |
| API: Bulk Import | `POST /api/admin/jt-shipments/import` | ✅ Live |
| API: n8n Sync | `POST /api/admin/jt-shipments/n8n-sync` | ✅ Live |
| API: Stats | `GET /api/admin/jt-shipments/stats` | ✅ Live |

---

## 🗄️ ตาราง jt_shipments — Field ที่มีและจัดการได้

### Field ปัจจุบัน (โครงหลัก — ดู schema จริงใน Supabase / migration)

| Field | Type | CRUD | หมายเหตุ |
|---|---|---|---|
| `id` | bigint / uuid | อ่านอย่างเดียว | Primary Key, auto-generate |
| `awb_number` | text | ✅ C R U D | เลขพัสดุ J&T — Unique |
| `booking_date` | timestamptz หรือ text (บางดีพลอย) | ✅ C R U D | วันที่จอง — กราฟรายวันใช้กฎ UTC / substring ตาม RPC |
| `sender_name` | text | ✅ C R U D | ชื่อผู้ส่ง |
| `sender_phone` | text | ✅ C R U D | เบอร์ผู้ส่ง |
| `receiver_name` | text | ✅ C R U D | ชื่อผู้รับ |
| `receiver_phone` | text | ✅ C R U D | เบอร์ผู้รับ |
| `shipping_fee` | numeric | ✅ C R U D | ค่าส่ง (บาท) |
| `platform` | text | ✅ | แหล่งที่มา (Shopee, TikTok, …) — ดู `20260502_jt_shipments_platform.sql` |
| `cod_amount` | numeric | ✅ | COD (ถ้ามีในตาราง) |
| `latest_scan_type` | text | ✅ | ใช้ badge / นับตีกลับใน dashboard |

รายชื่อคอลัมน์สำหรับ **Import UI** ดึงจาก RPC **`jt_shipments_import_columns()`** (service_role เท่านั้น) — ดู `database/db/migrations/20260503_jt_shipments_columns_rpc.sql`

---

## ➕ Field ที่แนะนำให้เพิ่ม (Roadmap — บางส่วนอาจมีในฐานแล้ว)

### Phase 1 — เพิ่มได้เลย (ไม่กระทบระบบเดิม)

```sql
ALTER TABLE public.jt_shipments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE public.jt_shipments ADD COLUMN IF NOT EXISTS weight_kg numeric(6,2);
-- cod_amount อาจมีแล้ว — ตรวจก่อนรัน
ALTER TABLE public.jt_shipments ADD COLUMN IF NOT EXISTS cod_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.jt_shipments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.jt_shipments ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'standard';
```

| Field ใหม่ | ประโยชน์ | ความยาก |
|---|---|---|
| `status` | ติดตามสถานะพัสดุ, filter ใน Dashboard | 🟢 ง่าย |
| `weight_kg` | คำนวณค่าส่ง, วิเคราะห์น้ำหนักเฉลี่ย | 🟢 ง่าย |
| `cod_amount` | ติดตาม COD ที่ต้องเก็บเงินปลายทาง | 🟢 ง่าย |
| `notes` | หมายเหตุพิเศษจากพนักงาน | 🟢 ง่าย |
| `service_type` | แยกรายงานตามประเภทบริการ | 🟢 ง่าย |

### Phase 2 — เพิ่มแบบมี Relation

```sql
ALTER TABLE public.jt_shipments ADD COLUMN receiver_address text;
ALTER TABLE public.jt_shipments ADD COLUMN receiver_province text;
ALTER TABLE public.jt_shipments ADD COLUMN receiver_district text;
ALTER TABLE public.jt_shipments ADD COLUMN receiver_postal_code text;
ALTER TABLE public.jt_shipments ADD COLUMN branch_id bigint REFERENCES branches(id);
ALTER TABLE public.jt_shipments ADD COLUMN created_by text; -- ชื่อ/ID พนักงาน
```

### Phase 3 — ขั้นสูง (Multi-branch, ลูกค้าประจำ)

```sql
ALTER TABLE public.jt_shipments ADD COLUMN customer_id uuid REFERENCES customers(id);
ALTER TABLE public.jt_shipments ADD COLUMN vip_code text;
ALTER TABLE public.jt_shipments ADD COLUMN jt_confirmed_at timestamptz;
ALTER TABLE public.jt_shipments ADD COLUMN tracking_updated_at timestamptz;
```

---

## 🚀 Feature ที่สามารถสร้างต่อได้

### 1. 📊 Dashboard ขั้นสูง
- **กราฟ Donut** — สัดส่วน service_type (ธรรมดา/ด่วน)
- **Heat Map** — วันไหน/ชั่วโมงไหนส่งมากสุด
- **แผนที่จังหวัดปลายทาง** — Top 10 จังหวัดที่รับพัสดุ
- **COD Tracker** — ยอด COD ที่ค้างรับ vs รับแล้ว
- **เปรียบเทียบ** — สัปดาห์นี้ vs สัปดาห์ที่แล้ว

```
ไฟล์ที่ต้องสร้าง:
- app/admin/(dashboard)/jt-dashboard/page.tsx  ← แก้ไขเพิ่ม
- app/api/admin/jt-shipments/stats/route.ts    ← แก้ไขเพิ่ม field
```

### 2. 📤 Export ข้อมูล
- **Export CSV** — ส่งออกตามช่วงวันที่/ตัวกรอง
- **Export Excel** — รูปแบบ .xlsx พร้อม format
- **Print Report** — พิมพ์สรุปรายวัน

```
ไฟล์ที่ต้องสร้าง:
- app/api/admin/jt-shipments/export/route.ts
- ติดตั้ง: npm install xlsx (ติดตั้งแล้ว)
```

### 3. 🔍 ค้นหาขั้นสูง (Advanced Filter)
- Filter ตาม **status** (dropdown)
- Filter ตาม **service_type**
- Filter ตาม **จังหวัดผู้รับ**
- Filter ตาม **ช่วงค่าส่ง** (min–max)
- **บันทึก filter ที่ใช้บ่อย** (Saved Filters)

### 4. 👤 ระบบลูกค้าประจำ
- ค้นหาลูกค้าจากเบอร์โทร
- ดู **ประวัติการส่ง** ของลูกค้ารายนั้น
- ระบุ **VIP Code** ของ J&T
- **Auto-fill** ชื่อ/ที่อยู่จากประวัติ

```
ตาราง: customers (มีใน schema.sql แล้ว)
ไฟล์ที่ต้องสร้าง:
- app/admin/(dashboard)/customers/page.tsx
- app/api/admin/customers/route.ts
```

### 5. 🔔 การแจ้งเตือน
- **LINE Notification** — แจ้งเจ้าของเมื่อสิ้นวัน (จำนวน/ยอด)
- **Alert** — เมื่อ COD เกินยอดที่กำหนด
- **รายงานสรุปอัตโนมัติ** ผ่าน n8n ส่ง LINE ทุกเย็น

```
ENV ที่ต้องใช้: LINE_CHANNEL_ACCESS_TOKEN, LINE_ADMIN_USER_ID (มีแล้ว)
ไฟล์ที่ต้องสร้าง:
- app/api/admin/jt-shipments/daily-report/route.ts
- n8n Workflow: DailySummaryTrigger → HTTP → /api/admin/jt-shipments/daily-report
```

### 6. 📦 ระบบ Status Tracking
- UI อัปเดตสถานะแบบ Dropdown ในตาราง
- **Timeline** แสดงประวัติการเปลี่ยนสถานะ
- **Bulk Update** — เลือกหลายรายการแล้วเปลี่ยน status พร้อมกัน

```
ต้องเพิ่ม field ก่อน:
ALTER TABLE jt_shipments ADD COLUMN status text DEFAULT 'pending';

ไฟล์ที่ต้องสร้าง:
- app/api/admin/jt-shipments/[id]/status/route.ts
- อัปเดต: app/admin/(dashboard)/shipments/page.tsx (เพิ่ม status column)
```

### 7. 🤖 n8n Automation ที่แนะนำ

| Workflow | Trigger | ผลลัพธ์ |
|---|---|---|
| **Daily Sync** | ทุกวัน 00:00 | ดึง Excel → Import → แจ้ง LINE |
| **Weekly Report** | ทุกจันทร์ | สรุป 7 วัน → ส่ง LINE Owner |
| **COD Alert** | Real-time | ตรวจ COD สูงผิดปกติ → แจ้ง |
| **Backup** | ทุกคืน | Supabase → Google Sheets backup |

### 8. 📱 Mobile-Ready Improvements (แนะนำสำหรับทำงานผ่านสมาร์ตโฟน)

- หน้า `shipments` ควรมีโหมด mobile list (card view) แทนตารางเต็ม
- หน้า scan ควรมี fallback ช่องกรอกรหัส shipment/awb กรณีกล้องใช้งานไม่ได้
- action สำคัญควรอยู่แถบล่างคงที่: `บันทึก`, `ยืนยัน`, `ส่งเข้า J&T`
- ใส่ network badge (`ออนไลน์`, `รอเชื่อมต่อ`) เพื่อให้พนักงานรู้สถานะทันที
- เพิ่ม queue สำหรับ draft save ตอนเน็ตไม่เสถียร และ sync อัตโนมัติเมื่อกลับมาออนไลน์

```
ไฟล์ที่แนะนำให้ปรับ:
- app/admin/(dashboard)/shipments/page.tsx        ← ทำ responsive card layout
- app/admin/(dashboard)/shipments/ShipmentModal.tsx ← ลด field บังคับบนมือถือ
- app/(staff)/scan/page.tsx (หรือไฟล์ scan ปัจจุบัน) ← กล้อง + fallback input
```

---

## 🔧 Environment Variables ที่ต้องใช้เพิ่ม

| ตัวแปร | ใช้สำหรับ | มีแล้ว? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase connection | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations | ✅ |
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่ง LINE Notification | ✅ |
| `LINE_ADMIN_USER_ID` | ส่งถึง Owner | ✅ |
| `N8N_ORDER_WEBHOOK_URL` | Trigger n8n | ✅ |
| `JT_API_KEY` | J&T API จริง (อนาคต) | ❌ ต้องขอ |
| `JT_API_SECRET` | J&T API จริง (อนาคต) | ❌ ต้องขอ |

---

## 📁 โครงสร้างไฟล์ที่เกี่ยวข้อง

```
app/
├── admin/(dashboard)/
│   ├── page.tsx                    ✅ Shop Dashboard
│   ├── jt-dashboard/
│   │   └── page.tsx                ✅ J&T Dashboard
│   ├── shipments/
│   │   ├── page.tsx                ✅ CRUD Table
│   │   ├── ShipmentModal.tsx       ✅ Add/Edit Modal
│   │   └── ImportModal.tsx         ✅ Drag & Drop Import
│   ├── orders/                     ✅ Shop Orders
│   ├── products/                   ✅ Products
│   ├── bundles/                    ✅ Bundles
│   ├── customers/                  ⬜ TODO: ลูกค้าประจำ
│   └── reports/                    ⬜ TODO: รายงานสรุป
│
└── api/admin/
    ├── jt-shipments/
    │   ├── route.ts                ✅ GET/POST/PUT/DELETE
    │   ├── import/route.ts         ✅ Bulk Import
    │   ├── n8n-sync/route.ts       ✅ n8n Batch Sync
    │   ├── stats/route.ts          ✅ Dashboard Stats
    │   ├── export/route.ts         ⬜ TODO: CSV Export
    │   ├── daily-report/route.ts   ⬜ TODO: LINE Report
    │   └── [id]/status/route.ts    ⬜ TODO: Status Update
    └── customers/
        └── route.ts                ⬜ TODO
```

---

## 🗺️ Roadmap แนะนำ

```
Phase 1 (สัปดาห์นี้)
├── ✅ CRUD J&T Shipments
├── ✅ Dashboard Stats
├── ✅ Import Excel
├── ⬜ เพิ่ม field: status, weight_kg, cod_amount, notes
└── ⬜ Export CSV

Phase 2 (สัปดาห์หน้า)
├── ⬜ Status Dropdown ในตาราง
├── ⬜ Bulk Status Update
├── ⬜ Advanced Filter
└── ⬜ LINE Daily Report

Phase 3 (เดือนหน้า)
├── ⬜ ระบบลูกค้าประจำ + Auto-fill
├── ⬜ Dashboard แผนที่จังหวัด
├── ⬜ Multi-branch support
└── ⬜ J&T API Integration (ถ้าได้ key)
```

---

## 📝 หมายเหตุสำหรับนักพัฒนา

- **Auth**: ใช้ Cookie-based Admin Auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- **Supabase**: ใช้ `supabaseAdmin` (Service Role) ใน API routes เท่านั้น ห้ามใส่ service key ใน Client — หน้า `/admin/jt-dashboard` ปัจจุบันใช้ **anon browser client** (`@/lib/supabaseClient`) จึงต้องมี **RLS/policy** ที่อนุญาตอ่าน `jt_shipments` ตามที่ต้องการ (หรือย้าย metrics ไป API + service role)
- **สองที่ของ admin client**: `@/lib/supabaseAdmin` (throw ถ้าไม่มี key) vs `@app/lib/supabaseAdmin` (placeholder) — รายละเอียดใน `docs/jt-dashboard-data-sources.md`
- **Import**: ใช้ `xlsx` library parse ไฟล์ client-side ก่อน ส่งเป็น JSON ไป API
- **n8n Sync**: รับทั้ง `{ rows: [...] }` และ `[...]` array โดยตรง
- **Pagination**: ทุกหน้าที่มีข้อมูลเยอะใช้ server-side pagination ขนาด 50 ต่อหน้า
- **Mobile guideline**: อ้างอิงรายละเอียดเพิ่มเติมที่ `docs/mobile-operations-guide.md`
