# Architecture – SmartShip Branch Assistant

---

## 1. High-Level Context View

SmartShip Branch Assistant เป็นระบบเสริมสำหรับสาขาขนส่ง (เช่น J&T Franchise)  
อยู่ตรงกลางระหว่าง “ลูกค้า / พนักงานสาขา” กับ “ระบบ J&T หลัก”

### External Actors & Systems

- **Customer**
  - มาที่หน้าร้านเพื่อส่งพัสดุ
  - ให้ข้อมูลผู้ส่ง/ผู้รับกับพนักงาน
  - อาจใช้ LINE/QR จากมือถือในอนาคต

- **Branch Staff**
  - ใช้ Staff Portal เพื่อสร้าง/แก้ไข/ยืนยัน shipment
  - สแกน QR และส่งข้อมูลเข้าสู่ระบบ J&T

- **Branch Owner**
  - ดูรายงานยอดส่งพัสดุรายวัน/รายเดือน
  - ใช้ Dashboard หรือข้อความสรุปจาก LINE/Email

- **J&T System (Franchise Core System)**
  - ระบบหลักที่ใช้รับเข้าพัสดุและออกเลข Tracking จริง
  - ปัจจุบันใช้งานผ่านเว็บ/แอปของ J&T
  - อนาคตรองรับ API หรือการอ่าน QR Payload

- **AI Services (เช่น DeepSeek / OpenAI / อื่น ๆ)**
  - ช่วยจัดรูปแบบที่อยู่ (Address Parsing & Validation)
  - ช่วยเขียนสรุปรายวันเป็นภาษาคน

- **Reference Data (Thai Locations)**
  - ฐานข้อมูลจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ของประเทศไทย
  - ใช้เป็น “ความจริง” สำหรับตรวจสอบความถูกต้องของที่อยู่

---

## 2. Logical Architecture (Component View)

มองในมุมส่วนประกอบหลักของระบบ SmartShip แบ่งเป็น 4 ชั้น:

### 2.1 Presentation Layer (Frontends)

1. **Staff Portal (Web App)**
   - ใช้เทคโนโลยีเช่น Next.js / React
   - หน้าที่หลัก:
     - ฟอร์มสร้าง Shipment (ส่วนที่ 1)
     - หน้าสแกน/ค้นหาจาก QR (ส่วนที่ 2)
     - หน้าแก้ไขข้อมูลลูกค้าประจำ
     - Dashboard / รายงานสรุปยอดส่ง

2. **(Optional) LINE/LIFF Interface**
   - สำหรับเวอร์ชันที่ให้ลูกค้ากรอกข้อมูลพัสดุล่วงหน้าด้วยตนเอง
   - เรียกใช้ Backend หรือ n8n ผ่าน Webhook/HTTP API

### 2.2 Application & Integration Layer

ใช้เครื่องมือ Orchestrator กลาง เช่น **n8n** (หรือเทคโนโลยีที่เทียบเท่า) สำหรับ:

- รับ **Webhook** จาก LINE (ถ้าใช้)
- ประสานงานระหว่าง:
  - Staff Portal
  - Database (Supabase/PostgreSQL)
  - AI Service
  - J&T API (ในอนาคต)
- รัน Job ตามเวลา (Scheduled Workflow) เช่น:
  - สร้างรายงานสรุปรายวัน (UC-04)
  - ตรวจสอบ shipment ที่สถานะค้าง (`pending_jt`)

**ตัวอย่าง Workflow หลัก**

- Workflow A: `CreateShipmentDraft`
  - รับข้อมูลจาก Staff Portal / LINE
  - บันทึกลง `shipments`
  - สร้าง QR Payload และคืน QR URL/ข้อมูลให้ Frontend

