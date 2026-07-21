import type { Accused, CrimeCase, RiskExplanation, ShapFeature } from '../types';
import { allCases, allAccused } from '../data/generator';
import { getCaseById, districtBreakdown } from '../data/analytics';
import { districtById } from '../data/catalog';
import { clamp } from '../data/random';

// Risk level from score
export function levelFromScore(score: number): RiskExplanation['level'] {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

// ---- Offender risk with SHAP-style additive explanation ----
// Base value = mean offender risk across dataset (the "expected" prediction)
let _baseOffender = 0;
function offenderBase(): number {
  if (!_baseOffender) {
    const sum = allAccused().reduce((s, a) => s + a.riskScore, 0);
    _baseOffender = Math.round(sum / allAccused().length);
  }
  return _baseOffender;
}

export function offenderRisk(accusedId: string): RiskExplanation | null {
  const a = allAccused().find((x) => x.id === accusedId);
  if (!a) return null;
  const base = offenderBase();
  const features: ShapFeature[] = [];

  // priors contribution
  const priors = a.priorsCount;
  features.push({
    feature: 'prior_convictions',
    value: priors * 4.2,
    display: `${priors} prior conviction${priors === 1 ? '' : 's'}`,
  });

  // gang affiliation
  features.push({
    feature: 'gang_affiliation',
    value: a.gangAffiliation ? 11 : -2,
    display: a.gangAffiliation ? `Gang: ${a.gangAffiliation}` : 'No gang link',
  });

  // age band (younger adult slightly higher recidivism)
  const ageContrib = a.age < 25 ? 4 : a.age < 35 ? 2 : a.age > 50 ? -5 : 0;
  features.push({ feature: 'age_band', value: ageContrib, display: `Age ${a.age}` });

  // status (absconding raises risk)
  const statusContrib =
    a.status === 'Absconding' ? 9 : a.status === 'On Bail' ? 3 : a.status === 'Arrested' ? -3 : a.status === 'In Custody' ? -6 : 0;
  features.push({ feature: 'current_status', value: statusContrib, display: a.status });

  // linked case severity
  const linked = allCases().filter((c) => c.accusedIds.includes(a.id));
  const avgSev = linked.length ? linked.reduce((s, c) => s + c.severity, 0) / linked.length : 0;
  features.push({ feature: 'avg_case_severity', value: (avgSev - 5) * 2.4, display: `Avg case severity ${avgSev.toFixed(1)}/10` });

  // multi-case (recidivism indicator)
  features.push({ feature: 'case_count', value: linked.length > 1 ? (linked.length - 1) * 2.5 : -1, display: `${linked.length} linked case${linked.length === 1 ? '' : 's'}` });

  // district crime density (environmental factor)
  const distStats = districtBreakdown().find((d) => d.id === a.districtId);
  const density = distStats ? distStats.count / 40 : 1; // ~ avg cases per district
  features.push({ feature: 'district_crime_density', value: (density - 1) * 3, display: `${distStats?.name ?? a.districtId} density` });

  const raw = base + features.reduce((s, f) => s + f.value, 0);
  const score = clamp(Math.round(raw), 1, 99);
  const level = levelFromScore(score);

  const reasoning: string[] = [];
  const top = [...features].sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4);
  for (const f of top) {
    if (f.value > 0) reasoning.push(`**${f.display}** increases risk by ${f.value.toFixed(1)} points.`);
    else if (f.value < 0) reasoning.push(`**${f.display}** reduces risk by ${Math.abs(f.value).toFixed(1)} points.`);
  }
  reasoning.push(
    `The model's baseline (expected offender risk) is ${base}. Summing feature contributions yields a final risk of ${score} (${level}).`,
  );

  return { score, level, baseValue: base, features, reasoning };
}

// ---- Case risk with SHAP ----
let _baseCase = 0;
function caseBase(): number {
  if (!_baseCase) {
    const sum = allCases().reduce((s, c) => s + c.severity * 8, 0);
    _baseCase = Math.round(sum / allCases().length);
  }
  return _baseCase;
}

