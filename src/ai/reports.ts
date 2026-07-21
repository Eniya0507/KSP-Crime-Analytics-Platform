import { kpis, districtBreakdown, crimeTypeDistribution, monthlyTrend, hotspots, repeatOffenders } from '../data/analytics';
import { allCases } from '../data/generator';
import { getCaseById, caseTimeline } from '../data/analytics';
import { generateInvestigationSummary, getSimilarCasesWithScore } from './investigation';
import type { ChatMessage } from '../types';
import { uploadReportToStratus } from '../lib/stratus';

const STYLES = `
  body { font-family: 'Inter', Arial, sans-serif; color: #0b1426; margin: 32px; }
  h1 { color: #1c3e72; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin: 0 0 4px; font-size: 22px; }
  h2 { color: #1c3e72; font-size: 15px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .05em; }
  .sub { color: #555; font-size: 12px; margin-bottom: 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
  .kpi { border: 1px solid #d8e4f5; border-radius: 8px; padding: 10px 12px; }
  .kpi .v { font-size: 22px; font-weight: 700; color: #234e8c; }
  .kpi .l { font-size: 11px; color: #555; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  th { background: #eef3fb; text-align: left; padding: 6px 8px; color: #234e8c; }
  td { border-top: 1px solid #e5edf7; padding: 6px 8px; }
  .bar { height: 8px; background: #3b82f6; border-radius: 4px; }
  .footer { margin-top: 30px; font-size: 10px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; }
  .pill { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .pill.open { background: #fef3c7; color: #92400e; }
  .pill.closed { background: #d1fae5; color: #065f46; }
  .pill.high { background: #fee2e2; color: #991b1b; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { margin: 3px 0; font-size: 12px; }
  .msg { border-left: 3px solid #3b82f6; padding: 6px 10px; margin: 8px 0; background: #f8fafc; font-size: 12px; }
  .msg .r { font-weight: 600; color: #234e8c; }
`;

function header(title: string, subtitle: string): string {
  return `<h1>Karnataka State Police — ${title}</h1><div class="sub">${subtitle} · Generated ${new Date().toLocaleString('en-IN')} · CONFIDENTIAL</div>`;
}
function footer(): string {
  return `<div class="footer">KSP Crime Intelligence Platform — AI-powered analytics. For official use only. © 2026 Karnataka State Police.</div>`;
}

/** Build a full standalone HTML document from the report body fragment. */
export function buildReportDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>KSP Report</title><style>${STYLES}</style></head><body>${html}${footer()}</body></html>`;
}

function openPrint(html: string, reportLabel = 'KSP_Report') {
  const fullDoc = buildReportDocument(html);

  // Background upload to Catalyst Stratus (fire-and-forget — never blocks the print dialog)
  uploadReportToStratus(fullDoc, reportLabel).catch(() => { /* silent */ });

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    const blob = new Blob([fullDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportLabel}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>KSP Report</title><style>${STYLES}</style></head><body>${html}${footer()}<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>`);
  w.document.close();
}

