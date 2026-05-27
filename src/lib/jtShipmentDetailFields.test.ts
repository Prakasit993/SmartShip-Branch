import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_JT_SHIPMENT_DETAIL_FIELDS,
    parseJtShipmentDetailFieldsFromSettingsValue,
    sanitizeJtShipmentDetailFieldsWithAllowed,
} from './jtShipmentDetailFields.ts';

// Run: npm test
//
// Regression: แอดมินเลือกฟิลด์ที่อยู่นอกชุด default (เช่น dest_province) แล้วเซฟ →
// ตอนอ่าน setting ต้องไม่ถูกตัดทิ้ง (เคยบั๊ก: parse กรองด้วย hardcode 17 ฟิลด์
// ทำให้ฟิลด์นอกชุดหายตั้งแต่ตอนอ่าน → modal รายละเอียดไม่แสดงค่า).

describe('parseJtShipmentDetailFieldsFromSettingsValue — ไม่กรองด้วย allowlist', () => {
    test('เก็บฟิลด์นอกชุด default ไว้ (dest_province)', () => {
        const out = parseJtShipmentDetailFieldsFromSettingsValue(
            JSON.stringify(['awb_number', 'dest_province', 'dest_district']),
        );
        assert.deepEqual(out, ['awb_number', 'dest_province', 'dest_district']);
    });

    test('รองรับ array ดิบ (jsonb column)', () => {
        const out = parseJtShipmentDetailFieldsFromSettingsValue(['awb_number', 'sign_branch_code']);
        assert.deepEqual(out, ['awb_number', 'sign_branch_code']);
    });

    test('รองรับ double-encoded JSON string', () => {
        const out = parseJtShipmentDetailFieldsFromSettingsValue(JSON.stringify(JSON.stringify(['awb_number', 'cod_status'])));
        assert.deepEqual(out, ['awb_number', 'cod_status']);
    });

    test('ตัดค่าซ้ำ + ค่าว่าง', () => {
        const out = parseJtShipmentDetailFieldsFromSettingsValue(JSON.stringify(['awb_number', 'awb_number', '', '  ']));
        assert.deepEqual(out, ['awb_number']);
    });

    test('null/ว่าง/พังรูปแบบ → DEFAULT', () => {
        assert.deepEqual(parseJtShipmentDetailFieldsFromSettingsValue(null), DEFAULT_JT_SHIPMENT_DETAIL_FIELDS);
        assert.deepEqual(parseJtShipmentDetailFieldsFromSettingsValue(''), DEFAULT_JT_SHIPMENT_DETAIL_FIELDS);
        assert.deepEqual(parseJtShipmentDetailFieldsFromSettingsValue('{not json'), DEFAULT_JT_SHIPMENT_DETAIL_FIELDS);
    });
});

describe('parse → sanitize เทียบ availableFields (พฤติกรรมจริงใน route)', () => {
    const availableFields = [
        'awb_number',
        'booking_date',
        'sender_name',
        'dest_province',
        'dest_district',
        'sign_branch_code',
        'cod_status',
    ];

    test('ฟิลด์นอก default ที่เป็นคอลัมน์จริง → คงอยู่ (เคสบั๊กเดิม)', () => {
        const parsed = parseJtShipmentDetailFieldsFromSettingsValue(
            JSON.stringify(['awb_number', 'dest_province', 'sign_branch_code']),
        );
        const fields = sanitizeJtShipmentDetailFieldsWithAllowed(parsed, availableFields);
        assert.deepEqual(fields, ['awb_number', 'dest_province', 'sign_branch_code']);
    });

    test('ฟิลด์ที่ไม่ใช่คอลัมน์จริง → ถูกตัด', () => {
        const parsed = parseJtShipmentDetailFieldsFromSettingsValue(
            JSON.stringify(['awb_number', 'not_a_real_column']),
        );
        const fields = sanitizeJtShipmentDetailFieldsWithAllowed(parsed, availableFields);
        assert.deepEqual(fields, ['awb_number']);
    });
});
