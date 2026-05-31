# SmartShip — J&T Warehouse Module

> อัปเดต: 2026-05-30 | สถานะ: Phase 1-4 + Phase A เสร็จสมบูรณ์ + 8 commits merged เข้า main

หน้า `/admin/jt-warehouse` สำหรับ admin/staff ตรวจสอบพัสดุ J&T ที่ค้างจ่ายและพนักงานนำส่งของสาขา — ระบบ async upload tracking + smart queue + KPI gate ครบวงจร

---

## 📍 สถานะ Feature Matrix

| Phase | Feature | สถานะ |
|---|---|:---:|
| **1** | Health badge (data > 30 min stale) | ✅ |
| **1** | Manual upload modal | ✅ |
| **2** | "ปิดงาน" rule = 6 fields complete | ✅ |
| **2** | Lazy-load staff detail drawer | ✅ |
| **3** | COD bucket card + drill-down | ✅ |
| **3.5** | Daily filter (วันนี้/ทั้งหมด toggle) | ✅ |
| **3.5** | Alert summary card (pending/stuck/problem) | ✅ |
| **3.6** | Async upload tracking + polling | ✅ |
| **3.7** | Unified UploadJobsTray + Provider (3 modules) | ✅ |
| **3.8** | Smart queue (Max 2 concurrent) + auto-retry 2× | ✅ |
| **4** | Mid-day KPI gate (workload-based) | ✅ |
| **A** | Auto-sync infrastructure (DB + endpoints + UI card) | ✅ |
| **UX** | Collapsible sections (localStorage persist) | ✅ |
| **UX** | Staff grid cards (5 per row) | ✅ |
| **UX** | Empty state context-aware | ✅ |
| **B** | n8n auto-sync workflows (3 portals) | ⏳ pending |
| **5** | AI Tools + LINE OA cron | ⏳ pending |

---

## 🗄️ Database Migrations (apply ตามลำดับ)

```
✅ 20260528_warehouse_jt_parcels.sql              — schema หลัก 62 cols
✅ 20260528_warehouse_jt_summary_rpc.sql          — initial RPCs + last_upload view
✅ 20260528_warehouse_jt_closed_predicate.sql     — 6-field "ปิดงาน" rule
✅ 20260528_warehouse_jt_staff_detail.sql         — drawer RPC
✅ 20260528_warehouse_jt_cod_summary.sql          — COD bucket RPCs
✅ 20260528_warehouse_jt_arrived_date_helper.sql  — Excel serial parser
✅ 20260528_warehouse_jt_daily_filter.sql         — date filter on all RPCs
✅ 20260528_warehouse_jt_alert_summary.sql        — alert RPCs
✅ 20260528_jt_upload_jobs.sql                    — async job tracking
✅ 20260529_auto_sync_infrastructure.sql          — Phase A foundation
✅ 20260529_warehouse_jt_midday_kpi.sql           — Phase 4 KPI
✅ 20260529_warehouse_jt_midday_kpi_workload.sql  — KPI workload fix
```

**Verify**: 
```sql
-- ตรวจ functions
SELECT proname FROM pg_proc WHERE proname IN (
    'jt_text_is_filled',
    'jt_parcel_is_closed',
    'jt_parse_arrived_date',
    'get_warehouse_jt_branch_summary',
    'get_warehouse_jt_branch_staff_summary',
    'get_warehouse_jt_staff_detail',
    'get_warehouse_jt_cod_summary',
    'get_warehouse_jt_cod_bucket_list',
    'get_warehouse_jt_alert_summary',
    'get_warehouse_jt_alert_list',
    'get_warehouse_jt_midday_performance',
    'get_jt_warehouse_config',
    'set_jt_warehouse_config',
    'get_auto_sync_health',
    'increment_auto_sync_counter',
    'jt_upload_jobs_set_updated_at',
    'auto_sync_health_set_updated_at',
    'jt_warehouse_config_set_updated_at'
);
-- ควรเห็น 18 rows

-- ตรวจ tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN (
    'warehouse_jt_parcels',
    'jt_upload_jobs',
    'n8n_playwright_state',
    'auto_sync_health',
    'jt_warehouse_config'
);
-- ควรเห็น 5 tables

-- ตรวจ view
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' AND table_name = 'warehouse_jt_last_upload';
-- ควรเห็น 1 row
```

---

## 🛣️ API Routes