export function caseRisk(caseId: string): RiskExplanation | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  const base = caseBase();
  const features: ShapFeature[] = [];

  features.push({ feature: 'crime_severity', value: (c.severity - 5) * 5, display: `Severity ${c.severity}/10` });
  features.push({ feature: 'weapon_used', value: c.weaponUsed ? 8 : -4, display: c.weaponUsed ? `Weapon: ${c.weaponUsed}` : 'No weapon' });
  features.push({ feature: 'accused_count', value: (c.accused.length - 1) * 4, display: `${c.accused.length} accused` });
  features.push({ feature: 'accused_priors', value: c.accused.reduce((s, a) => s + a.priorsCount, 0) * 2.2, display: `${c.accused.reduce((s, a) => s + a.priorsCount, 0)} total priors` });
  features.push({ feature: 'gang_link', value: c.accused.some((a) => a.gangAffiliation) ? 10 : -3, display: c.accused.some((a) => a.gangAffiliation) ? 'Gang-linked' : 'No gang link' });
  features.push({ feature: 'value_loss', value: Math.min(12, c.valueLossInr / 100000), display: `₹${(c.valueLossInr / 100000).toFixed(1)}L loss` });
  features.push({ feature: 'time_of_day', value: c.timeOfDay === 'Night' ? 5 : c.timeOfDay === 'Evening' ? 2 : -2, display: c.timeOfDay });
  features.push({ feature: 'case_status', value: c.isSolved ? -10 : 6, display: c.status });

  const raw = base + features.reduce((s, f) => s + f.value, 0);
  const score = clamp(Math.round(raw), 1, 99);
  const level = levelFromScore(score);

  const reasoning: string[] = [];
  const top = [...features].sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4);
  for (const f of top) {
    if (f.value > 0) reasoning.push(`**${f.display}** raises case risk by ${f.value.toFixed(1)}.`);
    else if (f.value < 0) reasoning.push(`**${f.display}** lowers case risk by ${Math.abs(f.value).toFixed(1)}.`);
  }
  reasoning.push(`Baseline case risk is ${base}. SHAP-weighted sum gives final risk ${score} (${level}).`);

  return { score, level, baseValue: base, features, reasoning };
}

// ---- District risk ----
export function districtRisk(districtId: string): RiskExplanation | null {
  const d = districtById(districtId);
  if (!d) return null;
  const cases = allCases().filter((c) => c.districtId === districtId);
  if (!cases.length) return null;
  const base = 45;
  const features: ShapFeature[] = [];

  const unsolved = cases.filter((c) => !c.isSolved).length;
  features.push({ feature: 'unsolved_rate', value: (unsolved / cases.length - 0.4) * 30, display: `${Math.round((unsolved / cases.length) * 100)}% unsolved` });
  const highSev = cases.filter((c) => c.severity >= 8).length;
  features.push({ feature: 'high_severity_share', value: (highSev / cases.length - 0.1) * 40, display: `${highSev} high-severity cases` });
  const gangs = new Set(allAccused().filter((a) => a.districtId === districtId && a.gangAffiliation).map((a) => a.gangAffiliation)).size;
  features.push({ feature: 'gang_presence', value: gangs * 4, display: `${gangs} active gangs` });
  const repeat = allAccused().filter((a) => a.districtId === districtId && a.priorsCount >= 5).length;
  features.push({ feature: 'repeat_offenders', value: repeat * 1.5, display: `${repeat} repeat offenders` });
  const valueLoss = cases.reduce((s, c) => s + c.valueLossInr, 0);
  features.push({ feature: 'economic_loss', value: Math.min(15, valueLoss / 10000000), display: `₹${(valueLoss / 10000000).toFixed(2)} Cr loss` });

  const raw = base + features.reduce((s, f) => s + f.value, 0);
  const score = clamp(Math.round(raw), 1, 99);
  const level = levelFromScore(score);

  const reasoning = [
    `**${d.name}** district risk is driven by ${Math.round((unsolved / cases.length) * 100)}% unsolved rate, ${highSev} high-severity cases, and ${gangs} active gangs.`,
    `Economic loss from crimes totals ₹${(valueLoss / 10000000).toFixed(2)} Cr.`,
    `Composite SHAP score: ${score} (${level}).`,
  ];

  return { score, level, baseValue: base, features, reasoning };
}

// Location risk (for a given case's location)
export function locationRisk(caseId: string): RiskExplanation | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  return districtRisk(c.districtId);
}

// SHAP summary across all accused (for global explainability view)
export function globalShapSummary(): { feature: string; meanAbs: number; direction: number }[] {
  const acc = allAccused().slice(0, 200); // sample
  const sums = new Map<string, { abs: number; signed: number }>();
  for (const a of acc) {
    const r = offenderRisk(a.id);
    if (!r) continue;
    for (const f of r.features) {
      const e = sums.get(f.feature) ?? { abs: 0, signed: 0 };
      e.abs += Math.abs(f.value);
      e.signed += f.value;
      sums.set(f.feature, e);
    }
  }
  return [...sums.entries()]
    .map(([feature, v]) => ({ feature, meanAbs: v.abs / acc.length, direction: v.signed / acc.length }))
    .sort((a, b) => b.meanAbs - a.meanAbs);
}
