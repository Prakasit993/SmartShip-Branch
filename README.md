# SmartShip Branch Assistant  
*AI-powered branch assistant for J&T-style parcel franchise*

---

## 1. Project Overview (ภาพรวมโปรเจกต์)

SmartShip Branch Assistant คือระบบช่วยงานสาขาขนส่งพัสดุ (เช่น J&T Franchise)  
ที่ออกแบบมาเพื่อลดขั้นตอนการกรอกข้อมูลซ้ำซ้อน เพิ่มความเร็วที่เคาน์เตอร์  
และเตรียมพร้อมสำหรับการเชื่อมต่อกับระบบขนส่งหลักในอนาคต (ผ่าน API หรือ QR Integration)

**Key idea (แนวคิดหลัก)**  
- แยกการทำงานเป็น 2 ส่วนชัดเจน:
  1. **ส่วนที่ 1 – ระบบหน้าร้านของสาขา (SmartShip System)**  
     - เก็บข้อมูลผู้ส่ง/ผู้รับให้ครบ  
     - ล็อกที่อยู่ผู้ส่ง = ที่อยู่สาขา (ไม่ต้องให้ลูกค้ากรอก)  
     - ดึง/ผูก **VIP Code** ของลูกค้าจาก J&T (ถ้ามี)  
     - สร้าง **QR Code** ที่มีข้อมูลครบสำหรับใช้ในขั้นตอนถัดไป
  2. **ส่วนที่ 2 – ระบบรับเข้าของ J&T (Existing J&T System)**  
     - ใช้ QR Code จากระบบ SmartShip  
     - เพื่อลดการพิมพ์ข้อมูลซ้ำ และเตรียมพร้อมต่อ API ในอนาคต

---

## 2. Business Problem & Goals

### 2.1 Problems (Pain Points ปัจจุบัน)

- ลูกค้าต้องเขียน/บอกข้อมูลซ้ำหลายครั้ง (ที่เคาน์เตอร์, ในระบบ J&T)
- พนักงานต้องคีย์ข้อมูลชื่อ/เบอร์/ที่อยู่เองทั้งหมด → ช้าและผิดบ่อย
- ขาดระบบจัดเก็บข้อมูลลูกค้าประจำ/สถิติรายวันอย่างเป็นระบบ
- ไม่มีการใช้ AI มาช่วยจัดการที่อยู่/ตรวจสอบข้อมูล

### 2.2 Project Goals

1. ลดเวลาทำรายการ 1 พัสดุที่หน้าร้าน (เช่น จาก ~5 นาที เหลือ ~2 นาที)
2. ลดการพิมพ์ผิดของข้อมูลลูกค้า (ชื่อ/เบอร์/รหัสไปรษณีย์)
3. ทำให้เจ้าของสาขาดึง **รายงานยอดส่งต่อวัน/เดือน** ได้อัตโนมัติ
4. แสดงตัวอย่างการใช้ **AI + Automation (n8n) + LINE** ในงานจริงของสาขาขนส่ง

---

## 3. Actors & Scope

### 3.1 Actors

- **Customer** – ลูกค้าที่มาส่งของ
- **Branch Staff** – พนักงานประจำสาขา
- **Branch Owner** – เจ้าของ/ผู้จัดการสาขา
- **SmartShip System** – ระบบที่พัฒนาใหม่ (LINE + Web + DB + n8n + AI)
- **J&T System** – ระบบแฟรนไชส์เดิมที่ใช้รับเข้าพัสดุ

### 3.2 In Scope (MVP)

- ระบบหน้าร้าน (Part 1) สำหรับเก็บข้อมูลลูกค้า/พัสดุและออก QR
- Staff Portal สำหรับพนักงานสแกน/สร้างงาน
- ฐานข้อมูลกลางสำหรับสาขา (shipments, customers, branches)
- Workflow ด้วย n8n (integration, automation, AI)
- รายงานสรุปยอดส่งพัสดุรายวัน

---

## 4. Core Use Cases

### UC-01: Create Shipment Draft & QR (ส่วนที่ 1)

