# SmartShip — คลังพัสดุ J&T (J&T Warehouse Module)

> อัปเดต: 2026-05-28 | URL: `/admin/jt-warehouse`

หน้าสรุปพัสดุ J&T ที่อยู่ในคลัง/รอนำจ่าย — แยกตามสาขาและพนักงานนำจ่าย ข้อมูลถูก scrape อัตโนมัติด้วย Playwright ทุก 30-60 นาที ส่งผ่าน n8n เข้า Supabase

---

## 📍 ภาพรวม Pipeline

```
J&T Web Portal
    ↓ (Playwright scrape every 30-60min)
ไฟล์ .xlsx / .csv
    ↓ POST /api/admin/jt-parcel-n8n-upload?filename=...
Next.js API proxy (auth: admin-or-staff)
    ↓ multipart forward
n8n Webhook (https://n8n.mybabymeal.com/webhook/upload_stock)
    ↓ Extract from File → Edit Fields → Postgres
public.warehouse_jt_parcels (Supabase)
    ↓ RPC aggregation
หน้า /admin/jt-warehouse
```

---

## 🗂️ ไฟล์ในระบบ (สร้างใหม่ใน feature นี้)

### Backend / DB

| ไฟล์ | หน้าที่ |
|---|---|
| [database/db/migrations/20260528_warehouse_jt_parcels.sql](../database/db/migrations/20260528_warehouse_jt_parcels.sql) | สร้างตาราง `warehouse_jt_parcels` (62 columns, all text) + RLS + 3 indexes + trigger updated_at |
| [database/db/migrations/20260528_warehouse_jt_summary_rpc.sql](../database/db/migrations/20260528_warehouse_jt_summary_rpc.sql) | composite index + 2 RPC + 1 view สำหรับ aggregation |
| [app/api/admin/jt-parcel-n8n-upload/route.ts](../app/api/admin/jt-parcel-n8n-upload/route.ts) | API route โพรซี multipart ไป n8n webhook |

### Frontend (Admin Dashboard)

| ไฟล์ | หน้าที่ |
|---|---|
| [app/admin/(dashboard)/jt-warehouse/page.tsx](../app/admin/(dashboard)/jt-warehouse/page.tsx) | Server component — fetch 2 RPC + view ผ่าน `supabaseAdmin` |
| [app/admin/(dashboard)/jt-warehouse/BranchStaffView.tsx](../app/admin/(dashboard)/jt-warehouse/BranchStaffView.tsx) | Client UI — tab สาขา + ตารางพนักงาน + ค้นหา + banner "ยังอยู่ในคลัง" |
| [app/admin/(dashboard)/jt-warehouse/JtParcelN8nUpload.tsx](../app/admin/(dashboard)/jt-warehouse/JtParcelN8nUpload.tsx) | Modal upload สีส้ม J&T (copy pattern จาก TiktokN8nUpload) |
| [app/admin/(dashboard)/AdminSidebar.tsx](../app/admin/(dashboard)/AdminSidebar.tsx) | เพิ่ม NavItem 📦 "คลังพัสดุ J&T" ระหว่าง "โปรไฟล์ลูกค้า" กับ "คำสั่งซื้อ" |
| [app/admin/context/AdminLanguageContext.tsx](../app/admin/context/AdminLanguageContext.tsx) | เพิ่ม translation `nav.jtWarehouse` (th + en) |

---

## 🗄️ ตาราง `warehouse_jt_parcels`

**Primary key:** `awb_number` (เลขพัสดุ)
**ทุก column เป็น text** — รองรับ Excel serial date (`46170.32`), `"-"`, `""` โดยไม่ต้อง parse type ใน n8n

### กลุ่มฟิลด์ (62 columns)

