import type { CrimeCase, Accused } from '../types';
import { getCaseById, similarCases } from '../data/analytics';
import { offenderRisk } from './risk';
import { allCases } from '../data/generator';

export interface InvestigationSummary {
  caseId: string;
  aiSummary: string;
  suggestedSteps: string[];
  investigationLeads: InvestigationLead[];
  relatedEvidence: string[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  confidence: number;
}

export interface InvestigationLead {
  type: 'Accused' | 'Location' | 'Network' | 'Pattern' | 'Witness';
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  actionable: string;
}

export interface InvestigationNote {
  id: string;
  caseId: string;
  content: string;
  author: string;
  timestamp: string;
  category: 'Observation' | 'Lead' | 'Evidence' | 'Witness' | 'Action';
}

// In-memory notes store (persisted via localStorage)
const NOTES_KEY = 'ksp-investigation-notes';

function loadNotes(): InvestigationNote[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]'); } catch { return []; }
}
function saveNotes(notes: InvestigationNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function getNotesByCase(caseId: string): InvestigationNote[] {
  return loadNotes().filter((n) => n.caseId === caseId).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export function addNote(note: Omit<InvestigationNote, 'id' | 'timestamp'>): InvestigationNote {
  const notes = loadNotes();
  const newNote: InvestigationNote = {
    ...note,
    id: `NOTE-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
  };
  notes.unshift(newNote);
  saveNotes(notes.slice(0, 500));
  return newNote;
}

export function deleteNote(id: string): void {
  saveNotes(loadNotes().filter((n) => n.id !== id));
}

export function generateInvestigationSummary(caseId: string): InvestigationSummary | null {
  const c = getCaseById(caseId);
  if (!c) return null;

  const abscondingAccused = c.accused.filter((a) => a.status === 'Absconding');
  const gangLinked = c.accused.filter((a) => a.gangAffiliation);
  const highRiskAccused = c.accused.filter((a) => a.riskScore >= 70);
  const similar = similarCases(caseId, 3);
  const fatalVictims = c.victims.filter((v) => v.injurySeverity === 'Fatal');
  const majorVictims = c.victims.filter((v) => v.injurySeverity === 'Major');

  // AI Summary
  const aiSummary = buildSummary(c, abscondingAccused, gangLinked, fatalVictims, similar);

  // Suggested Steps
  const suggestedSteps = buildSteps(c, abscondingAccused, gangLinked, highRiskAccused);

  // Investigation Leads
  const leads = buildLeads(c, abscondingAccused, gangLinked, similar);

  // Related Evidence
  const relatedEvidence = buildEvidence(c);

  // Risk level
  const riskLevel = c.severity >= 9 ? 'Critical' : c.severity >= 7 ? 'High' : c.severity >= 5 ? 'Medium' : 'Low';

  const confidence = Math.min(0.95, 0.6 + (c.accused.length * 0.05) + (c.victims.length * 0.03) + (c.ipcSections.length * 0.02));

  return { caseId, aiSummary, suggestedSteps, investigationLeads: leads, relatedEvidence, riskLevel, confidence };
}

function buildSummary(c: ReturnType<typeof getCaseById> & {}, abscondingAccused: Accused[], gangLinked: Accused[], fatalVictims: any[], similar: CrimeCase[]): string {
  const parts: string[] = [];
  parts.push(`**Case ${c.id}** involves a **${c.crimeType}** (${c.category}) registered under FIR ${c.firNumber} on ${new Date(c.date).toLocaleDateString('en-IN')} at ${c.station?.name ?? c.stationId}, ${c.district?.name ?? c.districtId}.`);
  parts.push(`The case carries a severity of **${c.severity}/10** and is currently **${c.status}**.`);
  if (c.accused.length > 0) {
    parts.push(`**${c.accused.length} accused** named — ${c.accused.map((a) => a.name).slice(0, 3).join(', ')}${c.accused.length > 3 ? ` and ${c.accused.length - 3} more` : ''}.`);
  }
  if (abscondingAccused.length > 0) {
    parts.push(`⚠️ **${abscondingAccused.length} accused absconding**: ${abscondingAccused.map((a) => a.name).join(', ')} — immediate lookout notice recommended.`);
  }
  if (gangLinked.length > 0) {
    parts.push(`🔴 **Gang involvement detected**: ${[...new Set(gangLinked.map((a) => a.gangAffiliation))].join(', ')} — coordinate with organized crime unit.`);
  }
  if (fatalVictims.length > 0) {
    parts.push(`**${fatalVictims.length} fatal victim(s)** — post-mortem and forensic reports are critical.`);
  }
  if (c.weaponUsed) {
    parts.push(`Weapon used: **${c.weaponUsed}** — FSL analysis and ballistic/forensic matching required.`);
  }
  if (similar.length > 0) {
    parts.push(`**${similar.length} similar case(s)** found — cross-reference accused and modus operandi with ${similar.map((s) => s.id).join(', ')}.`);
  }
  return parts.join(' ');
}

function buildSteps(c: ReturnType<typeof getCaseById> & {}, abscondingAccused: Accused[], gangLinked: Accused[], highRiskAccused: Accused[]): string[] {
  const steps: string[] = [];
  steps.push(`Verify FIR ${c.firNumber} completeness — ensure all IPC sections (${c.ipcSections.join(', ')}) are correctly applied.`);
  steps.push(`Conduct scene-of-crime inspection at ${c.locationType} (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}) — collect physical evidence and CCTV footage.`);
  if (abscondingAccused.length > 0) {
    steps.push(`Issue lookout circulars for ${abscondingAccused.length} absconding accused: ${abscondingAccused.map((a) => `${a.name} (${a.id})`).join(', ')}.`);
  }
  if (c.weaponUsed) {
    steps.push(`Submit ${c.weaponUsed} to FSL for forensic analysis — match with prior cases in the district.`);
  }
  steps.push(`Record statements of all ${c.victims.length} victim(s) and identify potential witnesses in ${c.locationType} vicinity.`);
  if (gangLinked.length > 0) {
    steps.push(`Coordinate with Organized Crime Unit — ${[...new Set(gangLinked.map((a) => a.gangAffiliation))].join(', ')} gang involvement detected.`);
  }
  if (highRiskAccused.length > 0) {
    steps.push(`Apply for remand of high-risk accused: ${highRiskAccused.map((a) => a.name).join(', ')} (risk scores: ${highRiskAccused.map((a) => a.riskScore).join(', ')}).`);
  }
  steps.push(`Verify phone records and digital footprint of all accused — check CDR with telecom providers.`);
  steps.push(`File charge sheet within statutory period — current status: ${c.status}.`);
  if (c.valueLossInr > 0) {
    steps.push(`Initiate asset recovery proceedings for ₹${c.valueLossInr.toLocaleString('en-IN')} value loss.`);
  }
  return steps;
}

function buildLeads(c: ReturnType<typeof getCaseById> & {}, abscondingAccused: Accused[], gangLinked: Accused[], similar: CrimeCase[]): InvestigationLead[] {
  const leads: InvestigationLead[] = [];
  for (const a of abscondingAccused.slice(0, 3)) {
    leads.push({
      type: 'Accused',
      description: `${a.name} (${a.id}) — absconding, risk score ${a.riskScore}, last known district: ${a.districtId}`,
      priority: 'High',
      actionable: `Issue LOC/NBW, check last known address and phone ${a.phone}`,
    });
  }
  if (gangLinked.length > 0) {
    leads.push({
      type: 'Network',
      description: `Gang affiliation: ${[...new Set(gangLinked.map((a) => a.gangAffiliation))].join(', ')} — ${gangLinked.length} members in this case`,
      priority: 'High',
      actionable: 'Cross-reference with gang database, check co-accused in prior cases',
    });
  }
  if (similar.length > 0) {
    leads.push({
      type: 'Pattern',
      description: `${similar.length} similar cases found with matching crime type, location, or modus operandi`,
      priority: 'Medium',
      actionable: `Review cases ${similar.map((s) => s.id).join(', ')} for common accused or patterns`,
    });
  }
  leads.push({
    type: 'Location',
    description: `Crime occurred at ${c.locationType} — ${c.timeOfDay} — coordinates ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`,
    priority: c.timeOfDay === 'Night' ? 'High' : 'Medium',
    actionable: 'Obtain CCTV footage from nearby establishments, interview local witnesses',
  });
  if (c.accused.some((a) => a.priorsCount >= 3)) {
    const repeat = c.accused.filter((a) => a.priorsCount >= 3);
    leads.push({
      type: 'Accused',
      description: `${repeat.length} accused with 3+ prior convictions — high recidivism risk`,
      priority: 'Medium',
      actionable: `Review prior case files for ${repeat.map((a) => a.name).join(', ')} — identify patterns`,
    });
  }
  return leads;
}

function buildEvidence(c: ReturnType<typeof getCaseById> & {}): string[] {
  const evidence: string[] = [];
  evidence.push(`FIR document — ${c.firNumber} (${new Date(c.date).toLocaleDateString('en-IN')})`);
  if (c.weaponUsed) evidence.push(`${c.weaponUsed} — physical evidence, FSL submission required`);
  evidence.push(`Scene photographs — ${c.locationType} at ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
  if (c.victims.some((v) => v.injurySeverity !== 'None')) {
    evidence.push(`Medical examination reports — ${c.victims.filter((v) => v.injurySeverity !== 'None').length} injured victim(s)`);
  }
  evidence.push(`Witness statements — ${c.locationType} vicinity`);
  evidence.push(`CCTV footage — ${c.timeOfDay} time window`);
  if (c.valueLossInr > 0) evidence.push(`Financial records — ₹${c.valueLossInr.toLocaleString('en-IN')} value loss documentation`);
  evidence.push(`CDR (Call Detail Records) — all accused phone numbers`);
  return evidence;
}

// Similar cases with similarity percentage
export interface SimilarCaseResult {
  caseId: string;
  crimeType: string;
  firNumber: string;
  district: string;
  date: string;
  status: string;
  severity: number;
  similarityScore: number;
  matchReasons: string[];
}

export function getSimilarCasesWithScore(caseId: string, limit = 5): SimilarCaseResult[] {
  const c = getCaseById(caseId);
  if (!c) return [];

  return allCases()
    .filter((x) => x.id !== caseId)
    .map((x) => {
      let score = 0;
      const reasons: string[] = [];
      if (x.crimeType === c.crimeType) { score += 30; reasons.push('Same crime type'); }
      else if (x.category === c.category) { score += 15; reasons.push('Same category'); }
      if (x.districtId === c.districtId) { score += 20; reasons.push('Same district'); }
      const sevDiff = Math.abs(x.severity - c.severity);
      if (sevDiff <= 1) { score += 15; reasons.push('Similar severity'); }
      else if (sevDiff <= 3) { score += 7; }
      if (x.locationType === c.locationType) { score += 10; reasons.push('Same location type'); }
      if (x.timeOfDay === c.timeOfDay) { score += 5; reasons.push('Same time of day'); }
      const sharedIpc = x.ipcSections.filter((s) => c.ipcSections.includes(s));
      if (sharedIpc.length > 0) { score += sharedIpc.length * 5; reasons.push(`Shared IPC: ${sharedIpc.join(', ')}`); }
      if (x.weaponUsed && x.weaponUsed === c.weaponUsed) { score += 10; reasons.push('Same weapon'); }
      return { x, score: Math.min(99, score), reasons };
    })
    .filter((r) => r.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      caseId: r.x.id,
      crimeType: r.x.crimeType,
      firNumber: r.x.firNumber,
      district: r.x.districtId,
      date: r.x.date,
      status: r.x.status,
      severity: r.x.severity,
      similarityScore: r.score,
      matchReasons: r.reasons,
    }));
}
