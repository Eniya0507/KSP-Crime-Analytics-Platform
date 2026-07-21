import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Search } from 'lucide-react';
import { PageHeader, Card, EmptyState, StatusPill, SeverityMeter } from '../components/ui';
import { useI18n } from '../i18n';
import { caseTimeline, getCaseById } from '../data/analytics';
import type { TimelineEvent } from '../data/analytics';
import { allCases } from '../data/generator';
import { DISTRICTS } from '../data/catalog';

const KIND_DOT: Record<TimelineEvent['kind'], string> = {
  fir: 'bg-blue-500', investigation: 'bg-amber-500', forensic: 'bg-purple-500',
  arrest: 'bg-rose-500', court: 'bg-cyan-500', closure: 'bg-emerald-500',
};
const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  fir: 'FIR', investigation: 'Investigation', forensic: 'Forensic',
  arrest: 'Arrest', court: 'Court', closure: 'Closure',
};

export default function TimelinePage() {
  const { t } = useI18n();
  const [caseId, setCaseId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [activeCase, setActiveCase] = useState<string>('');

  const cases = useMemo(() => {
    return [...allCases()]
      .filter((c) => !districtId || c.districtId === districtId)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 50);
  }, [districtId]);

  const loadTimeline = (id: string) => {
    setCaseId(id);
    setActiveCase(id);
    setEvents(caseTimeline(id));
  };

  useEffect(() => {
    if (!activeCase && cases.length) loadTimeline(cases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases]);

  const activeCaseObj = useMemo(() => (activeCase ? getCaseById(activeCase) : undefined), [activeCase]);

  return (
    <div>
      <PageHeader title={t('page_timeline_title')} subtitle={t('page_timeline_sub')} />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Case selector */}
        <Card title="Select Case" subtitle={`${cases.length} recent cases`} className="lg:col-span-1" bodyClass="p-0">
          <div className="border-b border-white/5 p-3">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-steel-300/60" />
              <input value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="KSP-00001" className="w-full rounded-md border border-white/10 bg-ink-900/60 py-1.5 pl-7 pr-2 text-xs text-steel-100 outline-none" />
            </div>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="input py-1.5 text-xs">
              <option value="">All districts</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="max-h-96 divide-y divide-white/5 overflow-y-auto">
            {cases.filter((c) => !caseId || c.id.includes(caseId.toUpperCase()) || c.firNumber.includes(caseId)).map((c) => (
              <button key={c.id} onClick={() => loadTimeline(c.id)} className={`block w-full px-3 py-2.5 text-left ${activeCase === c.id ? 'bg-steel-600/15' : 'hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-steel-100">{c.id}</span>
                  <SeverityMeter value={c.severity} />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-steel-300/70">{c.crimeType} · {new Date(c.date).toLocaleDateString('en-IN')}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card title={activeCaseObj ? `Timeline — ${activeCaseObj.id}` : 'Timeline'} subtitle={activeCaseObj ? `${activeCaseObj.crimeType} · ${activeCaseObj.firNumber}` : ''} className="lg:col-span-3">
          {events && events.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                {(Object.keys(KIND_LABEL) as TimelineEvent['kind'][]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-steel-300/80">
                    <span className={`h-2 w-2 rounded-full ${KIND_DOT[k]}`} /> {KIND_LABEL[k]}
                  </span>
                ))}
              </div>
              <ol className="relative ml-3 border-l border-white/10">
                {events.map((e, i) => (
                  <li key={i} className="mb-5 ml-5">
                    <span className={`absolute -left-[7px] h-3.5 w-3.5 rounded-full ring-2 ring-ink-850 ${KIND_DOT[e.kind]}`} />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-steel-300/60">{KIND_LABEL[e.kind]}</span>
                      <span className="text-xs text-steel-300/70">{new Date(e.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-white">{e.title}</p>
                    <p className="text-xs text-steel-300/80">{e.detail}</p>
                  </li>
                ))}
              </ol>
              {activeCaseObj && (
                <div className="mt-4 flex gap-2">
                  <Link to={`/case/${activeCaseObj.id}`} className="btn-outline text-xs">Full case <ArrowRight size={12} /></Link>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={<Clock size={36} />} title="Select a case to view its timeline" hint="Choose from the list on the left." />
          )}
        </Card>
      </div>
    </div>
  );
}
