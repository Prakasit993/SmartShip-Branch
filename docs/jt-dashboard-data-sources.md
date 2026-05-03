# J&T Dashboard — แหล่งข้อมูล ข้อจำกัด และข้อควรระวัง (ไม่ให้สับสนหรือจอยข้อมูล)

อัปเดต: 2026-05-02 — ใช้คู่กับ `docs/jt-admin-guide.md` — เพิ่มแมป schema `jt_shipments` เต็มรูปแบบ

จุดประสงค์ของเอกสารนี้คือให้ทีมรู้ว่า **dashboard ดึงเลขจากไหน**, **ใช้คีย์อะไร**, และ **ทำไมตัวเลขสองที่ถึงไม่เท่ากัน** ถ้าไม่ได้ออกแบบให้ตรงกัน

---

## การตรวจ `public.jt_shipments` บน Supabase (หัวคอลัมน์ / ชนิดข้อมูล)

**ใน repo นี้ไม่มีไฟล์ migration ที่สร้างตาราง `jt_shipments` ตั้งแต่ต้น** — โครงสร้างจริงอยู่ที่โปรเจกต์ Supabase ของคุณเท่านั้น การ “ตรวจสอบ” ที่ทำได้คือ:

| วิธี | ทำอย่างไร |
|------|------------|
| **Table Editor** | ดูแท็บคอลัมน์เหมือนที่คุณแคป — ได้ชื่อฟิลด์ + `data_type` ทันที |
| **SQL** | `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jt_shipments' ORDER BY ordinal_position;` |
| **ผ่านแอป** | RPC **`jt_shipments_import_columns()`** (เรียกจาก API import ด้วย service role) คืนชื่อคอลัมน์กับชนิดจาก `information_schema` เหมือนใน Editor |

### สิ่งที่สอดคล้องกับภาพหน้าจอ Supabase ที่ตรวจได้ (ตัวอย่างจากการใช้งานจริง)

จาก screenshot Table Editor ของโปรเจกต์คุณ **คอลัมน์ที่เห็นเป็นชนิด `text` ทั้งหมด** ได้แก่ `awb_number`, `booking_date`, `sender_name`, `sender_phone`, `receiver_name`, `receiver_phone`, `shipping_fee` และมีไอคอนกุญแจที่ `awb_number` (ใช้เป็น **primary key** / unique identifier ของแถว)

**ผลต่อการทำ dashboard / aggregate**

- **`shipping_fee` เป็น text** → ทุกที่ที่คำนวณยอดเงินต้อง **parse เป็นตัวเลข** (ฝั่งแอปใช้ `Number()` / regex ก่อนคิดเฉลี่ยหรือรวม) — ตรงกับที่ RPC `jt_shipment_daily_stats_utc` ทำอยู่แล้ว (ดึงตัวเลขจากสตริงด้วย `regexp_replace`).
- **`booking_date` เป็น text** → “วันที่” ไม่ใช่ชนิด `timestamptz`/`date` ใน DB — การจัดกลุ่มรายวันควรใช้กฎเดียวกันกับที่ใช้ใน SQL (เช่น prefix `YYYY-MM-DD` หรือ cast ที่ Postgres ยอมรับ).
- **RPC สองแบบใน repo ไม่เหมือนกันเรื่อง text:**
  - **`jt_shipment_daily_stats_utc`** — ออกแบบให้ยืดหยุ่นกับ **ข้อความ** `booking_date` (ตัดวันที่จากต้นสตริง).
  - **`jt_shipment_daily_counts_utc`** — ใช้ `(booking_date AT TIME ZONE 'UTC')::date` ซึ่งสมมติว่าค่าแปลงเป็น timestamp ได้สม่ำเสมอ — ถ้า `booking_date` เป็น text รูปแบบซับซ้อน อาจได้ผลต่างจากฟังก์ชันแรกหรือเกิด error — **ควรพึ่ง `jt_shipment_daily_stats_utc` + stats API** เป็นหลักเมื่อคอลัมน์เป็น text.

