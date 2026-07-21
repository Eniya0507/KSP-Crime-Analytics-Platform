import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { User, Search, Phone, Car, Home, Banknote, Crown, AlertCircle, Download, ArrowLeft } from 'lucide-react';
import { PageHeader, Card, RiskBadge, EmptyState, SeverityMeter, StatusPill } from '../components/ui';
import { ShapWaterfall } from '../components/charts';
import { repeatOffenders, getAccusedById, getCasesByAccused } from '../data/analytics';
import { offenderRisk } from '../ai/risk';
import { DISTRICTS, GANG_NAMES } from '../data/catalog';
import { exportCasePdf } from '../ai/reports';
import { addAudit, useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';

export default function AccusedPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const initialId = params.get('id') ?? '';
  const [selectedId, setSelectedId] = useState(initialId);
  const [search, setSearch] = useState('');
  const [gangFilter, setGangFilter] = useState('');
  const [distFilter, setDistFilter] = useState('');

  const top = useMemo(() => repeatOffenders(60), []);
  const filtered = useMemo(() => top.filter((a) =>
    (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase())) &&
    (!gangFilter || a.gangAffiliation === gangFilter) &&
    (!distFilter || a.districtId === distFilter)
  ), [top, search, gangFilter, distFilter]);

  const activeId = selectedId || filtered[0]?.id || '';
  const accused = useMemo(() => getAccusedById(activeId), [activeId]);
  const risk = useMemo(() => (activeId ? offenderRisk(activeId) : null), [activeId]);
  const cases = useMemo(() => (activeId ? getCasesByAccused(activeId) : []), [activeId]);

  useEffect(() => {
    if (activeId) {
      setParams({ id: activeId }, { replace: true });
      addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Viewed accused ${activeId}`, category: 'Case Access', detail: accused ? `${accused.name} · risk ${accused.riskScore}` : '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (initialId && !accused) {
    return (
      <div>
        <PageHeader title={t('page_accused_title')} />
        <EmptyState icon={<AlertCircle size={40} />} title={`Accused ${initialId} does not exist`} />
        <Link to="/accused" className="btn-outline"><ArrowLeft size={15} /> Browse accused</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('page_accused_title')} subtitle={t('page_accused_sub')} />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* List */}
        <Card title="Repeat Offenders" subtitle={`${filtered.length} profiles`} className="lg:col-span-1" bodyClass="p-0">
          <div className="border-b border-white/5 p-3 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-steel-300/60" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID…" className="w-full rounded-md border border-white/10 bg-ink-900/60 py-1.5 pl-7 pr-2 text-xs text-steel-100 outline-none" />
            </div>
            <select value={gangFilter} onChange={(e) => setGangFilter(e.target.value)} className="input py-1.5 text-xs">
              <option value="">All gangs</option>
              {GANG_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={distFilter} onChange={(e) => setDistFilter(e.target.value)} className="input py-1.5 text-xs">
              <option value="">All districts</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="max-h-[520px] divide-y divide-white/5 overflow-y-auto">
            {filtered.map((a) => (
              <button key={a.id} onClick={() => setSelectedId(a.id)} className={`block w-full px-3 py-2.5 text-left ${activeId === a.id ? 'bg-steel-600/15' : 'hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-white">{a.name}</span>
                  <RiskBadge score={a.riskScore} level={a.riskScore >= 75 ? 'Critical' : a.riskScore >= 55 ? 'High' : a.riskScore >= 35 ? 'Medium' : 'Low'} />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-steel-300/70">{a.id} · {a.priorsCount} priors{a.gangAffiliation ? ` · ${a.gangAffiliation}` : ''}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-xs text-steel-300/60">No matches</p>}
          </div>
        </Card>

        {/* Detail */}
        <div className="space-y-4 lg:col-span-3">
          {accused ? (
            <>
              <Card title="Offender Profile" subtitle={accused.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose-600/30 to-rose-900/20 text-xl font-semibold text-rose-200">
                      {accused.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{accused.name}</h2>
                      <p className="text-xs text-steel-300/70">{accused.id} · {accused.age}y · {accused.gender}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <RiskBadge score={accused.riskScore} level={risk?.level ?? 'Low'} />
                        <span className="chip bg-white/5 text-steel-200">{accused.status}</span>
                        {accused.gangAffiliation && <span className="chip bg-purple-500/15 text-purple-300"><Crown size={11} /> {accused.gangAffiliation}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Row icon={<Home size={14} />} label="District" value={DISTRICTS.find((d) => d.id === accused.districtId)?.name ?? accused.districtId} />
                  <Row icon={<Phone size={14} />} label="Phone" value={accused.phone} />
                  <Row icon={<Banknote size={14} />} label="Aadhaar (last 4)" value={`****${accused.aadhaarLast4}`} />
                  <Row icon={<User size={14} />} label="Occupation" value={accused.occupation} />
                  <Row icon={<AlertCircle size={14} />} label="Prior Convictions" value={String(accused.priorsCount)} />
                  <Row icon={<Crown size={14} />} label="Gang" value={accused.gangAffiliation ?? 'None'} />
                </div>
              </Card>

              {risk && (
                <Card title="Risk Score Explanation (SHAP)" subtitle={`Score ${risk.score} · ${risk.level} · baseline ${risk.baseValue}`}>
                  <ShapWaterfall features={risk.features} baseValue={risk.baseValue} finalScore={risk.score} height={320} />
                  <div className="mt-3 space-y-1.5">
                    {risk.reasoning.map((r, i) => <p key={i} className="text-xs text-steel-300/80" dangerouslySetInnerHTML={{ __html: r }} />)}
                  </div>
                </Card>
              )}

              <Card title={`Crime History (${cases.length})`} subtitle="Cases linked to this offender" bodyClass="p-0">
                <div className="table-wrap border-0">
                  <table className="tbl">
                    <thead><tr><th>Case</th><th>Crime Type</th><th>Date</th><th>Status</th><th>Severity</th><th></th></tr></thead>
                    <tbody>
                      {cases.map((c) => (
                        <tr key={c.id}>
                          <td><Link to={`/case/${c.id}`} className="font-mono text-steel-100 hover:text-steel-300">{c.id}</Link></td>
                          <td className="text-white">{c.crimeType}</td>
                          <td className="text-steel-300/80">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                          <td><StatusPill status={c.status} /></td>
                          <td><SeverityMeter value={c.severity} /></td>
                          <td><button onClick={() => exportCasePdf(c.id)} className="text-steel-300 hover:text-white"><Download size={14} /></button></td>
                        </tr>
                      ))}
                      {cases.length === 0 && <tr><td colSpan={6} className="text-center text-steel-300/60">No linked cases</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card><EmptyState icon={<User size={40} />} title="Select an accused from the list" hint="Browse top repeat offenders or filter by gang/district." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-steel-300/60">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-steel-300/60">{label}</p>
        <p className="text-sm text-steel-100">{value}</p>
      </div>
    </div>
  );
}
