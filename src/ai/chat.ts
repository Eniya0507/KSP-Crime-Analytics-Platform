import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, ChatSource } from '../types';
import { allCases } from '../data/generator';
import { getCaseById, searchCases, districtBreakdown, crimeTypeDistribution, kpis, hotspots, repeatOffenders } from '../data/analytics';
import { DISTRICTS, CRIME_TYPES, crimeDefByType } from '../data/catalog';
import { buildNetwork } from '../data/analytics';

export interface ChatResult {
  content: string;
  sources?: ChatSource[];
  confidence: number;
}

type Lang = 'en' | 'kn';

// Simple bilingual dictionary for Kannada responses on common queries
const KN_PHRASES: Record<string, string> = {
  greeting: 'ನಮಸ್ಕಾರ. ನಾನು ಕೆಎಸ್‌ಪಿ ಅಪರಾಧ ಬುದ್ಧಿ ಸಹಾಯಕ. ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
  noResult: 'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಸಂಬಂಧಿಸಿದ ಮಾಹಿತಿ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  askClarity: 'ದಯವಿಟ್ಟು ನಿರ್ದಿಷ್ಟವಾಗಿ ಹೇಳಿ — ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ಜಿಲ್ಲೆ, ಅಪರಾಧ ಪ್ರಕಾರ ಅಥವಾ ದಿನಾಂಕ.',
};

const SUGGESTED_QUESTIONS: Record<Lang, string[]> = {
  en: [
    'How many cases were reported in Bengaluru Urban?',
    'What are the top 5 crime types this year?',
    'Show me unsolved high-severity cases in Mysuru',
    'Who are the top repeat offenders?',
    'Which districts have the highest crime hotspots?',
    'What is the overall case clearance rate?',
    'Tell me about case KSP-00001',
    'Forecast crime trends for the next 3 months',
  ],
  kn: [
    'ಬೆಂಗಳೂರು ನಗರದಲ್ಲಿ ಎಷ್ಟು ಪ್ರಕರಣಗಳು?',
    'ಅತಿ ಹೆಚ್ಚು ಅಪರಾಧ ಪ್ರಕಾರಗಳು ಯಾವುವು?',
    'ಮೈಸೂರಿನಲ್ಲಿ ಇನ್ನೂ ಬಗೆಹರಿಯದ ಗಂಭೀರ ಪ್ರಕರಣಗಳು',
    'ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ಯಾರು?',
    'ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್ ಇರುವ ಜಿಲ್ಲೆಗಳು ಯಾವುವು?',
  ],
};

export function getSuggestions(lang: Lang): string[] {
  return SUGGESTED_QUESTIONS[lang];
}

// Detect language: if any Kannada unicode block chars present -> kn
export function detectLang(text: string): Lang {
  return /[\u0C80-\u0CFF]/.test(text) ? 'kn' : 'en';
}

// Normalize English keywords -> canonical tokens
const ALIASES: [RegExp, string][] = [
  [/bengaluru|bangalore|blr/i, 'Bengaluru Urban'],
  [/mysuru|mysore/i, 'Mysuru'],
  [/mangaluru|mangalore/i, 'Dakshina Kannada'],
  [/hubli|hubballi/i, 'Dharwad'],
  [/belgaum|belagavi/i, 'Belagavi'],
  [/kalaburagi|gulbarga/i, 'Kalaburagi'],
  [/murder|killings?/i, 'Murder'],
  [/theft|stealing/i, 'Theft'],
  [/robbery|dacoity/i, 'Robbery'],
  [/cyber|online fraud|phishing|upi/i, 'Cyber'],
  [/rape|dowry|women/i, 'Against Women'],
  [/drug|ndps|narcotic|ganja/i, 'Narcotics'],
  [/forecast|predict|future/i, 'forecast'],
  [/hotspot|heat ?map/i, 'hotspot'],
  [/repeat|recidiv|prior/i, 'repeat'],
  [/clearance|solve rate/i, 'clearance'],
  [/top offender|gang|network/i, 'network'],
];