### Upload pipeline (Phase 3.6-3.8)
| Path | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/jt-parcel-n8n-upload` | POST | admin-or-staff | Stock (warehouse) upload — create job + proxy |
| `/api/admin/n8n-upload` | POST | admin-or-staff | JT Shipments upload |
| `/api/admin/tiktok-n8n-upload` | POST | admin-or-staff | TikTok upload |
| `/api/admin/jt-warehouse/upload-callback` | POST | Bearer secret | n8n ยิงผลลัพธ์กลับ |
| `/api/admin/jt-warehouse/upload-jobs` | GET | admin-or-staff | Polling status |

### Data queries (Phase 2-4)
| Path | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/jt-warehouse/staff-detail` | GET | admin-or-staff | Drawer detail |
| `/api/admin/jt-warehouse/cod-bucket` | GET | admin-or-staff | COD drill-down |
| `/api/admin/jt-warehouse/alert-list` | GET | admin-or-staff | Alert drill-down |
| `/api/admin/jt-warehouse/midday-performance` | GET | admin-or-staff | KPI data |
| `/api/admin/jt-warehouse/midday-config` | GET / PATCH | GET=staff, PATCH=admin | KPI config |

### Auto-sync foundation (Phase A)
| Path | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/auto-sync/state/[portal]` | GET / POST | Bearer secret | Playwright storage state |
| `/api/admin/auto-sync/health` | GET | admin-or-staff | Sync health card |

---

## 🎨 UI Components

### Page-level (Server Components)
- `app/admin/(dashboard)/jt-warehouse/page.tsx` — main page, SSR fetch RPCs

### Client Components
- `BranchStaffView.tsx` — main view (Meta strip + Branch tabs + KPI + Alert + COD + Banner + Staff grid)
- `MiddayKpiCard.tsx` — Phase 4 KPI gate + settings modal
- `StaffDetailModal.tsx` — Phase 2 drawer
- `CodBucketDrawer.tsx` — Phase 3 drill-down
- `AlertDrawer.tsx` — Phase 3.5 drill-down
- `JtParcelN8nUpload.tsx` — Phase 3.7 (1-line wrapper)

### Shared (in `app/admin/components/`)
- `CollapsibleSection.tsx` — reusable collapse wrapper
- `SimpleUploadModal.tsx` — reusable upload modal
- `UploadJobsTray.tsx` — floating tray (rendered in AdminClientWrapper)
- `AutoSyncHealthCard.tsx` — Phase A status card

### Provider
- `UploadJobsContext.tsx` — global job tracking + smart queue + retry

---

## 🔐 Environment Variables

```bash
# n8n webhooks (3 portals)
JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL=https://n8n.mybabymeal.com/webhook/upload_stock
NEXT_PUBLIC_N8N_UPLOAD_WEBHOOK_URL=...  # JT Shipments
TIKTOK_N8N_UPLOAD_WEBHOOK_URL=...

# n8n callback security
N8N_UPLOAD_CALLBACK_SECRET=<bearer secret>

# Upload limits
NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB=4.5

# AI tools (Phase 5 — pending)
N8N_AI_TOOLS_SECRET=...
```

---

## 📊 Business Rules (อ้างอิง memory)

> See [[project-jt-warehouse-business-rules]] memory file

### 1. "ปิดงาน" — 6 fields ครบ
```sql
public.jt_parcel_is_closed(
    signed_time, sign_branch_name, signed_record_time,
    signed_by_staff, signer_name, sign_time_status
)
```

### 2. รอบรับเข้า
- รอบเช้า: 06:00–10:00
- รอบบ่าย: 13:00–16:00

### 3. COD buckets
- < ฿1,000 / 1k–2k / 2k–5k / **> ฿5,000 ⚠️**

### 4. Mid-day KPI Gate
- เป้า: ≥ 20% ของ **workload** ก่อน 12:00
- Workload = `closed_today + pending_with_staff`
- Match J&T portal's "ต้องเซ็นรับวันนี้"

### 5. Smart Queue
- Max 2 concurrent uploads
- Auto-retry 2× × 30s delay
- Manual retry button on final fail

### 6. UX
- **Collapsible defaults**:
  - Auto-sync OK → auto-collapse
  - Alert/COD → default collapsed
  - KPI/Banner/Staff → default expanded
- **Persist** ใน localStorage: `jt-warehouse-section:{id}`
- **Staff grid**: responsive 2/3/4/5 cols
- **Empty state**: "วันนี้" → suggest "ทั้งหมด" + "อัปโหลด"

---

## 🧪 Verification Queries

```sql
-- 1. KPI ตอนนี้
SELECT public.get_warehouse_jt_midday_performance('604320');
-- ดู: workload_count, closed_count, closed_pct, status

-- 2. Alert summary
SELECT public.get_warehouse_jt_alert_summary('604320', CURRENT_DATE, CURRENT_DATE);
-- ดู: pending, stuck, problem

-- 3. COD breakdown
SELECT public.get_warehouse_jt_cod_summary('604320');
-- ดู: buckets {low, mid, high, very_high}

-- 4. Auto-sync health
SELECT * FROM public.get_auto_sync_health();
-- ดู: 3 rows (jt_parcel/jt_shipment/tiktok) + status

