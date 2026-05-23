import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateSelectSql,
    JT_ALLOWED_TABLES,
    TIKTOK_ALLOWED_TABLES,
} from './sqlValidator.ts';

// Run with: npm test  (node --test, native TS — no framework)
//
// The focus is the JT/TikTok dataset separation (the security boundary added in
// P1.3): neither carrier's tool may reach the other's table, directly or via a
// subquery/join. Existing SELECT-only / function / LIMIT guards are also covered
// as regression since the whitelist became a parameter.

/** Assert the query was rejected, optionally checking the error mentions `needle`. */
function assertRejected(sql: string, allowed: ReadonlySet<string> | undefined, needle?: string) {
    const r = allowed ? validateSelectSql(sql, allowed) : validateSelectSql(sql);
    assert.equal(r.ok, false, `expected rejection for: ${sql}`);
    if (!r.ok && needle) {
        assert.match(r.error, new RegExp(needle, 'i'), `error "${r.error}" should mention "${needle}"`);
    }
}

/** Assert the query passed validation. */
function assertOk(sql: string, allowed?: ReadonlySet<string>) {
    const r = allowed ? validateSelectSql(sql, allowed) : validateSelectSql(sql);
    assert.equal(r.ok, true, `expected pass for: ${sql}${r.ok ? '' : ' — ' + r.error}`);
    return r;
}

describe('dataset separation — TikTok tool (TIKTOK_ALLOWED_TABLES)', () => {
    test('allows SELECT from tiktok_shipments', () => {
        assertOk("SELECT awb_number FROM tiktok_shipments WHERE booking_date >= '2026-01-01'", TIKTOK_ALLOWED_TABLES);
    });

    test('rejects jt_shipments (other carrier)', () => {
        assertRejected('SELECT * FROM jt_shipments', TIKTOK_ALLOWED_TABLES, 'jt_shipments');
    });

    test('rejects NYXEL tables (e.g. products)', () => {
        assertRejected('SELECT * FROM products', TIKTOK_ALLOWED_TABLES, 'products');
    });

    test('rejects a JOIN onto jt_shipments', () => {
        assertRejected(
            'SELECT awb_number FROM tiktok_shipments JOIN jt_shipments ON tiktok_shipments.awb_number = jt_shipments.awb_number',
            TIKTOK_ALLOWED_TABLES,
            'jt_shipments',
        );
    });

    test('rejects a subquery into jt_shipments', () => {
        assertRejected(
            'SELECT awb_number FROM tiktok_shipments WHERE awb_number IN (SELECT awb_number FROM jt_shipments)',
            TIKTOK_ALLOWED_TABLES,
            'jt_shipments',
        );
    });
});

describe('dataset separation — JT tool (default = JT_ALLOWED_TABLES)', () => {
    test('allows jt_shipments', () => {
        assertOk("SELECT awb_number FROM jt_shipments WHERE booking_date >= '2026-01-01'");
    });

    test('allows NYXEL tables (products)', () => {
        assertOk('SELECT id FROM products');
    });

    test('rejects tiktok_shipments (other carrier)', () => {
        assertRejected("SELECT * FROM tiktok_shipments WHERE booking_date >= '2026-01-01'", undefined, 'tiktok_shipments');
    });

    test('rejects a subquery into tiktok_shipments', () => {
        assertRejected(
            'SELECT awb_number FROM jt_shipments WHERE awb_number IN (SELECT awb_number FROM tiktok_shipments)',
            undefined,
            'tiktok_shipments',
        );
    });
});

describe('whitelist constants stay disjoint', () => {
    test('no table appears in both JT and TikTok sets', () => {
        const overlap = [...TIKTOK_ALLOWED_TABLES].filter((t) => JT_ALLOWED_TABLES.has(t));
        assert.deepEqual(overlap, [], `JT/TikTok whitelists must not overlap, found: ${overlap}`);
    });
});

describe('regression — core guards still hold under the parameterized whitelist', () => {
    test('rejects non-SELECT (UPDATE)', () => {
        assertRejected("UPDATE tiktok_shipments SET signer_name = 'x'", TIKTOK_ALLOWED_TABLES, 'only SELECT');
    });

    test('rejects INSERT', () => {
        assertRejected("INSERT INTO tiktok_shipments (awb_number) VALUES ('1')", TIKTOK_ALLOWED_TABLES, 'only SELECT');
    });

    test('rejects multiple statements', () => {
        assertRejected('SELECT 1 FROM tiktok_shipments; SELECT 2 FROM tiktok_shipments', TIKTOK_ALLOWED_TABLES, 'multiple statements');
    });

    test('rejects blocked function (pg_sleep)', () => {
        assertRejected('SELECT pg_sleep(10) FROM tiktok_shipments', TIKTOK_ALLOWED_TABLES, 'pg_sleep');
    });

    test('rejects non-string sql', () => {
        const r = validateSelectSql(42 as unknown, TIKTOK_ALLOWED_TABLES);
        assert.equal(r.ok, false);
    });

    test('rejects empty sql', () => {
        assertRejected('   ', TIKTOK_ALLOWED_TABLES, 'empty');
    });

    test('injects default LIMIT 1000 when missing', () => {
        const r = assertOk('SELECT awb_number FROM tiktok_shipments', TIKTOK_ALLOWED_TABLES);
        if (r.ok) {
            assert.equal(r.limitInjected, true);
            assert.equal(r.limit, 1000);
            assert.match(r.safeSql, /LIMIT 1000/i);
        }
    });

    test('clamps an over-large LIMIT to 1000', () => {
        const r = assertOk('SELECT awb_number FROM tiktok_shipments LIMIT 5000', TIKTOK_ALLOWED_TABLES);
        if (r.ok) {
            assert.equal(r.limit, 1000);
            assert.equal(r.limitInjected, false);
        }
    });

    test('keeps a within-cap LIMIT untouched', () => {
        const r = assertOk('SELECT awb_number FROM tiktok_shipments LIMIT 50', TIKTOK_ALLOWED_TABLES);
        if (r.ok) {
            assert.equal(r.limit, 50);
            assert.equal(r.limitInjected, false);
        }
    });
});
