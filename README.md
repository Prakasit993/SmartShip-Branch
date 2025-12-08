# Project To-Do – SmartShip Branch Assistant

รวมรายการงานทั้งหมดที่ใช้วางแผนใน ClickUp / GitHub Issues  
(ติ๊กเช็กได้ตามความคืบหน้า)

---

## 0. Repo & Project Setup

- [ ] สร้าง GitHub repo `SmartShip-Branch` (หรือชื่อใกล้เคียง)
- [ ] เพิ่มไฟล์ `README.md` (Project Overview + Goals)
- [ ] สร้างโฟลเดอร์ `docs/`
- [ ] สร้างไฟล์เอกสารหลัก:
  - [ ] `docs/use-cases.md`
  - [ ] `docs/data-model.md`
  - [ ] `docs/architecture.md`
  - [ ] `docs/security.md`
  - [ ] `docs/todo.md` (ไฟล์นี้)

---

## 1. Analysis & Documentation

- [ ] เก็บข้อมูล AS-IS Process ของสาขา J&T (ทำเป็นข้อความ/แผนภาพ)
- [ ] เขียน Problem Statement & Business Goals
- [ ] ระบุ Actors หลัก:
  - [ ] Customer
  - [ ] Branch Staff
  - [ ] Branch Owner
  - [ ] SmartShip System
  - [ ] J&T System
  - [ ] AI Services
- [ ] นิยาม Scope ของระบบ (In Scope / Out of Scope)
- [ ] เขียน Use Case รายละเอียด:
  - [ ] UC-01: Create Shipment Draft & QR (Part 1)
  - [ ] UC-02: Scan QR & Confirm Shipment in J&T (Part 2)
  - [ ] UC-03: Create Shipment at Counter (No LINE)
  - [ ] UC-04: Daily Shipment Summary Report
  - [ ] UC-05: Customer Management (VIP/Regular)
- [ ] สรุป Use Case ทั้งหมดใน `docs/use-cases.md`
- [ ] วาด/อธิบาย Context Diagram / Level 0 DFD (เป็นข้อความหรือภาพ)

---

## 2. Data & Architecture Design

### 2.1 Data Model

- [ ] ออกแบบ Conceptual Data Model (Entities หลัก)
- [ ] เติมรายละเอียดใน `docs/data-model.md` สำหรับ:
  - [ ] `branches`
  - [ ] `customers`
  - [ ] `shipments`
  - [ ] `branch_daily_report`
  - [ ] `thai_locations` (reference table)
- [ ] ระบุฟิลด์สำคัญ + key / index ที่จำเป็น
- [ ] ระบุ flag สำหรับคุณภาพข้อมูล:
  - [ ] `address_validated`
  - [ ] `address_needs_staff_review`
  - [ ] `status` (draft/confirmed/sent_to_jt/...)

### 2.2 Architecture

- [ ] เติม `docs/architecture.md` (High-Level Architecture)
- [ ] อธิบาย:
  - [ ] Actors & External Systems
  - [ ] Presentation Layer (Staff Portal / LINE/LIFF)
  - [ ] Application & Integration Layer (n8n หรือเทียบเท่า)
  - [ ] Data Layer (PostgreSQL / Supabase)
  - [ ] External Services (J&T System, AI Services, LINE)
- [ ] ระบุ Main Flows ระดับสถาปัตยกรรม:
  - [ ] Flow A – UC-01: Create Shipment Draft & QR
  - [ ] Flow B – UC-02: Scan QR & Confirm Shipment in J&T
  - [ ] Flow C – Daily Summary (UC-04)
- [ ] ใส่ Design Considerations:
  - [ ] Tool-agnostic (เปลี่ยนจาก n8n ไปใช้ขององค์กรได้)
  - [ ] Scalability (รองรับหลายสาขา)
  - [ ] Security & Compliance (โยงไป `docs/security.md`)

---

## 3. MVP Implementation (Part 1 – Branch System)

### 3.1 Backend & Database

- [ ] สร้างฐานข้อมูล (เช่น Supabase / PostgreSQL)
- [ ] สร้างตาราง:
  - [ ] `branches`
  - [ ] `customers`
  - [ ] `shipments`
  - [ ] `branch_daily_report`
  - [ ] `thai_locations`
- [ ] Seed ข้อมูล `branches` (ที่อยู่สาขาจริง)
- [ ] เตรียม/อิมพอร์ตข้อมูล `thai_locations` (จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์)

### 3.2 Staff Portal (Web App)

