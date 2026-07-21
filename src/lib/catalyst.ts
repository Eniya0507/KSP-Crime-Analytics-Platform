/**
 * Zoho Catalyst Data Store REST client
 *
 * Required env vars (set in .env):
 *   VITE_CATALYST_PROJECT_ID   — numeric Catalyst project ID
 *   VITE_CATALYST_TOKEN        — Zoho OAuth token
 *
 * Table ID env vars (set after creating tables in Catalyst console):
 *   VITE_TABLE_DISTRICTS, VITE_TABLE_STATIONS, VITE_TABLE_OFFICERS,
 *   VITE_TABLE_CASES, VITE_TABLE_ACCUSED, VITE_TABLE_VICTIMS,
 *   VITE_TABLE_ALERTS, VITE_TABLE_AUDIT_LOG
 */

import { localZcql, localInsertRow, localUpdateRow, localDeleteRow } from './localDb';

export interface CatalystConfig {
  projectId: string;
  token: string;
  tables: Record<string, string>;
}

const getStoredConfig = (): CatalystConfig => {
  try {
    const saved = localStorage.getItem('ksp-catalyst-config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse stored Catalyst config:', e);
  }
  return {
    projectId: (import.meta.env.VITE_CATALYST_PROJECT_ID as string) || '',
    token: (import.meta.env.VITE_CATALYST_TOKEN as string) || '',
    tables: {
      districts:       (import.meta.env.VITE_TABLE_DISTRICTS as string)  || 'districts',
      police_stations: (import.meta.env.VITE_TABLE_STATIONS as string)   || 'police_stations',
      officers:        (import.meta.env.VITE_TABLE_OFFICERS as string)   || 'officers',
      cases:           (import.meta.env.VITE_TABLE_CASES as string)      || 'cases',
      accused:         (import.meta.env.VITE_TABLE_ACCUSED as string)    || 'accused',
      victims:         (import.meta.env.VITE_TABLE_VICTIMS as string)    || 'victims',
      alerts:          (import.meta.env.VITE_TABLE_ALERTS as string)     || 'alerts',
      audit_log:       (import.meta.env.VITE_TABLE_AUDIT_LOG as string)  || 'audit_log',
    }
  };
};

const currentConfig = getStoredConfig();

let _projectId = currentConfig.projectId;
let _token = currentConfig.token;
export const TABLE_IDS = currentConfig.tables;

export function getCatalystConfig(): CatalystConfig {
  return { projectId: _projectId, token: _token, tables: TABLE_IDS };
}

export function saveCatalystConfig(config: CatalystConfig) {
  _projectId = config.projectId;
  _token = config.token;
  Object.assign(TABLE_IDS, config.tables);
  try {
    localStorage.setItem('ksp-catalyst-config', JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Catalyst config to localStorage:', e);
  }
}

export function setCatalystToken(t: string) {
  _token = t;
  const cfg = getStoredConfig();
  cfg.token = t;
  saveCatalystConfig(cfg);
}
export function getCatalystToken(): string { return _token; }

function isConfigured(): boolean {
  return !!_projectId && !!_token;
}

function getDSBase() {
  return `https://api.catalyst.zoho.com/baas/v1/project/${_projectId}/table`;
}
function getZCQLBase() {
  return `https://api.catalyst.zoho.com/baas/v1/project/${_projectId}/search`;
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': _token ? `Zoho-oauthtoken ${_token}` : '',
    'Environment': 'Development',
  };
}

export interface DSRow { ROWID?: string; [key: string]: unknown; }