- Workflow B: `ConfirmShipmentAndSendToJT`
  - รับ `shipment_id` จากการสแกน QR
  - ดึงข้อมูล shipment
  - อัปเดตข้อมูลเพิ่มเติม (น้ำหนัก, บริการ, COD)
  - ส่งข้อมูลเข้า J&T System (API/automation)
  - เปลี่ยนสถานะเป็น `sent_to_jt` หรือ `confirmed`

- Workflow C: `DailySummaryReport`
  - รันทุกวันหลังปิดร้าน
  - รวมข้อมูลจาก `shipments`
  - เรียก AI สร้างข้อความสรุป
  - บันทึกลง `branch_daily_report` และแจ้งเจ้าของสาขา

### 2.3 Data Layer (Database & Reference Data)

ใช้ฐานข้อมูลเช่น **PostgreSQL / Supabase** ประกอบด้วย:

- `branches` – ข้อมูลสาขา (ที่อยู่ผู้ส่ง)
- `customers` – ลูกค้าผู้ส่ง + VIP Code
- `shipments` – ข้อมูลพัสดุแต่ละชิ้น (สถานะ, ที่อยู่, COD ฯลฯ)
- `branch_daily_report` – สรุปยอดส่งรายวัน
- `thai_locations` – ตารางอ้างอิงตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์

**หลักการออกแบบข้อมูล**

- แยก “ข้อมูลปฏิบัติการ” (shipments/customers) ออกจาก “ข้อมูลอ้างอิง” (thai_locations)
- ใช้ index ที่จำเป็น เช่น บน `phone`, `postal_code`, `branch_id + report_date`
- เก็บ flag สำหรับคุณภาพข้อมูล เช่น:
  - `address_validated`
  - `address_needs_staff_review`

### 2.4 External Services & Systems

1. **J&T System**
   - ปัจจุบัน:
     - Staff ใช้งานด้วยมือ → กรอกข้อมูลจาก Staff Portal/QR เข้าเว็บของ J&T
   - อนาคต:
     - SmartShip → ส่งข้อมูลเข้า API ของ J&T โดยตรง
     - รับเลข Tracking และสถานะกลับมาเก็บใน `jt_consignment_no`

2. **AI Services**
   - `Address Parsing & Normalization`
     - Input: ข้อความที่อยู่ยาว ๆ
     - Output: field แยก: บ้านเลขที่, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์
   - `Daily Summary Writer`
     - Input: ตัวเลขสถิติต่าง ๆ ในแต่ละวัน
     - Output: ข้อความสรุปที่อ่านง่ายสำหรับเจ้าของสาขา

3. **Authentication / Identity (ถ้ามี)**
   - ระบบล็อกอินสำหรับ Staff / Owner
   - อาจใช้ Supabase Auth, Auth0 หรือ SSO ขององค์กร (ถ้ามีการขยาย)

---

## 3. Deployment View (Runtime Architecture)

สำหรับ MVP สามารถออกแบบ Deployment แบบง่าย ๆ ดังนี้:

### 3.1 Components

- **Branch Site (ร้านสาขา)**
  - อุปกรณ์พนักงาน: PC/Notebook/Tablet ที่เปิด Staff Portal ผ่าน Browser
  - เครื่องสแกน QR (USB/กล้องเว็บแคม)

- **Cloud Backend**
  - Web App (Staff Portal + API) รันบนบริการเช่น Vercel / Node Server
  - n8n Instance (Self-host หรือ Cloud)
  - PostgreSQL / Supabase Database
  - AI Services (เรียกผ่าน API ไปยังผู้ให้บริการ)

### 3.2 การเชื่อมต่อ

- Staff Portal → Backend API (HTTPS)
- Backend / n8n → Database (Private network หรือ secure connection)
- n8n → AI Services / J&T API (HTTPS)
- LINE Webhook → n8n/Backend (ถ้าใช้ LINE)

**Trust Boundaries คร่าว ๆ**