- [ ] ตั้งโปรเจกต์ Web App (เช่น Next.js/React)
- [ ] หน้าจอ:
  - [ ] หน้า Login (Staff / Owner)
  - [ ] ฟอร์มสร้าง Shipment (Part 1)
  - [ ] หน้าแสดง QR Code และสรุปข้อมูลพัสดุ
  - [ ] หน้า “รับเข้าระบบ J&T (Part 2)” + สแกน QR
  - [ ] หน้า Customer Management (ค้น/แก้ลูกค้าประจำ)
  - [ ] หน้าแสดงรายงานพื้นฐาน (ดึงจาก `branch_daily_report`)
- [ ] เชื่อมต่อ Backend / DB ผ่าน API หรือ Supabase client

---

## 4. Automation & AI (n8n / Workflow Layer)

- [ ] ติดตั้ง/ตั้งค่า n8n (หรือเลือกเครื่องมือ Orchestrator อื่น)
- [ ] สร้าง Credentials ที่จำเป็น:
  - [ ] DB (PostgreSQL/Supabase)
  - [ ] AI Service (เช่น DeepSeek / OpenAI)
  - [ ] LINE / J&T API (ถ้าใช้)
- [ ] Workflow A: `CreateShipmentDraft`
  - [ ] รับข้อมูลจาก Staff Portal / HTTP Request
  - [ ] ตรวจสอบข้อมูลที่อยู่กับ `thai_locations`
  - [ ] เรียก AI ช่วย normalize address (ถ้าใช้)
  - [ ] บันทึก `customers` + `shipments` (สถานะ `draft`)
  - [ ] ส่งข้อมูลกลับไปให้ Frontend สำหรับสร้าง QR
- [ ] Workflow B: `ConfirmShipmentAndSendToJT`
  - [ ] รับ `shipment_id` จากการสแกน QR
  - [ ] ดึง shipment จาก DB
  - [ ] อัปเดตข้อมูลเพิ่ม (น้ำหนัก, ประเภทบริการ, COD)
  - [ ] ส่งข้อมูลไป J&T System (API / automation)
  - [ ] เปลี่ยนสถานะ shipment เป็น `sent_to_jt` หรือ `confirmed`
- [ ] Workflow C: `DailySummaryReport`
  - [ ] Trigger ทุกวันตามเวลาปิดร้าน
  - [ ] Query `shipments` ของวันนั้น
  - [ ] รวมยอด/สถิติ
  - [ ] เรียก AI เขียน summary text
  - [ ] บันทึกลง `branch_daily_report`
  - [ ] ส่งสรุปไป Owner (LINE / Email)

---

## 5. Integration & Reporting

- [ ] วิเคราะห์วิธีเชื่อมกับ J&T:
  - [ ] ปัจจุบัน (กรอกมือจากข้อมูลบนหน้าจอ SmartShip)
  - [ ] อนาคต (API / QR Payload)
- [ ] ออกแบบฟอร์แมต QR Payload ให้ชัดเจน:
  - [ ] ต้องมี: branch code, shipment_id, vip_code, sender/receiver summary
- [ ] หน้า Dashboard / รายงาน:
  - [ ] รายงานยอดส่งรายวัน (ดึงจาก `branch_daily_report`)
  - [ ] filter ตามวันที่, สาขา, ประเภทบริการ
- [ ] ระบุ Next Step สำหรับการเชื่อม JT API จริงในอนาคต

---

## 6. Presentation & Portfolio

- [ ] เตรียม Slide Deck สำหรับพรีเซนต์โปรเจกต์นี้ (6–10 สไลด์):
  - [ ] Slide 1 – Project Intro (SmartShip Branch Assistant คืออะไร)
  - [ ] Slide 2 – Business Problem & Pain Points
  - [ ] Slide 3 – Goals & Scope
  - [ ] Slide 4 – Use Cases หลัก (UC-01 – UC-04)
  - [ ] Slide 5 – Data Model / Architecture Overview
  - [ ] Slide 6 – ตัวอย่างหน้าจอ/Flow (Prototype หรือ Screenshot)
  - [ ] Slide 7 – AI & Automation ใช้ตรงไหน
  - [ ] Slide 8 – Security & Next Steps
- [ ] เขียน Section “Role as System Analyst” ใน README / Slide:
  - [ ] วิเคราะห์งานจริงจากธุรกิจของตัวเอง
  - [ ] ออกแบบ Process, Use Case, Data Model, Architecture, Security
  - [ ] วาง Roadmap จาก MVP ไปสู่ Multi-branch

---

## 7. Security & Compliance

- [ ] เติมรายละเอียดใน `docs/security.md` (ตามหัวข้อหลัก)
- [ ] ออกแบบ RBAC:
  - [ ] สิทธิ์ Staff
  - [ ] สิทธิ์ Branch Owner
  - [ ] สิทธิ์ Admin/System Owner