-- 5. Config
SELECT * FROM public.jt_warehouse_config;
-- ดู: midday_target_pct, midday_cutoff_hour
```

---

## 🎯 Manual Test Checklist

### UI Tests
- [ ] เปิด `/admin/jt-warehouse` แล้วโหลดสำเร็จ (no errors)
- [ ] Meta strip แสดง "อัปเดตล่าสุด" + รวม + สาขา + พนักงาน + toggle วันนี้/ทั้งหมด
- [ ] Branch card 604320 แสดงตัวเลขถูกต้อง
- [ ] **🤖 Auto-Sync card** — ย่อ/ขยายได้, แสดง stale/ok ตาม last_finished_at
- [ ] **🎯 KPI card** — แสดง workload + closed + %, ปุ่ม ⚙️ เปิด settings ได้
- [ ] **🚨 Alert card** — default collapsed, คลิก ▼ ขยาย, คลิก tile → drawer
- [ ] **💰 COD card** — default collapsed, คลิก ▼ ขยาย, คลิก tile → drawer
- [ ] **📦 Banner คลัง** — แสดงถ้ามี unassigned > 0
- [ ] **👥 Staff grid** — 5 cols (desktop), avatar + progress + COD, คลิก → modal
- [ ] Toggle วันนี้/ทั้งหมด → ตัวเลขเปลี่ยน
- [ ] Empty state วันนี้ → แสดงปุ่ม "ดูทั้งหมด" + "รีเฟรช"
- [ ] localStorage persist หลัง refresh

### Upload Tests
- [ ] กดปุ่ม 📋 upload → modal เปิด → เลือกไฟล์ → ส่ง
- [ ] Modal ปิดทันที, tray ขวาล่างแสดง "ประมวลผล"
- [ ] อัปโหลด 3 ไฟล์ติด → 2 active + 1 "รอคิว #1"
- [ ] อัปโหลดจากคนละหน้า (warehouse + tiktok) — เห็น 2 jobs ใน tray
- [ ] n8n เสร็จ → tray แสดง "สำเร็จ N รายการ" + toast เด้ง
- [ ] router.refresh() ทำงาน (ตัวเลขใหม่)
- [ ] Force fail (ตัด n8n) → "ลองใหม่ใน 30s (1/2)" → retry
- [ ] Retry exhausted → final error + ปุ่ม "ลองใหม่" manual

### KPI Tests
- [ ] Workload count ≈ J&T portal's "ต้องเซ็นรับวันนี้" (ส่วนต่าง < 5%)
- [ ] กดเฟือง → ปรับเป้า 20% → 25% → progress bar update
- [ ] ตอนเช้า (ก่อนอัปโหลด): status='behind' หรือ 'no_data'
- [ ] เลย 12:00: status='missed' (ถ้าไม่ผ่านเป้า) หรือ 'achieved'

---

## 🚧 Pending Tasks

### Phase 1 — User actions (n8n)
- [ ] ลบ "Insert rows in a table" node เก่าที่ error
- [ ] Activate manual upload workflows ทั้ง 3 ✅ (น่าจะทำแล้ว เพราะ upload ใช้ได้)

### Phase 3.6/3.7 — n8n callback updates
- [ ] JT Shipments workflow callback ✅ (ทำแล้วตอนแก้)
- [ ] Stock workflow callback ✅ (ทำแล้ว — affected_rows = 5640)
- [ ] TikTok workflow callback ✅ (ทำแล้ว — verified)

### Phase B — Auto-sync workflows (n8n + Playwright)
- [ ] ติดตั้ง n8n-nodes-playwright
- [ ] Credentials × 3 portals + LINE OA token
- [ ] Stock workflow (cron */15 6-20 + 0 21)
- [ ] TikTok workflow (cron 5 6-21)
- [ ] JT Shipments workflow (cron 10 6-21/3)
- [ ] Error trigger → LINE OA alert

### Phase 5 — AI Tools + LINE OA
- [ ] Endpoints: GET /api/ai-tools/jt-today-summary, etc. (gated by N8N_AI_TOOLS_SECRET)
- [ ] n8n AI Agent + LINE OA cron schedules
- [ ] Daily summary 21:30, mid-day check 11:30, COD alert event-based

---

## 📚 Related Files

- [docs/auto-sync-plan.md](auto-sync-plan.md) — Phase B detailed plan
- [docs/jt-warehouse-n8n-setup.md](jt-warehouse-n8n-setup.md) — manual upload setup
- Memory: `project-jt-warehouse-business-rules`
- Memory: `project-jt-warehouse`
- Memory: `project-ai-chat-architecture` (Phase 5 reference)

---

## 🎉 Production State (2026-05-30)

```
PR #57 merged → main → Vercel deployed
Total commits ahead of original: 25+
Total migrations: 12 (all applied)
Total new files (src): 11 components + 3 utilities + 11 routes
Total lines added: ~5,500
```

ระบบใช้งานจริงทุกวันใน production — admin team ใช้ตามรอบ
