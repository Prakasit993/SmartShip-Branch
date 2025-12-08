# Security & Privacy – SmartShip Branch Assistant

---

## 1. Objectives (วัตถุประสงค์ด้านความปลอดภัย)

เป้าหมายหลักของการออกแบบ Security ในระบบนี้:

- ปกป้องข้อมูลส่วนบุคคลของลูกค้า (ชื่อ, เบอร์โทร, ที่อยู่, รหัสไปรษณีย์, VIP Code)
- ป้องกันการเข้าถึงระบบโดยไม่ได้รับอนุญาต (ทั้งฝั่ง Staff และระบบหลังบ้าน)
- ลดโอกาสเกิดข้อมูลผิดพลาดตั้งแต่ต้นทาง (Data Quality + Address Validation)
- รองรับการขยายไปใช้งานในหลายสาขาได้ โดยยังควบคุมสิทธิ์ได้ดี

---

## 2. Access Control & Authentication

### 2.1 Role-Based Access Control (RBAC)

ระบบแบ่งสิทธิ์ผู้ใช้ออกเป็นอย่างน้อย 3 ระดับ:

- **Staff**
  - เข้าถึงเฉพาะ shipment ของสาขาตัวเอง (`branch_id` เดียว)
  - สร้าง/แก้ไข shipment ในสถานะ `draft`, `confirmed` ภายในสาขา
  - สแกน QR และส่งเข้าระบบ J&T

- **Branch Owner**
  - เห็น shipment ทุกชิ้นของสาขาตนเอง
  - เข้าดูรายงานใน `branch_daily_report`
  - ไม่มีสิทธิ์แก้ข้อมูลระดับระบบ (เช่น โครงสร้างตาราง, config กลาง)

- **Admin / System Owner**
  - ตั้งค่า branch, สร้าง/ปิดบัญชีผู้ใช้
  - ดู log และ audit trail
  - ใช้ในการดูแลระบบและ debug เท่านั้น

### 2.2 Authentication

- Staff Portal ต้องล็อกอินก่อนใช้งานทุกครั้ง
- Username / Password หรือ Auth Provider (เช่น Supabase Auth / Auth0 / SSO) ตามบริบท
- แนะนำ:
  - บังคับรหัสผ่านที่มีความซับซ้อนขั้นต่ำ
  - ปิดบัญชีที่ไม่ใช้งานแล้ว (Inactive Staff)

---

## 3. Data Protection (การปกป้องข้อมูล)

### 3.1 In Transit (ระหว่างส่ง)

- ทุกการเชื่อมต่อใช้ **HTTPS**:
  - Staff Portal ↔ Backend API
  - Backend / n8n ↔ Database (ถ้าเป็น Cloud ให้ใช้ SSL)
  - n8n ↔ AI Services / J&T API / LINE Webhook
- ไม่ส่งข้อมูลสำคัญผ่าน HTTP ธรรมดาหรือ URL Query ที่ไม่จำเป็น

### 3.2 At Rest (ตอนเก็บ)

- ใช้บริการฐานข้อมูลที่รองรับ **Encryption at Rest** (เช่น Supabase / PostgreSQL บน Cloud)
- ลดการเก็บข้อมูลซ้ำซ้อน:
  - VIP Code, เบอร์โทร ควรอยู่ใน `customers` + ซ้ำใน `shipments` เท่าที่จำเป็นสำหรับระบบ
- ไม่เก็บข้อมูลที่ไม่จำเป็น เช่น เลขบัตรประชาชน / วันเกิด หากไม่ได้ใช้

### 3.3 Field-Level Protection (Optional แต่แนะนำ)

สำหรับข้อมูลอ่อนไหว (Sensitive):

- เบอร์โทร (`phone`)
- VIP Code (`vip_code`)
- line_user_id

สามารถเข้ารหัสระดับ field (Field-Level Encryption) เพิ่มเติม หรืออย่างน้อย:

- ไม่ดึงไปแสดงโดยไม่จำเป็น
- ไม่ใส่ข้อมูลเหล่านี้ใน log, error message หรือ analytics โดยตรง

### 3.4 Secret Management

- เก็บ API Key / Token (เช่น AI, LINE, J&T API) ไว้ใน:
  - Environment variables
  - n8n Credentials
- ห้าม hard-code key ลงใน source code หรือแชร์ใน README / รูปหน้าจอ

---

## 4. Data Quality & Address Validation

### 4.1 Reference Table: `thai_locations`

- ใช้ตาราง `thai_locations` เป็นฐานข้อมูลอ้างอิงของ:
  - จังหวัด
  - อำเภอ/เขต
  - ตำบล/แขวง
  - รหัสไปรษณีย์
- ทุกครั้งที่มีการกรอก/แก้ไขที่อยู่ผู้รับ:
  - ระบบตรวจสอบว่าชุดข้อมูลตำบล+อำเภอ+จังหวัด+รหัสไปรษณีย์เข้ากันหรือไม่

### 4.2 Validation Behavior

- ถ้าฟิลด์ทั่วไปไม่ครบ/รูปแบบผิด (เช่น เบอร์โทรไม่ครบ 10 หลัก):
  - ระบบขึ้น error ใต้ฟิลด์นั้น
  - ไม่อนุญาตให้ไปขั้นตอนถัดไป

