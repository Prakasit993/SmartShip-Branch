# Data Model – SmartShip Branch Assistant

---

## Entity: branches

ตัวแทน “สาขา” ที่เป็นจุดรับพัสดุ ใช้สำหรับล็อกที่อยู่ผู้ส่ง

- `id` (PK, uuid)
- `code` (string) – รหัสสาขา เช่น `BR001`
- `name` (string) – ชื่อสาขา
- `address_line` (string) – ที่อยู่สาขา (บ้านเลขที่/ถนน/หมู่บ้าน)
- `district` (string) – อำเภอ/เขต
- `province` (string)
- `postal_code` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## Entity: customers

ตัวแทน “ลูกค้าผู้ส่ง” ที่อาจกลับมาใช้บริการหลายครั้ง

- `id` (PK, uuid)
- `name` (string)
- `phone` (string, unique ถ้าเป็นไปได้)
- `vip_code` (string, nullable) – ผูกกับ VIP ของ J&T (ถ้ามี)
- `line_user_id` (string, nullable) – กรณีอนาคตใช้ LINE/LIFF
- `default_address_line` (string, nullable) – ที่อยู่หลัก (ถ้าเก็บ)
- `default_district` (string, nullable)
- `default_province` (string, nullable)
- `default_postal_code` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## Entity: shipments

ตัวแทน “รายการพัสดุ” 1 ชิ้น ตั้งแต่ draft จนส่งเข้า J&T

- `id` (PK, uuid)
- `branch_id` (FK → branches.id)
- `customer_id` (FK → customers.id, nullable)

**ข้อมูลผู้ส่ง (Sender)**  
- `sender_name` (string)
- `sender_phone` (string)
- `sender_address_line` (string) – โดยปกติ = ที่อยู่สาขา
- `sender_district` (string)
- `sender_province` (string)
- `sender_postal_code` (string)

**ข้อมูลผู้รับ (Receiver)**  
- `receiver_name` (string)
- `receiver_phone` (string)
- `receiver_address_line` (string)
- `receiver_subdistrict` (string)
- `receiver_district` (string)
- `receiver_province` (string)
- `receiver_postal_code` (string)

**ข้อมูลเพิ่มเติม**  
- `vip_code` (string, nullable) – copy มาจาก customer เพื่อ embed ลง QR ง่าย ๆ
- `service_type` (string, nullable) – ธรรมดา / ด่วน / ฯลฯ
- `cod_amount` (numeric, nullable)
- `weight_kg` (numeric, nullable)

**สถานะ & Flag**  
- `status` (string) – เช่น `draft`, `pending_staff_review`, `confirmed`, `sent_to_jt`, `cancelled`
- `address_validated` (boolean, default false) – true เมื่อที่อยู่ผ่านการตรวจสอบ/ยืนยันแล้ว
- `address_needs_staff_review` (boolean, default false) – ใช้ในเคสที่ระบบเช็กแล้วไม่ตรง และลูกค้าไม่ยืนยัน ให้พนักงานตรวจ

**เวลา/การติดตาม**  
- `created_at` (timestamp)
- `confirmed_at` (timestamp, nullable)
- `confirmed_by` (string, nullable) – ชื่อ/รหัสพนักงานที่ยืนยัน
- `jt_consignment_no` (string, nullable) – เลขพัสดุจากระบบ J&T เมื่อบันทึกเสร็จ

---

## Entity: branch_daily_report

ตารางสรุปยอดรายวันต่อสาขา

- `id` (PK, uuid)
- `branch_id` (FK → branches.id)
- `report_date` (date)
- `total_shipments` (integer)
- `total_revenue` (numeric, nullable)
- `total_cod_amount` (numeric, nullable)
- `top_destination_province` (string, nullable)
- `raw_stats_json` (jsonb) – เก็บรายละเอียดส่วนแบ่งตามประเภทบริการ ฯลฯ
- `summary_text` (text) – ข้อความสรุปที่ AI เขียน
- `created_at` (timestamp)

---

## Entity: thai_locations (Reference Table)

ฐานข้อมูลอ้างอิงจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์  
ใช้สำหรับตรวจสอบความถูกต้องของที่อยู่

- `id` (PK, uuid)
- `province_code` (string, nullable)
- `province_name` (string)
- `district_code` (string, nullable)
- `district_name` (string)
- `subdistrict_code` (string, nullable)
- `subdistrict_name` (string)
- `postal_code` (string)
- `active` (boolean, default true)
- `created_at` (timestamp)
- `updated_at` (timestamp)
