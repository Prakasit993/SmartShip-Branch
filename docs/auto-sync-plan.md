# SmartShip — Auto-Sync Plan (3 portals)

> สร้าง: 2026-05-29 | สถานะ: Planning  
> ผู้ใช้กำหนด: Stock /15min · TikTok /1h · JT /3h | JT+TikTok cap 3000 rows/upload

แผนการสร้างระบบ auto-sync ดึงข้อมูลจาก 3 portals (J&T Warehouse / TikTok Shop / J&T Shipments) เข้า SmartShip โดยอัตโนมัติ

---

## 🎯 Requirements (จาก user)

| Portal | Frequency | Row cap/upload | Window |
|---|---|---|---|
| 📦 **Stock** (J&T Warehouse) | ทุก **15 นาที** | ไม่จำกัด (snapshot) | 06:00–21:00 |
| 🎵 **TikTok Shop** | ทุก **1 ชั่วโมง** | ≤ **3,000 rows** | 06:00–21:00 |
| 🚚 **JT Shipments** | ทุก **3 ชั่วโมง** | ≤ **3,000 rows** | 06:00–21:00 |

**คอนสเตรนต์**: ไม่ต้องการรันพร้อมกัน (ป้องกัน RAM overload — server 5.8 GB)

---

## 📅 Schedule Matrix (offset เพื่อกัน collision)

ใช้ minute offset แยก start time:

| Time | Stock 📦 | TikTok 🎵 | JT 🚚 |
|---|:---:|:---:|:---:|
| **06:00** | ✓ | | |
| 06:05 | | ✓ | |
| 06:10 | | | ✓ |
| 06:15 | ✓ | | |
| 06:30 | ✓ | | |
| 06:45 | ✓ | | |
| **07:00** | ✓ | | |
| 07:05 | | ✓ | |
| 07:15 | ✓ | | |
| ... | ... | ... | ... |
| **09:00** | ✓ | | |
| 09:05 | | ✓ | |
| 09:10 | | | ✓ |
| ... | ... | ... | ... |

**Cron expressions**:
```
Stock:    */15 6-20 * * *  +  0 21 * * *      (60 runs/day + 1 = 61)
TikTok:   5 6-21 * * *                         (16 runs/day)
JT:       10 6-21/3 * * *                      (6 runs/day @ 06,09,12,15,18,21)
```

**Total**: ~83 runs/day แต่ **ห่างกันอย่างน้อย 5 นาที** เสมอ

### Safety: n8n workflow settings
ตั้ง **"Max concurrent executions per workflow = 1"** — กันรอบใหม่เริ่มก่อนรอบเก่าจบ
+ ตั้ง **execution timeout = 5 นาที** — กัน Playwright ค้าง

---

## 🏗️ Architecture (per workflow)

```
┌────────────────────────────────────────────────────────────────┐
│ [Schedule Trigger]                                             │
│   cron + Asia/Bangkok                                          │
│        ↓                                                       │
│ [Read storage state from DB]                                   │
│   GET /api/admin/auto-sync/state/<portal>                      │
│   → cookies + localStorage JSON                                │
│        ↓                                                       │
│ [Playwright: Launch + restore state]                           │
│   chromium.launchPersistentContext({ storageState })           │
│        ↓                                                       │
│ [Navigate portal]                                              │
│   if (login required) → login + save new state                 │
│        ↓                                                       │
│ [Set date filter] ⚠️ สำคัญสำหรับ JT + TikTok                  │
│   - JT: ดู records ของ 3.5 ชม.ที่ผ่านมา                       │
│   - TikTok: ดู records ของ 1.5 ชม.ที่ผ่านมา                   │
│   - Stock: ไม่ต้อง (snapshot ปัจจุบัน)                         │
│        ↓                                                       │
│ [Click "ส่งออกข้อมูล"]                                          │
│   → wait for download                                          │
│        ↓                                                       │
│ [Save storage state ใหม่]                                       │
│   POST /api/admin/auto-sync/state/<portal>                     │
│        ↓                                                       │
│ [Execute Workflow → Manual Upload]                             │
│   → ส่งไฟล์ผ่าน existing manual webhook                       │
│   → reuse parse + insert + audit + callback logic              │
│        ↓                                                       │
│ [Update auto_sync_health]                                      │
│   last_status = 'success' / 'error'                            │
│        ↓                                                       │
│ [Error trigger → LINE OA] (ถ้าพัง)                            │
└────────────────────────────────────────────────────────────────┘
```

---

## 📂 Row Cap Strategy (≤ 3,000 rows)

### 🚚 JT Shipments — ทุก 3 ชม.

**Logic**: Export records ที่อยู่ใน **ช่วง 3.5 ชม.ก่อนเวลา trigger** (overlap 30 นาทีกัน gap)

Portal action:
```
1. ไปหน้า "รายการพัสดุ"
2. ตั้ง filter: latest_scan_time >= now() - 3.5 hr
3. Export
```

**คาดการณ์**: J&T มี ~1,500 ใบ/วัน → 3 ชม. ≈ 200 ใบ ✅ (น้อยกว่า 3000 มาก)

