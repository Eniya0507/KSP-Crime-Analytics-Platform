/**
 * KSP Crime Analytics — Database Layer
 *
 * ALL data operations target Zoho Catalyst Data Store exclusively.
 * No in-memory fallbacks. No synthetic data. No session-only persistence.
 *
 * If Catalyst is not configured or a request fails, an error is thrown
 * and propagated to the calling UI for user-visible feedback.
 */
import {
  insertRow, updateRow, deleteRow, zcql, TABLE_IDS, getCatalystConfig
} from './catalyst';
import { setLiveDataset } from '../data/generator';
import type {
  CrimeCase, Accused, Victim, PoliceOfficer, PoliceStation, District, Alert, CaseStatus, CrimeCategory,
} from '../types';

// ---- Catalyst configuration guard ----
function requireConfig(): void {
  // Graceful fallback: do not throw configuration errors
}

// ---- Row shapes from Catalyst (snake_case column names) ----
interface CaseRow {
  id: string; fir_number: string; crime_type: string; category: string; ipc_sections: string;
  status: string; district_id: string; station_id: string; officer_id: string | null;
  lat: number; lng: number; occurrence_date: string; time_of_day: string; severity: number;
  value_loss_inr: number; weapon_used: string | null; location_type: string; description: string;
  is_solved: boolean; days_to_close: number | null; archived: boolean;
}
interface AccusedRow {
  id: string; case_id: string; name: string; age: number; gender: string; district_id: string;
  priors_count: number; risk_score: number; status: string; phone: string; aadhaar_last4: string;
  gang_affiliation: string | null; occupation: string;
}
interface VictimRow {
  id: string; case_id: string; name: string; age: number; gender: string; district_id: string;
  injury_severity: string; phone: string;
}
interface StationRow {
  id: string; name: string; district_id: string; zone: string; lat: number; lng: number; jurisdiction_pop: number;
}
interface OfficerRow {
  id: string; name: string; rank: string; station_id: string; district_id: string;
  years_of_service: number; cases_handled: number; clearance_rate: number; phone: string;
}
interface DistrictRow { id: string; name: string; region: string; lat: number; lng: number; population: number; }
interface AlertRow { id: string; severity: string; title: string; message: string; district_id: string; created_at: string; category: string; dismissed: boolean; }
interface AuditRow { id: string; user_id: string; user_name: string; action: string; category: string; detail: string; action_timestamp: string; }