| กลุ่ม | คอลัมน์ |
|---|---|
| **เขต/แฟรนไชส์** | `region_name`, `region_code`, `franchise_name`, `franchise_code` |
| **เวลา scan** | `gateway_dispatch_time`, `earliest_scan_time`, `latest_scan_time`, `arrived_branch_time`, `arrived_branch_name` |
| **นำจ่าย** ★ | `delivery_branch_code`, `delivery_branch_name`, `delivered_time`, `delivery_staff_id`, `delivery_staff_name`, `delivery_staff_position`, `delivery_staff_phone`, `is_assist_delivery` |
| **ตกค้าง** | `stuck_time`, `stuck_reason`, `stuck_scan_branch`, `stuck_flag` |
| **มีปัญหา** | `problem_time`, `problem_reason`, `problem_scan_branch` |
| **เข้าคลัง** | `warehouse_in_time`, `warehouse_in_branch`, `shop_name` |
| **เซ็นรับ** | `signed_time`, `sign_branch_name`, `signed_record_time`, `signed_by_staff`, `signer_name`, `sign_time_status`, `sign_branch_status`, `signed_flag` |
| **ตีกลับ** | `return_register_time`, `return_register_branch`, `return_signed_time`, `return_sign_branch`, `return_signer`, `return_flag` |
| **ปิดงาน** | `closed_branch`, `closed_time` |
| **ประเภท/เงิน** | `branch_type`, `order_source`, `parcel_type`, `product_type`, `service_type`, `billed_weight`, `payment_method`, `total_shipping_fee`, `cod_amount` |
| **ผู้ส่ง/รับ** | `sender_name`, `sender_customer`, `sender_phone`, `receiver_name`, `receiver_phone`, `receiver_address` |
| **อื่น** | `leftover_flag` (遗留件标识), `created_at`, `updated_at` |

### Indexes

- `awb_number` (PK)
- `delivery_branch_code` — filter ตามสาขา
- `(delivery_branch_code, delivery_staff_id)` — composite สำหรับ aggregate
- `(delivery_branch_code, signed_flag)` — filter สถานะ
- `created_at DESC` — เรียงล่าสุด

### Triggers

- `warehouse_jt_parcels_updated_at` — auto-set `updated_at = now()` ทุก UPDATE

---

## 🧮 RPC + View

### `get_warehouse_jt_branch_summary()`

สรุปต่อ**สาขา** สำหรับ tab cards (3 การ์ดบนสุด)

```sql
returns (
  delivery_branch_code, delivery_branch_name,
  parcel_count, staff_count,
  delivered_count, pending_count, stuck_count
)
```

- `staff_count` = DISTINCT `delivery_staff_id` ที่ไม่ว่าง
- `delivered_count` = `signed_flag = 'Y'`
- `pending_count` = `signed_flag IS NULL/empty/N'`

### `get_warehouse_jt_branch_staff_summary()`

สรุปต่อ**พนักงาน**ในแต่ละสาขา (เรียงตามจำนวนพัสดุมากสุด)

```sql
returns (
  delivery_branch_code, delivery_branch_name,
  delivery_staff_id, delivery_staff_name, delivery_staff_position, delivery_staff_phone,
  parcel_count, delivered_count, pending_count, stuck_count, cod_total
)
```

- **GROUP BY** `(delivery_branch_code, delivery_staff_id)` → row ที่ `staff_id` ว่าง = "พัสดุยังอยู่ในคลัง"
- `cod_total` = `SUM(NULLIF(cod_amount, '')::numeric)` รวมเงิน COD ของพัสดุที่ staff คนนี้รับผิดชอบ

### View `warehouse_jt_last_upload`

```sql
returns (
  last_uploaded_at,  -- MAX(updated_at)
  total_parcels,     -- COUNT(*)
  branch_count,      -- DISTINCT delivery_branch_code
  staff_count        -- DISTINCT delivery_staff_id (ไม่นับ empty)
)
```

---

## 🌐 n8n Field Mapping (Thai → snake_case)

ใช้ใน **Edit Fields node** ของ n8n workflow (`upload_stock` webhook) — ทุกฟิลด์ type = String

<details>
<summary>คลิกดู mapping ครบ 62 ฟิลด์</summary>

