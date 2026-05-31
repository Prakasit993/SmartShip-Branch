# J&T Warehouse — Verification Checklist

> สำหรับยืนยันสถานะระบบก่อนเริ่ม phase ถัดไป (Phase B หรือ Phase 5)  
> วันที่: 2026-05-30

---

## 🟢 ✅ สิ่งที่ verified แล้ว

### DB
- [x] 12 migrations apply ครบ
- [x] 18 functions/RPCs ทำงาน
- [x] 5 tables + 1 view present
- [x] RLS policies ถูกต้อง
- [x] Triggers updated_at ทำงาน

### API endpoints (12 routes)
- [x] Upload routes 3 ตัว (jt-parcel/jt-shipment/tiktok) ทำงาน + tracking
- [x] Upload callback verify Bearer + UPDATE health
- [x] Polling endpoint คืนสถานะ
- [x] Data query RPCs ทั้งหมด
- [x] Config GET/PATCH (admin-only validation)
- [x] Auto-sync state read/write (Bearer secured)
- [x] Auto-sync health (admin-or-staff)

### UI
- [x] Page render สำเร็จ (no console errors)
- [x] Meta strip: time + counts + toggle + refresh
- [x] Health badge (stale > 30 min in work hours)
- [x] Branch tabs grid
- [x] Mid-day KPI card + settings modal (admin save)
- [x] Auto-sync health card (Phase A)
- [x] Alert summary (collapsible default)
- [x] COD bucket card (collapsible default)
- [x] Banner ยังอยู่ในคลัง
- [x] Staff grid 5 cols + avatar + progress + COD
- [x] Click card → StaffDetailModal เปิด
- [x] Modal: counts + COD breakdown + top 20 pending
- [x] CodBucketDrawer drill-down
- [x] AlertDrawer drill-down

### Upload flow
- [x] Modal เลือกไฟล์ → submit → job created
- [x] Tray ขวาล่าง progress + duration
- [x] Smart queue: 3 concurrent → 2 active + 1 queued
- [x] Auto-retry: fail → "ลองใหม่ใน 30s (1/2)"
- [x] Manual retry button on final error
- [x] Concurrent uploads ข้าม module (warehouse + tiktok) ใช้พร้อมกันได้
- [x] Toast notification ตอน job เสร็จ
- [x] router.refresh() ทำงาน

### KPI accuracy
- [x] Workload denominator ตรงกับ J&T portal (~95% match)
- [x] Closed count match J&T's signed count
- [x] Status: behind/achieved/missed/no_data ถูกต้อง
- [x] Cutoff hour configurable
- [x] Target % configurable

### UX polish
- [x] Collapsible: คลิก ▼/▲ ทำงาน
- [x] localStorage persist หลัง refresh
- [x] Empty state context-aware (วันนี้ → suggest ทั้งหมด)
- [x] Daily toggle: วันนี้/ทั้งหมด ใช้งานได้

---

## 🟡 ⏳ Pending Verification

### n8n callback (Phase 3.6/3.7)
- [x] JT Warehouse (stock) → tested OK
- [x] TikTok Shipments → tested OK
- [x] JT Shipments → tested OK

### Auto-sync foundation (Phase A)
- [x] DB tables/functions deployed
- [x] Endpoints ready
- [x] Health card shows "stale" correctly
- [ ] **ไม่ได้ทดสอบกับ n8n จริง** — รอ Phase B implement

### Phase B — Auto-sync workflows
- [ ] **ไม่ได้เริ่ม** — รอ portal credentials × 3 + LINE OA token

### Phase 5 — AI Tools
- [ ] **ไม่ได้เริ่ม** — รอตัดสินใจ schedule + endpoints

---

## 📝 Known Discrepancies (acceptable)

### KPI workload vs J&T portal
- ของเรา: workload_count = closed_today + pending_with_staff
- J&T: ต้องเซ็นรับวันนี้ (อาจกรอง problem/returned/stuck เพิ่ม)
- **ส่วนต่างประมาณ < 5%** — acceptable สำหรับ KPI tracking

### Auto-sync card "ข้อมูลค้าง"
- ตอนเช้าก่อน upload แรกของวัน → ห่างจากเมื่อวานเกิน 30 นาที = stale
- เป็นพฤติกรรมที่ถูกต้อง (warning ตามที่ออกแบบไว้)
- จะเปลี่ยนเป็น "ทำงานปกติ" หลัง auto-sync workflow ทำงาน (Phase B)

---

## 🎯 Next Step Decision

### Option A — Phase B (Auto-sync workflows) ⏰
**ใช้เวลา**: 2-3 ชั่วโมง dev + setup credentials  
**ต้องการ**: portal credentials × 3 + LINE OA token  
**Output**: 3 n8n workflows + Playwright + error alert

### Option B — Phase 5 (AI Tools + LINE OA) 🤖
**ใช้เวลา**: 2-3 ชั่วโมง dev  
**ต้องการ**: เพิ่ม AI endpoints + n8n AI agent setup  
**Output**: AI สามารถดึงข้อมูล warehouse และส่ง LINE OA daily summary

### Option C — Refinement + Bug fixes 🔧
**ใช้เวลา**: ตาม backlog  
**Output**: ปรับปรุง edge cases + UX small wins

---

## 📊 Statistics

```
Branch: claude/clever-lamarr-91e924 → main (merged)
Phases complete: 1 (partial) + 2, 3, 3.5, 3.6, 3.7, 3.8, 4, A + UX
Code lines added: ~5,500
Files added: 25+
Migrations: 12
RPCs: 18 (helper + query + mutation)
Endpoints: 12
UI components: 11+
```

ระบบ production-ready สำหรับ daily admin operations
