# Project To-Do – SmartShip Branch Assistant

รวมรายการงานทั้งหมดที่ใช้วางแผนใน ClickUp / GitHub Issues  
(ติ๊กเช็กได้ตามความคืบหน้า)

---

## 0. Repo & Project Setup

- [x] สร้าง GitHub repo `SmartShip-Branch` (หรือชื่อใกล้เคียง)
- [x] เพิ่มไฟล์ `README.md` (Project Overview + Goals)
- [x] สร้างโฟลเดอร์ `docs/`
- [x] สร้างไฟล์เอกสารหลัก:
  - [x] `docs/use-cases.md`
  - [x] `docs/data-model.md`
  - [x] `docs/architecture.md`
  - [x] `docs/security.md`
  - [x] `docs/todo.md` (ไฟล์นี้)

---

## 1. Analysis & Documentation

- [x] เก็บข้อมูล AS-IS Process ของสาขา J&T (ทำเป็นข้อความ/แผนภาพ)
- [x] เขียน Problem Statement & Business Goals
- [x] ระบุ Actors หลัก:
  - [x] Customer
  - [x] Branch Staff
  - [x] Branch Owner
  - [x] SmartShip System
  - [x] J&T System
  - [x] AI Services
- [x] นิยาม Scope ของระบบ (In Scope / Out of Scope)
- [x] เขียน Use Case รายละเอียด:
  - [x] UC-01: Create Shipment Draft & QR (Part 1)
  - [x] UC-02: Scan QR & Confirm Shipment in J&T (Part 2)
  - [ ] UC-03: Create Shipment at Counter (No LINE)
  - [ ] UC-04: Daily Shipment Summary Report
  - [ ] UC-05: Customer Management (VIP/Regular)
- [ ] สรุป Use Case ทั้งหมดใน `docs/use-cases.md`
- [x] วาด/อธิบาย Context Diagram / Level 0 DFD (เป็นข้อความหรือภาพ)

---

## 2. Data & Architecture Design

### 2.1 Data Model

- [x] ออกแบบ Conceptual Data Model (Entities หลัก)
- [x] เติมรายละเอียดใน `docs/data-model.md` สำหรับ:
  - [x] `branches`
  - [x] `customers`
  - [x] `shipments`
  - [x] `branch_daily_report`
  - [x] `thai_locations` (reference table)
- [x] ระบุฟิลด์สำคัญ + key / index ที่จำเป็น (PK + unique phone, etc.)
- [x] ระบุ flag สำหรับคุณภาพข้อมูล:
  - [x] `address_validated`
  - [x] `address_needs_staff_review`
  - [x] `status` (draft/confirmed/sent_to_jt/...)

### 2.2 Architecture

- [x] เติม `docs/architecture.md` (High-Level Architecture)
- [x] อธิบาย:
  - [x] Actors & External Systems
  - [x] Presentation Layer (Staff Portal / LINE/LIFF)
  - [x] Application & Integration Layer (n8n หรือเทียบเท่า)
  - [x] Data Layer (PostgreSQL / Supabase)
  - [x] External Services (J&T System, AI Services, LINE)
- [x] ระบุ Main Flows ระดับสถาปัตยกรรม:
  - [x] Flow A – UC-01: Create Shipment Draft & QR
  - [x] Flow B – UC-02: Scan QR & Confirm Shipment in J&T
  - [ ] Flow C – Daily Summary (UC-04)
- [x] ใส่ Design Considerations:
  - [x] Tool-agnostic (เปลี่ยนจาก n8n ไปใช้ขององค์กรได้)
  - [x] Scalability (รองรับหลายสาขา)
  - [x] Security & Compliance (โยงไป `docs/security.md`)

---

## 3. MVP Implementation (Part 1 – Branch System)

### 3.1 Backend & Database

- [x] สร้างฐานข้อมูล (เช่น Supabase / PostgreSQL)
- [x] สร้างตาราง:
  - [x] `branches`
  - [x] `customers`
  - [x] `shipments`
  - [x] `branch_daily_report`
  - [x] `thai_locations`
- [x] Seed ข้อมูล `branches` (ที่อยู่สาขาจริง)
- [ ] เตรียม/อิมพอร์ตข้อมูล `thai_locations` (จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์)

### 3.2 Staff Portal (Web App)

- [x] ตั้งโปรเจกต์ Web App (เช่น Next.js/React)
- [x] หน้าจอ:
  - [ ] หน้า Login (Staff / Owner)
  - [x] ฟอร์มสร้าง Shipment (Part 1)
  - [x] หน้าแสดง QR Code และสรุปข้อมูลพัสดุ (หลังสร้าง draft)
  - [x] หน้า “รับเข้าระบบ J&T (Part 2)” + สแกน QR
  - [ ] หน้า Customer Management (ค้น/แก้ลูกค้าประจำ)
  - [ ] หน้าแสดงรายงานพื้นฐาน (ดึงจาก `branch_daily_report`)
- [x] เชื่อมต่อ Backend / DB ผ่าน API หรือ Supabase client (สำหรับ UC-01/UC-02)

---

## 4. Automation & AI (n8n / Workflow Layer)

- [ ] ติดตั้ง/ตั้งค่า n8n (หรือเลือกเครื่องมือ Orchestrator อื่นสำหรับโปรเจกต์นี้)
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

- [x] วิเคราะห์วิธีเชื่อมกับ J&T:
  - [x] ปัจจุบัน (กรอกมือจากข้อมูลบนหน้าจอ SmartShip)
  - [x] อนาคต (API / QR Payload / automation)
- [x] ออกแบบฟอร์แมต QR Payload ให้ชัดเจน (MVP):
  - [x] ต้องมี: `branch_code`, `shipment_id`
  - [ ] เพิ่ม: `vip_code`, sender/receiver summary (ถ้าต้องใช้ใน J&T API)
- [ ] หน้า Dashboard / รายงาน:
  - [ ] รายงานยอดส่งรายวัน (ดึงจาก `branch_daily_report`)
  - [ ] filter ตามวันที่, สาขา, ประเภทบริการ
- [ ] ระบุ Next Step สำหรับการเชื่อม JT API จริงในอนาคต (mock → real)

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
- [ ] ออกแบบ/สร้าง `audit_log` (Audit Trail) logic:
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

## 9. Testing & Quality (แนะนำเพิ่ม)

- [ ] เขียน Unit Test พื้นฐาน:
  - [ ] ฟังก์ชันสร้าง QR payload
  - [ ] ฟังก์ชัน parse QR payload (validate รูปแบบ)
- [ ] เขียน Integration Test สำหรับ UC-01 / UC-02:
  - [ ] สร้าง shipment draft แล้วเช็กว่าขึ้นใน DB
  - [ ] simulate scan payload → เปลี่ยน status เป็น `confirmed`
- [ ] ทำ Test Data Script:
  - [ ] สร้าง sample shipments หลายสถานะ เพื่อเดโมในหน้ารายงาน
- [ ] จัดทำ “Demo Script” 1 หน้า (step-by-step) เวลาไปพรีเซนต์โปรเจกต์