- [ ] Implement Login / Auth สำหรับ Staff Portal
- [ ] บังคับใช้ HTTPS ทุกการเชื่อมต่อ:
  - [ ] Staff Portal ↔ Backend
  - [ ] Backend ↔ DB
  - [ ] n8n ↔ External Services
- [ ] ตั้งค่าการเก็บ Secret:
  - [ ] API Keys / Tokens เก็บใน Environment Variables / n8n Credentials
  - [ ] ห้าม hard-code ใน source code
- [ ] Implement Address Validation:
  - [ ] ใช้ `thai_locations` ตรวจ combination ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์
  - [ ] Popup ให้เลือก “ยืนยันตามที่ระบบแนะนำ” หรือ “ให้พนักงานตรวจสอบ”
  - [ ] ตั้งค่า flag `address_validated`, `address_needs_staff_review`
- [ ] ออกแบบ/สร้าง `audit_log` (Audit Trail):
  - [ ] บันทึกการสร้าง/แก้ไข/เปลี่ยนสถานะ shipment
  - [ ] บันทึกการแก้ข้อมูลลูกค้า
- [ ] ปรับ Logging ให้ไม่เก็บข้อมูลอ่อนไหวใน log:
  - [ ] เบอร์โทร
  - [ ] ที่อยู่เต็ม
  - [ ] VIP Code
- [ ] วาง Data Retention Policy:
  - [ ] เก็บรายละเอียด shipment กี่ปี
  - [ ] วิธี anonymize / ลบข้อมูลเก่า
- [ ] ตั้งค่า Backup & Recovery:
  - [ ] Backup DB รายวัน
  - [ ] ทดสอบ Restore เป็นระยะ
- [ ] ทบทวน Terms/Privacy ของ AI Services / J&T / LINE ที่ใช้

---

## 8. Optional / Future Enhancements

- [ ] รองรับ Multi-Branch (หลายสาขาในระบบเดียว)
- [ ] เพิ่มระบบ Notification (แจ้งลูกค้าเมื่อสถานะเปลี่ยน)
- [ ] เพิ่ม Dashboard เชิงลึก (Top ลูกค้าประจำ, สถิติปลายทาง, Peak time)
- [ ] PoC เชื่อม J&T API (ถ้ามีเอกสารให้ใช้จริง)
- [ ] เพิ่ม Unit Test / Integration Test ส่วนสำคัญ

---

# SmartShip Branch Assistant

ระบบผู้ช่วยสาขาขนส่งพัสดุ (ฉบับ J&T Franchise)  
โฟกัสลดขั้นตอนหน้าร้าน, ลดการพิมพ์ซ้ำ, และเตรียมต่อยอดเชื่อม API J&T + AI ช่วยจัดการข้อมูล

---

## 1. Project Overview (ภาพรวมโปรเจกต์)

**SmartShip Branch Assistant** คือระบบ Portal เล็ก ๆ สำหรับสาขาขนส่ง ที่ช่วยจัดการ “ขั้นตอนหน้าร้าน” ให้เป็นระบบมากขึ้น โดยแยกงานออกเป็น 2 ส่วนหลัก:

1. **ส่วนที่ 1 – ระบบหน้าร้านของสาขา (SmartShip System)**  
   - เก็บข้อมูลผู้ส่ง/ผู้รับให้เรียบร้อย  
   - ล็อกที่อยู่ผู้ส่งให้เป็นที่อยู่สาขา  
   - สร้าง Shipment Draft + QR Code สำหรับเอาไปใช้ในขั้นตอนรับเข้าระบบ J&T

2. **ส่วนที่ 2 – ระบบรับเข้าระบบ J&T (Existing J&T System)**  
   - ใช้ QR จากส่วนที่ 1 เพื่อดึงข้อมูลได้เร็ว  
   - พนักงานตรวจสอบ/เติมข้อมูลเพิ่ม แล้วส่งเข้าระบบ J&T (ปัจจุบันยังเป็น “จำลองส่ง” ใน DB)

เป้าหมายของโปรเจกต์นี้คือ **ทำ demo ระดับ System Analyst + Dev** ที่:

- มี **Use Case ชัดเจน (UC-01, UC-02)**  
- มี **ฐานข้อมูลจริง (Supabase / PostgreSQL)**  
- มี **เว็บจริงให้กดใช้งาน (Next.js)**  
- มี **QR Flow ครบวง**: สร้าง → ปริ้น/แสดง → สแกน → ยืนยัน

---

## 2. Business Problem & Goals

### 2.1 Pain Points ปัจจุบัน (มองจากมุมสาขา J&T)

