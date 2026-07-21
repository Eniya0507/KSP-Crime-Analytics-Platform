import type { CrimeCase, Accused, Victim, PoliceStation, District, CrimeCategory } from '../types';
import { allCases, allAccused, allVictims, allStations, allOfficers, allAlerts, dataset } from './generator';
import { DISTRICTS, CRIME_TYPES, crimeDefByType, districtById } from './catalog';

export interface CaseWithRel extends CrimeCase {
  accused: Accused[];
  victims: Victim[];
  station?: PoliceStation;
  district?: District;
  officerName: string;
}

const accusedByCase = new Map<string, Accused[]>();
const victimByCase = new Map<string, Victim[]>();
const officerById = new Map<string, { id: string; name: string; rank: string }>();
const stationById = new Map<string, PoliceStation>();

function ensureIndex() {
  if (accusedByCase.size === 0) {
    for (const a of allAccused()) {
      const list = accusedByCase.get(a.caseId) ?? [];
      list.push(a);
      accusedByCase.set(a.caseId, list);
    }
    for (const v of allVictims()) {
      const list = victimByCase.get(v.caseId) ?? [];
      list.push(v);
      victimByCase.set(v.caseId, list);
    }
    for (const o of allOfficers()) officerById.set(o.id, { id: o.id, name: o.name, rank: o.rank });
    for (const s of allStations()) stationById.set(s.id, s);
  }
}

export function getCaseById(id: string): CaseWithRel | undefined {
  ensureIndex();
  const c = allCases().find((x) => x.id === id || x.firNumber === id);
  if (!c) return undefined;
  const officer = officerById.get(c.officerId);
  return {
    ...c,
    accused: accusedByCase.get(c.id) ?? [],
    victims: victimByCase.get(c.id) ?? [],
    station: stationById.get(c.stationId),
    district: districtById(c.districtId),
    officerName: officer ? `${officer.rank} ${officer.name}` : c.officerId,
  };
}

export function searchCases(params: {
  query?: string;
  crimeType?: string;
  category?: CrimeCategory | '';
  districtId?: string;
  stationId?: string;
  status?: string;
  ipc?: string;
  from?: string;
  to?: string;
  minSeverity?: number;
}): CrimeCase[] {
  const q = (params.query ?? '').trim().toLowerCase();
  return allCases().filter((c) => {
    if (q) {
      const hay = `${c.id} ${c.firNumber} ${c.crimeType} ${c.description}`.toLowerCase();
      if (!hay.includes(q)) {
        // also match accused/victim names
        ensureIndex();
        const rels = accusedByCase.get(c.id) ?? [];
        const vrels = victimByCase.get(c.id) ?? [];
        const names = [...rels.map((a) => a.name), ...vrels.map((v) => v.name)].join(' ').toLowerCase();
        if (!names.includes(q)) return false;
      }
    }
    if (params.crimeType && c.crimeType !== params.crimeType) return false;
    if (params.category && c.category !== params.category) return false;
    if (params.districtId && c.districtId !== params.districtId) return false;
    if (params.stationId && c.stationId !== params.stationId) return false;
    if (params.status && c.status !== params.status) return false;
    if (params.ipc && !c.ipcSections.some((s) => s.includes(params.ipc!))) return false;
    if (params.from && c.date < params.from) return false;
    if (params.to && c.date > params.to) return false;
    if (params.minSeverity != null && c.severity < params.minSeverity) return false;
    return true;
  });
}

export function getAccusedById(id: string): Accused | undefined {
  return allAccused().find((a) => a.id === id);
}
export function getVictimById(id: string): Victim | undefined {
  return allVictims().find((v) => v.id === id);
}
export function getCasesByAccused(accusedId: string): CrimeCase[] {
  const a = getAccusedById(accusedId);
  if (!a) return [];
  return allCases().filter((c) => c.accusedIds.includes(accusedId));
}

// ---- Aggregations ----
export interface MonthlyPoint {
  month: string;
  label: string;
  count: number;
  solved: number;
}

export function monthlyTrend(year?: number): MonthlyPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets: MonthlyPoint[] = months.map((m, i) => ({
    month: `${i + 1}`,
    label: m,
    count: 0,
    solved: 0,
  }));
  for (const c of allCases()) {
    const d = new Date(c.date);
    if (year && d.getUTCFullYear() !== year) continue;
    buckets[d.getUTCMonth()].count++;
    if (c.isSolved) buckets[d.getUTCMonth()].solved++;
  }
  return buckets;
}