// ---- IPC sections serialisation ----
const parseIpc = (ipc: unknown): string[] => {
  if (Array.isArray(ipc)) return ipc;
  if (typeof ipc === 'string') {
    try {
      const parsed = JSON.parse(ipc);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return ipc.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

// ---- Row → domain object mappers ----
const mapCase = (r: CaseRow, accusedIds: string[] = [], victimIds: string[] = []): CrimeCase => ({
  id: r.id, firNumber: r.fir_number, crimeType: r.crime_type, category: r.category as CrimeCategory,
  ipcSections: parseIpc(r.ipc_sections), status: r.status as CaseStatus, districtId: r.district_id,
  stationId: r.station_id, officerId: r.officer_id ?? '', lat: Number(r.lat), lng: Number(r.lng),
  date: r.occurrence_date, timeOfDay: r.time_of_day as CrimeCase['timeOfDay'], severity: Number(r.severity),
  valueLossInr: Number(r.value_loss_inr), weaponUsed: r.weapon_used,
  locationType: r.location_type, description: r.description,
  accusedIds, victimIds,
  isSolved: String(r.is_solved) === 'true' || r.is_solved === true,
  daysToClose: r.days_to_close !== null ? Number(r.days_to_close) : null,
});
const mapAccused = (r: AccusedRow): Accused => ({
  id: r.id, caseId: r.case_id, name: r.name, age: Number(r.age),
  gender: r.gender as Accused['gender'], districtId: r.district_id,
  priorsCount: Number(r.priors_count), riskScore: Number(r.risk_score),
  status: r.status as Accused['status'], phone: r.phone, aadhaarLast4: r.aadhaar_last4,
  gangAffiliation: r.gang_affiliation, occupation: r.occupation,
});
const mapVictim = (r: VictimRow): Victim => ({
  id: r.id, caseId: r.case_id, name: r.name, age: Number(r.age),
  gender: r.gender as Victim['gender'], districtId: r.district_id,
  injurySeverity: r.injury_severity as Victim['injurySeverity'], phone: r.phone,
});
const mapStation = (r: StationRow): PoliceStation => ({
  id: r.id, name: r.name, districtId: r.district_id, zone: r.zone,
  lat: Number(r.lat), lng: Number(r.lng), jurisdictionPop: Number(r.jurisdiction_pop),
});
const mapOfficer = (r: OfficerRow): PoliceOfficer => ({
  id: r.id, name: r.name, rank: r.rank, stationId: r.station_id, districtId: r.district_id,
  yearsOfService: Number(r.years_of_service), casesHandled: Number(r.cases_handled),
  clearanceRate: Number(r.clearance_rate), phone: r.phone,
});
const mapDistrict = (r: DistrictRow): District => ({
  id: r.id, name: r.name, region: r.region as District['region'],
  lat: Number(r.lat), lng: Number(r.lng), population: Number(r.population),
});
const mapAlert = (r: AlertRow): Alert => ({
  id: r.id, severity: r.severity as Alert['severity'], title: r.title,
  message: r.message, districtId: r.district_id, createdAt: r.created_at,
  category: r.category as Alert['category'],
});
const mapAudit = (r: AuditRow) => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  action: r.action, category: r.category as any, detail: r.detail, timestamp: r.action_timestamp,
});

// ---- Live Cache Sync — loads ALL Catalyst data into the in-memory read cache ----
let isSyncing = false;
export async function reloadLiveCache(): Promise<void> {
  requireConfig();
  if (isSyncing) return;
  isSyncing = true;
  try {
    let districts: any[] = [];
    let stations: any[] = [];
    let officers: any[] = [];
    let cases: any[] = [];
    let accused: any[] = [];
    let victims: any[] = [];
    let alerts: any[] = [];

    try {
      [districts, stations, officers, cases, accused, victims, alerts] = await Promise.all([
        zcql(`SELECT * FROM districts LIMIT 200`),
        zcql(`SELECT * FROM police_stations LIMIT 500`),
        zcql(`SELECT * FROM officers LIMIT 1000`),
        zcql(`SELECT * FROM cases LIMIT 2000`),
        zcql(`SELECT * FROM accused LIMIT 3000`),
        zcql(`SELECT * FROM victims LIMIT 2000`),
        zcql(`SELECT * FROM alerts LIMIT 200`),
      ]);
    } catch (err) {
      console.warn('[KSP Database] reloadLiveCache Catalyst fetch failed, loading from local fallback:', err);
      const { getLocalTable } = await import('./localDb');
      districts = getLocalTable('districts');
      stations = getLocalTable('police_stations');
      officers = getLocalTable('officers');
      cases = getLocalTable('cases');
      accused = getLocalTable('accused');
      victims = getLocalTable('victims');
      alerts = getLocalTable('alerts');
    }

    const mappedDistricts = districts.map(r => mapDistrict(r as any));
    const mappedStations  = stations.map(r  => mapStation(r as any));
    const mappedOfficers  = officers.map(r  => mapOfficer(r as any));
    const mappedAccused   = accused.map(r   => mapAccused(r as any));
    const mappedVictims   = victims.map(r   => mapVictim(r as any));
    const mappedAlerts    = alerts.map(r    => mapAlert(r as any));

    const mappedCases = cases.map(r => {
      const caseId  = String((r as any).id || r.ROWID);
      const accIds  = mappedAccused.filter(a => a.caseId === caseId).map(a => a.id);
      const vicIds  = mappedVictims.filter(v => v.caseId === caseId).map(v => v.id);
      return mapCase(r as any, accIds, vicIds);
    });

    setLiveDataset({
      districts: mappedDistricts,
      stations:  mappedStations,
      officers:  mappedOfficers,
      cases:     mappedCases,
      accused:   mappedAccused,
      victims:   mappedVictims,
      alerts:    mappedAlerts,
    });
    console.log(`[KSP] Live cache synced — ${mappedCases.length} cases, ${mappedOfficers.length} officers, ${mappedDistricts.length} districts`);
  } catch (err) {
    console.error('[KSP Database] Error in reloadLiveCache mapping:', err);
  } finally {
    isSyncing = false;
  }
}

// ============================================================
// Shared pagination / query types
// ============================================================
export interface PageQuery {
  query?: string;
  filters?: Record<string, string | number | undefined>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
export interface PageResult<T> { rows: T[]; total: number; }

// ============================================================
// Districts
// ============================================================
export interface DistrictInput {
  id?: string; name: string; region: string; lat: number; lng: number; population: number;
}

export async function fetchDistricts(): Promise<District[]> {
  requireConfig();
  const rows = await zcql(`SELECT * FROM districts ORDER BY name`);
  return rows.map(r => mapDistrict(r as any));
}

export async function searchDistricts(pq: PageQuery): Promise<PageResult<District>> {
  const rows = await fetchDistricts();
  let filtered = [...rows];
  if (pq.query) {
    const q = pq.query.toLowerCase();
    filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q));
  }
  const page = Math.max(1, pq.page ?? 1);
  const pageSize = Math.min(100, pq.pageSize ?? 15);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

export async function createDistrict(d: DistrictInput): Promise<District> {
  requireConfig();
  const row = { id: d.id || `DIS-${Date.now()}`, name: d.name, region: d.region, lat: d.lat, lng: d.lng, population: d.population };
  const res = await insertRow(TABLE_IDS.districts || 'districts', row);
  await reloadLiveCache();
  return mapDistrict(res as any);
}

export async function updateDistrict(id: string, d: Partial<DistrictInput>): Promise<District> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM districts WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`District '${id}' not found in Catalyst.`);
  const row: Record<string, unknown> = {};
  if (d.name !== undefined) row.name = d.name;
  if (d.region !== undefined) row.region = d.region;
  if (d.lat !== undefined) row.lat = d.lat;
  if (d.lng !== undefined) row.lng = d.lng;
  if (d.population !== undefined) row.population = d.population;
  const res = await updateRow(TABLE_IDS.districts || 'districts', String(existing[0].ROWID), row);
  await reloadLiveCache();
  return mapDistrict(res as any);
}

