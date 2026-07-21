import { useMemo, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, User, Users, Shield, FileText, Phone, Banknote,
  Activity, Sparkles, Download, Clock, AlertCircle, Brain, Target, Lightbulb,
  StickyNote, Plus, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { PageHeader, Card, StatusPill, CategoryPill, SeverityMeter, RiskBadge, EmptyState, Banner } from '../components/ui';
import { getCaseById, caseTimeline } from '../data/analytics';
import { caseRisk, offenderRisk } from '../ai/risk';
import { ShapWaterfall } from '../components/charts';
import MapView from '../components/MapView';
import { exportCasePdf, exportInvestigationPdf } from '../ai/reports';
import { addAudit, useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import type { TimelineEvent } from '../data/analytics';
import {
  generateInvestigationSummary, getSimilarCasesWithScore,
  getNotesByCase, addNote, deleteNote, type InvestigationNote,
} from '../ai/investigation';

const KIND_DOT: Record<TimelineEvent['kind'], string> = {
  fir: 'bg-blue-500', investigation: 'bg-amber-500', forensic: 'bg-purple-500',
  arrest: 'bg-rose-500', court: 'bg-cyan-500', closure: 'bg-emerald-500',
};

const LEAD_PRIORITY_COLOR = { High: 'bg-rose-500/15 text-rose-300', Medium: 'bg-amber-500/15 text-amber-300', Low: 'bg-steel-500/15 text-steel-300' };
const LEAD_TYPE_COLOR = { Accused: 'text-rose-400', Location: 'text-cyan-400', Network: 'text-purple-400', Pattern: 'text-amber-400', Witness: 'text-emerald-400' };
const NOTE_CATEGORIES: InvestigationNote['category'][] = ['Observation', 'Lead', 'Evidence', 'Witness', 'Action'];
const NOTE_CAT_COLOR: Record<InvestigationNote['category'], string> = {
  Observation: 'bg-steel-500/15 text-steel-300',
  Lead: 'bg-amber-500/15 text-amber-300',
  Evidence: 'bg-blue-500/15 text-blue-300',
  Witness: 'bg-emerald-500/15 text-emerald-300',
  Action: 'bg-purple-500/15 text-purple-300',
};

export default function CaseDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const c = useMemo(() => (id ? getCaseById(id) : undefined), [id]);
  const risk = useMemo(() => (id ? caseRisk(id) : null), [id]);
  const timeline = useMemo(() => (id ? caseTimeline(id) : []), [id]);
  const investigation = useMemo(() => (id ? generateInvestigationSummary(id) : null), [id]);
  const similarCases = useMemo(() => (id ? getSimilarCasesWithScore(id, 5) : []), [id]);

  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<InvestigationNote['category']>('Observation');
  const [showInvestigation, setShowInvestigation] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (id) setNotes(getNotesByCase(id));
  }, [id]);

  useEffect(() => {
    if (id && c) addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Viewed case ${id}`, category: 'Case Access', detail: `${c.crimeType} · ${c.status}` });
  }, [id, c, user]);

  const handleAddNote = () => {
    if (!noteText.trim() || !id) return;
    const n = addNote({ caseId: id, content: noteText.trim(), author: user?.name ?? 'Unknown', category: noteCategory });
    setNotes((prev) => [n, ...prev]);
    setNoteText('');
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Added note to case ${id}`, category: 'Case Access', detail: noteText.slice(0, 60) });
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  if (!c) {
    return (
      <div>
        <PageHeader title={t('page_search_title')} />
        <EmptyState icon={<AlertCircle size={40} />} title={`Case ${id} does not exist`} hint="It may have been removed or the ID is incorrect." />
        <div className="mt-4"><Link to="/search" className="btn-outline"><ArrowLeft size={15} /> Back to search</Link></div>
      </div>
    );
  }

  const mapPoint = { lat: c.lat, lng: c.lng, weight: c.severity / 10, popup: `<b>${c.id}</b><br/>${c.crimeType}<br/>${c.firNumber}` };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost"><ArrowLeft size={16} /> Back</button>
        <div className="flex gap-2">
          <Link to={`/timeline?id=${c.id}`} className="btn-outline"><Clock size={15} /> Timeline</Link>
          <Link to={`/chatbot?q=${encodeURIComponent(`Tell me about case ${c.id}`)}`} className="btn-outline"><Sparkles size={15} /> Ask AI</Link>
          <button onClick={() => exportInvestigationPdf(c.id)} className="btn-outline"><Brain size={15} /> Investigation PDF</button>
          <button onClick={() => exportCasePdf(c.id)} className="btn-primary"><Download size={15} /> Case PDF</button>
        </div>
      </div>

      <PageHeader
        title={`${c.id} — ${c.crimeType}`}
        subtitle={`${c.firNumber} · ${c.category} · IPC ${c.ipcSections.join(', ')}`}
        action={<div className="flex items-center gap-2"><StatusPill status={c.status} /><RiskBadge score={risk?.score ?? 0} level={risk?.level ?? 'Low'} /></div>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-4 lg:col-span-2">
          <Card title="Case Overview" subtitle="FIR & jurisdiction details">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Row icon={<FileText size={14} />} label="FIR Number" value={c.firNumber} />
              <Row icon={<Calendar size={14} />} label="Date & Time" value={`${new Date(c.date).toLocaleString('en-IN')} · ${c.timeOfDay}`} />
              <Row icon={<MapPin size={14} />} label="District" value={c.district?.name ?? c.districtId} />
              <Row icon={<Shield size={14} />} label="Station" value={c.station?.name ?? c.stationId} />
              <Row icon={<User size={14} />} label="Investigating Officer" value={c.officerName} />
              <Row icon={<Activity size={14} />} label="Severity" value={<SeverityMeter value={c.severity} />} />
              <Row icon={<MapPin size={14} />} label="Location Type" value={c.locationType} />
              <Row icon={<Activity size={14} />} label="Weapon" value={c.weaponUsed ?? 'None'} />
              <Row icon={<Banknote size={14} />} label="Value Loss" value={`₹${c.valueLossInr.toLocaleString('en-IN')}`} />
              <Row icon={<Clock size={14} />} label="Days to Close" value={c.daysToClose ? `${c.daysToClose} days` : '—'} />
            </div>
            <div className="mt-4 rounded-lg border border-white/5 bg-ink-900/40 p-3 text-sm text-steel-200">
              <p className="section-title mb-1.5">Description</p>
              {c.description}
            </div>
          </Card>

          {/* AI Investigation Summary */}
          {investigation && (
            <Card
              title="AI Investigation Summary"
              subtitle={`Confidence ${Math.round(investigation.confidence * 100)}% · Risk: ${investigation.riskLevel}`}
              action={
                <button onClick={() => setShowInvestigation((v) => !v)} className="text-steel-300/60 hover:text-white">
                  {showInvestigation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              }
            >
              {showInvestigation && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-steel-500/20 bg-steel-600/10 p-3 text-sm text-steel-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: investigation.aiSummary.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/⚠️/g, '<span class="text-amber-400">⚠️</span>').replace(/🔴/g, '<span class="text-rose-400">🔴</span>') }}
                  />

                  {/* Investigation Leads */}
                  <div>
                    <p className="section-title mb-2 flex items-center gap-1.5"><Target size={13} /> Investigation Leads</p>
                    <div className="space-y-2">
                      {investigation.investigationLeads.map((lead, i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-medium ${LEAD_TYPE_COLOR[lead.type]}`}>{lead.type}</span>
                            <span className={`chip text-[10px] ${LEAD_PRIORITY_COLOR[lead.priority]}`}>{lead.priority}</span>
                          </div>
                          <p className="mt-1 text-xs text-steel-200">{lead.description}</p>
                          <p className="mt-1 text-[11px] text-steel-300/70">→ {lead.actionable}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Related Evidence */}
                  <div>
                    <p className="section-title mb-2 flex items-center gap-1.5"><FileText size={13} /> Related Evidence</p>
                    <ul className="space-y-1">
                      {investigation.relatedEvidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-steel-300/80">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-steel-400" />{e}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Suggested Investigation Steps */}
          {investigation && (
            <Card
              title="Suggested Investigation Steps"
              subtitle={`${investigation.suggestedSteps.length} recommended actions`}
              action={
                <button onClick={() => setShowSteps((v) => !v)} className="text-steel-300/60 hover:text-white">
                  {showSteps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              }
            >
              {showSteps && (
                <ol className="space-y-2">
                  {investigation.suggestedSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-steel-600/30 text-[10px] font-bold text-steel-200">{i + 1}</span>
                      <p className="text-xs text-steel-200 leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              )}
              {!showSteps && (
                <button onClick={() => setShowSteps(true)} className="text-xs text-steel-300/70 hover:text-white">
                  <Lightbulb size={13} className="inline mr-1" /> Click to expand {investigation.suggestedSteps.length} steps
                </button>
              )}
            </Card>
          )}

          {/* Accused */}
          <Card title={`Accused (${c.accused.length})`} subtitle="Persons named in the FIR" bodyClass="p-0">
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Priors</th><th>Risk</th><th>Status</th><th>Gang</th></tr></thead>
                <tbody>
                  {c.accused.map((a) => {
                    const ar = offenderRisk(a.id);
                    return (
                      <tr key={a.id}>
                        <td><Link to={`/accused?id=${a.id}`} className="font-mono text-steel-100 hover:text-steel-300">{a.id}</Link></td>
                        <td className="text-white">{a.name}</td>
                        <td>{a.age}</td>
                        <td>{a.priorsCount}</td>
                        <td><RiskBadge score={a.riskScore} level={ar?.level ?? 'Low'} /></td>
                        <td><span className="chip bg-white/5 text-steel-200">{a.status}</span></td>
                        <td>{a.gangAffiliation ? <span className="chip bg-purple-500/15 text-purple-300">{a.gangAffiliation}</span> : '—'}</td>
                      </tr>
                    );
                  })}
                  {c.accused.length === 0 && <tr><td colSpan={7} className="text-center text-steel-300/60">No accused recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Victims */}
          <Card title={`Victims (${c.victims.length})`} subtitle="Affected persons" bodyClass="p-0">
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Injury</th><th>Phone</th></tr></thead>
                <tbody>
                  {c.victims.map((v) => (
                    <tr key={v.id}>
                      <td><Link to={`/victim?id=${v.id}`} className="font-mono text-steel-100 hover:text-steel-300">{v.id}</Link></td>
                      <td className="text-white">{v.name}</td>
                      <td>{v.age}</td>
                      <td>{v.gender}</td>
                      <td><span className={`chip ${v.injurySeverity === 'Fatal' ? 'bg-rose-500/15 text-rose-300' : v.injurySeverity === 'Major' ? 'bg-orange-500/15 text-orange-300' : v.injurySeverity === 'Minor' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{v.injurySeverity}</span></td>
                      <td className="font-mono text-xs text-steel-300/80">{v.phone}</td>
                    </tr>
                  ))}
                  {c.victims.length === 0 && <tr><td colSpan={6} className="text-center text-steel-300/60">No victims recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Investigation Notes */}
          <Card title="Investigation Notes" subtitle={`${notes.length} note${notes.length === 1 ? '' : 's'}`}>
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value as InvestigationNote['category'])} className="input w-auto text-xs">
                  {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Add investigation note… (Enter to save)"
                  className="input flex-1 text-sm"
                />
                <button onClick={handleAddNote} disabled={!noteText.trim()} className="btn-primary px-3"><Plus size={15} /></button>
              </div>
            </div>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`chip text-[10px] ${NOTE_CAT_COLOR[n.category]}`}>{n.category}</span>
                      <span className="text-[11px] text-steel-300/60">{n.author} · {new Date(n.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <button onClick={() => handleDeleteNote(n.id)} className="text-steel-300/40 hover:text-rose-300"><Trash2 size={12} /></button>
                  </div>
                  <p className="mt-1.5 text-xs text-steel-200">{n.content}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-center text-xs text-steel-300/60 py-4">No notes yet. Add your first investigation note above.</p>}
            </div>
          </Card>

          {/* Timeline */}
          <Card title="Investigation Timeline" subtitle="Case event reconstruction">
            <ol className="relative ml-3 border-l border-white/10">
              {timeline.map((e, i) => (
                <li key={i} className="mb-4 ml-4">
                  <span className={`absolute -left-[7px] h-3.5 w-3.5 rounded-full ring-2 ring-ink-850 ${KIND_DOT[e.kind]}`} />
                  <p className="text-xs text-steel-300/70">{new Date(e.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  <p className="text-sm font-medium text-white">{e.title}</p>
                  <p className="text-xs text-steel-300/80">{e.detail}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Right: map + risk + similar */}
        <div className="space-y-4">
          <Card title="Crime Location" subtitle={`${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`} bodyClass="p-2">
            <MapView points={[mapPoint]} center={[c.lat, c.lng]} zoom={11} height={220} heatmap markers />
          </Card>

          {risk && (
            <Card title="Explainable Risk (SHAP)" subtitle={`Case risk score: ${risk.score} · ${risk.level}`}>
              <ShapWaterfall features={risk.features} baseValue={risk.baseValue} finalScore={risk.score} height={300} />
              <div className="mt-3 space-y-1.5">
                {risk.reasoning.map((r, i) => <p key={i} className="text-xs text-steel-300/80" dangerouslySetInnerHTML={{ __html: r }} />)}
              </div>
            </Card>
          )}

          {/* Similar Cases with % */}
          <Card title="Similar Cases" subtitle="By crime type, location & modus operandi">
            <div className="space-y-2">
              {similarCases.map((s) => (
                <Link key={s.caseId} to={`/case/${s.caseId}`} className="block rounded-lg border border-white/5 bg-white/[0.03] p-3 hover:border-steel-500/30 hover:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-steel-100">{s.caseId}</span>
                    <span className={`chip text-[10px] ${s.similarityScore >= 70 ? 'bg-rose-500/15 text-rose-300' : s.similarityScore >= 50 ? 'bg-amber-500/15 text-amber-300' : 'bg-steel-500/15 text-steel-300'}`}>
                      {s.similarityScore}% match
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-steel-300/80">{s.crimeType} · {s.firNumber}</p>
                  <p className="mt-0.5 text-[11px] text-steel-300/60">{s.matchReasons.slice(0, 2).join(' · ')}</p>
                </Link>
              ))}
              {similarCases.length === 0 && <p className="text-center text-xs text-steel-300/60 py-4">No similar cases found</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-steel-300/60">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-steel-300/60">{label}</p>
        <p className="text-sm text-steel-100">{value}</p>
      </div>
    </div>
  );
}