สรุป: **ตรวจหัวข้อ `@supabase` / `public.jt_shipments` ได้** โดยใช้ Editor / SQL / RPC ด้านบน — agent ไม่มีสิทธิ์เชื่อมต่อโปรเจกต์ของคุณโดยตรง จึงยืนยันได้จาก **repo + ภาพหน้าจอ + migration** เท่านั้น

---

## DDL อ้างอิง `public.jt_shipments` และสิ่งที่ Dashboard เชื่อมได้

ด้านล่างเป็น schema ที่คุณใช้เป็นแหล่งอ้างอิง (เกือบทุกฟิลด์เป็น **`text`** — ต้อง parse ก่อนคำนวณ) และมี **`created_at` / `updated_at`** เป็น `timestamptz` เท่านั้น

- **Primary key**: `awb_number` (text, NOT NULL)
- **คอลัมน์เสริมจาก migration ใน repo** (อาจมีในฐานของคุณแล้ว): `platform` — ใช้แยกช่องทาง Shopee/TikTok ฯลฯ (ดู `20260502_jt_shipments_platform.sql`)

### แกนเวลา — ใช้จัด “รายวัน / รายสัปดาห์ / รายเดือน / รายปี”

| คอลัมน์ | ชนิด | ใช้ทำอะไรใน Dashboard | หมายเหตุ |
|---------|------|-------------------------|----------|
| **`booking_date`** | text | **แกนหลัก** สำหรับ “พัสดุตามวันที่จอง” — รายวัน / ต่อยอดเป็น สัปดาห์·เดือน·ปี | ใช้กฎเดียวกับ RPC `jt_shipment_daily_stats_utc` (ตัด `YYYY-MM-DD` จากต้นสตริง). เหมาะกับกราฟแนวโลจิสติกส์ |
| **`created_at`** | timestamptz | “เมื่อแถวถูกสร้างในระบบ” — aggregate ด้วย `date_trunc('day'|'week'|'month'|'year', created_at)` ใน SQL ได้ตรงๆ | ถ้าต้องการรายงานตาม **เวลาเข้าระบบ** ไม่ใช่วันจองบนป้าย J&T |
| **`updated_at`** | timestamptz | เหมือนกัน — เหมาะกับ “การเปลี่ยนแปลงล่าสุด” | ไม่ใช่ยอดขายตามวันจอง |
| **`latest_scan_time`** | text | ไทม์ไลน์สถานะล่าสุด | parse เป็นเวลาก่อน bucket — ระวังรูปแบบไม่สม่ำเสมอ |
| **`collected_time`**, **`signed_time`**, **`dispatch_time`**, **`cod_payment_time`**, **`issue_registered_time`** | text | KPI ตามเหตุการณ์ (เก็บพัสดุ / ลงนาม / ส่งออก / จ่าย COD / แจ้งปัญหา) | ต้องนิยามธุรกิจให้ชัดว่าใช้ฟิลด์ไหนเป็น “วันที่สำเร็จ” |
| **`gateway_received_weight`** … (ฟิลด์เวลาใน DDL) | text | เฉพาะกรณีที่ต้องรายงานตามขั้นตอนคลัง | เช่นเดียวกัน — parse ก่อน |

**การต่อยอดจาก “รายวัน” → สัปดาห์ / เดือน / ปี**

- **รายวัน**: มีโครงใน **`jt_shipment_daily_stats_utc`** + API stats อยู่แล้ว (นับ + รวม `shipping_fee` ต่อวัน UTC จาก `booking_date` text).
- **รายสัปดาห์ / เดือน / ปี**: ทำได้โดย **rollup** จากผลรายวัน (sum/count ในแอปหรือ SQL `GROUP BY`) หรือเขียน RPC ใหม่ที่ `GROUP BY date_trunc('week', day::timestamp)` เป็นต้น — **ต้องกำหนดว่าอาทิตย์เริ่มวันไหน** (เช่น ISO week จันทร์) ให้ตรงกันทั้งระบบ.

### ยอดเงิน / ค่าใช้จ่ายโลจิสติกส์ (parse text → numeric)

