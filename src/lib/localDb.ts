/**
 * KSP Local Database Layer
 * Fallback database stored in browser localStorage.
 * Mimics Catalyst tables and ZCQL queries.
 */
import { generateDataset } from '../data/generator';
import { DISTRICTS } from '../data/catalog';

const STORAGE_PREFIX = 'ksp_local_table_';

// ── Initial Seed ─────────────────────────────────────────────────────────────
export function initLocalDb(force = false) {
  if (!force && localStorage.getItem('ksp_local_initialized') === 'true') {
    return;
  }

  console.log('[KSP LocalDb] Initializing localStorage database from generator...');
  const ds = generateDataset();

  // 1. Districts
  const districts = DISTRICTS.map(d => ({
    ROWID: d.id,
    id: d.id,
    name: d.name,
    region: d.region,
    lat: d.lat,
    lng: d.lng,
    population: d.population,
  }));
  saveLocalTable('districts', districts);

  // 2. Police Stations
  const stations = ds.stations.map(s => ({
    ROWID: s.id,
    id: s.id,
    name: s.name,
    district_id: s.districtId,
    zone: s.zone,
    lat: s.lat,
    lng: s.lng,
    jurisdiction_pop: s.jurisdictionPop,
  }));
  saveLocalTable('police_stations', stations);

  // 3. Officers
  const officers = ds.officers.map(o => ({
    ROWID: o.id,
    id: o.id,
    name: o.name,
    rank: o.rank,
    station_id: o.stationId,
    district_id: o.districtId,
    years_of_service: o.yearsOfService,
    cases_handled: o.casesHandled,
    clearance_rate: o.clearanceRate,
    phone: o.phone,
  }));
  saveLocalTable('officers', officers);

  // 4. Cases
  const cases = ds.cases.map(c => ({
    ROWID: c.id,
    id: c.id,
    fir_number: c.firNumber,
    crime_type: c.crimeType,
    category: c.category,
    ipc_sections: JSON.stringify(c.ipcSections),
    status: c.status,
    district_id: c.districtId,
    station_id: c.stationId,
    officer_id: c.officerId || null,
    lat: c.lat,
    lng: c.lng,
    occurrence_date: c.date,
    time_of_day: c.timeOfDay,
    severity: c.severity,
    value_loss_inr: c.valueLossInr,
    weapon_used: c.weaponUsed || null,
    location_type: c.locationType,
    description: c.description,
    is_solved: c.isSolved,
    days_to_close: c.daysToClose || null,
    archived: false,
  }));
  saveLocalTable('cases', cases);

  // 5. Accused
  const accused = ds.accused.map(a => ({
    ROWID: a.id,
    id: a.id,
    case_id: a.caseId,
    name: a.name,
    age: a.age,
    gender: a.gender,
    district_id: a.districtId,
    priors_count: a.priorsCount,
    risk_score: a.riskScore,
    status: a.status,
    phone: a.phone,
    aadhaar_last4: a.aadhaarLast4,
    gang_affiliation: a.gangAffiliation || 'None',
    occupation: a.occupation,
  }));
  saveLocalTable('accused', accused);

  // 6. Victims
  const victims = ds.victims.map(v => ({
    ROWID: v.id,
    id: v.id,
    case_id: v.caseId,
    name: v.name,
    age: v.age,
    gender: v.gender,
    district_id: v.districtId,
    injury_severity: v.injurySeverity,
    phone: v.phone,
  }));
  saveLocalTable('victims', victims);

  // 7. Alerts
  const alerts = ds.alerts.map(a => ({
    ROWID: a.id,
    id: a.id,
    severity: a.severity,
    title: a.title,
    message: a.message,
    district_id: a.districtId,
    created_at: a.createdAt,
    category: a.category,
    dismissed: false,
  }));
  saveLocalTable('alerts', alerts);

  // 8. Audit Log
  saveLocalTable('audit_log', []);

  localStorage.setItem('ksp_local_initialized', 'true');
  console.log('[KSP LocalDb] Initialized successfully.');
}

// ── Storage Operations ────────────────────────────────────────────────────────
export function getLocalTable(tableId: string): any[] {
  // Auto-init if empty
  initLocalDb();
  const key = STORAGE_PREFIX + tableId;
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`[KSP LocalDb] Failed to parse local table ${tableId}:`, e);
    return [];
  }
}