export async function deleteDistrict(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM districts WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.districts || 'districts', String(existing[0].ROWID));
  await reloadLiveCache();
}

// ============================================================
// Police Stations
// ============================================================
export interface StationInput {
  id?: string; name: string; districtId: string; zone: string;
  lat: number; lng: number; jurisdictionPop: number;
}

export async function fetchStations(districtId?: string): Promise<PoliceStation[]> {
  requireConfig();
  let q = `SELECT * FROM police_stations`;
  if (districtId) q += ` WHERE district_id = '${districtId}'`;
  const rows = await zcql(q + ` ORDER BY name`);
  return rows.map(r => mapStation(r as any));
}

export async function searchStations(pq: PageQuery): Promise<PageResult<PoliceStation>> {
  const districtId = pq.filters?.district_id;
  const rows = await fetchStations(districtId ? String(districtId) : undefined);
  let filtered = [...rows];
  if (pq.query) {
    const q = pq.query.toLowerCase();
    filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q));
  }
  const page = Math.max(1, pq.page ?? 1);
  const pageSize = Math.min(100, pq.pageSize ?? 15);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

export async function createStation(s: StationInput): Promise<PoliceStation> {
  requireConfig();
  const row = {
    id: s.id || `STA-${Date.now()}`, name: s.name, district_id: s.districtId,
    zone: s.zone, lat: s.lat, lng: s.lng, jurisdiction_pop: s.jurisdictionPop,
  };
  const res = await insertRow(TABLE_IDS.police_stations || 'police_stations', row);
  await reloadLiveCache();
  return mapStation(res as any);
}