- ถ้าที่อยู่/รหัสไปรษณีย์ไม่ตรงกับ `thai_locations`:
  - ระบบแสดง popup เทียบระหว่าง:
    - ข้อมูลที่ Staff กรอก
    - ข้อมูลที่ระบบแนะนำจากฐานอ้างอิง
  - Staff เลือกได้ 2 ทาง:
    1. **ยืนยันใช้ข้อมูลที่ระบบแนะนำ** → ปรับที่อยู่ให้ถูกต้อง และตั้ง `address_validated = true`
    2. **ไม่ยืนยัน** → ระบบไม่ให้ยืนยันต่อ และแจ้งว่า:
       > "ระบบไม่สามารถยืนยันที่อยู่นี้ได้ กรุณาแจ้งพนักงานหน้าเคาน์เตอร์เพื่อช่วยตรวจสอบและบันทึกข้อมูลให้"
       (สำหรับ flow ที่ลูกค้ากรอกเองผ่านช่องทางอื่น)

- กรณีที่ Staff ตรวจเองและแก้ไขให้ถูกต้องก่อนส่งเข้าระบบ J&T:
  - เมื่อยืนยัน shipment สำเร็จ → ตั้ง `address_validated = true`

---

## 5. Logging & Audit Trail

### 5.1 Application Logs

- Log เหตุการณ์สำคัญ เช่น:
  - สร้าง shipment ใหม่
  - เปลี่ยนสถานะ shipment (`draft` → `confirmed` → `sent_to_jt`)
  - เรียก J&T API / AI Service แล้วเกิด error
- Log ควรเก็บ **ID อ้างอิง** เช่น `shipment_id` แทนข้อมูลละเอียด เช่น ที่อยู่เต็ม

### 5.2 Audit Trail

- เก็บข้อมูลว่า “ใครทำอะไร เมื่อไหร่” โดยเฉพาะ:
  - การแก้ไขข้อมูล shipment (ก่อนส่งเข้า J&T)
  - การแก้ไขข้อมูลลูกค้า (customers)
- อาจมีตาราง `audit_log` หรือใช้ Audit Feature ของ DB/Platform

ตัวอย่างโครง:

- `entity_type` (เช่น `shipment`, `customer`)
- `entity_id`
- `action` (`create`, `update`, `delete`, `status_change`)
- `performed_by` (ชื่อ/รหัส staff หรือระบบ)
- `performed_at` (timestamp)
- `before_data` / `after_data` (optional, อาจเก็บเฉพาะ diff หรือเฉพาะฟิลด์สำคัญ)

---

## 6. Data Retention & Backup

### 6.1 Retention Policy

- ข้อมูล `shipments`:
  - เก็บรายละเอียดเต็มอย่างน้อย 1–2 ปี สำหรับตรวจสอบย้อนหลัง
  - หลังจากนั้นสามารถ:
    - ลบหรือ anonymize ข้อมูลส่วนบุคคล (เช่น ลบชื่อ/เบอร์โทร/ที่อยู่ แต่เก็บจังหวัดและยอดเงินไว้สำหรับสถิติ)

- ข้อมูล `customers`:
  - เก็บเฉพาะลูกค้าที่ใช้งานในช่วง 1–2 ปีล่าสุด
  - ลูกค้าที่ไม่เคลื่อนไหวเลย (inactive) อาจถูก archive หรือลบตามนโยบาย

### 6.2 Backup & Recovery

- ทำ Backup DB อัตโนมัติ (Daily Backup)
- เก็บ snapshot ย้อนหลังอย่างน้อย 7–30 วัน
- ทดสอบการกู้คืน (Restore Test) เป็นระยะ
- เขียนขั้นตอน/เอกสารสำหรับกรณี DB มีปัญหา เพื่อให้เจ้าของสาขากลับมาใช้งานได้เร็วที่สุด

---

## 7. Third-Party & Integration Security

### 7.1 J&T System

- ถ้ายังไม่มี API:
  - การนำข้อมูลเข้า J&T ทำผ่าน Staff ที่กรอกในหน้าเว็บ J&T
  - ระวังไม่ให้ Export ข้อมูลออกจาก SmartShip แบบดิบ ๆ โดยไม่มีการป้องกัน

- ถ้ามี J&T API:
  - ใช้ API Key / OAuth ตามที่ระบบหลักกำหนด
  - จำกัดสิทธิ์ API Key ให้เข้าถึงเฉพาะ endpoint ที่จำเป็น
  - Log ทุกครั้งที่เรียก API และ Response สำคัญ (แต่ไม่ใส่ข้อมูลส่วนบุคคลใน log)

### 7.2 AI Services

- ส่งเฉพาะข้อมูลที่จำเป็นให้ AI (Data Minimization)
  - เช่น ที่อยู่ + รหัสไปรษณีย์ ไม่จำเป็นต้องใส่ชื่อจริง/เบอร์โทรเสมอไป
- ตรวจสอบ Terms & Privacy ของผู้ให้บริการ AI
- ไม่ส่งข้อมูลลับทางธุรกิจหรือ credentials ให้ AI

### 7.3 LINE / Other Channels

- เก็บเฉพาะ `line_user_id` หรือ token ที่จำเป็น
- ไม่ log access token หรือข้อมูลลับลงใน log ปกติ
- ตั้งค่า Webhook URL ให้เป็น HTTPS และใช้ path ที่คาดเดายาก

---

## 8. Operational Security (แนวทางการดูแลระยะยาว)

- อัปเดตเวอร์ชันของ:
  - n8n
  - Framework Web (เช่น Next.js)
  - Library ด้าน Security (เช่น Auth/DB Client)
  อย่างสม่ำเสมอเพื่อลดช่องโหว่
- ตรวจสอบสิทธิ์ผู้ใช้งานระบบเป็นระยะ:
  - ปิด user ของพนักงานที่ลาออก
  - จำกัดจำนวน admin account ให้น้อยที่สุด
- ทำ Pen-test หรือ Review ระบบเมื่อจะขยายไปใช้ในหลายสาขา

---