| Column ใน Supabase | Expression ใน n8n |
|---|---|
| `awb_number` ★ PK | `{{ $json['เลขพัสดุ'] }}` |
| `region_name` | `{{ $json['ชื่อเขต'] }}` |
| `region_code` | `{{ $json['รหัสเขต'] }}` |
| `franchise_name` | `{{ $json['ชื่อแฟรนไชส์'] }}` |
| `franchise_code` | `{{ $json['รหัสแฟรนไชส์'] }}` |
| `gateway_dispatch_time` | `{{ $json['เวลาเกทเวย์นำส่ง'] }}` |
| `earliest_scan_time` | `{{ $json['เวลาที่เร็วที่สุด'] }}` |
| `latest_scan_time` | `{{ $json['เวลาล่าสุด'] }}` |
| `arrived_branch_time` | `{{ $json['เวลาที่พัสดุถึงสาขา'] }}` |
| `arrived_branch_name` | `{{ $json['สาขาพัสดุถึง'] }}` |
| `delivery_branch_code` ★ | `{{ $json['รหัสสาขานำจ่าย'] }}` |
| `delivery_branch_name` | `{{ $json['ชื่อสาขานำจ่าย'] }}` |
| `delivered_time` | `{{ $json['เวลาที่นำจ่ายพัสดุ'] }}` |
| `delivery_staff_id` | `{{ $json['รหัสพนักงานนำจ่าย'] }}` |
| `delivery_staff_name` | `{{ $json['ชื่อของพนักงานนำจ่าย'] }}` |
| `delivery_staff_position` | `{{ $json['ตำแหน่งพนักงานนำจ่ายพัสดุ'] }}` |
| `delivery_staff_phone` | `{{ $json['เบอร์มือถือพนักงานนำจ่ายพัสดุ'] }}` |
| `is_assist_delivery` | `{{ $json['ช่วยนำจ่ายหรือไม่'] }}` |
| `stuck_time` | `{{ $json['เวลาที่พัสดุตกค้าง'] }}` |
| `stuck_reason` | `{{ $json['สาเหตุพัสดุตกค้าง'] }}` |
| `stuck_scan_branch` | `{{ $json['สาขาที่สแกนพัสดุตกค้าง'] }}` |
| `stuck_flag` | `{{ $json['สัญลักษณ์ตกค้าง'] }}` |
| `problem_time` | `{{ $json['เวลาพัสดุมีปัญหา'] }}` |
| `problem_reason` | `{{ $json['สาเหตุของพัสดุมีปัญหา'] }}` |
| `problem_scan_branch` | `{{ $json['สาขาที่สแกนพัสดุมีปัญหา'] }}` |
| `warehouse_in_time` | `{{ $json['เวลาที่สินค้าเข้าคลัง'] }}` |
| `warehouse_in_branch` | `{{ $json['สาขาที่สแกนรับเข้าคลัง'] }}` |
| `shop_name` | `{{ $json['ชื่อร้าน'] }}` |
| `signed_time` | `{{ $json['เวลาเซ็นรับ'] }}` |
| `sign_branch_name` | `{{ $json['สาขาเซ็นรับ'] }}` |
| `signed_record_time` | `{{ $json['เวลาการบันทึกเซ็นรับพัสดุ'] }}` |
| `signed_by_staff` | `{{ $json['(พนักงานนำจ่ายพัสดุ)เซ็นรับพัสดุ'] }}` |
| `signer_name` | `{{ $json['ผู้เซ็นรับ'] }}` |
| `return_register_time` | `{{ $json['เวลาลงทะเบียนพัสดุตีกลับ'] }}` |
| `return_register_branch` | `{{ $json['สาขาลงทะเบียนตีกลับ'] }}` |
| `return_signed_time` | `{{ $json['เวลาเซ็นรับพัสดุตีกลับ'] }}` |
| `return_sign_branch` | `{{ $json['เซ็นรับพัสดุตีกลับ (สาขา)'] }}` |
| `return_signer` | `{{ $json['ผู้เซ็นรับพัสดุตีกลับ'] }}` |
| `closed_branch` | `{{ $json['สาขาที่ปิดงาน'] }}` |
| `closed_time` | `{{ $json['เวลาที่ปิดงาน'] }}` |
| `branch_type` | `{{ $json['ประเภทสาขา'] }}` |
| `order_source` | `{{ $json['แหล่งที่มาคำสั่งซื้อ'] }}` |
| `parcel_type` | `{{ $json['ประเภทพัสดุ'] }}` |
| `billed_weight` | `{{ $json['น้ำหนักที่ใช้คิดเงิน'] }}` |
| `payment_method` | `{{ $json['วิธีการชำระเงิน'] }}` |
| `total_shipping_fee` | `{{ $json['ค่าขนส่งทั้งหมด'] }}` |
| `cod_amount` | `{{ $json['COD'] }}` |
| `sender_name` | `{{ $json['ผู้ส่ง'] }}` |
| `sender_customer` | `{{ $json['ลูกค้าผู้ส่ง'] }}` |
| `sender_phone` | `{{ $json['เบอร์โทรผู้ส่ง'] }}` |
| `receiver_name` | `{{ $json['ผู้รับ'] }}` |
| `receiver_phone` | `{{ $json['เบอร์มือถือผู้รับ'] }}` |
| `receiver_address` | `{{ $json['ที่อยู่ผู้รับ'] }}` |
| `return_flag` | `{{ $json['สัญลักษณ์ตีกลับ'] }}` |
| `product_type` | `{{ $json['ประเภทสินค้า'] }}` |
| `service_type` | `{{ $json['ประเภทค่าบริการเสริม'] }}` |
| `sign_time_status` | `{{ $json['สถานะเวลาเซ็นรับ'] }}` |
| `sign_branch_status` | `{{ $json['สถานะสาขาเซ็นรับ'] }}` |
| `signed_flag` | `{{ $json['สัญลักษณ์เซ็นรับ'] }}` |
| `leftover_flag` | `{{ $json['遗留件标识'] }}` |