คอลัมน์เหล่านี้เหมาะกับ **สรุปยอดรวม / เฉลี่ย / เปรียบเทียบช่วงเวลา** (คู่กับแกนเวลาด้านบน)

| คอลัมน์ | ความหมายโดยประมาณใน Dashboard |
|---------|--------------------------------|
| **`shipping_fee`** | ค่าส่งหลัก — ใช้ในกราฟรายวัน (มี RPC อยู่แล้ว) |
| **`total_shipping_fee`** | ค่าส่งรวม (ถ้ามีความหมายแยกจาก shipping_fee) — ต้องตกลงธุรกิจว่าใช้ฟิลด์ไหนเป็น KPI หลัก |
| **`cod_amount`** | ยอด COD — “ยอดเก็บปลายทาง” ตามช่วงเวลา |
| **`remote_area_fee`** | ค่าพื้นที่ห่างไกล |
| **`return_fee`** | ค่าธรรมเนียมตีกลับ |
| **`insurance_fee`** | ค่าประกัน |
| **`other_fees`** | ค่าอื่นๆ |
| **`discount_amount`** | ส่วนลด |
| **`amount_before_discount`** | ยอดก่อนส่วนลด (benchmark) |

คำว่า **“ยอดขายรายวัน / รายเดือน …”** ในโลจิสติกส์มักหมายถึง **ยอด COD + ค่าบริการที่เก็บได้** — ต้องนิยามสูตร เช่น `cod_amount + shipping_fee` หรือใช้เฉพาะ `cod_amount` แล้วแยกกราฟค่าส่ง — **เขียนลง product spec** เพื่อไม่สลับสับกับร้านค้าปลีกแบบ ecommerce

### ปริมาณ / น้ำหนัก / ขนาด (สำหรับค่าเฉลี่ยหรือกระจาย)

ตัวอย่าง: `avg_weight`, `volumetric_weight`, `billed_weight`, `order_weight`, `received_weight`, `parcel_volume`, `total_height`, `width`, `length`, … และฟิลด์ gateway/received — **ทั้งหมด text** → parse แล้วคิดค่าเฉลี่ยตามช่วงเวลาหรือตามจังหวัดได้

### ภูมิศาสตร์และช่องทาง

| คอลัมน์ | Dashboard ที่ทำได้ |
|---------|---------------------|
| **`dest_province`**, **`dest_district`**, **`dest_zipcode`** | Top จังหวัด / เขต / รหัสไปรษณีย์ — heatmap / แท่งเปรียบเทียบ |
| **`order_source`** | แยกตามแหล่งออเดอร์ |
| **`shop_name`** | แยกตามร้าน / แบรนด์ |
| **`platform`** (ถ้ามีจาก migration) | แยก marketplace vs ช่องทางอื่น |

### สถานะการขนส่ง / COD / ปัญหา / ตีกลับ

| คอลัมน์ | ตัวอย่างการใช้ |
|---------|----------------|
| **`latest_scan_type`** | สัดส่วนสถานะล่าสุด, นับคีย์เวิร์ด “ตีกลับ” / Return |
| **`cod_status`**, **`cod_payment_method`**, **`cod_payment_time`** | วงจร COD — ค้างเก็บ / จ่ายแล้ว, funnel |
| **`issue_status`**, **`exception_reason`** | ปัญหาในระบบ — top เหตุผล |
| **`return_type`**, **`return_branch_name`** | ประเภทและจุดรับคืน |
| **`delivery_method`** | แยกประเภทจัดส่ง |

### ตารางสรุป: ประเภทรายงาน × ข้อมูลที่เชื่อมได้

