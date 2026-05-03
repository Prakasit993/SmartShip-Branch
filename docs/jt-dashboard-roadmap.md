# JT Dashboard — Roadmap (Pack 2 / Pack 3 / Other)

> เอกสารฉบับนี้เขียนไว้เป็น **handoff** ให้ agent รอบถัดไปทำงานต่อ หลัง Pack 1 (Chart polish) เสร็จแล้ว
> อัปเดตครั้งสุดท้าย: 2026-05-03 — หลังจบ Pack 1 (A1 tooltip + A6 X-axis ticks + A9 zero-day marker)

---

## 0. สถานะปัจจุบัน (เสร็จแล้ว)

| เฟส | ผลลัพธ์ | Commit/File หลัก |
|---|---|---|
| **P1** | แทน `Number(...)` ด้วย `parseJtMoneyText` กันข้อมูลตก | `app/api/admin/jt-shipments/stats/route.ts` |
| **P2** | RPC `jt_dashboard_fixed_totals` + TS พร้อม fallback | `app/api/admin/jt-shipments/dashboard/route.ts` |
| **P3** | RPC `jt_stats_summary` + `jt_channel_label` + `jt_shipping_fee_bucket` | `app/api/admin/jt-shipments/stats/route.ts` |
| **P4** | Delta badges (เทียบช่วงก่อน) บน 4 KPI cards แถวแรก | `JtDashboardView.tsx` → `DeltaBadge` + `AnimatedKpiCard.delta` |
| **P6** | ขยาย RPC + เพิ่ม 4 KPI cards แถว 2 (JMS revenue, COD paid/pending, collection rate) | `jtDashboardTypes.ts`, `JtDashboardView.tsx` |
| **Pack 1** | Chart tooltip + X-axis ticks (สัปดาห์) + zero-day pill marker + weekend badge | `JtDashboardDailyCharts.tsx` — fn `computeAxisTicks`, `ChartXAxis`, `dayOfWeekInfo` |

### RPC ที่อยู่ใน Supabase แล้ว (อย่าลบ)

```sql
-- พื้นฐาน
jt_text_to_numeric(text) returns numeric
jt_channel_label(platform text, order_source text) returns text
jt_shipping_fee_bucket(channel_label text) returns text

-- อัพเดตล่าสุด 11 คอลัมน์
jt_dashboard_fixed_totals(p_date_from text, p_date_to text)
  returns table (total_count, sum_cod, sum_fee_positive, count_fee_positive, return_count,
                 sum_total_fee_jms, cod_paid_count, cod_paid_amount,
                 cod_pending_count, cod_pending_amount, cod_no_collection_count)

-- consolidated stats
jt_stats_summary(p_date_from text, p_date_to text) returns jsonb
```

---

## 1. Pack 2 — Custom Metric Modal Polish (อันดับถัดไป)

**Goal**: ปรับฟอร์ม "เพิ่มการ์ดสรุป" ให้ admin สร้างการ์ดได้เร็ว แม่น และมั่นใจก่อนกด บันทึก

**Files ที่ต้องแก้หลัก**
- `app/admin/(dashboard)/jt-dashboard/JtDashboardCustomMetrics.tsx` — ฟอร์ม modal
- `lib/jtCustomMetricCards.ts` — definition schema (อาจต้องเพิ่ม field ใหม่)
- `lib/jtCustomMetricAccumulators.ts` — logic คำนวณ client-side

### B1. Live Preview 🔥🔥🔥
หลัง user เลือก field + operator + value + method ให้แสดงตัวเลขที่จะคำนวณได้จริงก่อนกดบันทึก

**Approach**
- ใช้ data ที่โหลดแล้วใน dashboard (เก็บ cache ของ rows ล่าสุด ~หรือเรียก RPC preview)
- วิธีเร็ว: สุ่ม sample 100–500 rows จาก dashboard context แล้วลองรัน accumulator
- วิธีแม่น: สร้าง RPC ใหม่ `jt_custom_metric_preview(p_definition jsonb, p_date_from, p_date_to)` — จะเสีย round-trip แต่ถูกต้อง

**UX**
```
[Field] [Op] [Value]
        ↓ (debounce 400ms)
┌─────────────────────────┐
│ ตัวอย่างผลลัพธ์         │
│ 1,234 เคส · จาก 28,295  │
│ ของข้อมูลทั้งหมด (4.4%) │
└─────────────────────────┘
```

### B2. Preset Filter Chips 🔥🔥🔥
แทนที่จะให้ admin พิมพ์ filter ด้วยมือ เพิ่ม chip ที่คลิกเติมได้เลย

**ชุด chip ที่ควรมี**
- Channel: `JMS` / `Marketplace (TikTok/Shopee/Lazada)` / `Other`
- COD status: `เก็บเงินแล้ว` / `รอเก็บ` / `ไม่มี COD` / `ส่งคืน`
- Return: `มีคำว่า "ตีกลับ" ใน latest_scan_type`