export function exportDashboardPdf() {
  const k = kpis();
  const dist = districtBreakdown().slice(0, 10);
  const ct = crimeTypeDistribution().slice(0, 8);
  const hs = hotspots().slice(0, 5);
  const ro = repeatOffenders(8);
  const html = `
    ${header('Crime Dashboard Report', 'Statewide intelligence summary')}
    <div class="kpi-grid">
      <div class="kpi"><div class="v">${k.totalCases}</div><div class="l">Total Cases</div></div>
      <div class="kpi"><div class="v">${k.clearance}%</div><div class="l">Clearance Rate</div></div>
      <div class="kpi"><div class="v">${k.open}</div><div class="l">Open Cases</div></div>
      <div class="kpi"><div class="v">${k.highSeverity}</div><div class="l">High Severity</div></div>
      <div class="kpi"><div class="v">${k.repeatOffenders}</div><div class="l">Repeat Offenders</div></div>
      <div class="kpi"><div class="v">${k.activeGangs}</div><div class="l">Active Gangs</div></div>
      <div class="kpi"><div class="v">₹${(k.valueLossInr / 10000000).toFixed(2)} Cr</div><div class="l">Value Loss</div></div>
      <div class="kpi"><div class="v">${k.alerts}</div><div class="l">Active Alerts</div></div>
    </div>
    <h2>Top Districts</h2>
    <table><tr><th>District</th><th>Cases</th><th>Unsolved</th><th>Clearance</th></tr>
    ${dist.map((d) => `<tr><td>${d.name}</td><td>${d.count}</td><td>${d.unsolved}</td><td>${Math.round((d.solved / d.count) * 100)}%</td></tr>`).join('')}
    </table>
    <h2>Top Crime Types</h2>
    <table><tr><th>Crime Type</th><th>Category</th><th>Cases</th></tr>
    ${ct.map((c) => `<tr><td>${c.type}</td><td>${c.category}</td><td>${c.count}</td></tr>`).join('')}
    </table>
    <h2>Crime Hotspots</h2>
    <table><tr><th>District</th><th>Cases</th><th>Avg Severity</th><th>Top Crime</th><th>Trend</th></tr>
    ${hs.map((h) => `<tr><td>${h.districtName}</td><td>${h.count}</td><td>${h.severityAvg}</td><td>${h.topCrime}</td><td>${h.trend}</td></tr>`).join('')}
    </table>
    <h2>Repeat Offenders</h2>
    <table><tr><th>Name</th><th>ID</th><th>Priors</th><th>Risk</th><th>Gang</th></tr>
    ${ro.map((a) => `<tr><td>${a.name}</td><td>${a.id}</td><td>${a.priorsCount}</td><td>${a.riskScore}</td><td>${a.gangAffiliation ?? '—'}</td></tr>`).join('')}
    </table>
  `;
  openPrint(html, 'KSP_Dashboard_Report');
}

export function exportCasePdf(caseId: string) {
  const c = getCaseById(caseId);
  if (!c) return;
  const tl = caseTimeline(caseId);
  const html = `
    ${header(`Case Report — ${c.id}`, `${c.firNumber} · ${c.crimeType}`)}
    <table>
      <tr><td><b>Case ID</b></td><td>${c.id}</td><td><b>FIR Number</b></td><td>${c.firNumber}</td></tr>
      <tr><td><b>Crime Type</b></td><td>${c.crimeType}</td><td><b>Category</b></td><td>${c.category}</td></tr>
      <tr><td><b>Date</b></td><td>${new Date(c.date).toUTCString()}</td><td><b>Time of Day</b></td><td>${c.timeOfDay}</td></tr>
      <tr><td><b>District</b></td><td>${c.district?.name}</td><td><b>Station</b></td><td>${c.station?.name}</td></tr>
      <tr><td><b>Status</b></td><td><span class="pill ${c.isSolved ? 'closed' : 'open'}">${c.status}</span></td><td><b>Severity</b></td><td>${c.severity}/10</td></tr>
      <tr><td><b>IPC Sections</b></td><td colspan="3">${c.ipcSections.join(', ')}</td></tr>
      <tr><td><b>Location</b></td><td>${c.locationType}</td><td><b>Coordinates</b></td><td>${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</td></tr>
      <tr><td><b>Weapon</b></td><td>${c.weaponUsed ?? 'None'}</td><td><b>Value Loss</b></td><td>₹${c.valueLossInr.toLocaleString('en-IN')}</td></tr>
      <tr><td><b>Investigating Officer</b></td><td>${c.officerName}</td><td><b>Accused Name</b></td><td>${c.accused.length ? c.accused.map(a => a.name).join(', ') : 'Unknown'}</td></tr>
    </table>
    <h2>Description</h2><p>${c.description}</p>
    <h2>Accused (${c.accused.length})</h2>
    <table><tr><th>ID</th><th>Name</th><th>Age</th><th>Priors</th><th>Risk</th><th>Status</th><th>Gang</th></tr>
    ${c.accused.map((a) => `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.age}</td><td>${a.priorsCount}</td><td>${a.riskScore}</td><td>${a.status}</td><td>${a.gangAffiliation ?? '—'}</td></tr>`).join('')}
    </table>
    <h2>Victims (${c.victims.length})</h2>
    <table><tr><th>ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Injury</th></tr>
    ${c.victims.map((v) => `<tr><td>${v.id}</td><td>${v.name}</td><td>${v.age}</td><td>${v.gender}</td><td>${v.injurySeverity}</td></tr>`).join('')}
    </table>
    <h2>Investigation Timeline</h2>
    <ul>${tl.map((e) => `<li><b>${new Date(e.date).toDateString()}</b> — ${e.title}: ${e.detail}</li>`).join('')}</ul>
  `;
  openPrint(html, `KSP_Case_${caseId}`);
}