export function saveLocalTable(tableId: string, rows: any[]) {
  const key = STORAGE_PREFIX + tableId;
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch (e) {
    console.error(`[KSP LocalDb] Failed to save local table ${tableId}:`, e);
  }
}

// ── CRUD Emulation ────────────────────────────────────────────────────────────
export function localInsertRow(tableId: string, row: any): any {
  const table = getLocalTable(tableId);
  const newRow = { ...row };
  if (!newRow.ROWID) {
    newRow.ROWID = `local-${tableId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  if (!newRow.id) {
    newRow.id = newRow.ROWID;
  }
  table.push(newRow);
  saveLocalTable(tableId, table);
  return newRow;
}

export function localUpdateRow(tableId: string, rowId: string, row: any): any {
  const table = getLocalTable(tableId);
  const idx = table.findIndex(r => String(r.ROWID) === String(rowId) || String(r.id) === String(rowId));
  if (idx === -1) {
    console.warn(`[KSP LocalDb] Row ${rowId} not found in ${tableId} for update.`);
    return row;
  }
  table[idx] = { ...table[idx], ...row };
  saveLocalTable(tableId, table);
  return table[idx];
}

export function localDeleteRow(tableId: string, rowId: string) {
  let table = getLocalTable(tableId);
  table = table.filter(r => String(r.ROWID) !== String(rowId) && String(r.id) !== String(rowId));
  saveLocalTable(tableId, table);
}

// ── ZCQL SQL Interpreter ──────────────────────────────────────────────────────
function evalWhereExpr(row: any, expr: string): boolean {
  if (expr.includes(' OR ')) {
    const parts = expr.split(' OR ');
    return parts.some(p => evalWhereExpr(row, p));
  }
  if (expr.includes(' AND ')) {
    const parts = expr.split(' AND ');
    return parts.every(p => evalWhereExpr(row, p));
  }

  const match = expr.match(/([a-zA-Z0-9_]+)\s*(=|!=|LIKE)\s*(.*)/i);
  if (!match) return true;

  const col = match[1].trim();
  const op = match[2].trim();
  let valStr = match[3].trim();

  if ((valStr.startsWith("'") && valStr.endsWith("'")) || (valStr.startsWith('"') && valStr.endsWith('"'))) {
    valStr = valStr.substring(1, valStr.length - 1);
  }

  const actualVal = row[col];

  if (op === '=') {
    if (valStr === 'null') return actualVal === null || actualVal === undefined || actualVal === '';
    if (valStr === 'true') return actualVal === true || String(actualVal) === 'true';
    if (valStr === 'false') return actualVal === false || String(actualVal) === 'false';
    return String(actualVal ?? '') === valStr;
  } else if (op === '!=') {
    if (valStr === 'null') return actualVal !== null && actualVal !== undefined && actualVal !== '';
    return String(actualVal ?? '') !== valStr;
  }
  return true;
}

export function localZcql(query: string): any[] {
  const q = query.replace(/\s+/g, ' ').trim();
  const fromMatch = q.match(/FROM\s+([a-zA-Z0-9_]+)/i);
  if (!fromMatch) {
    console.warn('[KSP LocalDb] Could not parse table from query:', query);
    return [];
  }
  const tableId = fromMatch[1];
  let rows = getLocalTable(tableId);

  // 1. WHERE
  const whereMatch = q.match(/WHERE\s+(.*?)(?=\s+ORDER\s+BY|\s+LIMIT|$)/i);
  if (whereMatch) {
    const expr = whereMatch[1].trim();
    rows = rows.filter(row => evalWhereExpr(row, expr));
  }

  // 2. ORDER BY
  const orderMatch = q.match(/ORDER\s+BY\s+([a-zA-Z0-9_]+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    const col = orderMatch[1];
    const dir = (orderMatch[2] || 'ASC').toUpperCase();
    rows.sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      if (typeof va === 'string') {
        return dir === 'ASC' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'ASC' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  // 3. LIMIT / OFFSET
  const limitMatch = q.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = q.match(/OFFSET\s+(\d+)/i);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

  if (limitMatch) {
    const limit = parseInt(limitMatch[1], 10);
    rows = rows.slice(offset, offset + limit);
  } else if (offset > 0) {
    rows = rows.slice(offset);
  }

  return rows;
}