export function yearlyTrend(): { year: number; count: number; solved: number }[] {
  const map = new Map<number, { count: number; solved: number }>();
  for (const c of allCases()) {
    const y = new Date(c.date).getUTCFullYear();
    const e = map.get(y) ?? { count: 0, solved: 0 };
    e.count++;
    if (c.isSolved) e.solved++;
    map.set(y, e);
  }
  return [...map.entries()].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year);
}

export function categoryDistribution(): { category: CrimeCategory; count: number }[] {
  const map = new Map<CrimeCategory, number>();
  for (const c of allCases()) map.set(c.category, (map.get(c.category) ?? 0) + 1);
  return CRIME_TYPES.reduce< { category: CrimeCategory; count: number }[]>((acc, ct) => {
    if (map.has(ct.category) && !acc.find((x) => x.category === ct.category)) {
      acc.push({ category: ct.category, count: map.get(ct.category)! });
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count);
}

export function crimeTypeDistribution(): { type: string; count: number; category: CrimeCategory }[] {
  const map = new Map<string, { count: number; category: CrimeCategory }>();
  for (const c of allCases()) {
    const e = map.get(c.crimeType) ?? { count: 0, category: c.category };
    e.count++;
    map.set(c.crimeType, e);
  }
  return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count);
}

export function districtBreakdown(): { id: string; name: string; count: number; solved: number; unsolved: number }[] {
  const map = new Map<string, { count: number; solved: number }>();
  for (const c of allCases()) {
    const e = map.get(c.districtId) ?? { count: 0, solved: 0 };
    e.count++;
    if (c.isSolved) e.solved++;
    map.set(c.districtId, e);
  }
  return DISTRICTS.map((d) => {
    const e = map.get(d.id) ?? { count: 0, solved: 0 };
    return { id: d.id, name: d.name, count: e.count, solved: e.solved, unsolved: e.count - e.solved };
  }).sort((a, b) => b.count - a.count);
}

export function stationBreakdown(districtId?: string): { id: string; name: string; districtId: string; count: number; solved: number }[] {
  const map = new Map<string, { count: number; solved: number }>();
  for (const c of allCases()) {
    if (districtId && c.districtId !== districtId) continue;
    const e = map.get(c.stationId) ?? { count: 0, solved: 0 };
    e.count++;
    if (c.isSolved) e.solved++;
    map.set(c.stationId, e);
  }
  return allStations()
    .filter((s) => !districtId || s.districtId === districtId)
    .map((s) => {
      const e = map.get(s.id) ?? { count: 0, solved: 0 };
      return { id: s.id, name: s.name, districtId: s.districtId, count: e.count, solved: e.solved };
    })
    .sort((a, b) => b.count - a.count);
}

export function repeatOffenders(limit = 30): Accused[] {
  return [...allAccused()].sort((a, b) => b.priorsCount - a.priorsCount || b.riskScore - a.riskScore).slice(0, limit);
}

export function kpis() {
  const cases = allCases();
  const solved = cases.filter((c) => c.isSolved).length;
  const open = cases.filter((c) => !c.isSolved).length;
  const highSeverity = cases.filter((c) => c.severity >= 8).length;
  const repeat = allAccused().filter((a) => a.priorsCount >= 5).length;
  const gangs = new Set(allAccused().map((a) => a.gangAffiliation).filter(Boolean)).size;
  const valueLoss = cases.reduce((s, c) => s + c.valueLossInr, 0);
  const last30 = cases.filter((c) => (Date.now() - +new Date(c.date)) / 86400000 < 400).length; // synthetic recent
  const clearance = cases.length ? (solved / cases.length) * 100 : 0;
  return {
    totalCases: cases.length,
    solved,
    open,
    clearance: Math.round(clearance * 10) / 10,
    highSeverity,
    repeatOffenders: repeat,
    activeGangs: gangs,
    valueLossInr: valueLoss,
    recentCases: last30,
    accused: allAccused().length,
    victims: allVictims().length,
    officers: allOfficers().length,
    stations: allStations().length,
    alerts: allAlerts().length,
    districts: DISTRICTS.length,
  };
}

// Hotspot computation: cluster cases by location proximity per district
export interface Hotspot {
  id: string;
  districtId: string;
  districtName: string;
  lat: number;
  lng: number;
  count: number;
  severityAvg: number;
  topCrime: string;
  trend: 'rising' | 'stable' | 'falling';
}

export function hotspots(): Hotspot[] {
  const byDistrict = new Map<string, CrimeCase[]>();
  for (const c of allCases()) {
    const list = byDistrict.get(c.districtId) ?? [];
    list.push(c);
    byDistrict.set(c.districtId, list);
  }
  const out: Hotspot[] = [];
  for (const [distId, list] of byDistrict) {
    if (list.length < 10) continue;
    // centroid
    const lat = list.reduce((s, c) => s + c.lat, 0) / list.length;
    const lng = list.reduce((s, c) => s + c.lng, 0) / list.length;
    // top crime
    const tcount = new Map<string, number>();
    for (const c of list) tcount.set(c.crimeType, (tcount.get(c.crimeType) ?? 0) + 1);
    const topCrime = [...tcount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Theft';
    const sevAvg = list.reduce((s, c) => s + c.severity, 0) / list.length;
    // trend by comparing last 6 months vs previous 6 months (synthetic)
    const now = +new Date('2026-07-17');
    const recent = list.filter((c) => now - +new Date(c.date) < 180 * 86400000).length;
    const prev = list.filter((c) => {
      const diff = now - +new Date(c.date);
      return diff >= 180 * 86400000 && diff < 360 * 86400000;
    }).length;
    const trend: Hotspot['trend'] = recent > prev * 1.15 ? 'rising' : recent < prev * 0.85 ? 'falling' : 'stable';
    out.push({
      id: `HS-${distId}`,
      districtId: distId,
      districtName: districtById(distId)?.name ?? distId,
      lat,
      lng,
      count: list.length,
      severityAvg: Math.round(sevAvg * 10) / 10,
      topCrime,
      trend,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

// Seasonal: crime count by month across all years
export function seasonalPattern(): { month: string; count: number; label: string }[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = months.map((m) => ({ month: m, label: m, count: 0 }));
  for (const c of allCases()) buckets[new Date(c.date).getUTCMonth()].count++;
  return buckets;
}

export function timeOfDayBreakdown(): { tod: string; count: number }[] {
  const t = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 } as Record<string, number>;
  for (const c of allCases()) t[c.timeOfDay]++;
  return Object.entries(t).map(([tod, count]) => ({ tod, count }));
}

// Similar cases by category + district + severity proximity
export function similarCases(caseId: string, limit = 5): CrimeCase[] {
  const c = getCaseById(caseId);
  if (!c) return [];
  return allCases()
    .filter((x) => x.id !== caseId)
    .map((x) => {
      let score = 0;
      if (x.category === c.category) score += 3;
      if (x.crimeType === c.crimeType) score += 4;
      if (x.districtId === c.districtId) score += 2;
      score += 3 - Math.abs(x.severity - c.severity) * 0.6;
      if (x.locationType === c.locationType) score += 1;
      return { x, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.x);
}

// Case timeline events
export interface TimelineEvent {
  date: string;
  title: string;
  detail: string;
  kind: 'fir' | 'arrest' | 'investigation' | 'forensic' | 'court' | 'closure';
}

export function caseTimeline(caseId: string): TimelineEvent[] {
  const c = getCaseById(caseId);
  if (!c) return [];
  const start = +new Date(c.date);
  const events: TimelineEvent[] = [
    {
      date: c.date,
      title: 'FIR Registered',
      detail: `${c.firNumber} filed under IPC ${c.ipcSections.join(', ')} at ${c.station?.name ?? c.stationId}.`,
      kind: 'fir',
    },
  ];
  events.push({
    date: new Date(start + 2 * 86400000).toISOString(),
    title: 'Investigation Initiated',
    detail: `Scene visit and evidence collection. Officer assigned: ${c.officerName}.`,
    kind: 'investigation',
  });
  const forensic = c.weaponUsed || c.category === 'Violent';
  if (forensic) {
    events.push({
      date: new Date(start + 5 * 86400000).toISOString(),
      title: 'Forensic Report Received',
      detail: `FSL analyzed ${c.weaponUsed ?? 'scene evidence'} and submitted findings.`,
      kind: 'forensic',
    });
  }
  const arrests = c.accused.filter((a) => a.status === 'Arrested' || a.status === 'In Custody');
  for (const a of arrests.slice(0, 3)) {
    events.push({
      date: new Date(start + intInDays(8, 60)).toISOString(),
      title: `Accused Arrested — ${a.name}`,
      detail: `${a.id}, ${a.age}y, ${a.occupation}. ${a.priorsCount} prior(s). Risk score ${a.riskScore}.`,
      kind: 'arrest',
    });
  }
  if (c.status === 'Charge Sheet Filed' || c.isSolved) {
    events.push({
      date: new Date(start + (c.daysToClose ?? 45) * 86400000).toISOString(),
      title: 'Charge Sheet Filed',
      detail: `Submitted to jurisdictional court. ${c.accused.length} accused named.`,
      kind: 'court',
    });
  }
  if (c.status === 'Closed') {
    events.push({
      date: new Date(start + (c.daysToClose ?? 90) * 86400000).toISOString(),
      title: 'Case Closed',
      detail: `Final report submitted. Closure time: ${c.daysToClose} days.`,
      kind: 'closure',
    });
  }
  return events.sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

function intInDays(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Network: build accused↔case↔victim graph with phone/vehicle/address links
export interface GraphNode {
  id: string;
  label: string;
  type: 'accused' | 'victim' | 'case' | 'phone' | 'vehicle' | 'address' | 'bank';
  districtId?: string;
  risk?: number;
  gang?: string | null;
}
export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  gangs: { name: string; members: number; districts: string[] }[];
  leaders: { accusedId: string; name: string; gang: string; centrality: number; cases: number }[];
  hiddenLinks: { a: string; b: string; reason: string; confidence: number }[];
}

const VEHICLES = ['KA01 AB 1234', 'KA02 CD 5678', 'KA03 EF 9012', 'KA05 GH 3456', 'KA08 IJ 7890', 'KA19 KL 2345', 'KA41 MN 6789'];
const STREETS = ['MG Road', 'Station Road', 'Market Street', 'Temple Street', 'Bus Stand Road', 'Industrial Area', 'New Town Layout'];

export function buildNetwork(districtId?: string, gang?: string): GraphData {
  const accused = allAccused().filter((a) => (!districtId || a.districtId === districtId) && (!gang || a.gangAffiliation === gang));
  const caseIds = new Set(accused.map((a) => a.caseId));
  const cases = allCases().filter((c) => caseIds.has(c.id));
  const victims = allVictims().filter((v) => caseIds.has(v.caseId));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (n: GraphNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };
  const addEdge = (s: string, t: string, label: string) => {
    const key = `${s}|${t}|${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ source: s, target: t, label });
    }
  };

  // Deterministic phone/vehicle/address per accused using hash
  const hashStr = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };
  const phoneFor = (a: Accused) => a.phone;
  const vehicleFor = (a: Accused) => VEHICLES[hashStr(a.id) % VEHICLES.length];
  const addressFor = (a: Accused) => `${STREETS[hashStr(a.id + 'x') % STREETS.length]}, ${districtById(a.districtId)?.name ?? ''}`;
  const bankFor = (a: Accused) => `BANK-${String(hashStr(a.id + 'b') % 100000).padStart(5, '0')}`;

  for (const a of accused) {
    addNode({ id: a.id, label: a.name, type: 'accused', districtId: a.districtId, risk: a.riskScore, gang: a.gangAffiliation });
    addNode({ id: phoneFor(a), label: a.phone, type: 'phone' });
    addNode({ id: vehicleFor(a), label: vehicleFor(a), type: 'vehicle' });
    addNode({ id: addressFor(a), label: addressFor(a), type: 'address', districtId: a.districtId });
    addNode({ id: bankFor(a), label: `Acct ****${a.aadhaarLast4}`, type: 'bank' });
    addEdge(a.id, phoneFor(a), 'owns phone');
    addEdge(a.id, vehicleFor(a), 'owns vehicle');
    addEdge(a.id, addressFor(a), 'resides at');
    addEdge(a.id, bankFor(a), 'holds account');
  }
  for (const c of cases) {
    addNode({ id: c.id, label: c.firNumber, type: 'case', districtId: c.districtId });
    for (const aid of c.accusedIds) addEdge(aid, c.id, 'accused in');
    for (const vid of c.victimIds) {
      const v = victims.find((x) => x.id === vid);
      if (v) {
        addNode({ id: v.id, label: v.name, type: 'victim', districtId: v.districtId });
        addEdge(v.id, c.id, 'victim of');
      }
    }
  }

  // Gang summary
  const gangMap = new Map<string, Accused[]>();
  for (const a of accused) {
    if (a.gangAffiliation) {
      const l = gangMap.get(a.gangAffiliation) ?? [];
      l.push(a);
      gangMap.set(a.gangAffiliation, l);
    }
  }
  const gangs = [...gangMap.entries()].map(([name, members]) => ({
    name,
    members: members.length,
    districts: [...new Set(members.map((m) => m.districtId))],
  }));

  // Leaders: highest risk per gang
  const leaders = [...gangMap.entries()].map(([gang, members]) => {
    const top = [...members].sort((a, b) => b.riskScore - a.riskScore)[0];
    const casesForTop = allCases().filter((c) => c.accusedIds.includes(top.id));
    return {
      accusedId: top.id,
      name: top.name,
      gang,
      centrality: top.riskScore,
      cases: casesForTop.length,
    };
  });

  // Hidden link prediction: accused sharing same phone area prefix OR same vehicle OR co-accused across cases
  const hiddenLinks: GraphData['hiddenLinks'] = [];
  const byPhonePrefix = new Map<string, Accused[]>();
  for (const a of accused) {
    const prefix = a.phone.slice(0, 9);
    const l = byPhonePrefix.get(prefix) ?? [];
    l.push(a);
    byPhonePrefix.set(prefix, l);
  }
  for (const [, group] of byPhonePrefix) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].id === group[j].id) continue;
          if (!edges.find((e) => (e.source === group[i].id && e.target === group[j].id) || (e.source === group[j].id && e.target === group[i].id))) {
            hiddenLinks.push({
              a: group[i].id,
              b: group[j].id,
              reason: 'Shared phone number prefix — possible coordinated activity',
              confidence: 0.72,
            });
          }
        }
      }
    }
  }
  // co-accused across multiple cases
  const pairCounts = new Map<string, number>();
  for (const c of cases) {
    for (let i = 0; i < c.accusedIds.length; i++) {
      for (let j = i + 1; j < c.accusedIds.length; j++) {
        const key = [c.accusedIds[i], c.accusedIds[j]].sort().join('|');
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of pairCounts) {
    if (count >= 2) {
      const [a, b] = key.split('|');
      hiddenLinks.push({ a, b, reason: `Co-accused in ${count} cases`, confidence: Math.min(0.97, 0.6 + count * 0.1) });
    }
  }

  return { nodes, edges, gangs, leaders, hiddenLinks: hiddenLinks.slice(0, 30) };
}

export function demographicsAgeDistribution() {
  const accused = allAccused();
  const victims = allVictims();
  const ageBands = [
    { range: 'Under 18', accused: 0, victims: 0 },
    { range: '18-25', accused: 0, victims: 0 },
    { range: '26-35', accused: 0, victims: 0 },
    { range: '36-50', accused: 0, victims: 0 },
    { range: 'Over 50', accused: 0, victims: 0 }
  ];
  for (const a of accused) {
    if (a.age < 18) ageBands[0].accused++;
    else if (a.age <= 25) ageBands[1].accused++;
    else if (a.age <= 35) ageBands[2].accused++;
    else if (a.age <= 50) ageBands[3].accused++;
    else ageBands[4].accused++;
  }
  for (const v of victims) {
    if (v.age < 18) ageBands[0].victims++;
    else if (v.age <= 25) ageBands[1].victims++;
    else if (v.age <= 35) ageBands[2].victims++;
    else if (v.age <= 50) ageBands[3].victims++;
    else ageBands[4].victims++;
  }
  return ageBands;
}

export function demographicsGenderDistribution() {
  const accused = allAccused();
  const victims = allVictims();
  const genderBreakdown = [
    { gender: 'Male', accused: 0, victims: 0 },
    { gender: 'Female', accused: 0, victims: 0 },
    { gender: 'Other', accused: 0, victims: 0 }
  ];
  for (const a of accused) {
    const g = a.gender || 'Male';
    const idx = genderBreakdown.findIndex(x => x.gender === g);
    if (idx !== -1) genderBreakdown[idx].accused++;
  }
  for (const v of victims) {
    const g = v.gender || 'Male';
    const idx = genderBreakdown.findIndex(x => x.gender === g);
    if (idx !== -1) genderBreakdown[idx].victims++;
  }
  return genderBreakdown;
}

export function demographicsOccupationDistribution() {
  const accused = allAccused();
  const counts: Record<string, number> = {};
  for (const a of accused) {
    const occ = a.occupation || 'Unemployed';
    counts[occ] = (counts[occ] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function demographicsSocialRiskIndicators() {
  const accused = allAccused();
  const riskGroups = [
    { name: 'Low Risk (<35)', value: 0 },
    { name: 'Medium Risk (35-54)', value: 0 },
    { name: 'High Risk (55-74)', value: 0 },
    { name: 'Critical Risk (>=75)', value: 0 }
  ];
  for (const a of accused) {
    const s = a.riskScore;
    if (s < 35) riskGroups[0].value++;
    else if (s < 55) riskGroups[1].value++;
    else if (s < 75) riskGroups[2].value++;
    else riskGroups[3].value++;
  }
  return riskGroups;
}

export { allCases, allAccused, allVictims, allStations, allOfficers, allAlerts, DISTRICTS, CRIME_TYPES, crimeDefByType, districtById, dataset };