export function exportInvestigationPdf(caseId: string) {
  const c = getCaseById(caseId);
  if (!c) return;
  const inv = generateInvestigationSummary(caseId);
  if (!inv) return;
  const sim = getSimilarCasesWithScore(caseId, 5);
  const html = `
    ${header(`Investigation Report — ${c.id}`, `${c.firNumber} · ${c.crimeType} · Risk: ${inv.riskLevel} · Confidence: ${Math.round(inv.confidence * 100)}%`)}
    <h2>AI Investigation Summary</h2>
    <p style="line-height:1.6">${inv.aiSummary.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
    <h2>Suggested Investigation Steps (${inv.suggestedSteps.length})</h2>
    <ol>${inv.suggestedSteps.map((s) => `<li style="margin-bottom:4px">${s}</li>`).join('')}</ol>
    <h2>Investigation Leads</h2>
    <table><tr><th>Type</th><th>Priority</th><th>Description</th><th>Actionable</th></tr>
    ${inv.investigationLeads.map((l) => `<tr><td>${l.type}</td><td>${l.priority}</td><td>${l.description}</td><td>${l.actionable}</td></tr>`).join('')}
    </table>
    <h2>Related Evidence</h2>
    <ul>${inv.relatedEvidence.map((e) => `<li>${e}</li>`).join('')}</ul>
    <h2>Similar Cases (${sim.length})</h2>
    <table><tr><th>Case ID</th><th>Crime Type</th><th>FIR</th><th>Similarity</th><th>Match Reasons</th></tr>
    ${sim.map((s) => `<tr><td>${s.caseId}</td><td>${s.crimeType}</td><td>${s.firNumber}</td><td>${s.similarityScore}%</td><td>${s.matchReasons.join(', ')}</td></tr>`).join('')}
    </table>
    <h2>Accused (${c.accused.length})</h2>
    <table><tr><th>ID</th><th>Name</th><th>Age</th><th>Risk</th><th>Priors</th><th>Status</th><th>Gang</th></tr>
    ${c.accused.map((a) => `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.age}</td><td>${a.riskScore}</td><td>${a.priorsCount}</td><td>${a.status}</td><td>${a.gangAffiliation ?? '—'}</td></tr>`).join('')}
    </table>
    <h2>Victims (${c.victims.length})</h2>
    <table><tr><th>ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Injury</th></tr>
    ${c.victims.map((v) => `<tr><td>${v.id}</td><td>${v.name}</td><td>${v.age}</td><td>${v.gender}</td><td>${v.injurySeverity}</td></tr>`).join('')}
    </table>
  `;
  openPrint(html, `KSP_Investigation_${caseId}`);
}

export function exportConversationPdf(messages: ChatMessage[], title = 'Conversation Transcript') {
  const html = `
    ${header('AI Conversation Transcript', title)}
    ${messages.map((m) => `<div class="msg"><div class="r">${m.role === 'user' ? 'You' : 'Assistant'} · ${new Date(m.timestamp).toLocaleString('en-IN')}${m.confidence ? ` · confidence ${Math.round(m.confidence * 100)}%` : ''}</div><div>${m.content.replace(/\n/g, '<br>')}</div>${m.sources?.length ? `<div style="margin-top:4px;font-size:11px;color:#666">Sources: ${m.sources.map((s) => s.title).join('; ')}</div>` : ''}</div>`).join('')}
  `;
  openPrint(html, 'KSP_Conversation_Transcript');
}