| ความต้องการ Dashboard | เชื่อมจาก `jt_shipments` (หลัก) | หมายเหตุ |
|------------------------|-----------------------------------|----------|
| **จำนวนพัสดุรายวัน** | `booking_date` → bucket วัน | มี RPC + stats API |
| **รายสัปดาห์ / รายเดือน / รายปี** | rollup จากรายวัน หรือ `date_trunc` บนวันที่ parse แล้ว | กำหนด timezone และวันเริ่มสัปดาห์ให้ชัด |
| **ยอด COD รายวัน·เดือน** | `cod_amount` + แกนเวลา `booking_date` | ควร RPC sum (parse text ใน SQL) |
| **ค่าส่งรวม / เฉลี่ยตามช่วง** | `shipping_fee`, `total_shipping_fee` | ระบุว่าใช้ฟิลด์ไหนเป็น KPI |
| **“ยอดขาย” รวม (โลจิสติกส์)** | สูตรที่ตกลง + ฟิลด์เงินด้านบน | ไม่มีฟิลด์เดียวชื่อ sale — ประกอบจากหลายคอลัมน์ |
| **สัดส่วนตีกลับ** | `latest_scan_type`, `return_type` | นิยามคีย์เวิร์ด / ค่า enum |
| **Top จังหวัดปลายทาง** | `dest_province` + count หรือ sum fee |
| **แยกช่องทาง** | `order_source`, `shop_name`, `platform` |

เมื่อออกแบบฟีเจอร์ใหม่ ให้อัปเดตตารางใน section นี้และ section **5–6** ด้านล่างให้สอดคล้องกัน

---

## 1. สรุปภาพรวม: มีสอง “ทาง” หลักในการเข้าถึง `jt_shipments`

| ทาง | ไคลเอนต์ | ที่ใช้ในโค้ด | ข้าม RLS ไหม | เหมาะกับ |
|-----|-----------|----------------|---------------|-----------|
| **A — เบราว์เซอร์ (ผู้ใช้ล็อกอิน)** | `createBrowserClient` → `@/lib/supabaseClient` | หน้า `/admin/jt-dashboard` (ปัจจุบัน) | **ไม่** — ตาม policy | UI ที่โหลดจากฝั่งลูกข่าย |
| **B — เซิร์ฟเวอร์ (แอดมิน)** | Service Role → `@/lib/supabaseAdmin` (`src/lib/supabaseAdmin.ts`) | `app/api/admin/jt-shipments/*`, import, stats | **ใช่** | API routes, import, aggregate หนัก |

**หลักการง่ายๆ**

- ถ้าอ่านจาก **ทาง A** แล้วได้น้อยกว่าที่คาด → เช็ค **RLS / policy** ว่าอนุญาต `SELECT` แถวที่ต้องการหรือไม่.
- ถ้าต้องการ **ยอดรวมที่ตรงกับฐานข้อมูลทั้งก้อน** และไม่พึ่ง policy ฝั่งผู้ใช้ → ควรใช้ **ทาง B** (เช่น route under `/api/admin/...`) หรือ RPC ที่รันเป็น `service_role`.

---

## 2. ไฟล์ `supabaseAdmin` ใน repo — มีมากกว่าหนึ่งที่ (อย่าสับสน)

โปรเจกต์มี client แบบ service role **สองแบบที่ path ต่างกัน**:

| Path | พฤติกรรมเมื่อไม่มี `SUPABASE_SERVICE_ROLE_KEY` | ใช้ที่ไหนบ้าง (ตัวอย่าง) |
|------|--------------------------------------------------|---------------------------|
| **`src/lib/supabaseAdmin.ts`** (`@/lib/supabaseAdmin`) | **throw** ตอนโหลดโมดูลถ้าไม่มี URL/key | `app/api/admin/jt-shipments/import`, `stats`, CRUD API |
| **`app/lib/supabaseAdmin.ts`** (`@app/lib/supabaseAdmin`) | **warn** แล้วใช้สตริง `'placeholder'` — คำขอจะล้มเหลวตอนรัน | บาง `app/actions`, `order-success`, `categories/actions` |

**คำแนะนำเวลาทำ dashboard / รายงาน**

- สำหรับ aggregate และความสม่ำเสมอ — **พึ่ง `@/lib/supabaseAdmin`** (โฟลเดอร์ `src`) ใน API route.
- อย่าสมมติว่า `@app/lib/supabaseAdmin` จะ fail-fast เหมือนกันใน dev — อาจได้ error แบบงงๆ ตอนเรียก DB.