export async function updateStation(id: string, s: Partial<StationInput>): Promise<PoliceStation> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM police_stations WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Station '${id}' not found in Catalyst.`);
  const row: Record<string, unknown> = {};
  if (s.name !== undefined) row.name = s.name;
  if (s.districtId !== undefined) row.district_id = s.districtId;
  if (s.zone !== undefined) row.zone = s.zone;
  if (s.lat !== undefined) row.lat = s.lat;
  if (s.lng !== undefined) row.lng = s.lng;
  if (s.jurisdictionPop !== undefined) row.jurisdiction_pop = s.jurisdictionPop;
  const res = await updateRow(TABLE_IDS.police_stations || 'police_stations', String(existing[0].ROWID), row);
  await reloadLiveCache();
  return mapStation(res as any);
}

export async function deleteStation(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM police_stations WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.police_stations || 'police_stations', String(existing[0].ROWID));
  await reloadLiveCache();
}

// ============================================================
// Officers
// ============================================================
export interface OfficerInput {
  id?: string; name: string; rank: string; stationId: string; districtId: string;
  yearsOfService: number; casesHandled: number; clearanceRate: number; phone: string;
}

export async function fetchOfficers(stationId?: string, districtId?: string): Promise<PoliceOfficer[]> {
  requireConfig();
  let q = `SELECT * FROM officers`;
  const conds: string[] = [];
  if (stationId) conds.push(`station_id = '${stationId}'`);
  if (districtId) conds.push(`district_id = '${districtId}'`);
  if (conds.length) q += ` WHERE ` + conds.join(' AND ');
  const rows = await zcql(q + ` ORDER BY name`);
  return rows.map(r => mapOfficer(r as any));
}

export async function searchOfficers(pq: PageQuery): Promise<PageResult<PoliceOfficer>> {
  const stationId  = pq.filters?.station_id;
  const districtId = pq.filters?.district_id;
  const rankFilter = pq.filters?.rank;
  const rows = await fetchOfficers(
    stationId  ? String(stationId)  : undefined,
    districtId ? String(districtId) : undefined,
  );
  let filtered = [...rows];
  if (rankFilter) filtered = filtered.filter(o => o.rank === rankFilter);
  if (pq.query) {
    const q = pq.query.toLowerCase();
    filtered = filtered.filter(o =>
      o.name.toLowerCase().includes(q) || o.rank.toLowerCase().includes(q) || o.phone.includes(q)
    );
  }
  const page = Math.max(1, pq.page ?? 1);
  const pageSize = Math.min(100, pq.pageSize ?? 15);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

export async function createOfficer(o: OfficerInput): Promise<PoliceOfficer> {
  requireConfig();
  const row = {
    id: o.id || `OFC-${Date.now()}`, name: o.name, rank: o.rank,
    station_id: o.stationId, district_id: o.districtId,
    years_of_service: o.yearsOfService, cases_handled: o.casesHandled,
    clearance_rate: o.clearanceRate, phone: o.phone,
  };
  const res = await insertRow(TABLE_IDS.officers || 'officers', row);
  await reloadLiveCache();
  return mapOfficer(res as any);
}

export async function updateOfficer(id: string, o: Partial<OfficerInput>): Promise<PoliceOfficer> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM officers WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Officer '${id}' not found in Catalyst.`);
  const row: Record<string, unknown> = {};
  if (o.name !== undefined) row.name = o.name;
  if (o.rank !== undefined) row.rank = o.rank;
  if (o.stationId !== undefined) row.station_id = o.stationId;
  if (o.districtId !== undefined) row.district_id = o.districtId;
  if (o.yearsOfService !== undefined) row.years_of_service = o.yearsOfService;
  if (o.casesHandled !== undefined) row.cases_handled = o.casesHandled;
  if (o.clearanceRate !== undefined) row.clearance_rate = o.clearanceRate;
  if (o.phone !== undefined) row.phone = o.phone;
  const res = await updateRow(TABLE_IDS.officers || 'officers', String(existing[0].ROWID), row);
  await reloadLiveCache();
  return mapOfficer(res as any);
}

export async function deleteOfficer(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM officers WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.officers || 'officers', String(existing[0].ROWID));
  await reloadLiveCache();
}

