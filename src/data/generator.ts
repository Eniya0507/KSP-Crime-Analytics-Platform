import type {
  CrimeCase,
  Accused,
  Victim,
  PoliceOfficer,
  PoliceStation,
  Alert,
  CaseStatus,
} from '../types';
import {
  DISTRICTS,
  CRIME_TYPES,
  WEAPONS,
  LOCATION_TYPES,
  GANG_NAMES,
  OCCUPATIONS,
  RANKS,
} from './catalog';
import { mulberry32, pick, intIn, floatIn, bool, jitter, clamp } from './random';

export interface Dataset {
  cases: CrimeCase[];
  accused: Accused[];
  victims: Victim[];
  officers: PoliceOfficer[];
  stations: PoliceStation[];
  districts: typeof DISTRICTS;
  alerts: Alert[];
}

// Deterministic synthetic name parts
const FIRST_NAMES = [
  'Ramesh', 'Suresh', 'Mahesh', 'Ganesh', 'Venkatesh', 'Nagaraj', 'Prakash', 'Suresha',
  'Kiran', 'Kumar', 'Manju', 'Naveen', 'Dinesh', 'Rajesh', 'Anil', 'Sunil', 'Vijay',
  'Ravi', 'Arjun', 'Deepak', 'Harish', 'Lokesh', 'Manoj', 'Naveen', 'Pavan', 'Shashi',
  'Lakshmi', 'Saraswathi', 'Geetha', 'Saritha', 'Pavithra', 'Shobha', 'Kavya', 'Meghana',
  'Nisha', 'Priya', 'Anitha', 'Sunitha', 'Vidya', 'Lata', 'Girija', 'Nagarathna',
  'Abdul', 'Imran', 'Khalil', 'Rahman', 'Salman', 'Faijal', 'Noor', 'Ayesha',
  'Thomas', 'Michael', 'Joseph', 'Peter', 'Lawrence', "D'Souza", 'Fernandes',
  'Singh', 'Gurpreet', 'Harbhajan', 'Manjeet', 'Balbir',
  'Shankar', 'Murthy', 'Krishna', 'Govind', 'Rangaswamy', 'Channabasava', 'Bhima',
];
const LAST_NAMES = [
  'Gowda', 'Reddy', 'Shetty', 'Rao', 'Naidu', 'Poojary', 'Hegde', 'Bhat', 'Kumar',
  'Naik', 'Patil', 'Desai', 'Kulkarni', 'Joshi', 'Sharma', 'Iyer', 'Menon',
  'Khan', 'Sheikh', 'Mansuri', 'Syed', 'Kazi',
  "D'Souza", 'Fernandes', 'Pereira', 'Mendonza', 'Coelho',
  'Singh', 'Sodhi', 'Gill',
  'Swamy', 'Murthy', 'Chari', 'Acharya', 'Shastri', 'Iyengar',
];

function makeName(rng: () => number): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

function makePhone(rng: () => number): string {
  const p = pick(rng, ['9', '8', '7', '6']);
  let n = p;
  for (let i = 0; i < 9; i++) n += Math.floor(rng() * 10);
  return `+91-${n.slice(0, 5)}-${n.slice(5)}`;
}

function firNumber(stationId: string, year: number, idx: number): string {
  return `${stationId}/${year}/${String(idx).padStart(5, '0')}`;
}

const STATUS_WEIGHTS: [CaseStatus, number][] = [
  ['Open', 0.18],
  ['Under Investigation', 0.27],
  ['Charge Sheet Filed', 0.22],
  ['Closed', 0.25],
  ['Pending', 0.08],
];

function statusByWeight(rng: () => number): CaseStatus {
  const r = rng();
  let acc = 0;
  for (const [s, w] of STATUS_WEIGHTS) {
    acc += w;
    if (r <= acc) return s;
  }
  return 'Open';
}

// Date helpers - cases spread across 2022-2026 with weight toward recent
function makeDate(rng: () => number): { date: string; year: number; month: number; tod: CrimeCase['timeOfDay'] } {
  const yearPool = [2022, 2022, 2023, 2023, 2023, 2024, 2024, 2024, 2025, 2025, 2025, 2026, 2026];
  const year = pick(rng, yearPool);
  const month = intIn(rng, 0, year === 2026 ? 5 : 11); // up to June 2026
  const day = intIn(rng, 1, 28);
  const hour = intIn(rng, 0, 23);
  const tod =
    hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const d = new Date(Date.UTC(year, month, day, hour, intIn(rng, 0, 59)));
  return { date: d.toISOString(), year, month, tod };
}