---

## 3. Migration `20260503_jt_shipments_columns_rpc.sql` — ทำอะไร (และไม่ได้ทำอะไร)

ฟังก์ชัน **`jt_shipments_import_columns()`**

- **คืนค่า**: รายชื่อคอลัมน์จริงของตาราง `public.jt_shipments` จาก `information_schema` (`column_name`, `data_type`).
- **จุดประสงค์**: ให้ UI **Import** และ logic แบบ dynamic รู้ว่าตารางมีฟิลด์อะไรบ้าง (ไม่ต้อง hard-code รายการคอลัมน์ในโค้ดแบบตายตัว).
- **ความปลอดภัย**: `SECURITY DEFINER`, `REVOKE` จาก `PUBLIC`, **`GRANT EXECUTE` เฉพาะ `service_role`** — ฝั่งเบราว์เซอร์เรียก RPC นี้โดยตรง **ไม่ได้** (ต้องผ่าน API ที่ใช้ service role).
- **ไม่ได้**: คำนวณสถิติ dashboard, ไม่ได้ sum COD, ไม่ได้นับกราฟรายวัน.

สรุป: migration นี้ช่วยเรื่อง **schema discovery สำหรับ import** — ไม่ใช่แหล่ง metrics ของกราฟหลัก.

---

## 4. RPC อื่นที่เกี่ยวกับ “รายวัน / UTC” (เกี่ยวข้องกับ dashboard แบบกราฟ)

ไฟล์เหล่านี้อยู่ใน `database/db/migrations/`:

| ฟังก์ชัน | ไฟล์มิเกรชัน | บทบาท |
|----------|----------------|--------|
| `jt_shipment_daily_stats_utc(p_start, p_end)` | `20260505_jt_shipment_daily_stats_utc.sql` | นับแถว + รวม `shipping_fee` **ต่อวันปฏิทิน UTC** โดยดึง prefix วันที่จาก **ข้อความ** `booking_date` (ยืดหยุ่นกับข้อมูลเก็บเป็น text) |
| `jt_shipment_daily_counts_utc(p_start, p_end)` | `20260504_jt_shipment_daily_counts_utc.sql` | นับแถวต่อวัน UTC โดยใช้ `(booking_date AT TIME ZONE 'UTC')::date` — **สมมติว่า `booking_date` เป็นชนิดที่แปลงเป็น timestamptz ได้สม่ำเสมอ** |

**ข้อควรระวัง (สำคัญ)**

- ถ้าในฐานข้อมูลจริง `booking_date` เป็น **text** หลากรูปแบบ — ฟังก์ชันที่ใช้ `AT TIME ZONE` กับฟังก์ชันที่ใช้ `substring` อาจให้ **ความหมาย “วัน” ไม่เหมือนกัน** ถ้าไม่ได้ normalize ข้อมูล.
- API **`GET /api/admin/jt-shipments/stats`** ใช้ **`jt_shipment_daily_stats_utc`** (และมี fallback ดึงแถวใน PostgREST ถ้า RPC ไม่พร้อม) — การออกแบบกราฟในแอปควรอิงกฎเดียวกับ RPC/fallback นั้น (ดูโค้ดใน `app/api/admin/jt-shipments/stats/route.ts`).

---

## 5. หน้า `/admin/jt-dashboard` ปัจจุบันทำอะไรได้บ้าง

จากการออกแบบล่าสุด (client component + `@/lib/supabaseClient`):

| ความสามารถ | วิธีคิดข้อมูล |
|-------------|----------------|
| จำนวนพัสดุทั้งหมด | `count` head query บน `jt_shipments` (ผ่าน RLS) |
| รวม COD / ค่าส่งเฉลี่ย (เฉพาะแถว `shipping_fee > 0`) / นับตีกลับ | **วนดึงแถวทีละหน้า** (เช่น 1,000 แถว) แล้วคำนวณฝั่ง client |
| 5 รายการล่าสุด | `select` + `order booking_date desc` + `limit 5` |

**ข้อจำกัด**