### 🎵 TikTok — ทุก 1 ชม.

**Logic**: Export records **ช่วง 1.5 ชม.ก่อน trigger**

Portal action:
```
1. ไปหน้า "Shipping Management"
2. ตั้ง filter: create_time >= now() - 1.5 hr
3. Export
```

**คาดการณ์**: TikTok ~500 ใบ/วัน → 1 ชม. ≈ 30-50 ใบ ✅

### 📦 Stock — ทุก 15 นาที

**Logic**: Snapshot ปัจจุบันทั้งหมด (ไม่ filter)

Portal action:
```
1. ไปหน้า "การควบคุมนำจ่ายของ DP ปลายทาง"
2. ตั้ง filter: 04Thanyaburi062 (สาขา)
3. Export
```

**คาดการณ์**: ~5,800 rows snapshot — TRUNCATE+INSERT ใน DB

### 🛡️ Failsafe: Row check ก่อน upload

หลัง download → parse Excel แล้วนับแถว:
- ถ้า **> 3,000** (JT/TikTok) → split เป็นหลาย uploads
- หรือ → ส่ง alert "data overflow — manual review needed"

---

## 💾 Storage State Management

### ทำไมต้องมี?
- Playwright login ใช้เวลานาน + เสี่ยง captcha
- เก็บ session ไว้ใช้ซ้ำ → Workflow แต่ละรอบเริ่มเร็ว
- Session expire เมื่อไหร่ → login ใหม่ + บันทึก state ใหม่

### Schema (DB)
```sql
CREATE TABLE n8n_playwright_state (
    portal      text PRIMARY KEY,    -- 'jt' | 'tiktok' | 'stock'
    storage_state jsonb NOT NULL,    -- cookies + localStorage
    updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### Endpoints (Next.js)
```
GET  /api/admin/auto-sync/state/[portal]    → คืน { storage_state }
POST /api/admin/auto-sync/state/[portal]    → รับ { storage_state } บันทึก

Auth: Bearer N8N_UPLOAD_CALLBACK_SECRET (ใช้ secret เดิม)
```

### n8n logic
```js
// 1. Read state
const res = await fetch(`${BASE}/api/admin/auto-sync/state/jt`, {
    headers: { Authorization: `Bearer ${SECRET}` }
});
const { storage_state } = await res.json();

// 2. Launch Playwright
const context = await chromium.launchPersistentContext('', { storageState: storage_state });