export function generateDataset(): Dataset {
  const rng = mulberry32(20260717); // fixed seed -> reproducible

  // 150 police stations (5 per district)
  const stations: PoliceStation[] = [];
  for (const d of DISTRICTS) {
    const zones = ['Urban', 'Rural', 'Industrial', 'Coastal', 'Border'];
    for (let i = 0; i < 5; i++) {
      const id = `${d.id}-PS${i + 1}`;
      stations.push({
        id,
        name: `${d.name.split(' ')[0]} ${pick(rng, ['Town', 'City', 'Rural', 'Sadar', 'West', 'East', 'North', 'South', 'Cantt', 'Traffic'])} PS ${i + 1}`,
        districtId: d.id,
        zone: zones[i % zones.length],
        lat: jitter(rng, d.lat, 0.25),
        lng: jitter(rng, d.lng, 0.25),
        jurisdictionPop: Math.round(d.population / 5),
      });
    }
  }

  // 500 police officers (varied ranks, ~3-4 per station)
  const officers: PoliceOfficer[] = [];
  const perStation = Math.floor(500 / stations.length);
  let officerIdx = 0;
  for (const s of stations) {
    for (let i = 0; i < perStation; i++) {
      officerIdx++;
      const rank = pick(rng, RANKS);
      officers.push({
        id: `OFC-${String(officerIdx).padStart(4, '0')}`,
        name: makeName(rng),
        rank,
        stationId: s.id,
        districtId: s.districtId,
        yearsOfService: intIn(rng, 1, 32),
        casesHandled: intIn(rng, 5, 220),
        clearanceRate: clamp(floatIn(rng, 0.42, 0.86), 0.3, 0.95),
        phone: makePhone(rng),
      });
    }
  }
  // pad to 500
  while (officers.length < 500) {
    officerIdx++;
    const s = pick(rng, stations);
    officers.push({
      id: `OFC-${String(officerIdx).padStart(4, '0')}`,
      name: makeName(rng),
      rank: pick(rng, RANKS),
      stationId: s.id,
      districtId: s.districtId,
      yearsOfService: intIn(rng, 1, 32),
      casesHandled: intIn(rng, 5, 220),
      clearanceRate: clamp(floatIn(rng, 0.42, 0.86), 0.3, 0.95),
      phone: makePhone(rng),
    });
  }

  // 1000 crime cases
  const cases: CrimeCase[] = [];
  const accused: Accused[] = [];
  const victims: Victim[] = [];
  let accusedCounter = 0;
  let victimCounter = 0;

  // Bengaluru Urban gets a higher share (urban crime density)
  const districtWeights = DISTRICTS.map((d) => ({
    id: d.id,
    w: d.population * (d.id === 'BLR' ? 1.8 : 1) * floatIn(rng, 0.7, 1.3),
  }));
  const totalW = districtWeights.reduce((s, x) => s + x.w, 0);

  function weightedDistrict(): string {
    const r = rng() * totalW;
    let acc = 0;
    for (const dw of districtWeights) {
      acc += dw.w;
      if (r <= acc) return dw.id;
    }
    return districtWeights[0].id;
  }

  for (let i = 0; i < 1000; i++) {
    const districtId = weightedDistrict();
    const district = DISTRICTS.find((d) => d.id === districtId)!;
    const districtStations = stations.filter((s) => s.districtId === districtId);
    const station = pick(rng, districtStations);
    const stationOfficers = officers.filter((o) => o.stationId === station.id);
    const officer = stationOfficers.length ? pick(rng, stationOfficers) : pick(rng, officers);
    const cdef = pick(rng, CRIME_TYPES);
    const { date, year, tod } = makeDate(rng);
    const status = statusByWeight(rng);
    const isSolved = status === 'Closed' || status === 'Charge Sheet Filed';
    const daysToClose = isSolved ? intIn(rng, 3, 240) : null;
    const lat = jitter(rng, station.lat, 0.18);
    const lng = jitter(rng, station.lng, 0.18);

    const caseId = `KSP-${String(i + 1).padStart(5, '0')}`;
    const firNum = firNumber(station.id, year, intIn(rng, 1, 600));

    // Accused: 1-4 for violent/gang crimes, 1-2 otherwise
    const isGangCrime = cdef.category === 'Violent' || cdef.category === 'Narcotics' || cdef.type === 'Dacoity';
    const nAccused = isGangCrime ? intIn(rng, 2, 4) : intIn(rng, 1, 2);
    const accusedIds: string[] = [];
    for (let a = 0; a < nAccused; a++) {
      accusedCounter++;
      const priors = bool(rng, 0.35) ? intIn(rng, 1, 8) : 0;
      const gang = isGangCrime && bool(rng, 0.6) ? pick(rng, GANG_NAMES) : null;
      const riskScore = clamp(
        Math.round(
          cdef.baseSeverity * 5 +
            priors * 6 +
            (gang ? 12 : 0) +
            (bool(rng, 0.3) ? 8 : 0),
        ),
        5,
        98,
      );
      const aid = `ACC-${String(accusedCounter).padStart(5, '0')}`;
      accusedIds.push(aid);
      accused.push({
        id: aid,
        caseId,
        name: makeName(rng),
        age: intIn(rng, 18, 62),
        gender: bool(rng, 0.92) ? 'Male' : 'Female',
        districtId,
        priorsCount: priors,
        riskScore,
        status: isSolved ? (bool(rng, 0.7) ? 'Arrested' : 'In Custody') : bool(rng, 0.3) ? 'Absconding' : bool(rng, 0.4) ? 'On Bail' : 'Surrendered',
        phone: makePhone(rng),
        aadhaarLast4: String(intIn(rng, 0, 9999)).padStart(4, '0'),
        gangAffiliation: gang,
        occupation: pick(rng, OCCUPATIONS),
      });
    }

    // Victims: 1 for property/economic/cyber, 1-3 for violent/against-women
    const nVictims = cdef.category === 'Violent' || cdef.category === 'Against Women' ? intIn(rng, 1, 3) : 1;
    const victimIds: string[] = [];
    for (let v = 0; v < nVictims; v++) {
      victimCounter++;
      const vid = `VIC-${String(victimCounter).padStart(5, '0')}`;
      victimIds.push(vid);
      const injury: Victim['injurySeverity'] =
        cdef.category === 'Violent'
          ? cdef.type === 'Murder' || cdef.type === 'Dowry Death'
            ? 'Fatal'
            : bool(rng, 0.45) ? 'Major' : 'Minor'
          : 'None';
      victims.push({
        id: vid,
        caseId,
        name: makeName(rng),
        age: intIn(rng, 6, 78),
        gender: cdef.category === 'Against Women' ? 'Female' : bool(rng, 0.6) ? 'Male' : 'Female',
        districtId,
        injurySeverity: injury,
        phone: makePhone(rng),
      });
    }

    const valueLoss = Math.round(
      cdef.baseValueLoss * floatIn(rng, 0.4, 2.2) * (cdef.category === 'Cyber' ? floatIn(rng, 1, 4) : 1),
    );

    cases.push({
      id: caseId,
      firNumber: firNum,
      crimeType: cdef.type,
      category: cdef.category,
      ipcSections: cdef.ipc,
      status,
      districtId,
      stationId: station.id,
      officerId: officer.id,
      lat,
      lng,
      date,
      timeOfDay: tod,
      severity: clamp(Math.round(cdef.baseSeverity * floatIn(rng, 0.85, 1.15)), 1, 10),
      valueLossInr: valueLoss,
      weaponUsed: bool(rng, cdef.weaponLikelihood) ? pick(rng, WEAPONS) : null,
      locationType: pick(rng, LOCATION_TYPES),
      description: `${cdef.type} reported at ${pick(rng, LOCATION_TYPES)} in ${district.name} jurisdiction. FIR ${firNum} registered at ${station.name}.`,
      accusedIds,
      victimIds,
      isSolved,
      daysToClose,
    });
  }

  // Ensure accused & victim counts (the loop already targets; pad if short)
  while (accused.length < 2500) {
    accusedCounter++;
    const c = pick(rng, cases);
    accused.push({
      id: `ACC-${String(accusedCounter).padStart(5, '0')}`,
      caseId: c.id,
      name: makeName(rng),
      age: intIn(rng, 18, 62),
      gender: bool(rng, 0.92) ? 'Male' : 'Female',
      districtId: c.districtId,
      priorsCount: bool(rng, 0.4) ? intIn(rng, 1, 6) : 0,
      riskScore: clamp(intIn(rng, 10, 90), 5, 98),
      status: pick(rng, ['Arrested', 'On Bail', 'Absconding', 'In Custody'] as const),
      phone: makePhone(rng),
      aadhaarLast4: String(intIn(rng, 0, 9999)).padStart(4, '0'),
      gangAffiliation: bool(rng, 0.2) ? pick(rng, GANG_NAMES) : null,
      occupation: pick(rng, OCCUPATIONS),
    });
    c.accusedIds.push(accused[accused.length - 1].id);
  }
  while (victims.length < 1500) {
    victimCounter++;
    const c = pick(rng, cases);
    victims.push({
      id: `VIC-${String(victimCounter).padStart(5, '0')}`,
      caseId: c.id,
      name: makeName(rng),
      age: intIn(rng, 6, 78),
      gender: bool(rng, 0.5) ? 'Male' : 'Female',
      districtId: c.districtId,
      injurySeverity: pick(rng, ['None', 'Minor', 'Major', 'Fatal'] as const),
      phone: makePhone(rng),
    });
    c.victimIds.push(victims[victims.length - 1].id);
  }

  // Truncate to exact targets if we overshot (keep slice stable)
  const accusedFinal = accused.slice(0, 2500);
  const victimsFinal = victims.slice(0, 1500);
  const accusedIdsSet = new Set(accusedFinal.map((a) => a.id));
  const victimIdsSet = new Set(victimsFinal.map((v) => v.id));
  for (const c of cases) {
    c.accusedIds = c.accusedIds.filter((id) => accusedIdsSet.has(id));
    c.victimIds = c.victimIds.filter((id) => victimIdsSet.has(id));
  }

  // Alerts derived from data
  const alerts: Alert[] = [];
  // Critical: high-severity unsolved in last 60 days
  const now = new Date('2026-07-17').getTime();
  for (const c of cases) {
    const ageDays = (now - new Date(c.date).getTime()) / 86400000;
    if (!c.isSolved && c.severity >= 8 && ageDays < 60) {
      alerts.push({
        id: `ALR-${alerts.length + 1}`,
        severity: c.severity >= 9 ? 'critical' : 'high',
        title: `${c.crimeType} — Unsolved high-severity case`,
        message: `FIR ${c.firNumber} (${c.id}) in ${districtName(c.districtId)}. Severity ${c.severity}/10.`,
        districtId: c.districtId,
        createdAt: c.date,
        category: 'Hotspot',
      });
    }
  }
  // Repeat offender alerts
  const repeatByDistrict = new Map<string, number>();
  for (const a of accusedFinal) {
    if (a.priorsCount >= 5) {
      repeatByDistrict.set(a.districtId, (repeatByDistrict.get(a.districtId) ?? 0) + 1);
    }
  }
  for (const [distId, count] of repeatByDistrict) {
    if (count >= 6) {
      alerts.push({
        id: `ALR-${alerts.length + 1}`,
        severity: 'high',
        title: `${count} repeat offenders active in ${districtName(distId)}`,
        message: `${count} accused with 5+ priors linked to recent cases.`,
        districtId: distId,
        createdAt: new Date(now - intIn(rng, 1, 14) * 86400000).toISOString(),
        category: 'Repeat Offender',
      });
    }
  }
  // Gang alerts
  for (const g of GANG_NAMES) {
    const members = accusedFinal.filter((a) => a.gangAffiliation === g);
    if (members.length >= 3) {
      alerts.push({
        id: `ALR-${alerts.length + 1}`,
        severity: members.length >= 5 ? 'critical' : 'medium',
        title: `${g}: ${members.length} members identified`,
        message: `Criminal network "${g}" active across ${new Set(members.map((m) => m.districtId)).size} districts.`,
        districtId: members[0].districtId,
        createdAt: new Date(now - intIn(rng, 1, 21) * 86400000).toISOString(),
        category: 'Network',
      });
    }
  }
  // Sort alerts by severity then date
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    cases,
    accused: accusedFinal,
    victims: victimsFinal,
    officers,
    stations,
    districts: DISTRICTS,
    alerts: alerts.slice(0, 50),
  };

  function districtName(id: string): string {
    return DISTRICTS.find((d) => d.id === id)?.name ?? id;
  }
}

// Singleton dataset (generated once)
let _dataset: Dataset | null = null;
export function getDataset(): Dataset {
  if (!_dataset) _dataset = generateDataset();
  return _dataset;
}

// Allow setting a live dataset
export function setLiveDataset(liveData: Partial<Dataset>) {
  const current = getDataset();
  if (liveData.cases) current.cases = liveData.cases;
  if (liveData.accused) current.accused = liveData.accused;
  if (liveData.victims) current.victims = liveData.victims;
  if (liveData.officers) current.officers = liveData.officers;
  if (liveData.stations) current.stations = liveData.stations;
  if (liveData.alerts) current.alerts = liveData.alerts;
}

// Convenience accessors used across the app
export const dataset = (): Dataset => getDataset();
export const allCases = (): CrimeCase[] => getDataset().cases;
export const allAccused = (): Accused[] => getDataset().accused;
export const allVictims = (): Victim[] => getDataset().victims;
export const allOfficers = (): PoliceOfficer[] => getDataset().officers;
export const allStations = (): PoliceStation[] => getDataset().stations;
export const allAlerts = (): Alert[] => getDataset().alerts;