</details>

**ข้อระวัง:** ตั้ง type ทุกฟิลด์เป็น **String** ใน Edit Fields (หรือเปิด "Ignore Type Conversion Errors" ใน Settings)

---

## 🔄 Upload Strategy: Snapshot Mode (เลือกแล้ว)

**ที่ตัดสินใจ:** DB ตรงกับไฟล์ล่าสุดเสมอ (snapshot ล้วน) ไม่สะสมประวัติ

**ที่ทำใน n8n:** เพิ่ม **TRUNCATE node** ก่อน Insert node เดิม

```
[Webhook] → [Extract from File] → [Edit Fields]
   → [⚡ Postgres Execute Query: TRUNCATE TABLE public.warehouse_jt_parcels]
   → [Loop Over Items] → [Postgres Insert rows]
```

**Trade-off ที่ยอมรับ:** ระหว่าง TRUNCATE → INSERT จบ (30-60s) table ว่าง — ถ้ามีคนเปิดหน้าในช่วงนั้นจะเห็น "ยังไม่มีข้อมูล" ชั่วครู่

**Upgrade path (ถ้าเจอปัญหา race condition):**
- สร้าง `warehouse_jt_parcels_staging` table
- Insert ทุก row ลง staging
- หลังจบ → atomic swap ภายใน `BEGIN; TRUNCATE main; INSERT FROM staging; COMMIT;`

---

## 🎨 UI Layout (`/admin/jt-warehouse`)