// 3. หลัง login (ถ้าทำ) — บันทึก state ใหม่
await fetch(`${BASE}/api/admin/auto-sync/state/jt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_state: await context.storageState() })
});
```

---

## 🩺 Health Monitoring

### Schema (DB)
```sql
CREATE TABLE auto_sync_health (
    kind                text PRIMARY KEY,           -- 'jt_parcel'|'jt_shipment'|'tiktok'
    last_started_at     timestamptz,
    last_finished_at    timestamptz,
    last_status         text,                       -- 'success'|'error'|'running'
    last_affected_rows  integer,
    last_error          text,
    updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### Endpoint
```
GET /api/admin/auto-sync/health
→ คืน [{kind, last_finished_at, last_status, last_affected_rows, last_error}, ...]
```

### UI Card (ใน dashboard ของแต่ละ module)
```
┌─ 🤖 Auto-Sync Status ─────────────────────┐
│ 📦 Stock      ✅ ok    5 min ago  5,840 │
│ 🎵 TikTok     ✅ ok   23 min ago     42 │
│ 🚚 JT         ⚠️ stale 4 hr ago     156 │  ← > 3h = stale
│                                            │
│ [🔄 Trigger ทันที]  [📜 ดู logs]           │
└────────────────────────────────────────────┘
```

ถ้า `last_finished_at` ค้างเกิน threshold (1.5× ของ frequency) → badge stale + LINE OA alert

---

## ⚠️ Error Handling Matrix

| Error type | Action | Alert |
|---|---|---|
| Login fail (wrong credentials) | Stop workflow | LINE OA — "Portal credentials expired" |
| Captcha challenge | Pause + Save partial state | LINE OA — "Manual login needed" |
| Network timeout (portal) | Retry 2× with 30s backoff | (silent ถ้า retry สำเร็จ) |
| Export button missing (UI change) | Stop workflow | LINE OA — "Portal UI changed" |
| Download empty file | Mark error + continue | LINE OA — "Empty export" |
| File > 3,000 rows (JT/TikTok) | Split + multiple uploads | (info only) |
| Upload webhook fail | Save error in health | LINE OA — "Upload failed" |
| OOM / Playwright crash | n8n auto-retry workflow | LINE OA — "Playwright OOM" |

### Error Trigger Workflow (n8n)
```
[Error Trigger]                  ← ดักทุก workflow ที่ error
    ↓
[Switch by workflowId]
    ↓
[HTTP Request → LINE OA push]
    Body: {
      to: ADMIN_LINE_USER_ID,
      messages: [{
        type: "text",
        text: "🔴 {{ portal }}\n{{ workflow_name }}\n{{ error_message }}\n{{ timestamp }}"
      }]
    }
```

---

## 🔐 Environment Variables (เพิ่ม)

```bash
# Storage state + health endpoints (ใช้ secret เดิม)
N8N_UPLOAD_CALLBACK_SECRET=<existing>

# Portal credentials (ใน n8n Variables — sensitive)
JT_PORTAL_URL=https://jt-portal.example.com
JT_PORTAL_USER=<username>
JT_PORTAL_PASS=<password>

TIKTOK_PORTAL_URL=https://shop.tiktok.com
TIKTOK_PORTAL_USER=<username>
TIKTOK_PORTAL_PASS=<password>

STOCK_PORTAL_URL=https://...
STOCK_PORTAL_USER=<username>
STOCK_PORTAL_PASS=<password>

# Branch code สำหรับ Stock
STOCK_BRANCH_CODE=04Thanyaburi062

# LINE OA
LINE_OA_TOKEN=<channel access token>
LINE_OA_ADMIN_ID=<admin user id>
```

---

## 📋 Implementation Checklist

### Phase A — Foundation (ทำก่อน — ผม)
- [ ] **#23** สร้าง DB schema: `n8n_playwright_state` + `auto_sync_health`
- [ ] **#24** สร้าง 3 endpoints: state read/write + health
- [ ] **#25** Auto-sync health card UI ใน 3 dashboards
- [ ] อัปเดต upload-callback ให้บันทึก `auto_sync_health` ด้วย

### Phase B — n8n workflows (user ทำ)
- [ ] Install n8n Playwright community node (หรือ Puppeteer fallback)
- [ ] เก็บ credentials portal × 3 ใน n8n Variables
- [ ] เก็บ LINE OA token ใน n8n Variables
- [ ] **Workflow 1: Stock** — schedule */15 + Playwright + Execute Workflow
- [ ] **Workflow 2: TikTok** — schedule 5 6-21 + Playwright + date filter + Execute Workflow
- [ ] **Workflow 3: JT** — schedule 10 6-21/3 + Playwright + date filter + Execute Workflow
- [ ] **Error Workflow** — ดักจาก 3 workflows + LINE OA push

### Phase C — Testing
- [ ] Manual trigger แต่ละ workflow → ตรวจ tray + health card
- [ ] รัน schedule 1 วัน → ตรวจ run count ตรง matrix
- [ ] Simulate error (เปลี่ยน password) → ตรวจ LINE alert มา
- [ ] ตรวจ session reuse (login แค่ครั้งแรก)
- [ ] ตรวจ row cap (ถ้าไฟล์ > 3000)

---

## 🚨 Risk Assessment

| Risk | Severity | Mitigation |
|---|:---:|---|
| Portal เปลี่ยน UI (selector แตก) | 🔴 High | Error trigger + LINE alert ทันที |
| Captcha บล็อก | 🟠 Med | Storage state + manual fallback |
| RAM OOM (3 Playwright พร้อมกัน) | 🟠 Med | Time offset + max concurrent=1 + timeout |
| Session expire ระหว่าง business hours | 🟡 Low | Auto re-login + บันทึก state ใหม่ |
| File > 3,000 rows (JT/TikTok) | 🟡 Low | Row check + split logic |
| Network blip → upload fail | 🟡 Low | Retry 2× ใน n8n |
| 2 รอบเริ่มพร้อมกัน (cron skew) | 🟢 Very Low | Max concurrent = 1 ใน workflow |

---

## ⚡ Quick Start (Recommended Order)

```
Day 1: ☐ Phase A (DB + endpoints + UI)              ← ผม implement
Day 2: ☐ User: ติดตั้ง Playwright node + credentials
Day 3: ☐ User: Workflow Stock (ง่ายสุด — ทดสอบ pipeline)
Day 4: ☐ User: Workflow TikTok (date filter)
Day 5: ☐ User: Workflow JT (date filter)
Day 6: ☐ Error trigger + LINE OA setup
Day 7: ☐ Full integration test + monitoring 1 วัน
```

---

## 📚 Related Files

- [docs/jt-warehouse-guide.md](jt-warehouse-guide.md) — overview ระบบ J&T warehouse
- [docs/jt-warehouse-n8n-setup.md](jt-warehouse-n8n-setup.md) — n8n manual upload setup
- Memory: `project_jt_warehouse_business_rules` — closed/COD/KPI rules
- Memory: `project_jt_warehouse` — technical architecture

---

## 🎯 Decision Points (ต้องตอบก่อนเริ่ม Phase B)

1. **Playwright node**: ติดตั้ง community node `n8n-nodes-playwright` หรือใช้ external service?
2. **Captcha**: Portal มี captcha ไหม? ถ้ามี → strategy?
3. **Portal API**: มี API ทางการแทนการ scrape ไหม? (เร็วกว่าและเสถียรกว่า)
4. **LINE OA**: มี channel access token พร้อมไหม?
5. **Trigger ทันที button**: ต้องการให้ admin กดบน UI ได้ไหม? (Phase A3)