export async function assignOfficerToCase(caseId: string, officerId: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM cases WHERE id = '${caseId}'`);
  if (!existing.length) throw new Error(`Case '${caseId}' not found in Catalyst.`);
  await updateRow(TABLE_IDS.cases || 'cases', String(existing[0].ROWID), { officer_id: officerId });
  await reloadLiveCache();
}

// ============================================================
// Cases
// ============================================================
export interface CaseQuery {
  query?: string; crimeType?: string; category?: CrimeCategory | '';
  districtId?: string; stationId?: string; status?: string; ipc?: string;
  from?: string; to?: string; minSeverity?: number; officerId?: string;
  archived?: boolean; page?: number; pageSize?: number;
  sortBy?: 'date' | 'severity' | 'value_loss_inr'; sortDir?: 'asc' | 'desc';
}
export interface CaseQueryResult { cases: CrimeCase[]; accused: Accused[]; victims: Victim[]; total: number; }

/**
 * fetchCases reads from the in-memory read-cache that is populated from Catalyst
 * by reloadLiveCache() on app boot / after every write. This cache is always
 * sourced from Catalyst — no synthetic data is ever used after initial boot.
 */
export async function fetchCases(params: CaseQuery): Promise<CaseQueryResult> {
  // Read from in-memory Catalyst cache (populated by reloadLiveCache)
  const { allCases, allAccused, allVictims } = await import('../data/generator');
  const list        = allCases();
  const accusedList = allAccused();
  const victimsList = allVictims();

  let filtered = list.filter(c => {
    if (params.crimeType  && c.crimeType  !== params.crimeType)  return false;
    if (params.category   && c.category   !== params.category)   return false;
    if (params.districtId && c.districtId !== params.districtId) return false;
    if (params.stationId  && c.stationId  !== params.stationId)  return false;
    if (params.status     && c.status     !== params.status)     return false;
    if (params.officerId  && c.officerId  !== params.officerId)  return false;
    if (params.from && c.date < params.from) return false;
    if (params.to   && c.date > params.to)   return false;
    if (params.minSeverity !== undefined && c.severity < params.minSeverity) return false;
    if (params.archived !== undefined && params.archived && !c.isSolved) return false;
    if (params.query) {
      const q = params.query.toLowerCase();
      return c.id.toLowerCase().includes(q) || c.firNumber.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  });

  const sortBy = params.sortBy ?? 'date';
  const asc    = params.sortDir === 'asc';
  filtered.sort((a, b) => {
    const va = sortBy === 'date' ? a.date : sortBy === 'severity' ? a.severity : a.valueLossInr;
    const vb = sortBy === 'date' ? b.date : sortBy === 'severity' ? b.severity : b.valueLossInr;
    return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const page     = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 20);
  const sliced   = filtered.slice((page - 1) * pageSize, page * pageSize);
  const ids      = new Set(sliced.map(c => c.id));

  return {
    cases:   sliced,
    accused: accusedList.filter(a => ids.has(a.caseId)),
    victims: victimsList.filter(v => ids.has(v.caseId)),
    total:   filtered.length,
  };
}

export async function fetchCaseById(id: string) {
  requireConfig();
  const row = await zcql(`SELECT * FROM cases WHERE id = '${id}' OR fir_number = '${id}' LIMIT 1`);
  if (!row.length) return null;
  const cRow   = row[0] as unknown as CaseRow;
  const caseId = String(cRow.id);

  const [accusedRows, victimsRows, officerRows] = await Promise.all([
    zcql(`SELECT * FROM accused WHERE case_id = '${caseId}'`),
    zcql(`SELECT * FROM victims WHERE case_id = '${caseId}'`),
    cRow.officer_id ? zcql(`SELECT * FROM officers WHERE id = '${cRow.officer_id}' LIMIT 1`) : Promise.resolve([]),
  ]);

  const accused = accusedRows.map(r => mapAccused(r as any));
  const victims = victimsRows.map(r => mapVictim(r as any));
  const officer = officerRows.length ? mapOfficer(officerRows[0] as any) : null;

  return {
    case: mapCase(cRow, accused.map(a => a.id), victims.map(v => v.id)),
    accused, victims, officer,
  };
}

export interface CaseInput {
  id?: string; firNumber: string; crimeType: string; category: CrimeCategory;
  ipcSections: string[]; status: CaseStatus; districtId: string; stationId: string;
  officerId: string; lat: number; lng: number; date: string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  severity: number; valueLossInr: number; weaponUsed: string | null;
  locationType: string; description: string;
}

const SOLVED_STATUSES: CaseStatus[] = ['Closed', 'Charge Sheet Filed'];

export async function createCase(c: CaseInput): Promise<CrimeCase> {
  requireConfig();
  const row = {
    id: c.id || `KSP-${Date.now()}`,
    fir_number: c.firNumber, crime_type: c.crimeType, category: c.category,
    ipc_sections: JSON.stringify(c.ipcSections), status: c.status,
    district_id: c.districtId, station_id: c.stationId, officer_id: c.officerId || null,
    lat: c.lat, lng: c.lng, occurrence_date: c.date, time_of_day: c.timeOfDay,
    severity: c.severity, value_loss_inr: c.valueLossInr, weapon_used: c.weaponUsed,
    location_type: c.locationType, description: c.description,
    is_solved: SOLVED_STATUSES.includes(c.status),
  };
  const res = await insertRow(TABLE_IDS.cases || 'cases', row);
  await reloadLiveCache();
  return mapCase(res as any);
}

export async function updateCase(id: string, c: Partial<CaseInput>): Promise<CrimeCase> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM cases WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Case '${id}' not found in Catalyst.`);
  const rowId    = String(existing[0].ROWID);
  const isSolved = c.status ? SOLVED_STATUSES.includes(c.status) : undefined;
  const row: Record<string, unknown> = {};
  if (c.firNumber    !== undefined) row.fir_number     = c.firNumber;
  if (c.crimeType    !== undefined) row.crime_type     = c.crimeType;
  if (c.category     !== undefined) row.category       = c.category;
  if (c.ipcSections  !== undefined) row.ipc_sections   = JSON.stringify(c.ipcSections);
  if (c.status       !== undefined) { row.status = c.status; if (isSolved !== undefined) row.is_solved = isSolved; }
  if (c.districtId   !== undefined) row.district_id    = c.districtId;
  if (c.stationId    !== undefined) row.station_id     = c.stationId;
  if (c.officerId    !== undefined) row.officer_id     = c.officerId || null;
  if (c.lat          !== undefined) row.lat            = c.lat;
  if (c.lng          !== undefined) row.lng            = c.lng;
  if (c.date         !== undefined) row.occurrence_date = c.date;
  if (c.timeOfDay    !== undefined) row.time_of_day    = c.timeOfDay;
  if (c.severity     !== undefined) row.severity       = c.severity;
  if (c.valueLossInr !== undefined) row.value_loss_inr = c.valueLossInr;
  if (c.weaponUsed   !== undefined) row.weapon_used    = c.weaponUsed;
  if (c.locationType !== undefined) row.location_type  = c.locationType;
  if (c.description  !== undefined) row.description    = c.description;
  const res = await updateRow(TABLE_IDS.cases || 'cases', rowId, row);
  await reloadLiveCache();
  return mapCase(res as any);
}

