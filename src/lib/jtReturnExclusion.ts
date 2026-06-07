/**
 * รายชื่อสาขา/พนักงานที่ถือว่า "ปิดงานตีกลับแล้ว" → ตัดออกจากการ์ด "พัสดุถูกตีกลับ"
 * เก็บใน settings.key = jt_return_exclusion (แก้ได้จากหน้า dashboard, ไม่ hardcode)
 *
 * ค่า default = ค่าที่เคย hardcode ไว้เดิม เพื่อให้พฤติกรรมไม่เปลี่ยนจนกว่าแอดมินจะแก้
 */

export const JT_RETURN_EXCLUSION_SETTINGS_KEY = 'jt_return_exclusion';

export type JtReturnExclusionConfig = {
    /** ตรงกับ jt_shipments.sign_branch_name แบบ exact (trim แล้ว) */
    signBranchNames: string[];
    /** ตรงกับ jt_shipments.delivery_staff_id แบบ exact (trim แล้ว) */
    deliveryStaffIds: string[];
};

/** ค่าเริ่มต้น = ค่าที่ hardcode ไว้เดิมก่อนย้ายมาเป็น settings */
export const DEFAULT_JT_RETURN_EXCLUSION: JtReturnExclusionConfig = {
    signBranchNames: ['04Lam Luk Ka067'],
    deliveryStaffIds: ['604911501', '604911502', '604911503'],
};

function toCleanStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
        const v = String(item ?? '').trim();
        if (v && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }
    return out;
}

/**
 * แปลงค่าจาก settings.value (string JSON หรือ object) → config
 * ถ้า key ยังไม่เคยตั้งค่า (undefined/null) → คืน DEFAULT เพื่อรักษาพฤติกรรมเดิม
 * ถ้าตั้งค่าไว้แล้วแต่ว่าง → เคารพค่าว่าง (ไม่ตัดอะไรเลย)
 */
export function parseJtReturnExclusionFromSettingsValue(raw: unknown): JtReturnExclusionConfig {
    if (raw === undefined || raw === null) return { ...DEFAULT_JT_RETURN_EXCLUSION };

    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return { ...DEFAULT_JT_RETURN_EXCLUSION };
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return { ...DEFAULT_JT_RETURN_EXCLUSION };
        }
    }
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_JT_RETURN_EXCLUSION };

    const obj = parsed as Record<string, unknown>;
    return {
        signBranchNames: toCleanStringArray(obj.signBranchNames),
        deliveryStaffIds: toCleanStringArray(obj.deliveryStaffIds),
    };
}

/** ทำความสะอาด input ก่อนบันทึก (กันค่าแปลกปลอม + จำกัดจำนวน) */
export function sanitizeJtReturnExclusion(input: unknown): JtReturnExclusionConfig {
    const obj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
    const MAX = 200;
    return {
        signBranchNames: toCleanStringArray(obj.signBranchNames).slice(0, MAX),
        deliveryStaffIds: toCleanStringArray(obj.deliveryStaffIds).slice(0, MAX),
    };
}

/** true = ถือว่าปิดงานตีกลับแล้ว → ไม่นับในการ์ด */
export function isExcludedSignedReturn(
    row: { sign_branch_name: string | null; delivery_staff_id: string | null },
    config: JtReturnExclusionConfig,
): boolean {
    const signBranchName = String(row.sign_branch_name ?? '').trim();
    const deliveryStaffId = String(row.delivery_staff_id ?? '').trim();
    return (
        (signBranchName !== '' && config.signBranchNames.includes(signBranchName)) ||
        (deliveryStaffId !== '' && config.deliveryStaffIds.includes(deliveryStaffId))
    );
}