**Implementation hint**
- Mapping chip → filter: เช่น chip "JMS" → `{ column: '__derived_bucket', op: 'eq', value: 'jms' }`
- ต้องเพิ่ม derived columns ใน accumulator ที่รันผ่าน `jt_channel_label` + `jt_shipping_fee_bucket` ฝั่ง client (logic อยู่แล้วใน TS) หรือทำ RPC filter ใหม่

### B4. Format Options (prefix / suffix / decimals) 🔥🔥
ปัจจุบันเดาอัตโนมัติจาก method (count → int, sum/avg → money) — ให้ admin override ได้

**เพิ่ม field ใน `JtCustomMetricCardDefinition`**
```ts
format?: {
  prefix?: string;   // "฿", "$"
  suffix?: string;   // "%", "เคส", "kg"
  decimals?: number; // 0-4
  divideBy?: number; // สำหรับ "/100" → percent display
};
```

### B5. Inverse Good Toggle 🔥🔥
ปัจจุบัน delta badge เขียวเมื่อขึ้น แดงเมื่อลง — แต่บาง metric "ขึ้น = แย่" (เช่น returnCount, pendingAmount)

**เพิ่ม field**
```ts
inverseGood?: boolean; // default false; true → ขึ้น=แดง, ลง=เขียว
```

แล้วส่งต่อไป `DeltaBadge` ที่รับ prop นี้อยู่แล้ว (ดูใน `JtDashboardView.tsx`)

### UI Mockup (ประมาณ)
```
┌──────────────────────────────────────────┐
│ เพิ่มการ์ดสรุป                     [×]   │
├──────────────────────────────────────────┤
│ ชื่อ: [______________________]           │
│                                          │
│ 🎯 Preset filter (คลิกเพื่อเติม)        │
│ [JMS] [Marketplace] [เก็บแล้ว] [รอเก็บ] │
│                                          │
│ กรองแบบละเอียด (optional)                │
│ [Field▾] [Op▾] [Value___]  [+ เพิ่ม]    │
│                                          │
│ วิธีคำนวณ: [Count ▾]                    │
│                                          │
│ Format                                   │
│   Prefix: [฿]  Suffix: [เคส]            │
│   Decimals: [2]  ☐ inverse-good         │
│                                          │
│ 👁 ตัวอย่าง: ฿1,234.56 (↑ 12.3%)        │
│                                          │
│          [ยกเลิก]  [บันทึก]              │
└──────────────────────────────────────────┘
```

---

## 2. Pack 3 — Business Deep-Dive Charts

**Goal**: ใช้ประโยชน์จาก channel split (JMS/Marketplace/Other) ในกราฟให้เต็มที่

### A2. 7-day Moving Average Line 🔥🔥🔥
ช่วยอ่าน trend เวลาข้อมูล sparse — เส้นจะ smooth ผ่านจุดว่าง

**Approach**
- คำนวณฝั่ง client ใน `JtDashboardDailyCharts.tsx`
- สูตร: `avg[i] = mean(data[max(0, i-3) : min(n, i+4)])` (3 ก่อน + วันปัจจุบัน + 3 ถัดไป)
- Render เป็น `<svg>` overlay บนแท่ง — polyline + circle markers
- ใช้ path: `M x0,y0 L x1,y1 ...` โดย x = `(i + 0.5) / n × width`, y = `height × (1 - avg[i] / maxValue)`

**Caveat**: SVG overlay ต้อง `pointer-events: none` ไม่ให้บัง hover แท่ง และ z-index > grid lines, < tooltip

### A3. Stacked Bar by Channel 🔥🔥🔥
กราฟ count/fee/cod แบ่งเป็น 3 สีตาม bucket (JMS/Marketplace/Other)

**Data requirements**
- RPC `jt_daily_breakdown(p_date_from, p_date_to)` — return rows `{date, bucket, count, cod, fee}`
- หรือขยาย `jt_stats_summary` ให้รวม daily breakdown

**Implementation**
1. สร้าง RPC ใหม่หรือขยาย daily stats endpoint
2. แก้ `JtDashboardChartsPayload` — เพิ่ม `byBucket: Array<{date, jms, marketplace, other}>`
3. Render: แท่งเดียวสูง = total, แต่ข้างในเป็น 3 ช่วง stacked (JMS ล่าง, marketplace กลาง, other บน)
4. Legend: 3 จุดสีพร้อมชื่อ ใต้หัวกราฟ

**สี**
- JMS: emerald-500
- Marketplace: sky-500
- Other: slate-500

---

## 3. อื่นๆ (ตามที่ user ยังไม่เลือก — menu สำหรับรอบหน้า)