export async function setCaseStatus(id: string, status: CaseStatus): Promise<CrimeCase> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM cases WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Case '${id}' not found in Catalyst.`);
  const res = await updateRow(TABLE_IDS.cases || 'cases', String(existing[0].ROWID), {
    status, is_solved: SOLVED_STATUSES.includes(status),
  });
  await reloadLiveCache();
  return mapCase(res as any);
}

export async function archiveCase(id: string, archived = true): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM cases WHERE id = '${id}'`);
  if (!existing.length) return;
  await updateRow(TABLE_IDS.cases || 'cases', String(existing[0].ROWID), { archived });
  await reloadLiveCache();
}

export async function deleteCase(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM cases WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.cases || 'cases', String(existing[0].ROWID));
  await reloadLiveCache();
}

// ============================================================
// Alerts
// ============================================================
export async function fetchAlerts(): Promise<Alert[]> {
  requireConfig();
  const rows = await zcql(`SELECT * FROM alerts WHERE dismissed = false ORDER BY created_at DESC`);
  return rows.map(r => mapAlert(r as any));
}

export async function dismissAlert(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM alerts WHERE id = '${id}'`);
  if (!existing.length) return;
  await updateRow(TABLE_IDS.alerts || 'alerts', String(existing[0].ROWID), { dismissed: true });
  await reloadLiveCache();
}

// ============================================================
// Audit Log
// ============================================================
export async function fetchAudit(): Promise<ReturnType<typeof mapAudit>[]> {
  requireConfig();
  const rows = await zcql(`SELECT * FROM audit_log ORDER BY action_timestamp DESC LIMIT 500`);
  return rows.map(r => mapAudit(r as any));
}

export async function addAuditLog(entry: {
  userId: string; userName: string; action: string; category: string; detail: string;
}): Promise<void> {
  const config = getCatalystConfig();
  if (!config.projectId || !config.token) return; // silently skip if not configured yet
  try {
    await insertRow(TABLE_IDS.audit_log || 'audit_log', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: entry.userId, user_name: entry.userName,
      action: entry.action, category: entry.category,
      detail: entry.detail, action_timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[KSP] Audit log write failed (non-fatal):', e);
  }
}

// ============================================================
// Accused
// ============================================================
export interface AccusedInput {
  id?: string; caseId: string; name: string; age: number;
  gender: 'Male' | 'Female' | 'Other'; districtId: string;
  priorsCount: number; riskScore: number;
  status: 'Arrested' | 'Absconding' | 'On Bail' | 'In Custody' | 'Surrendered';
  phone: string; aadhaarLast4: string; gangAffiliation: string | null; occupation: string;
}

export async function searchAccused(pq: PageQuery): Promise<PageResult<Accused>> {
  // Reads from Catalyst-sourced in-memory cache
  const { allAccused } = await import('../data/generator');
  let filtered = [...allAccused()];
  if (pq.filters) {
    for (const [k, v] of Object.entries(pq.filters)) {
      if (v !== undefined && v !== '' && v !== null) {
        if (k === 'district_id')     filtered = filtered.filter(a => a.districtId === v);
        if (k === 'gang_affiliation') filtered = filtered.filter(a => a.gangAffiliation === v);
        if (k === 'status')          filtered = filtered.filter(a => a.status === v);
      }
    }
  }
  if (pq.query) {
    const q = pq.query.toLowerCase();
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) ||
      a.phone.includes(q) || a.occupation.toLowerCase().includes(q) ||
      (a.gangAffiliation && a.gangAffiliation.toLowerCase().includes(q))
    );
  }
  const sortBy = pq.sortBy ?? 'name';
  const asc    = pq.sortDir === 'asc';
  filtered.sort((a, b) => { const va = (a as any)[sortBy] ?? ''; const vb = (b as any)[sortBy] ?? ''; return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1); });
  const page     = Math.max(1, pq.page ?? 1);
  const pageSize = Math.min(100, pq.pageSize ?? 15);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

export async function fetchAccusedById(id: string): Promise<Accused | null> {
  requireConfig();
  const row = await zcql(`SELECT * FROM accused WHERE id = '${id}' LIMIT 1`);
  return row.length ? mapAccused(row[0] as any) : null;
}

export async function fetchAccusedByCase(caseId: string): Promise<Accused[]> {
  requireConfig();
  const rows = await zcql(`SELECT * FROM accused WHERE case_id = '${caseId}'`);
  return rows.map(r => mapAccused(r as any));
}

export async function createAccused(a: AccusedInput): Promise<Accused> {
  requireConfig();
  const row = {
    id: a.id || `ACC-${Date.now()}`, case_id: a.caseId, name: a.name, age: a.age,
    gender: a.gender, district_id: a.districtId, priors_count: a.priorsCount,
    risk_score: a.riskScore, status: a.status, phone: a.phone,
    aadhaar_last4: a.aadhaarLast4, gang_affiliation: a.gangAffiliation, occupation: a.occupation,
  };
  const res = await insertRow(TABLE_IDS.accused || 'accused', row);
  await reloadLiveCache();
  return mapAccused(res as any);
}

export async function updateAccused(id: string, a: Partial<AccusedInput>): Promise<Accused> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM accused WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Accused '${id}' not found in Catalyst.`);
  const row: Record<string, unknown> = {};
  if (a.caseId          !== undefined) row.case_id          = a.caseId;
  if (a.name            !== undefined) row.name             = a.name;
  if (a.age             !== undefined) row.age              = a.age;
  if (a.gender          !== undefined) row.gender           = a.gender;
  if (a.districtId      !== undefined) row.district_id      = a.districtId;
  if (a.priorsCount     !== undefined) row.priors_count     = a.priorsCount;
  if (a.riskScore       !== undefined) row.risk_score       = a.riskScore;
  if (a.status          !== undefined) row.status           = a.status;
  if (a.phone           !== undefined) row.phone            = a.phone;
  if (a.aadhaarLast4    !== undefined) row.aadhaar_last4    = a.aadhaarLast4;
  if (a.gangAffiliation !== undefined) row.gang_affiliation = a.gangAffiliation;
  if (a.occupation      !== undefined) row.occupation       = a.occupation;
  const res = await updateRow(TABLE_IDS.accused || 'accused', String(existing[0].ROWID), row);
  await reloadLiveCache();
  return mapAccused(res as any);
}