- ถ้าตารางใหญ่มาก การวนคำนวณยอดรวมฝั่ง client จะ **ช้าและเปลืองแบนด์วิดท์** — ควรย้ายไป **RPC หรือ API + service_role** เมื่อข้อมูลโต.
- ตัวเลขบน UI นี้จะ **สะท้อน policy RLS** — อาจไม่เท่ากับรายงานที่รันด้วย service role บนเซิร์ฟเวอร์.

---

## 6. ทำอะไรต่อใน dashboard ได้บ้าง (แนวทางที่สอดคล้องข้อมูล)

| เป้าหมาย | แนวทางที่แนะนำ |
|----------|----------------|
| กราฟรายวัน / ช่วงเดือน / rolling window | ใช้ **`GET /api/admin/jt-shipments/stats`** + RPC `jt_shipment_daily_stats_utc` (มีอยู่แล้ว) เพื่อให้สอดคล้องกับ “วัน UTC” |
| ยอดรวม COD / marketplace split / channel | เพิ่ม **RPC aggregate** ใหม่ หรือ view — หลีกเลี่ยงโหลดทุกแถวไปคำนวณในเบราว์เซอร์ |
| รู้ว่าตารางมีคอลัมน์อะไรสำหรับ mapping import | ใช้ **`jt_shipments_import_columns()`** ผ่าน API import (service_role อยู่แล้ว) |
| คอลัมน์ `platform` | มี migration เพิ่มคอลัมน์ — เหมาะกับ breakdown ตามช่องทางใน dashboard ภายหลัง |

---

## 7. เช็คลิสต์กันจอยข้อมูล (metrics ไม่ตรงกัน)

1. **ชั้นของการเข้าถึง**: เปรียบเทียบเลขจาก **browser** กับ **SQL ใน Supabase SQL Editor** — ถ้า SQL ได้มากกว่า มักเป็นเพราะ **RLS**.
2. **นิยาม “วัน”**: กราฟรายวันควรใช้ **UTC calendar day** เหมือน RPC/stats API — อย่าผสม local timezone ของเซิร์ฟเวอร์กับ UTC โดยไม่ตั้งใจ.
3. **รูปแบบ `booking_date`**: ถ้ายังเป็น text หลายรูปแบบ — normalize ที่ import หรือใช้ฟังก์ชันเดียวกับฐานในการตัดวัน.
4. **เฉลี่ยค่าส่ง**: ชัดเจนว่าหารจาก **ทุกแถว** หรือ **เฉพาะ `shipping_fee > 0`** — คนละคำตอบ.
5. **สองไฟล์ `supabaseAdmin`**: ตอนดีบัก production ให้ยืนยันว่า `SUPABASE_SERVICE_ROLE_KEY` ตั้งค่าถูก และ route ที่ใช้คือ `@/lib/supabaseAdmin` ตามที่ต้องการ.

---

## 8. Environment ที่เกี่ยวข้อง