| ID | รายการ | Effort | Impact | หมายเหตุ |
|----|---|:---:|:---:|---|
| **A4** | Toggle Daily / Weekly / Monthly | M | 🔥🔥 | ช่วยดู trend ระยะยาว — ต้อง aggregate client-side หรือ RPC |
| **A5** | Ghosted line ช่วงก่อนเทียบ | M | 🔥🔥 | ต้อง fetch previous period data แยก; แสดงเป็น polyline จาง |
| **A7** | Weekend shading | S | 🔥 | วาด `<rect>` สีพื้นซ่อน ส.-อา. (ข้อมูล dow มีใน `dayOfWeekInfo` แล้ว) |
| **A8** | Export CSV ต่อกราฟ | S | 🔥 | ปุ่ม "ดาวน์โหลด CSV" ข้างๆ หัวกราฟ — convert rows → csv blob |
| **B3** | Multiple filters AND | M | 🔥🔥🔥 | เปลี่ยน schema `filter` จาก obj เดียวเป็น array; UI เพิ่มปุ่ม "+ เงื่อนไข" |
| **B6** | Target / Goal + progress bar | M | 🔥🔥 | เพิ่ม `target?: number` ใน def; แสดง mini progress bar ใต้ value |
| **B7** | Duplicate card button | S | 🔥🔥 | ในการ์ด mode edit — ปุ่ม "ทำซ้ำ" copy definition แล้วแก้ title |
| **B8** | Drag-to-reorder | M | 🔥🔥 | ใช้ `@dnd-kit/core` หรือ `react-dnd`; persist order ใน settings table |
| **B9** | Card size 1× / 2× | S | 🔥 | เพิ่ม `size?: 'normal' \| 'wide'`; ใช้ `col-span-2` เมื่อ wide |
| **B10** | Formula mode (advanced) | L | 🔥 | Parser expression ง่าย ๆ เช่น `cod_paid_amount / total_count × 100` |
| **P5** | Auto-refresh dashboard | M | 🔥🔥 | Polling ทุก N วินาที หรือ Supabase realtime subscription |

---

## 4. Verification Checklist (ทำหลัง Pack 2/3 ของรอบหน้า)

- [ ] `npm run build` ผ่านไม่มี error
- [ ] `ReadLints` บนไฟล์ที่แก้ — ไม่มี lint error
- [ ] Dev server: รีโหลด `/admin/jt-dashboard` — ไม่มี error ใน console
- [ ] Network response `/api/admin/jt-shipments/dashboard` — field ใหม่ปรากฏครบ
- [ ] Network response `/api/admin/jt-shipments/stats` — `_aggregate_source: "rpc"`
- [ ] Test แต่ละ KPI card จำนวนเคสตรงกับ diagnostic SQL (ดู cross-tab ใน `docs/jt-dashboard-data-sources.md` ถ้ามี หรือจาก conversation history)

---

## 5. Gotchas / Things to Remember

1. **`shipping_fee` vs `total_shipping_fee`**
   - `shipping_fee` = ค่าส่งต่อพัสดุเดี่ยว (ใช้ใน avgShippingFee)
   - `total_shipping_fee` = ยอดรวมของ shipment ทั้ง batch — ใช้ใน JMS revenue
   - อย่าสับสนกันใน SQL/TS

2. **PostgREST `max-rows` = 1000** — ใช้ `AGG_PAGE = 1000` เท่านั้น ห้าม 5000 หรือ 10000
3. **COD state classification** ใช้ตรรกะเดียวกันใน SQL + TS:
   ```
   cod_amount = 0          → 'no_cod'
   cod_status LIKE 'ชำระ%' → 'paid'
   otherwise (> 0)          → 'pending'
   ```
4. **RPC return type เปลี่ยน** ต้อง `DROP FUNCTION` ก่อน `CREATE OR REPLACE` — Postgres block การเปลี่ยน column shape
5. **Custom metrics คำนวณฝั่ง TS** — ถ้าเพิ่ม custom card, route จะต้อง paginate 1 รอบ (cost ~ +7s สำหรับ 28k rows)
6. **Previous period = same day-count shift back** — ไม่ใช่ "เดือนก่อน" หรือ "ปีก่อน" (ดู `previousPeriod()` ใน route.ts)

---

## 6. การเริ่มรอบใหม่ — สั่ง agent แบบไหน

ตัวอย่าง prompt ให้ agent รอบหน้า:

> อ่าน `docs/jt-dashboard-roadmap.md` แล้วทำ **Pack 2 (Modal polish)** ตามลำดับ B1 → B2 → B4 → B5 โดย:
> 1. แก้ `JtDashboardCustomMetrics.tsx` เท่านั้น (ถ้าจำเป็นค่อยแตะ type)
> 2. ไม่เปลี่ยน RPC ใน Supabase (ใช้ data ที่ route ส่งมาแล้ว)
> 3. หลังแก้เสร็จ เช็ค `ReadLints` + ทดลอง `npm run dev` ให้แน่ใจว่า compile สำเร็จ
> 4. สรุปผลงานในรูปแบบ bullet list พร้อมภาพประกอบ (ถ้าผู้ใช้ขอ)

หรือ

> อ่าน `docs/jt-dashboard-roadmap.md` แล้วต่อที่ **Pack 3** — เริ่มด้วย A2 (7-day moving average line) ก่อน เพราะไม่ต้องแก้ RPC

---

**End of roadmap** — ลบไฟล์นี้ได้เมื่อ Pack 2/3 เสร็จครบ