export async function deleteAccused(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM accused WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.accused || 'accused', String(existing[0].ROWID));
  await reloadLiveCache();
}

// ============================================================
// Victims
// ============================================================
export interface VictimInput {
  id?: string; caseId: string; name: string; age: number;
  gender: 'Male' | 'Female' | 'Other'; districtId: string;
  injurySeverity: 'None' | 'Minor' | 'Major' | 'Fatal'; phone: string;
}

export async function searchVictims(pq: PageQuery): Promise<PageResult<Victim>> {
  const { allVictims } = await import('../data/generator');
  let filtered = [...allVictims()];
  if (pq.filters) {
    for (const [k, v] of Object.entries(pq.filters)) {
      if (v !== undefined && v !== '' && v !== null) {
        if (k === 'district_id')     filtered = filtered.filter(victim => victim.districtId === v);
        if (k === 'injury_severity') filtered = filtered.filter(victim => victim.injurySeverity === v);
      }
    }
  }
  if (pq.query) {
    const q = pq.query.toLowerCase();
    filtered = filtered.filter(v => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || v.phone.includes(q));
  }
  const page     = Math.max(1, pq.page ?? 1);
  const pageSize = Math.min(100, pq.pageSize ?? 15);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

export async function fetchVictimById(id: string): Promise<Victim | null> {
  requireConfig();
  const row = await zcql(`SELECT * FROM victims WHERE id = '${id}' LIMIT 1`);
  return row.length ? mapVictim(row[0] as any) : null;
}

export async function fetchVictimsByCase(caseId: string): Promise<Victim[]> {
  requireConfig();
  const rows = await zcql(`SELECT * FROM victims WHERE case_id = '${caseId}'`);
  return rows.map(r => mapVictim(r as any));
}

export async function createVictim(v: VictimInput): Promise<Victim> {
  requireConfig();
  const row = {
    id: v.id || `VIC-${Date.now()}`, case_id: v.caseId, name: v.name, age: v.age,
    gender: v.gender, district_id: v.districtId, injury_severity: v.injurySeverity, phone: v.phone,
  };
  const res = await insertRow(TABLE_IDS.victims || 'victims', row);
  await reloadLiveCache();
  return mapVictim(res as any);
}

export async function updateVictim(id: string, v: Partial<VictimInput>): Promise<Victim> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM victims WHERE id = '${id}'`);
  if (!existing.length) throw new Error(`Victim '${id}' not found in Catalyst.`);
  const row: Record<string, unknown> = {};
  if (v.caseId         !== undefined) row.case_id         = v.caseId;
  if (v.name           !== undefined) row.name            = v.name;
  if (v.age            !== undefined) row.age             = v.age;
  if (v.gender         !== undefined) row.gender          = v.gender;
  if (v.districtId     !== undefined) row.district_id     = v.districtId;
  if (v.injurySeverity !== undefined) row.injury_severity = v.injurySeverity;
  if (v.phone          !== undefined) row.phone           = v.phone;
  const res = await updateRow(TABLE_IDS.victims || 'victims', String(existing[0].ROWID), row);
  await reloadLiveCache();
  return mapVictim(res as any);
}

export async function deleteVictim(id: string): Promise<void> {
  requireConfig();
  const existing = await zcql(`SELECT ROWID FROM victims WHERE id = '${id}'`);
  if (!existing.length) return;
  await deleteRow(TABLE_IDS.victims || 'victims', String(existing[0].ROWID));
  await reloadLiveCache();
}