- เขต “Branch” – อุปกรณ์ในร้าน (ต้องล็อกอินเพื่อเข้าระบบ)
- เขต “Cloud Backend” – Web App / n8n / DB (อยู่หลัง HTTPS + Authentication)
- เขต “External Services” – AI API, J&T API, LINE Platform

---

## 4. Main Request Flows (Architecture-Level)

### 4.1 Flow A – UC-01: Create Shipment Draft & QR

1. **Staff Portal**
   - พนักงานกรอกข้อมูลผู้ส่ง/ผู้รับ/ที่อยู่ผ่านเว็บฟอร์ม

2. **Backend / n8n**
   - รับ request จากฟอร์ม
   - (ถ้าต้องใช้ AI ช่วยจัดที่อยู่ → เรียก AI Service + ใช้ `thai_locations` ตรวจ)
   - บันทึกข้อมูลลงตาราง `customers` / `shipments` ด้วยสถานะ `draft`
   - สร้าง QR Payload จากข้อมูล shipment
   - สร้าง QR Code (ใน Backend หรือ Frontend)

3. **Staff Portal**
   - แสดงสรุปข้อมูล + QR Code
   - พนักงานพิมพ์สติ๊กเกอร์ QR หรือติดกล่อง

### 4.2 Flow B – UC-02: Scan QR & Confirm Shipment in J&T

1. **Staff Portal**
   - พนักงานเปิดหน้าสแกน และสแกน QR บนกล่อง

2. **Backend**
   - ถอด QR Payload → ได้ `shipment_id` + ข้อมูลอื่น ๆ
   - ดึงข้อมูล shipment จาก DB (ต้องเป็นสถานะ `draft`)
   - แสดงข้อมูลให้พนักงานตรวจสอบ/กรอกเพิ่ม (น้ำหนัก, บริการ, COD)

3. **Staff Portal / Backend**
   - เมื่อพนักงานกดยืนยัน:
     - Backend อัปเดต shipment ใน DB → เปลี่ยนสถานะเป็น `confirmed` / `sent_to_jt`
     - ส่งข้อมูลเข้า J&T System (API หรือช่วยกรอกบนเว็บ J&T)
     - บันทึกเลข Tracking (ถ้ามี)

4. **Staff Portal**
   - แสดงข้อความ “รับเข้าระบบ J&T สำเร็จ”
   - พนักงานไปขั้นตอนชั่งน้ำหนัก/รับเงินตามปกติ

### 4.3 Flow C – Daily Summary (UC-04)

1. **n8n Scheduler**
   - Trigger เวลาเช่น 21:00 ทุกวัน

2. **n8n Workflow**
   - Query `shipments` ของวันนั้นจาก DB
   - รวมยอดจำนวนชิ้น, ยอดเงิน, แยกประเภทบริการ ฯลฯ
   - บันทึกลง `branch_daily_report`
   - เรียก AI สร้างข้อความสรุป
   - ส่งสรุปไปให้ Branch Owner (LINE/Email/หน้า Dashboard)

---

## 5. Design Considerations (สำหรับขยาย/ปรับใช้ในองค์กร)

- **Tool-Agnostic Design**
  - แม้ MVP ใช้ n8n แต่สถาปัตยกรรมนี้สามารถย้ายไปใช้:
    - Node-RED, Make, Zapier หรือ
    - AWS Step Functions / GCP Workflows
  - โดยไม่ต้องเปลี่ยน Business Flow

- **Scalability**
  - แยก Backend, n8n, Database เป็น Service ต่างหาก
  - สามารถรองรับหลายสาขาโดยเพิ่ม dimension `branch_id` ในทุก query/report

- **Security & Compliance**
  - ใช้ HTTPS ทุกจุด
  - RBAC: จำกัดสิทธิ์ Staff/Owner/Admin
  - ตรวจสอบและ log ทุกการเปลี่ยนแปลง shipment/customer (Audit Trail)
  - ปรับ Data Retention ตามนโยบาย PDPA / Privacy

---