**Actor:** Customer, Branch Staff  
**Goal:** สร้างข้อมูลพัสดุ (ผู้ส่ง/ผู้รับ/ที่อยู่ผู้รับ/เบอร์/รหัสไปรษณีย์) พร้อมล็อกที่อยู่ผู้ส่งเป็นที่อยู่สาขา และออก QR Code สำหรับใช้ในส่วนที่ 2

**Key Points:**
- พนักงานกรอกข้อมูลผู้ส่งจากชื่อ+เบอร์ลูกค้า
- ระบบใช้เบอร์โทรลูกค้าเป็น key เพื่อดึง/ผูก **VIP Code** จาก J&T (ในอนาคตผ่าน API)
- ที่อยู่ผู้ส่ง = ที่อยู่สาขา (branch address) แบบ fix
- ระบบบันทึก `shipment` สถานะ `draft` แล้วสร้าง QR ที่ encode:
  - branch code
  - VIP code (ถ้ามี)
  - sender name / phone
  - receiver name / phone / full address / postal code

---

### UC-02: Scan QR & Confirm Shipment in J&T (ส่วนที่ 2)

**Actor:** Branch Staff, J&T System  
**Goal:** ใช้ QR Code จากระบบสาขา เพื่อดึง/เติมข้อมูลในระบบ J&T ให้เร็วที่สุด

**Key Points:**
- Staff เปิดหน้าระบบ J&T (POS / Web) สำหรับรับเข้าพัสดุ
- Staff สแกน QR → รับ payload ที่มีข้อมูลผู้ส่ง/ผู้รับ (รองรับการ integrate ผ่าน API ในอนาคต)
- Staff ตรวจสอบ/แก้ไขเล็กน้อย (น้ำหนักจริง, ประเภทบริการ, COD)
- ระบบ J&T บันทึกข้อมูล, ระบบ SmartShip เปลี่ยนสถานะ `shipment` เป็น `sent_to_jt`

---

### UC-03: Create Shipment at Counter (No LINE)

**Actor:** Branch Staff  
**Goal:** รองรับลูกค้าที่ไม่ได้ใช้ LINE หรือไม่สร้างล่วงหน้า

**Key Points:**
- Staff เปิดฟอร์ม “สร้างพัสดุใหม่” บน Staff Portal
- กรอกชื่อ/เบอร์/ที่อยู่ผู้รับ จากคำบอกลูกค้า
- กด “ให้ AI ช่วยจัดที่อยู่” → AI แยก address เป็น field + ตรวจรหัสไปรษณีย์
- บันทึก `shipment` + ออก QR + ส่งข้อมูลเข้า J&T ตาม flow ปกติ

---

### UC-04: Daily Shipment Summary Report

**Actor:** Branch Owner  
**Goal:** สรุปยอดพัสดุ/ยอดเงิน/ปลายทางต่อวัน พร้อมสรุปข้อความแบบอ่านง่าย

**Key Points:**
- n8n trigger ทุกคืน → ดึงคำสั่ง `shipments` ของวันนั้น
- รวมจำนวนชิ้น, ยอดเงิน, แยกประเภทบริการ & จังหวัด
- บันทึกลงตาราง `branch_daily_report`
- เรียก AI สร้าง “ข้อความสรุป” ส่งให้เจ้าของผ่าน LINE หรือแสดงบน Dashboard

---

### UC-05: Customer Management (VIP/Regular)

**Actor:** Branch Staff  
**Goal:** จัดการข้อมูลลูกค้าประจำ: เบอร์โทร, ชื่อ, ที่อยู่หลัก, VIP Code

**Key Points:**
- ค้นหาลูกค้าจากเบอร์โทร / ชื่อ
- ผูก VIP Code ที่ได้จากระบบ J&T (ในอนาคตผ่าน API)
- ใช้ข้อมูลนี้ auto-fill ตอนสร้าง shipment ครั้งต่อไป

---

## 5. High-Level Architecture

**Frontend**

- LINE Official + LIFF → ฟอร์มลูกค้า / QR แสดงผล
- Staff Web Portal (Next.js) → สำหรับพนักงานหน้าร้าน

**Backend / Integration**

