import { insertRows, TABLE_IDS, zcql, deleteRow } from './catalyst';
import { generateDataset } from '../data/generator';
import { DISTRICTS } from '../data/catalog';

export interface SeedResult {
  districts: number;
  stations: number;
  officers: number;
  cases: number;
  accused: number;
  victims: number;
  alerts: number;
  errors: string[];
}

async function clearTable(tableName: string): Promise<void> {
  const tableId = TABLE_IDS[tableName] || tableName;
  try {
    const rows = await zcql(`SELECT ROWID FROM ${tableName} LIMIT 1000`);
    if (rows.length > 0) {
      const chunks = [];
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        chunks.push(rows.slice(i, i + chunkSize));
      }
      for (const chunk of chunks) {
        await Promise.all(chunk.map((r) => deleteRow(tableId, String(r.ROWID || r.rowid))));
      }
    }
  } catch (e: any) {
    console.warn(`Could not clear table ${tableName}:`, e?.message || e);
  }
}

export async function seedDatabase(onProgress?: (msg: string) => void): Promise<SeedResult> {
  const result: SeedResult = { districts: 0, stations: 0, officers: 0, cases: 0, accused: 0, victims: 0, alerts: 0, errors: [] };
  const ds = generateDataset();

  const tablesToClear = ['accused', 'victims', 'cases', 'officers', 'police_stations', 'districts', 'alerts'];
  
  for (const table of tablesToClear) {
    if (onProgress) onProgress(`Clearing table ${table}...`);
    await clearTable(table);
  }

  // 1. Districts
  try {
    if (onProgress) onProgress('Inserting districts...');
    const mapped = DISTRICTS.map((d) => ({
      id: d.id,
      name: d.name,
      region: d.region,
      lat: d.lat,
      lng: d.lng,
      population: d.population
    }));
    await insertRows(TABLE_IDS.districts || 'districts', mapped);
    result.districts = DISTRICTS.length;
  } catch (err: any) {
    result.errors.push(`districts: ${err.message}`);
  }

  // 2. Stations
  try {
    if (onProgress) onProgress('Inserting police stations...');
    const mapped = ds.stations.map((s) => ({
      id: s.id,
      name: s.name,
      district_id: s.districtId,
      zone: s.zone,
      lat: s.lat,
      lng: s.lng,
      jurisdiction_pop: s.jurisdictionPop
    }));
    await insertRows(TABLE_IDS.police_stations || 'police_stations', mapped);
    result.stations = ds.stations.length;
  } catch (err: any) {
    result.errors.push(`stations: ${err.message}`);
  }

  // 3. Officers
  try {
    if (onProgress) onProgress('Inserting police officers...');
    const mapped = ds.officers.map((o) => ({
      id: o.id,
      name: o.name,
      rank: o.rank,
      station_id: o.stationId,
      district_id: o.districtId,
      years_of_service: o.yearsOfService,
      cases_handled: o.casesHandled,
      clearance_rate: o.clearanceRate,
      phone: o.phone
    }));
    await insertRows(TABLE_IDS.officers || 'officers', mapped);
    result.officers = ds.officers.length;
  } catch (err: any) {
    result.errors.push(`officers: ${err.message}`);
  }

  // 4. Cases
  try {
    if (onProgress) onProgress('Inserting crime cases...');
    const mapped = ds.cases.map((c) => ({
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
      weapon_used: c.weaponUsed,
      location_type: c.locationType,
      description: c.description,
      is_solved: c.isSolved,
      days_to_close: c.daysToClose,
      archived: false
    }));
    await insertRows(TABLE_IDS.cases || 'cases', mapped);
    result.cases = ds.cases.length;
  } catch (err: any) {
    result.errors.push(`cases: ${err.message}`);
  }

  // 5. Accused
  try {
    if (onProgress) onProgress('Inserting accused details...');
    const mapped = ds.accused.map((a) => ({
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
      gang_affiliation: a.gangAffiliation,
      occupation: a.occupation
    }));
    await insertRows(TABLE_IDS.accused || 'accused', mapped);
    result.accused = ds.accused.length;
  } catch (err: any) {
    result.errors.push(`accused: ${err.message}`);
  }

  // 6. Victims
  try {
    if (onProgress) onProgress('Inserting victim details...');
    const mapped = ds.victims.map((v) => ({
      id: v.id,
      case_id: v.caseId,
      name: v.name,
      age: v.age,
      gender: v.gender,
      district_id: v.districtId,
      injury_severity: v.injurySeverity,
      phone: v.phone
    }));
    await insertRows(TABLE_IDS.victims || 'victims', mapped);
    result.victims = ds.victims.length;
  } catch (err: any) {
    result.errors.push(`victims: ${err.message}`);
  }

  // 7. Alerts
  try {
    if (onProgress) onProgress('Inserting system alerts...');
    const mapped = ds.alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      message: a.message,
      district_id: a.districtId,
      created_at: a.createdAt,
      category: a.category,
      dismissed: false
    }));
    await insertRows(TABLE_IDS.alerts || 'alerts', mapped);
    result.alerts = ds.alerts.length;
  } catch (err: any) {
    result.errors.push(`alerts: ${err.message}`);
  }

  if (onProgress) onProgress('Seeding completed!');
  return result;
}

// Quick check: is the database seeded yet?
export async function isSeeded(): Promise<boolean> {
  try {
    const count = await zcql(`SELECT ROWID FROM cases LIMIT 1`);
    return count.length > 0;
  } catch {
    return false;
  }
}