export function exportAnalyticsPdf() {
  const months = monthlyTrend();
  const ct = crimeTypeDistribution();
  const dist = districtBreakdown();
  const html = `
    ${header('Crime Analytics Report', 'Monthly, yearly & district analysis')}
    <h2>Monthly Trend (all years)</h2>
    <table><tr><th>Month</th><th>Cases</th><th>Solved</th><th>Clearance</th></tr>
    ${months.map((m) => `<tr><td>${m.label}</td><td>${m.count}</td><td>${m.solved}</td><td>${m.count ? Math.round((m.solved / m.count) * 100) : 0}%</td></tr>`).join('')}
    </table>
    <h2>Crime Type Distribution</h2>
    <table><tr><th>Crime Type</th><th>Category</th><th>Cases</th><th>Share</th></tr>
    ${ct.map((c) => `<tr><td>${c.type}</td><td>${c.category}</td><td>${c.count}</td><td>${Math.round((c.count / allCases().length) * 1000) / 10}%</td></tr>`).join('')}
    </table>
    <h2>District Analysis</h2>
    <table><tr><th>District</th><th>Cases</th><th>Solved</th><th>Unsolved</th><th>Clearance</th></tr>
    ${dist.map((d) => `<tr><td>${d.name}</td><td>${d.count}</td><td>${d.solved}</td><td>${d.unsolved}</td><td>${Math.round((d.solved / d.count) * 100)}%</td></tr>`).join('')}
    </table>
  `;
  openPrint(html, 'KSP_Analytics_Report');
}

export function exportAuditPdf(entries: { timestamp: string; userName: string; action: string; category: string; detail: string }[]) {
  const html = `
    ${header('Audit Log Report', `${entries.length} entries`)}
    <table><tr><th>Time</th><th>User</th><th>Category</th><th>Action</th><th>Detail</th></tr>
    ${entries.map((e) => `<tr><td>${new Date(e.timestamp).toLocaleString('en-IN')}</td><td>${e.userName}</td><td>${e.category}</td><td>${e.action}</td><td>${e.detail}</td></tr>`).join('')}
    </table>
  `;
  openPrint(html, 'KSP_Audit_Log');
}

// ── SmartBrowz-aware export helpers ──────────────────────────────────────────
// These are the SmartBrowz variants used by ReportsPage when the toggle is on.
// Each one builds the same HTML as the standard function, then delegates to
// exportWithSmartBrowz() which tries SmartBrowz first and falls back to openPrint().
import { exportWithSmartBrowz } from '../lib/smartbrowz';

export async function exportDashboardSmartBrowz(): Promise<void> {
  const k = kpis();
  const dist = districtBreakdown().slice(0, 10);
  const ct = crimeTypeDistribution().slice(0, 8);
  const hs = hotspots().slice(0, 5);
  const ro = repeatOffenders(8);
  const html = `
    ${header('Crime Dashboard Report', 'Statewide intelligence summary')}
    <div class="kpi-grid">
      <div class="kpi"><div class="v">${k.totalCases}</div><div class="l">Total Cases</div></div>
      <div class="kpi"><div class="v">${k.clearance}%</div><div class="l">Clearance Rate</div></div>
      <div class="kpi"><div class="v">${k.open}</div><div class="l">Open Cases</div></div>
      <div class="kpi"><div class="v">${k.highSeverity}</div><div class="l">High Severity</div></div>
    </div>
    <h2>Top Districts</h2>
    <table><tr><th>District</th><th>Cases</th><th>Unsolved</th><th>Clearance</th></tr>
    ${dist.map((d) => `<tr><td>${d.name}</td><td>${d.count}</td><td>${d.unsolved}</td><td>${Math.round((d.solved / d.count) * 100)}%</td></tr>`).join('')}
    </table>
    <h2>Top Crime Types</h2>
    <table><tr><th>Crime Type</th><th>Category</th><th>Cases</th></tr>
    ${ct.map((c) => `<tr><td>${c.type}</td><td>${c.category}</td><td>${c.count}</td></tr>`).join('')}
    </table>
    <h2>Crime Hotspots</h2>
    <table><tr><th>District</th><th>Cases</th><th>Avg Severity</th><th>Top Crime</th><th>Trend</th></tr>
    ${hs.map((h) => `<tr><td>${h.districtName}</td><td>${h.count}</td><td>${h.severityAvg}</td><td>${h.topCrime}</td><td>${h.trend}</td></tr>`).join('')}
    </table>
    <h2>Repeat Offenders</h2>
    <table><tr><th>Name</th><th>ID</th><th>Priors</th><th>Risk</th><th>Gang</th></tr>
    ${ro.map((a) => `<tr><td>${a.name}</td><td>${a.id}</td><td>${a.priorsCount}</td><td>${a.riskScore}</td><td>${a.gangAffiliation ?? '—'}</td></tr>`).join('')}
    </table>
  `;
  const doc = buildReportDocument(html);
  await exportWithSmartBrowz(doc, 'KSP_Dashboard_Report', () => openPrint(html, 'KSP_Dashboard_Report'));
}