```
┌─────────────────────────────────────────────┐
│ 📦 คลังพัสดุ J&T                  [📄 อัปโหลด]│  ← AdminPageHeader
├─────────────────────────────────────────────┤
│ Meta: อัปเดต 13 นาที | 4,705 | 1 สาขา | 26 พนักงาน [🔄 รีเฟรช]│
├─────────────────────────────────────────────┤
│ [การ์ดสาขา 604320] [การ์ดสาขา 604590] [...]  │  ← grid 3 cols, คลิกสลับ tab
├─────────────────────────────────────────────┤
│ 🏢 ยังอยู่ในคลัง: 2,415 ชิ้น   COD ฿230,974.41│  ← banner (เฉพาะตอนมี unassigned)
├─────────────────────────────────────────────┤
│ พนักงานนำจ่าย (26 คน)            [🔍 ค้นหา]   │
│ ──────────────────────────────────────────  │
│ พนักงาน      | รหัส/เบอร์   | พัสดุ | สำเร็จ | ค้าง | ตกค้าง | COD รวม │
│ Parinya      | 604320T...   | 234  | 0     | 234 | —     | ฿23,215│
│ Piyachat     | 604320T...   | 233  | 34    | 199 | —     | ฿13,697│
│ ...                                                       │
└─────────────────────────────────────────────┘
```

**Logic แยกแถว "พนักงาน" vs "ยังอยู่ในคลัง":**
- `delivery_staff_id` มีค่า → แสดงในตารางพนักงาน
- `delivery_staff_id` ว่าง/null → แสดงเป็น banner ด้านบน (พัสดุที่ยังไม่ได้ assign)

---

## 🔐 Auth + Env Vars

### Middleware
- `/admin/jt-warehouse` ป้องกันด้วย admin auth เดิม (middleware.ts protect `/admin/:path*`)
- ไม่ได้เพิ่มใน `staff` restricted routes → staff เข้าถึงได้

### Env Vars (Vercel + .env.local)
```
JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL=https://n8n.mybabymeal.com/webhook/upload_stock
NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB=4.5  # optional, default 4.5
```

API route `/api/admin/jt-parcel-n8n-upload` ใช้:
- `requireAdminApiAuth('admin-or-staff', request)` — กันคนนอก
- `maxDuration = 300` — รอ n8n นาน ๆ ได้

---

## 🧪 Verify Queries

```sql
-- ดูจำนวนรวม
select count(*) from warehouse_jt_parcels;

-- แยกตามสาขา
select delivery_branch_code, count(*)
from warehouse_jt_parcels
group by delivery_branch_code
order by count desc;

-- ลองเรียก RPC
select * from warehouse_jt_last_upload;
select * from get_warehouse_jt_branch_summary();
select * from get_warehouse_jt_branch_staff_summary() limit 10;

-- พัสดุที่ยังไม่ assign พนักงาน
select count(*) from warehouse_jt_parcels
where delivery_staff_id is null or delivery_staff_id = '';
```

---

## 📚 ที่มา / Pattern อ้างอิง

- **ตาราง pattern**: เลียนแบบ [`tiktok_shipments`](../database/db/migrations/20260521_tiktok_shipments.sql) (ทุก column เป็น text)
- **API route pattern**: คล้าย [`/api/admin/tiktok-n8n-upload`](../app/api/admin/tiktok-n8n-upload/route.ts)
- **Upload modal pattern**: คล้าย [`TiktokN8nUpload`](../app/admin/(dashboard)/tiktok-dashboard/TiktokN8nUpload.tsx) (เปลี่ยนสีจาก rose → orange)
- **Tab pattern**: คล้าย [`DeepDiveDashboardTabs`](../app/admin/(dashboard)/jt-deep-dive-dashboard/DeepDiveDashboardTabs.tsx)

---

## ⏭️ TODO / Future Work

- [ ] Migrate snapshot strategy → staging table + atomic swap (ถ้าเจอ race condition)
- [ ] เพิ่ม date filter (วันนี้ / เมื่อวาน / 7 วัน)
- [ ] เพิ่มกราฟ trend จำนวนพัสดุรายวัน
- [ ] Click พนักงาน → modal แสดง parcel list
- [ ] Export ตารางพนักงานเป็น Excel
- [ ] Alert ถ้าพัสดุค้างคลังเกินเกณฑ์ (เช่น > 5,000 ชิ้น)
