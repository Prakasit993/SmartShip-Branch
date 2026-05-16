import { Parser, type AST } from 'node-sql-parser';

/**
 * Phase 2 SQL validator for the AI Agent `query_sql` tool.
 *
 * Layered safety model:
 *  1. **Static parse (this file)** — reject anything that isn't a single SELECT
 *     against the whitelisted tables, block dangerous functions, inject a hard
 *     LIMIT cap.
 *  2. **Postgres run_ai_readonly_select function** — SET LOCAL ROLE +
 *     transaction_read_only + statement_timeout. Even if the parser is bypassed,
 *     Postgres rejects the write/long query.
 *  3. **Service-role connection only** — the function is owned by service_role
 *     and EXECUTE is granted only to service_role; PUBLIC is revoked.
 *
 * Why a custom validator instead of trusting layer 2 alone:
 *  - Faster reject (Postgres parse + role switch costs ~20-50ms per query).
 *  - We can give the AI a *useful* error ("ALTER blocked", "table X not allowed")
 *    so it can self-correct on retry.
 *  - Defense in depth: parser bugs in PG could one day allow a write — multiple
 *    layers absorb that.
 */

const PARSER_DIALECT = 'postgresql' as const;
const PARSER_TIMEOUT_MS = 1000;

/** Tables the AI may SELECT from. Mirrors `database/db/migrations/20260515_ai_readonly_role.sql`. */
const ALLOWED_TABLES = new Set([
    'jt_shipments',
    'shipping_cost_master',
]);

/**
 * Function names that are blocked even though they only "read".
 * Some can exfiltrate filesystem, do network calls, or sleep to DoS.
 * Case-insensitive match against unqualified function name (last segment).
 */
const BLOCKED_FUNCTIONS = new Set([
    // Filesystem access
    'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
    'lo_import', 'lo_export', 'lo_get', 'lo_open', 'lo_create',
    // Network / external
    'dblink', 'dblink_connect', 'dblink_exec', 'dblink_send_query',
    'pg_read_server_files', 'pg_write_server_files',
    // Sleep / DoS
    'pg_sleep', 'pg_sleep_for', 'pg_sleep_until',
    // Process / privilege
    'pg_terminate_backend', 'pg_cancel_backend',
    'current_setting', 'set_config', // can be used to bypass SET LOCAL
    'reset',
    // System catalog leaks of sensitive info (passwords, internal IDs)
    // Note: NOT blocking pg_class / pg_attribute — needed for legit metadata
]);

/**
 * Per the user's design choice, default LIMIT injected when the AI omits one.
 * Postgres function also enforces its own LIMIT via wrapping query, but we
 * inject here so the SQL we log is identical to what runs.
 */
export const DEFAULT_LIMIT = 1000;

/** Maximum LIMIT the AI can specify. Higher values get clamped. */
export const MAX_LIMIT = 1000;

export interface SqlValidationOk {
    ok: true;
    /** Original SQL trimmed. */
    inputSql: string;
    /** SQL with LIMIT injected/clamped — safe to pass to run_ai_readonly_select. */
    safeSql: string;
    /** True if LIMIT was injected by us; false if AI already provided one. */
    limitInjected: boolean;
    /** The effective LIMIT value after clamp. */
    limit: number;
}

export interface SqlValidationError {
    ok: false;
    /** Short, AI-readable explanation. The agent can use this to self-correct. */
    error: string;
    /** Internal hint for logs; not surfaced to the AI. */
    detail?: string;
}

export type SqlValidationResult = SqlValidationOk | SqlValidationError;

