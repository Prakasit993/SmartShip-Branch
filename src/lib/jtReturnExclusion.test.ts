import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_JT_RETURN_EXCLUSION,
    parseJtReturnExclusionFromSettingsValue,
    sanitizeJtReturnExclusion,
    isExcludedSignedReturn,
} from './jtReturnExclusion.ts';

// Run: npm test

describe('parseJtReturnExclusionFromSettingsValue', () => {
    test('key ยังไม่เคยตั้งค่า (null/undefined) → คืน DEFAULT (รักษาพฤติกรรมเดิม)', () => {
        assert.deepEqual(parseJtReturnExclusionFromSettingsValue(null), DEFAULT_JT_RETURN_EXCLUSION);
        assert.deepEqual(parseJtReturnExclusionFromSettingsValue(undefined), DEFAULT_JT_RETURN_EXCLUSION);
    });

    test('ตั้งค่าว่างไว้ชัดเจน → เคารพค่าว่าง (ไม่ตัดอะไรเลย)', () => {
        const out = parseJtReturnExclusionFromSettingsValue(
            JSON.stringify({ signBranchNames: [], deliveryStaffIds: [] }),
        );
        assert.deepEqual(out, { signBranchNames: [], deliveryStaffIds: [] });
    });

    test('อ่านค่าที่ตั้งไว้ + trim + ตัดซ้ำ', () => {
        const out = parseJtReturnExclusionFromSettingsValue(
            JSON.stringify({ signBranchNames: [' A ', 'A', 'B'], deliveryStaffIds: ['1', '1'] }),
        );
        assert.deepEqual(out, { signBranchNames: ['A', 'B'], deliveryStaffIds: ['1'] });
    });

    test('JSON เสีย → fallback DEFAULT', () => {
        assert.deepEqual(parseJtReturnExclusionFromSettingsValue('{not json'), DEFAULT_JT_RETURN_EXCLUSION);
    });
});

describe('sanitizeJtReturnExclusion', () => {
    test('กรองค่าว่าง/ซ้ำ และรับ input ที่ไม่ใช่ object', () => {
        assert.deepEqual(sanitizeJtReturnExclusion(null), { signBranchNames: [], deliveryStaffIds: [] });
        assert.deepEqual(
            sanitizeJtReturnExclusion({ signBranchNames: ['', ' x ', 'x'], deliveryStaffIds: [42] }),
            { signBranchNames: ['x'], deliveryStaffIds: ['42'] },
        );
    });
});

describe('isExcludedSignedReturn', () => {
    const cfg = { signBranchNames: ['04Lam Luk Ka067'], deliveryStaffIds: ['604911501'] };

    test('ตรงสาขา → ตัด', () => {
        assert.equal(isExcludedSignedReturn({ sign_branch_name: '04Lam Luk Ka067', delivery_staff_id: null }, cfg), true);
    });
    test('ตรงรหัสพนักงาน → ตัด', () => {
        assert.equal(isExcludedSignedReturn({ sign_branch_name: null, delivery_staff_id: '604911501' }, cfg), true);
    });
    test('ไม่ตรงทั้งคู่ → ไม่ตัด', () => {
        assert.equal(isExcludedSignedReturn({ sign_branch_name: 'OtherBranch', delivery_staff_id: '999' }, cfg), false);
    });
    test('config ว่าง → ไม่ตัดอะไรเลย แม้ค่าตรง default เดิม', () => {
        const empty = { signBranchNames: [], deliveryStaffIds: [] };
        assert.equal(isExcludedSignedReturn({ sign_branch_name: '04Lam Luk Ka067', delivery_staff_id: '604911501' }, empty), false);
    });
});
