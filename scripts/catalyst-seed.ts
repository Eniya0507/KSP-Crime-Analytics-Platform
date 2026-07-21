/**
 * Standalone CLI Seed Script for Zoho Catalyst Data Store
 * Run with: npx tsx scripts/catalyst-seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateDataset } from '../src/data/generator';
import { DISTRICTS } from '../src/data/catalog';

// ── Config ────────────────────────────────────────────────────────────────────
// Max rows to insert per table (keep well within Catalyst free tier limits)
const ROW_LIMIT = 50;

// Load .env manually from root directory
const envPath = path.resolve('.env');
let envProjectId = '';
let envToken = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const matchPid = line.match(/^\s*VITE_CATALYST_PROJECT_ID\s*=\s*(.+)$/);
    const matchTok = line.match(/^\s*VITE_CATALYST_TOKEN\s*=\s*(.+)$/);
    if (matchPid) envProjectId = matchPid[1].trim();
    if (matchTok) envToken = matchTok[1].trim();
  }
}

const projectId = process.env.VITE_CATALYST_PROJECT_ID || envProjectId;
const token = process.env.VITE_CATALYST_TOKEN || envToken;

if (!projectId || !token) {
  console.error('\x1b[31mError: Catalyst configuration missing.\x1b[0m');
  console.error('Please configure VITE_CATALYST_PROJECT_ID and VITE_CATALYST_TOKEN in your .env file.');
  process.exit(1);
}

console.log(`\n\x1b[36m=== Catalyst Data Store Seeder ===\x1b[0m`);
console.log(`Project ID : ${projectId}`);
console.log(`OAuth Token: ${token.substring(0, 8)}...`);
console.log(`Row limit  : ${ROW_LIMIT} per table\n`);

const dsBase = `https://api.catalyst.zoho.com/baas/v1/project/${projectId}/table`;
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Zoho-oauthtoken ${token}`,
  'Environment': 'Development',
};

// ── REST helper ───────────────────────────────────────────────────────────────
async function postRows(tableName: string, rows: any[]): Promise<void> {
  const url = `${dsBase}/${tableName}/row`;
  const chunkSize = 50;
  const limited = rows.slice(0, ROW_LIMIT);

  for (let i = 0; i < limited.length; i += chunkSize) {
    const chunk = limited.slice(i, i + chunkSize);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[${tableName}] Failed to insert chunk at row ${i}: ${response.status} - ${errText}`);
    }
  }
}

// Single-row probe: sends one row and prints the exact API error for diagnosis
async function probeRow(tableName: string, row: any): Promise<boolean> {
  const url = `${dsBase}/${tableName}/row`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.log(`  \x1b[33m[probe] ${tableName}: ${response.status} → ${errText}\x1b[0m`);
    return false;
  }
  return true;
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function runSeed() {
  const ds = generateDataset();

  // 1. Districts
  try {
    process.stdout.write('Seeding districts... ');
    // Probe with ONE row first to catch column-name mismatches early
    const probe = {
      id: DISTRICTS[0].id,
      name: DISTRICTS[0].name,
      region: DISTRICTS[0].region,
      lat: DISTRICTS[0].lat,
      lng: DISTRICTS[0].lng,
      population: DISTRICTS[0].population,
    };
    const ok = await probeRow('districts', probe);
    if (ok) {
      const mapped = DISTRICTS.map(d => ({
        id: d.id,
        name: d.name,
        region: d.region,
        lat: d.lat,
        lng: d.lng,
        population: d.population,
      }));
      await postRows('districts', mapped);
      console.log('\x1b[32m✓ Success\x1b[0m');
    } else {
      // Retry without optional columns (id, region) — in case those don't exist in console
      console.log('  Retrying without id/region...');
      const mapped = DISTRICTS.map(d => ({
        name: d.name,
        lat: d.lat,
        lng: d.lng,
        population: d.population,
      }));
      await postRows('districts', mapped);
      console.log('\x1b[32m✓ Success (minimal columns)\x1b[0m');
    }
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 2. Police Stations
  try {
    process.stdout.write('Seeding police stations... ');
    const probe = {
      name: ds.stations[0].name,
      district_id: ds.stations[0].districtId,
      zone: ds.stations[0].zone,
      lat: ds.stations[0].lat,
      lng: ds.stations[0].lng,
      jurisdiction_pop: ds.stations[0].jurisdictionPop,
    };
    const ok = await probeRow('police_stations', probe);
    if (ok) {
      const mapped = ds.stations.map(s => ({
        name: s.name,
        district_id: s.districtId,
        zone: s.zone,
        lat: s.lat,
        lng: s.lng,
        jurisdiction_pop: s.jurisdictionPop,
      }));
      await postRows('police_stations', mapped);
      console.log('\x1b[32m✓ Success\x1b[0m');
    } else {
      // Retry without optional columns
      console.log('  Retrying without zone/jurisdiction_pop...');
      const mapped = ds.stations.map(s => ({
        name: s.name,
        district_id: s.districtId,
        lat: s.lat,
        lng: s.lng,
      }));
      await postRows('police_stations', mapped);
      console.log('\x1b[32m✓ Success (minimal columns)\x1b[0m');
    }
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 3. Officers
  try {
    process.stdout.write('Seeding officers... ');
    const mapped = ds.officers.map(o => ({
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
    await postRows('officers', mapped);
    console.log('\x1b[32m✓ Success\x1b[0m');
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 4. Cases (id is mandatory in console)
  try {
    process.stdout.write('Seeding cases... ');
    const mapped = ds.cases.map(c => ({
      id: c.id,
      fir_number: c.firNumber,
      crime_type: c.crimeType,
      category: c.category,
      ipc_sections: JSON.stringify(c.ipcSections),
      status: c.status,
      district_id: c.districtId,
      station_id: c.stationId,
      officer_id: c.officerId || '',
      lat: c.lat,
      lng: c.lng,
      occurrence_date: c.date,
      time_of_day: c.timeOfDay,
      severity: c.severity,
      value_loss_inr: c.valueLossInr,
      weapon_used: c.weaponUsed || '',
      location_type: c.locationType,
      description: c.description,
      is_solved: c.isSolved,
      days_to_close: c.daysToClose || 0,
      archived: false,
    }));
    await postRows('cases', mapped);
    console.log('\x1b[32m✓ Success\x1b[0m');
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 5. Accused
  try {
    process.stdout.write('Seeding accused details... ');
    const mapped = ds.accused.map(a => ({
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
    await postRows('accused', mapped);
    console.log('\x1b[32m✓ Success\x1b[0m');
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 6. Victims
  try {
    process.stdout.write('Seeding victim details... ');
    const mapped = ds.victims.map(v => ({
      case_id: v.caseId,
      name: v.name,
      age: v.age,
      gender: v.gender,
      district_id: v.districtId,
      injury_severity: v.injurySeverity,
      phone: v.phone,
    }));
    await postRows('victims', mapped);
    console.log('\x1b[32m✓ Success\x1b[0m');
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  // 7. Alerts
  try {
    process.stdout.write('Seeding system alerts... ');
    const mapped = ds.alerts.map(a => ({
      severity: a.severity,
      title: a.title,
      message: a.message,
      district_id: a.districtId,
      created_at: a.createdAt,
      category: a.category,
      dismissed: false,
    }));
    await postRows('alerts', mapped);
    console.log('\x1b[32m✓ Success\x1b[0m');
  } catch (err: any) {
    console.log(`\x1b[31m✗ Failed: ${err.message}\x1b[0m`);
  }

  console.log('\n\x1b[32mDatabase seeding completed!\x1b[0m\n');
}

runSeed();