- n8n → Workflow Orchestrator:
  - รับ Webhook จาก LINE
  - ประสานงานกับ DB / AI / J&T API
  - รันงานสรุปรายวัน

**Database**

- PostgreSQL / Supabase (ตัวอย่าง)
  - `branches` – ข้อมูลสาขา (ที่อยู่ผู้ส่ง)
  - `customers` – ข้อมูลลูกค้า + VIP Code
  - `shipments` – ข้อมูลพัสดุ
  - `branch_daily_report` – สรุปยอดรายวัน

**AI Layer (Optional but Recommended)**

- AI service (เช่น DeepSeek / ChatGPT) สำหรับ:
  - แยก/จัดระเบียบที่อยู่จากข้อความรวม
  - แนะนำ/ตรวจสอบรหัสไปรษณีย์ + จังหวัด
  - สร้างรายงานสรุปรายวันเป็นภาษาคน

---

## 6. Data Model (Conceptual)

**branches**

- id (PK)  
- code  
- name  
- address_line  
- district / province / postal_code  

**customers**

- id (PK)  
- name  
- phone  
- vip_code (nullable)  
- line_user_id (nullable)  

**shipments**

- id (PK)  
- branch_id (FK → branches)  
- customer_id (FK → customers)  
- sender_name  
- sender_phone  
- receiver_name  
- receiver_phone  
- receiver_address_line  
- receiver_subdistrict  
- receiver_district  
- receiver_province  
- receiver_postal_code  
- vip_code (duplicate for quick access)  
- status (`draft` | `confirmed` | `sent_to_jt` | ...)  
- created_at  
- confirmed_at  

---

## 7. Security & Privacy Design (สรุปแนวคิดความปลอดภัย)

- **Access Control (RBAC)**  
  - Staff: เห็นเฉพาะ shipment ของสาขาตัวเอง  
  - Owner: เห็นทุก shipment ของสาขา  
  - Admin: manage system configuration

- **Transport Security**  
  - ทุกการเชื่อมต่อผ่าน HTTPS (LINE Webhook, Staff Portal, DB, AI)

- **Data Protection**  
  - ใช้บริการ DB ที่มี Encryption at Rest  
  - เบอร์โทร / VIP Code ไม่เขียนลง log ดิบ  
  - (Optional) field-level encryption สำหรับข้อมูลอ่อนไหว

- **Audit & Logging**  
  - เก็บ Audit Trail: ใครแก้ shipment/customer เมื่อไร  
  - Log การเรียก J&T API / Error / Retry

- **Data Retention**  
  - เก็บรายละเอียด shipment 1–2 ปี  
  - หลังจากนั้นเก็บเฉพาะข้อมูลสรุป (เช่น จังหวัด/ยอดเงิน) สำหรับสถิติ

---

## 8. Roadmap / Phases

**Phase 0 – Analysis & Design**
- เก็บ AS-IS Process ของสาขา
- ออกแบบ TO-BE Process
- เขียน Use Case, ERD, High-Level Architecture

**Phase 1 – Core MVP (Part 1: Branch System)**
- ระบบสร้าง shipment + ออก QR
- Staff Portal แบบ basic
- บันทึกข้อมูลลง DB

**Phase 2 – AI & Automation**
- ใช้ AI ช่วยจัด address + ตรวจข้อมูล
- n8n workflow สำหรับสร้างรายงานรายวัน

**Phase 3 – Integration with J&T**
- ออกแบบ QR Payload ให้รองรับ J&T
- เชื่อมต่อ J&T API (ถ้ามี) หรือกำหนด format กลาง

---

## 9. Role as System Analyst

ในโปรเจกต์นี้ เจ้าของผลงานทำหน้าที่เป็น:

- วิเคราะห์ปัญหาและความต้องการของสาขาขนส่งจริง (Franchise J&T)
- ออกแบบ AS-IS / TO-BE Process, Use Case, Data Model, Architecture
- เลือกเทคโนโลยี (LINE, n8n, Supabase, AI) ให้เหมาะกับบริบทธุรกิจ
- วาง Roadmap จาก MVP ไปสู่ระบบที่รองรับหลายสาขาในอนาคต