- ลูกค้าต้องเขียนที่อยู่/เบอร์โทรซ้ำ ๆ ทุกครั้ง  
- พนักงานหน้าร้านต้องพิมพ์ข้อมูลซ้ำจากกระดาษเข้าเครื่อง J&T  
- มีโอกาสพิมพ์ผิด (ชื่อ/เบอร์/รหัสไปรษณีย์)  
- เวลาเยอะในขั้นตอน “รับข้อมูล” มากกว่าการจัดการพัสดุจริง ๆ  
- ยังไม่ได้นำ AI / Automation มาช่วยตรวจสอบหรือทวนข้อมูล

### 2.2 Goals ของ SmartShip Branch Assistant

1. **ลดเวลาหน้าร้าน**  
   - ให้พนักงานมีหน้าจอเดียว ที่ต้องพิมพ์น้อยที่สุด  
   - ใช้ QR Code เป็นตัวกลางระหว่างระบบสาขา vs ระบบ J&T

2. **เตรียมฐานข้อมูลกลางของสาขาเอง**  
   - เก็บข้อมูลลูกค้า, ประวัติการส่ง, สถานะพัสดุ (ระดับ branch)  
   - ต่อกับระบบอื่นในอนาคตได้ (n8n, Line, AI ฯลฯ)

3. **ออกแบบให้ต่อยอดเป็น AI/Automation ได้ง่าย**  
   - ตรวจสอบที่อยู่/รหัสไปรษณีย์  
   - แนะนำบริการเสริม (COD, ประกัน ฯลฯ)  
   - ทำรายงานสรุปยอดรายวัน/รายเดือนอัตโนมัติ

---

## 3. Scope ปัจจุบัน (MVP 1 – Implement แล้ว)

### 3.1 ฟีเจอร์ที่ทำงานจริงแล้ว

- ✅ **UC-01: Create Shipment Draft & QR**
  - หน้าเว็บ `/shipments/new`
  - พนักงานกรอกข้อมูลผู้ส่ง/ผู้รับ  
  - ระบบล็อกที่อยู่ผู้ส่ง = ที่อยู่สาขา
  - บันทึกลงตาราง `shipments` (สถานะ `draft`)
  - สร้าง QR Code ที่มี payload:

    ```json
    {
      "shipment_id": "<UUID จาก shipments.id>",
      "branch_code": "BR001"
    }
    ```

- ✅ **UC-02: Scan QR & Confirm Shipment**
  - หน้าเว็บ `/shipments/scan`
  - รับ QR ผ่านกล้อง (หรือวาง JSON ลง textarea สำหรับเครื่องที่ไม่มีกล้อง)
  - อ่าน `shipment_id` จาก QR → ดึงข้อมูลจาก `shipments`
  - แสดงรายละเอียดพัสดุให้พนักงานตรวจสอบ
  - ปุ่ม “ยืนยันรับพัสดุ (จำลองส่งเข้า J&T)”  
    → update `shipments.status = 'confirmed'`  
    → set `confirmed_at`, `confirmed_by`

### 3.2 ฟีเจอร์ในเอกสาร / DB พร้อมต่อยอด

- ตาราง `thai_locations` – เก็บข้อมูลจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ (เตรียมไว้ใช้ตรวจสอบ address)  
- ตาราง `audit_log` – ใช้บันทึกเหตุการณ์สำคัญ เช่น `CREATE_SHIPMENT`, `CONFIRM_SHIPMENT` (ยังไม่ implement logic เต็ม)  
- โครง security / hardening ที่ระบุไว้ใน README + docs (RLS, การแยก role ฯลฯ) – ใช้เป็น guideline ในอนาคต

---

## 4. System Design

### 4.1 High-level Architecture

```mermaid
flowchart LR
    C[Customer<br/>ลูกค้าหน้าร้าน] -->|แจ้งข้อมูลส่งของ| S(Branch Staff)

    subgraph Portal[SmartShip Branch Portal<br/>(Next.js)]
        P1[/หน้า UC-01<br/>/shipments/new/]
        P2[/หน้า UC-02<br/>/shipments/scan/]
    end

    S --> P1
    P1 -->|insert draft + สร้าง QR| DB[(Supabase<br/>PostgreSQL)]

    P1 -->|แสดง QR Code| S

    S --> P2
    P2 -->|scan/wrap JSON<br/>{"shipment_id", "branch_code"}| P2
    P2 -->|ดึงข้อมูล shipment| DB

    P2 -->|update status=confirmed<br/>+ confirmed_at, confirmed_by| DB

    DB --> R[(Reports / n8n / Line<br/>(ในอนาคต))]
    เทคโนโลยีหลัก:

      Frontend / Portal: Next.js 15 (App Router), TypeScript, Tailwind CSS

      Database: Supabase (PostgreSQL)

      Auth (MVP): ยังไม่แยก user จริง ใช้ค่า demo_staff ใน confirmed_by เพื่อให้เห็น flow ก่อน

    QR:

      Generate: react-qr-code

      Scan: @yudiel/react-qr-scanner