// ---- Core request ----
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Catalyst ${method} ${url} → ${res.status}: ${txt}`);
  }
  const json = await res.json();
  // Catalyst wraps success in { status:"success", data: ... }
  return (json.data ?? json) as T;
}

// Flatten nested table structure in ZCQL rows
function flattenRow(row: any): any {
  if (!row) return row;
  const keys = Object.keys(row);
  if (keys.length === 1 && typeof row[keys[0]] === 'object' && row[keys[0]] !== null) {
    return { ROWID: row[keys[0]].ROWID, ...row[keys[0]] };
  }
  let flat: any = {};
  for (const k of keys) {
    if (typeof row[k] === 'object' && row[k] !== null && !Array.isArray(row[k])) {
      Object.assign(flat, row[k]);
    } else {
      flat[k] = row[k];
    }
  }
  return flat;
}

// ---- Row CRUD ----

/** Insert one row. Returns the saved row (with ROWID). */
export async function insertRow(tableId: string, row: DSRow): Promise<DSRow> {
  if (!isConfigured()) {
    return localInsertRow(tableId, row);
  }
  try {
    const data = await req<DSRow | { row: DSRow }>('POST', `${getDSBase()}/${tableId}/row`, { row });
    const saved = flattenRow((data as { row: DSRow }).row ?? (data as DSRow));
    // Keep local storage in sync
    localInsertRow(tableId, saved);
    return saved;
  } catch (err: any) {
    console.warn(`[KSP Catalyst Fallback] insertRow failed for ${tableId}:`, err.message || err);
    return localInsertRow(tableId, row);
  }
}

/** Insert multiple rows. Supports bulk insert with single-insert fallback. */
export async function insertRows(tableId: string, rows: DSRow[]): Promise<DSRow[]> {
  if (!rows.length) return [];
  if (!isConfigured()) {
    return rows.map(r => localInsertRow(tableId, r));
  }
  try {
    // Attempt bulk insert in Catalyst
    const data = await req<any>('POST', `${getDSBase()}/${tableId}/row`, rows.map(r => ({ ...r })));
    const returnedRows = Array.isArray(data) ? data : (data?.row ?? data);
    const saved = Array.isArray(returnedRows) ? returnedRows.map(flattenRow) : [flattenRow(returnedRows)];
    // Sync to local
    saved.forEach(r => localInsertRow(tableId, r));
    return saved;
  } catch (err: any) {
    console.warn(`[KSP Catalyst Fallback] insertRows failed for ${tableId}:`, err.message || err);
    return rows.map(r => localInsertRow(tableId, r));
  }
}

/** Update a row by ROWID. */
export async function updateRow(tableId: string, rowId: string, row: DSRow): Promise<DSRow> {
  if (!isConfigured()) {
    return localUpdateRow(tableId, rowId, row);
  }
  try {
    const data = await req<DSRow | { row: DSRow }>('PUT', `${getDSBase()}/${tableId}/row/${rowId}`, { row });
    const saved = flattenRow((data as { row: DSRow }).row ?? (data as DSRow));
    // Keep local storage in sync
    localUpdateRow(tableId, rowId, saved);
    return saved;
  } catch (err: any) {
    console.warn(`[KSP Catalyst Fallback] updateRow failed for ${tableId} (${rowId}):`, err.message || err);
    return localUpdateRow(tableId, rowId, row);
  }
}

/** Delete a row by ROWID. */
export async function deleteRow(tableId: string, rowId: string): Promise<void> {
  if (!isConfigured()) {
    localDeleteRow(tableId, rowId);
    return;
  }
  try {
    await req<unknown>('DELETE', `${getDSBase()}/${tableId}/row/${rowId}`);
    localDeleteRow(tableId, rowId);
  } catch (err: any) {
    console.warn(`[KSP Catalyst Fallback] deleteRow failed for ${tableId} (${rowId}):`, err.message || err);
    localDeleteRow(tableId, rowId);
  }
}

/** Fetch a single row by ROWID. Returns null if not found. */
export async function getRow(tableId: string, rowId: string): Promise<DSRow | null> {
  if (!isConfigured()) {
    const table = localZcql(`SELECT * FROM ${tableId} WHERE ROWID = '${rowId}' LIMIT 1`);
    return table.length ? table[0] : null;
  }
  try {
    const data = await req<DSRow | { row: DSRow }>('GET', `${getDSBase()}/${tableId}/row/${rowId}`);
    const r = (data as { row: DSRow }).row ?? (data as DSRow);
    return r ? flattenRow(r) : null;
  } catch {
    const table = localZcql(`SELECT * FROM ${tableId} WHERE ROWID = '${rowId}' LIMIT 1`);
    return table.length ? table[0] : null;
  }
}

/**
 * Execute a ZCQL query.
 * Catalyst ZCQL syntax: SELECT * FROM TableName WHERE col = 'val' ORDER BY col LIMIT n OFFSET n
 * Returns array of row objects.
 */
export async function zcql(query: string): Promise<DSRow[]> {
  if (!isConfigured()) {
    return localZcql(query);
  }
  try {
    const url = `${getZCQLBase()}?searchQuery=${encodeURIComponent(query)}`;
    const data = await req<DSRow[] | { rows: DSRow[] }>('GET', url);
    const rows = Array.isArray(data) ? data : (data as { rows: DSRow[] }).rows ?? [];
    return rows.map(flattenRow);
  } catch (err: any) {
    console.warn(`[KSP Catalyst Fallback] zcql query failed: "${query}". Error:`, err.message || err);
    return localZcql(query);
  }
}

/**
 * Fetch all rows from a table using ZCQL with optional WHERE, ORDER BY, LIMIT, OFFSET.
 */
export async function queryTable(opts: {
  table: string;
  where?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}): Promise<DSRow[]> {
  const { table, where, orderBy, limit = 200, offset = 0 } = opts;
  let q = `SELECT * FROM ${table}`;
  if (where) q += ` WHERE ${where}`;
  if (orderBy) q += ` ORDER BY ${orderBy}`;
  q += ` LIMIT ${limit} OFFSET ${offset}`;
  return zcql(q);
}

/**
 * Count rows matching a WHERE clause.
 * Uses SELECT COUNT(*) FROM table WHERE ...
 */
export async function countRows(table: string, where?: string): Promise<number> {
  let q = `SELECT COUNT(*) FROM ${table}`;
  if (where) q += ` WHERE ${where}`;
  const rows = await zcql(q);
  if (!rows.length) return 0;
  const first = rows[0];
  const val = first['COUNT(*)'] ?? first['count'] ?? first[Object.keys(first)[0]];
  return typeof val === 'number' ? val : parseInt(String(val), 10) || 0;
}

/**
 * Execute a Catalyst Serverless Function.
 * Throws on failure so callers can run their own local fallbacks.
 */
export async function executeFunction<T>(functionName: string, body: unknown): Promise<T> {
  if (!isConfigured()) {
    throw new Error(`[KSP] Catalyst not configured — skipping function "${functionName}", using local fallback.`);
  }
  return req<T>('POST', `https://api.catalyst.zoho.com/baas/v1/project/${_projectId}/function/${functionName}/execute`, body);
}