/** Entry point — call this before executing any AI-generated SQL. */
export function validateSelectSql(rawSql: unknown): SqlValidationResult {
    if (typeof rawSql !== 'string') {
        return { ok: false, error: 'sql must be a string' };
    }
    const sql = rawSql.trim();
    if (!sql) {
        return { ok: false, error: 'sql is empty' };
    }
    if (sql.length > 8000) {
        return { ok: false, error: 'sql is too long (max 8000 chars)' };
    }

    // Reject multi-statement up-front. node-sql-parser splits on `;` and returns
    // an array — we'll enforce length 1, but pre-checking avoids parser cost.
    const trimmedNoTrailingSemi = sql.replace(/;\s*$/, '');
    if (trimmedNoTrailingSemi.includes(';')) {
        return { ok: false, error: 'multiple statements are not allowed' };
    }

    // Parse the AST.
    const parser = new Parser();
    let ast: AST | AST[];
    try {
        ast = parser.astify(sql, { database: PARSER_DIALECT });
    } catch (e) {
        return {
            ok: false,
            error: `SQL syntax error: ${e instanceof Error ? e.message.slice(0, 200) : 'parse failed'}`,
        };
    }

    // node-sql-parser returns AST | AST[]; multi-statement → array of length>1.
    const statements: AST[] = Array.isArray(ast) ? ast : [ast];
    if (statements.length !== 1) {
        return { ok: false, error: 'multiple statements are not allowed' };
    }
    const stmt = statements[0];

    // 1. Must be SELECT.
    if (stmt.type !== 'select') {
        return {
            ok: false,
            error: `only SELECT is allowed (got: ${String(stmt.type).toUpperCase()})`,
        };
    }

    // 2. All FROM tables must be in the whitelist.
    const tableCheck = collectAndCheckTables(stmt);
    if (!tableCheck.ok) return tableCheck;

    // 3. No blocked function calls anywhere in the AST.
    const fnCheck = collectAndCheckFunctions(stmt);
    if (!fnCheck.ok) return fnCheck;

    // 4. Inject or clamp LIMIT.
    const limitInfo = injectOrClampLimit(stmt);

    // 5. Re-emit to SQL string. Use the parser's own .sqlify so we get
    // canonicalised, escaped output (avoids re-running the input which may
    // have suspicious whitespace / comments).
    const safeSql = parser.sqlify(stmt, { database: PARSER_DIALECT });

    return {
        ok: true,
        inputSql: sql,
        safeSql,
        limitInjected: limitInfo.injected,
        limit: limitInfo.value,
    };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface TableRef {
    db?: string | null;
    schema?: string | null;
    table?: string | null;
    as?: string | null;
}

interface SelectAst {
    type: 'select';
    from?: TableRef[] | null;
    columns?: unknown;
    where?: unknown;
    groupby?: unknown;
    having?: unknown;
    orderby?: unknown;
    limit?: { seperator: string; value: Array<{ type: string; value: number }> } | null;
    with?: Array<{ name: { value: string }; stmt: { ast?: AST } }> | null;
    _next?: SelectAst | null; // chained UNION / INTERSECT
}

function collectAndCheckTables(stmt: AST): SqlValidationResult {
    const found = new Set<string>();
    const visited = new WeakSet<object>();

    function visit(node: unknown): SqlValidationResult | null {
        if (!node || typeof node !== 'object') return null;
        if (visited.has(node as object)) return null;
        visited.add(node as object);

        if (Array.isArray(node)) {
            for (const item of node) {
                const err = visit(item);
                if (err) return err;
            }
            return null;
        }

        const obj = node as Record<string, unknown>;

        // FROM clause table reference
        if (typeof obj.table === 'string') {
            const tableName = String(obj.table).toLowerCase();
            const schema = typeof obj.schema === 'string' ? String(obj.schema).toLowerCase() : null;
            const db = typeof obj.db === 'string' ? String(obj.db).toLowerCase() : null;

            // Block cross-database / cross-schema references.
            if (db && db !== '' && db !== 'public') {
                return {
                    ok: false,
                    error: `cross-database query blocked: ${db}.${tableName}`,
                };
            }
            if (schema && schema !== '' && schema !== 'public') {
                return {
                    ok: false,
                    error: `non-public schema blocked: ${schema}.${tableName}`,
                };
            }
            if (!ALLOWED_TABLES.has(tableName)) {
                return {
                    ok: false,
                    error: `table not allowed: ${tableName}. Allowed: ${[...ALLOWED_TABLES].join(', ')}`,
                };
            }
            found.add(tableName);
        }

        for (const key of Object.keys(obj)) {
            const err = visit(obj[key]);
            if (err) return err;
        }
        return null;
    }

    const err = visit(stmt);
    if (err) return err;
    if (found.size === 0) {
        return { ok: false, error: 'query must reference at least one allowed table' };
    }
    return { ok: true } as SqlValidationOk;
}

function collectAndCheckFunctions(stmt: AST): SqlValidationResult {
    const visited = new WeakSet<object>();

    function visit(node: unknown): SqlValidationResult | null {
        if (!node || typeof node !== 'object') return null;
        if (visited.has(node as object)) return null;
        visited.add(node as object);

        if (Array.isArray(node)) {
            for (const item of node) {
                const err = visit(item);
                if (err) return err;
            }
            return null;
        }

        const obj = node as Record<string, unknown>;

        // node-sql-parser uses `type: 'function'` with `name` for function calls.
        if (obj.type === 'function') {
            const name = extractFunctionName(obj.name);
            if (name && BLOCKED_FUNCTIONS.has(name.toLowerCase())) {
                return {
                    ok: false,
                    error: `function not allowed: ${name}`,
                };
            }
        }
        // Aggregate functions appear as type: 'aggr_func' — allow these (count, sum, avg ...).

        for (const key of Object.keys(obj)) {
            const err = visit(obj[key]);
            if (err) return err;
        }
        return null;
    }

    const err = visit(stmt);
    if (err) return err;
    return { ok: true } as SqlValidationOk;
}

/**
 * node-sql-parser stores function names in a few shapes depending on version.
 * Try the common ones; fall through to null if we can't extract a name (the
 * function-allow list errs on the side of permissive — Postgres role still
 * blocks anything that mutates).
 */
function extractFunctionName(name: unknown): string | null {
    if (typeof name === 'string') return name;
    if (Array.isArray(name)) {
        // e.g. [{ type: 'origin', value: 'count' }]
        const first = name[0] as { value?: unknown } | undefined;
        if (first && typeof first.value === 'string') return first.value;
    }
    if (name && typeof name === 'object') {
        const obj = name as { name?: unknown; value?: unknown };
        if (typeof obj.name === 'string') return obj.name;
        if (typeof obj.value === 'string') return obj.value;
    }
    return null;
}

function injectOrClampLimit(stmt: AST): { injected: boolean; value: number } {
    const sel = stmt as unknown as SelectAst;
    // Existing LIMIT?
    if (sel.limit && Array.isArray(sel.limit.value) && sel.limit.value.length > 0) {
        // node-sql-parser limit shape: { seperator: ',' | 'offset', value: [{value: N}, ...] }
        // Find the row-count entry (last for `LIMIT N` or first for `LIMIT N OFFSET M`).
        const sep = (sel.limit.seperator ?? '').toLowerCase();
        let countEntry =
            sep === 'offset'
                ? sel.limit.value[0]
                : sel.limit.value[sel.limit.value.length - 1];
        const current = Number(countEntry?.value);
        if (Number.isFinite(current) && current > 0 && current <= MAX_LIMIT) {
            return { injected: false, value: current };
        }
        // Clamp to MAX_LIMIT (handles 0, negatives, NaN, > MAX).
        if (countEntry) {
            countEntry.value = MAX_LIMIT;
            return { injected: false, value: MAX_LIMIT };
        }
    }

    // No LIMIT — inject one.
    sel.limit = {
        seperator: '',
        value: [{ type: 'number', value: DEFAULT_LIMIT }],
    };
    return { injected: true, value: DEFAULT_LIMIT };
}