export async function exportInvestigationSmartBrowz(caseId: string): Promise<void> {
  const c = getCaseById(caseId);
  if (!c) return;
  const inv = generateInvestigationSummary(caseId);
  if (!inv) return;
  const sim = getSimilarCasesWithScore(caseId, 5);
  const html = `
    ${header(`Investigation Report — ${c.id}`, `${c.firNumber} · ${c.crimeType} · Risk: ${inv.riskLevel} · Confidence: ${Math.round(inv.confidence * 100)}%`)}
    <h2>AI Investigation Summary</h2>
    <p style="line-height:1.6">${inv.aiSummary.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
    <h2>Suggested Investigation Steps (${inv.suggestedSteps.length})</h2>
    <ol>${inv.suggestedSteps.map((s) => `<li style="margin-bottom:4px">${s}</li>`).join('')}</ol>
    <h2>Investigation Leads</h2>
    <table><tr><th>Type</th><th>Priority</th><th>Description</th><th>Actionable</th></tr>
    ${inv.investigationLeads.map((l) => `<tr><td>${l.type}</td><td>${l.priority}</td><td>${l.description}</td><td>${l.actionable}</td></tr>`).join('')}
    </table>
    <h2>Related Evidence</h2>
    <ul>${inv.relatedEvidence.map((e) => `<li>${e}</li>`).join('')}</ul>
    <h2>Similar Cases (${sim.length})</h2>
    <table><tr><th>Case ID</th><th>Crime Type</th><th>FIR</th><th>Similarity</th><th>Match Reasons</th></tr>
    ${sim.map((s) => `<tr><td>${s.caseId}</td><td>${s.crimeType}</td><td>${s.firNumber}</td><td>${s.similarityScore}%</td><td>${s.matchReasons.join(', ')}</td></tr>`).join('')}
    </table>
  `;
  const doc = buildReportDocument(html);
  await exportWithSmartBrowz(doc, `KSP_Investigation_${caseId}`, () => openPrint(html, `KSP_Investigation_${caseId}`));
}

export async function exportAnalyticsSmartBrowz(): Promise<void> {
  const months = monthlyTrend();
  const ct = crimeTypeDistribution();
  const dist = districtBreakdown();
  const html = `
    ${header('Crime Analytics Report', 'Monthly, yearly & district analysis')}
    <h2>Monthly Trend (all years)</h2>
    <table><tr><th>Month</th><th>Cases</th><th>Solved</th><th>Clearance</th></tr>
    ${months.map((m) => `<tr><td>${m.label}</td><td>${m.count}</td><td>${m.solved}</td><td>${m.count ? Math.round((m.solved / m.count) * 100) : 0}%</td></tr>`).join('')}
    </table>
    <h2>Crime Type Distribution</h2>
    <table><tr><th>Crime Type</th><th>Category</th><th>Cases</th><th>Share</th></tr>
    ${ct.map((c) => `<tr><td>${c.type}</td><td>${c.category}</td><td>${c.count}</td><td>${Math.round((c.count / allCases().length) * 1000) / 10}%</td></tr>`).join('')}
    </table>
    <h2>District Analysis</h2>
    <table><tr><th>District</th><th>Cases</th><th>Solved</th><th>Unsolved</th><th>Clearance</th></tr>
    ${dist.map((d) => `<tr><td>${d.name}</td><td>${d.count}</td><td>${d.solved}</td><td>${d.unsolved}</td><td>${Math.round((d.solved / d.count) * 100)}%</td></tr>`).join('')}
    </table>
  `;
  const doc = buildReportDocument(html);
  await exportWithSmartBrowz(doc, 'KSP_Analytics_Report', () => openPrint(html, 'KSP_Analytics_Report'));
}