| ตัวแปร | ใช้กับ |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ทั้ง browser client และ service client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser (`supabaseClient`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabaseAdmin` — **ห้ามใส่ใน client bundle** |

---

## 9. ลิงก์โค้ดอ้างอิง

| หัวข้อ | ตำแหน่งไฟล์ |
|--------|-------------|
| Import เรียก RPC คอลัมน์ | `app/api/admin/jt-shipments/import/route.ts` (`jt_shipments_import_columns`) |
| สถิติ + กราฟรายวัน (เซิร์ฟเวอร์) | `app/api/admin/jt-shipments/stats/route.ts` |
| ไคลเอนต์เบราว์เซอร์ | `src/lib/supabaseClient.ts` |
| Service role (เข้มงวด) | `src/lib/supabaseAdmin.ts` |
| Service role (ยืดหยุ่น build) | `app/lib/supabaseAdmin.ts` |

เมื่อเพิ่มฟีเจอร์ dashboard ใหม่ ให้อัปเดต **ตารางในหมวด 5–6** ของเอกสารนี้เป็นประจำ เพื่อให้ทีมอื่นไม่ต้องเดาที่มาของตัวเลขอีก.

---

## 10. ตัวอย่าง (SQL / API) — คัดลอกไปทดลองใน Supabase หรือโค้ด

### 10.1 เรียก RPC สถิติรายวัน (ตรงกับกราฟในแอป)

ช่วงวันที่เป็น **ปฏิทิน UTC** (`date`)

```sql
SELECT day, cnt, fee_sum
FROM public.jt_shipment_daily_stats_utc(
  '2026-05-01'::date,
  '2026-05-31'::date
)
ORDER BY day;
```

### 10.2 Rollup เป็นรายเดือนจากผลรายวัน (ไม่ต้องเขียน RPC ใหม่ในขั้นแรก)

แนวคิด: aggregate ซ้ำใน SQL โดยใช้ `date_trunc('month', day::timestamp)` บนผลของฟังก์ชันด้านบน

```sql
WITH daily AS (
  SELECT *
  FROM public.jt_shipment_daily_stats_utc('2026-01-01'::date, '2026-12-31'::date)
)
SELECT
  date_trunc('month', day::timestamp AT TIME ZONE 'UTC') AS month_utc,
  SUM(cnt) AS parcels,
  SUM(fee_sum) AS total_shipping_fee
FROM daily
GROUP BY 1
ORDER BY 1;
```

### 10.3 รายสัปดาห์ (ISO: สัปดาห์เริ่มจันทร์ — `isoyear` / `week`)

จาก **แถวดิบ** ถ้าตัดวันที่จาก `booking_date` text แบบเดียวกับ RPC:

```sql
WITH d AS (
  SELECT
    (substring(trim(booking_date) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date AS day
  FROM public.jt_shipments
  WHERE booking_date IS NOT NULL
    AND substring(trim(booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})') IS NOT NULL
)
SELECT
  date_trunc('week', day::timestamp)::date AS week_start_monday,
  COUNT(*) AS parcels
FROM d
GROUP BY 1
ORDER BY 1;
```

> ถ้า Postgres ของคุณใช้ `SET datestyle` คนละแบบ ให้ทดสอบผล `week_start_monday` ก่อนนำไป production

### 10.4 Top จังหวัดปลายทาง (นับพัสดุ)

```sql
SELECT
  NULLIF(trim(dest_province), '') AS province,
  COUNT(*) AS cnt
FROM public.jt_shipments
GROUP BY 1
HAVING NULLIF(trim(dest_province), '') IS NOT NULL
ORDER BY cnt DESC
LIMIT 10;
```

### 10.5 ยอด COD รวมในช่วง (parse `cod_amount` text)

แนวทางเดียวกับที่ RPC ค่าส่งใช้ — คัดเฉพาะตัวเลขจากสตริง:

```sql
SELECT
  SUM(
    CASE
      WHEN trim(COALESCE(cod_amount::text, '')) = '' THEN 0::numeric
      WHEN regexp_replace(trim(cod_amount::text), '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN regexp_replace(trim(cod_amount::text), '[^0-9.\-]', '', 'g')::numeric
      ELSE 0::numeric
    END
  ) AS sum_cod
FROM public.jt_shipments;
```

### 10.6 เรียก Stats API จากเบราว์เซอร์ / Postman (แกนกราฟรายวัน)

แทนที่โฮสต์และ cookie แอดมินตามสภาพแวดล้อมของคุณ

```http
GET /api/admin/jt-shipments/stats?chart_month=2026-05
Cookie: admin_session=...
```

พารามิเตอร์แกนเวลาอื่น (ดูโค้ด route): `chart_from`, `chart_to`, `window_days`

### 10.7 ตัวอย่างแนวคิด UI (React) — โหลดสถิติรายวันผ่าน API

```typescript
const qs = new URLSearchParams({ chart_month: '2026-05' });
const res = await fetch(`/api/admin/jt-shipments/stats?${qs}`, { credentials: 'include' });
const json = await res.json();
// json.daily30 — จำนวนต่อวัน, json.dailyFee30 — รวมค่าส่งต่อวัน, json.chartWindow — ช่วงที่ resolve แล้ว
```