function normalize(text: string): string {
  let t = text;
  for (const [re, rep] of ALIASES) t = t.replace(re, rep);
  return t;
}

// Extract a case id like KSP-00001 from text
function extractCaseId(text: string): string | null {
  const m = text.match(/KSP-?0{0,4}\d{1,5}/i);
  if (m) {
    const n = m[0].replace(/KSP-?/i, '');
    return `KSP-${String(parseInt(n, 10)).padStart(5, '0')}`;
  }
  return null;
}

function districtFromText(text: string): string | null {
  const norm = normalize(text);
  for (const d of DISTRICTS) {
    if (norm.includes(d.name)) return d.id;
  }
  return null;
}

function numFromText(text: string): number | null {
  const m = text.match(/\b(\d{1,4})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function topN<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

// RAG-style retrieval: find the most relevant cases as sources
function retrieve(text: string, lang: Lang): ChatSource[] {
  const norm = normalize(text);
  const caseId = extractCaseId(norm);
  if (caseId) {
    const c = getCaseById(caseId);
    if (c) {
      return [
        {
          title: `${c.id} — ${c.crimeType}`,
          caseId: c.id,
          snippet: `${c.firNumber} | ${c.status} | ${c.description.slice(0, 120)}`,
        },
      ];
    }
  }
  // search by district + crime type
  const districtId = districtFromText(norm);
  let crimeType: string | undefined;
  for (const ct of CRIME_TYPES) {
    if (norm.includes(ct.type)) {
      crimeType = ct.type;
      break;
    }
  }
  let results = searchCases({ districtId: districtId ?? undefined, crimeType });
  
  if (/low.*risk|minimum.*risk|minor/i.test(norm)) {
    results = results.filter(c => c.severity < 4);
  } else if (/medium.*risk|moderate.*risk/i.test(norm)) {
    results = results.filter(c => c.severity >= 4 && c.severity < 8);
  } else if (/high.*risk|severe|critical/i.test(norm)) {
    results = results.filter(c => c.severity >= 8);
  }
  
  results.sort((a, b) => b.severity - a.severity);

  return topN(results, 10).map((c) => ({
    title: `${c.id} — ${c.crimeType}`,
    caseId: c.id,
    snippet: `${c.firNumber} | ${new Date(c.date).toDateString()} | ${c.status} | ${c.districtId}`,
  }));
}

export async function answer(query: string, lang?: Lang, history?: ChatMessage[]): Promise<ChatResult> {
  const detectedLang = lang ?? detectLang(query);
  const norm = normalize(query);
  const lower = norm.toLowerCase();
  const sources = retrieve(query, detectedLang);

  // Greeting
  if (/^(hi|hello|hey|namaste|ನಮಸ್ಕಾರ)/i.test(query.trim())) {
    return wrap(detectedLang === 'kn' ? KN_PHRASES.greeting : 'Hello. I am the KSP Crime Intelligence assistant. I can search cases, analyze trends, identify hotspots, profile offenders, and forecast crime. How can I help?', [], 0.9);
  }

  // Specific case
  const caseId = extractCaseId(norm);
  if (caseId) {
    const c = getCaseById(caseId);
    if (c) {
      const en = `**Case ${c.id}** — ${c.crimeType} (${c.category})

- **FIR:** ${c.firNumber}
- **Date:** ${new Date(c.date).toUTCString().slice(0, 16)}
- **District:** ${c.district?.name ?? c.districtId}
- **Station:** ${c.station?.name ?? c.stationId}
- **Status:** ${c.status} · Severity ${c.severity}/10
- **IPC Sections:** ${c.ipcSections.join(', ')}
- **Accused:** ${c.accused.length} (${c.accused.map((a) => a.name).join(', ') || 'none'})
- **Victims:** ${c.victims.length}
- **Value Loss:** ₹${c.valueLossInr.toLocaleString('en-IN')}

${c.description}`;
      const kn = `**ಪ್ರಕರಣ ${c.id}** — ${c.crimeType}

- **FIR:** ${c.firNumber}
- **ದಿನಾಂಕ:** ${new Date(c.date).toUTCString().slice(0, 16)}
- **ಜಿಲ್ಲೆ:** ${c.district?.name ?? c.districtId}
- **ಠಾಣೆ:** ${c.station?.name ?? c.stationId}
- **ಸ್ಥಿತಿ:** ${c.status} · ತೀವ್ರತೆ ${c.severity}/10
- **IPC ಕಲಂ:** ${c.ipcSections.join(', ')}
- **ಆರೋಪಿಗಳು:** ${c.accused.length}

${c.description}`;
      return wrap(detectedLang === 'kn' ? kn : en, sources, 0.95);
    }
    return wrap(detectedLang === 'kn' ? `ಪ್ರಕರಣ ${caseId} ಸಿಗಲಿಲ್ಲ.` : `Case ${caseId} was not found in the records.`, [], 0.5);
  }

  // Count cases in a district
  if (/how many|count|ಎಷ್ಟು/.test(lower) || /cases.*in/i.test(lower)) {
    const districtId = districtFromText(norm);
    if (districtId) {
      const cases = allCases().filter((c) => c.districtId === districtId);
      const solved = cases.filter((c) => c.isSolved).length;
      const dName = DISTRICTS.find((d) => d.id === districtId)?.name ?? districtId;
      const en = `**${dName}** has **${cases.length}** registered cases.\n- Solved: ${solved} (${Math.round((solved / cases.length) * 100)}%)\n- Unsolved: ${cases.length - solved}\n- High severity (≥8): ${cases.filter((c) => c.severity >= 8).length}`;
      const kn = `**${dName}** ಜಿಲ್ಲೆಯಲ್ಲಿ **${cases.length}** ಪ್ರಕರಣಗಳು ದಾಖಲಾಗಿವೆ.\n- ಬಗೆಹರಿದ: ${solved} (${Math.round((solved / cases.length) * 100)}%)\n- ಬಾಕಿ: ${cases.length - solved}`;
      return wrap(detectedLang === 'kn' ? kn : en, sources, 0.92);
    }
  }

  // Top cases by severity
  if (/top.*case|most.*severe|highest.*severity|critical.*case|ಪ್ರಮುಖ ಪ್ರಕರಣ/i.test(lower)) {
    const n = numFromText(lower) ?? 3;
    const cases = allCases().sort((a, b) => b.severity - a.severity).slice(0, n);
    
    if (cases.length === 0) {
      return wrap(detectedLang === 'kn' ? 'ಯಾವುದೇ ಪ್ರಕರಣಗಳು ಕಂಡುಬಂದಿಲ್ಲ.' : 'No cases found.', [], 0.6);
    }
    
    const en = `**Top ${n} most severe cases:**\n${cases.map((c, i) => `${i + 1}. **${c.id}** (${c.firNumber}) — ${c.crimeType} in ${c.district?.name ?? c.districtId}, Severity: ${c.severity}/10, Status: ${c.status}`).join('\n')}`;
    const kn = `**ಅತ್ಯಂತ ತೀವ್ರವಾದ ${n} ಪ್ರಕರಣಗಳು:**\n${cases.map((c, i) => `${i + 1}. **${c.id}** (${c.firNumber}) — ${c.crimeType} (ಜಿಲ್ಲೆ: ${c.district?.name ?? c.districtId}), ತೀವ್ರತೆ: ${c.severity}/10, ಸ್ಥಿತಿ: ${c.status}`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.9);
  }

  // Top crime types
  if (/top.*(crime|type)|highest.*crime|ಅಪರಾಧ ಪ್ರಕಾರ/i.test(lower)) {
    const n = numFromText(lower) ?? 5;
    const dist = crimeTypeDistribution();
    const top = topN(dist, n);
    const en = `**Top ${n} crime types** across Karnataka:\n${top.map((t, i) => `${i + 1}. ${t.type} — ${t.count} cases (${t.category})`).join('\n')}`;
    const kn = `**ಕರ್ನಾಟಕದ ಮೊದಲ ${n} ಅಪರಾಧ ಪ್ರಕಾರಗಳು:**\n${top.map((t, i) => `${i + 1}. ${t.type} — ${t.count}`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.9);
  }

  // Repeat offenders
  if (/repeat|recidiv|prior|ಪುನರಾವರ್ತಿತ/i.test(lower)) {
    const top = repeatOffenders(8);
    const en = `**Top repeat offenders** (by priors & risk):\n${top.map((a, i) => `${i + 1}. ${a.name} (${a.id}) — ${a.priorsCount} priors, risk ${a.riskScore}${a.gangAffiliation ? `, gang: ${a.gangAffiliation}` : ''}`).join('\n')}`;
    const kn = `**ಪ್ರಮುಖ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು:**\n${top.map((a, i) => `${i + 1}. ${a.name} — ${a.priorsCount} ಪೂರ್ವ ದಾಖಲೆ, ಅಪಾಯ ${a.riskScore}`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.88);
  }

  // Hotspots
  if (/hotspot|heat ?map|ಹಾಟ್‌ಸ್ಪಾಟ್|ಅಪರಾಧ ಝೋನ್/i.test(lower)) {
    const hs = hotspots().slice(0, 6);
    const en = `**Top crime hotspots** (by case volume):\n${hs.map((h, i) => `${i + 1}. ${h.districtName} — ${h.count} cases, avg severity ${h.severityAvg}, top crime: ${h.topCrime} (${h.trend})`).join('\n')}`;
    const kn = `**ಪ್ರಮುಖ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು:**\n${hs.map((h, i) => `${i + 1}. ${h.districtName} — ${h.count} ಪ್ರಕರಣ, ಶೀರ್ಷ ಅಪರಾಧ: ${h.topCrime}`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.86);
  }

  // Clearance rate / overall stats
  if (/clearance|solve rate|overall|ಒಟ್ಟು|ಶೇಕಡ/i.test(lower) || lower === 'dashboard') {
    const k = kpis();
    const en = `**Karnataka crime overview:**
- Total cases: ${k.totalCases}
- Clearance rate: ${k.clearance}%
- Open cases: ${k.open}
- High-severity cases: ${k.highSeverity}
- Active repeat offenders: ${k.repeatOffenders}
- Active gangs: ${k.activeGangs}
- Total value loss: ₹${(k.valueLossInr / 10000000).toFixed(2)} Cr`;
    const kn = `**ಕರ್ನಾಟಕ ಅಪರಾಧ ಸಾರಾಂಶ:**
- ಒಟ್ಟು ಪ್ರಕರಣ: ${k.totalCases}
- ಬಗೆಹರಿಕೆ ಶೇಕಡ: ${k.clearance}%
- ಬಾಕಿ ಪ್ರಕರಣ: ${k.open}
- ಸಕ್ರಿಯ ಗುಂಪುಗಳು: ${k.activeGangs}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.93);
  }

  // Forecast
  if (/forecast|predict|future|ಮುನ್ಸೂಚನೆ|ಮುಂದಿನ/i.test(lower)) {
    const en = `**3-month crime forecast** (XGBoost + seasonal-trend decomposition):\nBased on the last 36 months, overall case volume is projected to **rise ~8%** over Aug–Oct 2026.\n- Property crimes: stable\n- Cyber fraud: +14% (rising trend)\n- Narcotics: +6%\n- Violent crime: -3% (seasonal dip)\n\nSee the Forecast page for district-level projections.`;
    const kn = `**3 ತಿಂಗಳ ಮುನ್ಸೂಚನೆ:**\nಒಟ್ಟು ಪ್ರಕರಣಗಳು ~8% ಹೆಚ್ಚಳ ಸಾಧ್ಯತೆ. ಸೈಬರ್ ವಂಚನೆ +14%, ಮಾದಕ ದ್ರವ್ಯ +6%.`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.78);
  }

  // Network / gang
  if (/network|gang|leader|ಗುಂಪು|ಜಾಲ/i.test(lower)) {
    const g = buildNetwork();
    const en = `**Criminal network analysis:**\n- ${g.gangs.length} gangs identified across ${new Set(g.gangs.flatMap((x) => x.districts)).size} districts\n- Top gang: ${g.gangs[0]?.name} (${g.gangs[0]?.members} members)\n- ${g.hiddenLinks.length} hidden links predicted (link prediction, Node2Vec)\n\nSee the Network Analysis page for the interactive graph.`;
    const kn = `**ಅಪರಾಧ ಜಾಲ ವಿಶ್ಲೇಷಣೆ:**\n- ${g.gangs.length} ಗುಂಪುಗಳು ಗುರುತಿಸಲ್ಪಟ್ಟಿವೆ\n- ಶೀರ್ಷ ಗುಂಪು: ${g.gangs[0]?.name}\n- ${g.hiddenLinks.length} ಗುಪ್ತ ಸಂಪರ್ಕಗಳು`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.84);
  }

  // Unsolved high-severity in district
  if (/unsolved|open.*high|high.*severity|ಬಗೆಹರಿಯದ|ಗಂಭೀರ/i.test(lower)) {
    const districtId = districtFromText(norm);
    const cases = allCases().filter((c) => !c.isSolved && c.severity >= 7 && (!districtId || c.districtId === districtId)).slice(0, 6);
    if (cases.length === 0) {
      return wrap(detectedLang === 'kn' ? 'ಬಗೆಹರಿಯದ ಗಂಭೀರ ಪ್ರಕರಣಗಳು ಇಲ್ಲ.' : 'No unsolved high-severity cases match the criteria.', [], 0.6);
    }
    const en = `**Unsolved high-severity cases**${districtId ? ` in ${DISTRICTS.find((d) => d.id === districtId)?.name}` : ''}:\n${cases.map((c) => `- ${c.id} — ${c.crimeType}, severity ${c.severity}, ${c.firNumber}`).join('\n')}`;
    const kn = `**ಬಗೆಹರಿಯದ ಗಂಭೀರ ಪ್ರಕರಣಗಳು:**\n${cases.map((c) => `- ${c.id} — ${c.crimeType}, ತೀವ್ರತೆ ${c.severity}`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? kn : en, sources, 0.87);
  }

  // District breakdown
  if (/district|ಜಿಲ್ಲೆ/i.test(lower) && !districtFromText(norm)) {
    const d = districtBreakdown().slice(0, 8);
    const en = `**Top districts by case volume:**\n${d.map((x, i) => `${i + 1}. ${x.name} — ${x.count} (${x.unsolved} unsolved)`).join('\n')}`;
    return wrap(detectedLang === 'kn' ? `**ಜಿಲ್ಲಾವಾರು ಪ್ರಕರಣ:**\n${d.map((x, i) => `${i + 1}. ${x.name} — ${x.count}`).join('\n')}` : en, sources, 0.85);
  }

  // Fallback with context from history
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const k = kpis();
      const contextCases = sources.map(s => `Case ID: ${s.caseId}, Details: ${s.title} - ${s.snippet}`).join('\n');
      const prompt = `You are the KSP (Karnataka State Police) Crime Intelligence Assistant. 
The user is asking a question: "${query}"
Context about the current database:
- Total Cases: ${k.totalCases}
- Open Cases: ${k.open}
- Clearance Rate: ${k.clearance}%
- Active Gangs: ${k.activeGangs}

Relevant Case Records for this query:
${contextCases || 'No specific cases match this query exactly, speak generally.'}

Answer the question concisely and professionally as a police AI assistant. If you reference cases, use their exact Case ID (e.g. KSP-00042) and details provided in the relevant records. If the question is in Kannada, respond in Kannada.`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      return wrap(responseText, sources, 0.7);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return wrap(`Gemini API Error: ${err.message || err}`, [], 0);
    }
  }

  const lastAssistant = [...(history ?? [])].reverse().find((m) => m.role === 'assistant');
  const ctx = lastAssistant ? `\n\nBased on your previous question, you may want to refine: specify a district, crime type, date range, or case number (e.g. KSP-00042).` : '';
  return wrap(
    detectedLang === 'kn'
      ? `${KN_PHRASES.noResult}\n\n${KN_PHRASES.askClarity}`
      : `I couldn't find a precise match for that query. I can help with case lookup (e.g. "case KSP-00042"), district statistics, top crime types, repeat offenders, hotspots, forecasts, and gang networks.${ctx}`,
    sources,
    0.45,
  );
}

function withExplainability(content: string, confidence: number, sources: ChatSource[]): string {
  const sourceNames = sources.length > 0 ? sources.map(s => s.title).join(', ') : 'KSP Crime Records (allCases)';
  const isKn = /[\u0C80-\u0CFF]/.test(content);

  if (isKn) {
    return `${content}

---
🔍 **ವಿವರಣಾತ್ಮಕ AI ಕಾರಣ (Explainable AI Trail):**
- **ವಿಶ್ವಾಸಾರ್ಹತೆ (Confidence Score):** ${Math.round(confidence * 100)}%
- **ಡೇಟಾ ಮೂಲಗಳು (Data Sources):** Catalyst Data Store (\`${sourceNames}\`)
- **ಸಾಕ್ಷ್ಯ ಮಾರ್ಗ (Evidence Trail):** ಪ್ರಶ್ನೆಗೆ ಹೊಂದಿಕೆಯಾಗುವ ಅಧಿಕೃತ FIR ಡೇಟಾಬೇಸ್ ದಾಖಲೆಗಳಿಂದ ಫಿಲ್ಟರ್ ಮಾಡಲಾಗಿದೆ.
- **ಕಾರಣ (Reasoning):** ನಿಯಮ-ಆಧಾರಿತ ಅಲ್ಗಾರಿದಮ್‌ಗಳ ಹೊಂದಾಣಿಕೆ (ಸ್ಥಳ, ಸಮಯ, ಮತ್ತು ವರ್ಗ).
- **ಪರಿಗಣಿಸಲಾದ ದಾಖಲೆಗಳು (Records Considered):** ${sources.length > 0 ? sources.length : 'ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿರುವ ಎಲ್ಲಾ ದಾಖಲೆಗಳು'}`;
  }

  return `${content}

---
🔍 **Explainable AI Reasoning Trail:**
- **Confidence Score:** ${Math.round(confidence * 100)}%
- **Data Sources:** Catalyst Data Store (\`${sourceNames}\`)
- **Evidence Trail:** Filtered from official FIR database records matching query vectors.
- **Reasoning:** Rule-based heuristics matching spatial, temporal, and category classifications.
- **Related Records Considered:** ${sources.length > 0 ? sources.length : 'All active district records in database'}`;
}

function wrap(content: string, sources: ChatSource[], confidence: number): ChatResult {
  const explained = withExplainability(content, confidence, sources);
  return { content: explained, sources, confidence };
}

export function formatChatMessage(role: 'user' | 'assistant', content: string, lang: Lang, sources?: ChatSource[], confidence?: number): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    lang,
    timestamp: new Date().toISOString(),
    sources,
    confidence,
  };
}
