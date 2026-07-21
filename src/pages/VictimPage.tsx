import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Search, Phone, AlertCircle, ArrowLeft, HeartPulse } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/ui';
import { allVictims, allCases } from '../data/generator';
import { DISTRICTS } from '../data/catalog';
import { getCaseById } from '../data/analytics';
import { addAudit, useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';

export default function VictimPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const initialId = params.get('id') ?? '';
  const [selectedId, setSelectedId] = useState(initialId);
  const [search, setSearch] = useState('');
  const [distFilter, setDistFilter] = useState('');
  const [injuryFilter, setInjuryFilter] = useState('');

  const victims = useMemo(() => allVictims(), []);
  const filtered = useMemo(() => victims.filter((v) =>
    (!search || v.name.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase())) &&
    (!distFilter || v.districtId === distFilter) &&
    (!injuryFilter || v.injurySeverity === injuryFilter)
  ).slice(0, 80), [victims, search, distFilter, injuryFilter]);

  const activeId = selectedId || filtered[0]?.id || '';
  const victim = useMemo(() => victims.find((v) => v.id === activeId), [victims, activeId]);
  const linkedCase = useMemo(() => (victim ? getCaseById(victim.caseId) : undefined), [victim]);

  useEffect(() => {
    if (activeId) {
      setParams({ id: activeId }, { replace: true });
      addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Viewed victim ${activeId}`, category: 'Case Access', detail: victim?.name ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const injuryColor: Record<string, string> = {
    Fatal: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    Major: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    Minor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    None: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };

  if (initialId && !victim) {
    return (
      <div>
        <PageHeader title={t('page_victim_title')} />
        <EmptyState icon={<AlertCircle size={40} />} title={`Victim ${initialId} does not exist`} />
        <Link to="/victim" className="btn-outline"><ArrowLeft size={15} /> Browse victims</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('page_victim_title')} subtitle={t('page_victim_sub')} />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Victims" subtitle={`${filtered.length} records`} className="lg:col-span-1" bodyClass="p-0">
          <div className="space-y-2 border-b border-white/5 p-3">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-steel-300/60" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID…" className="w-full rounded-md border border-white/10 bg-ink-900/60 py-1.5 pl-7 pr-2 text-xs text-steel-100 outline-none" />
            </div>
            <select value={distFilter} onChange={(e) => setDistFilter(e.target.value)} className="input py-1.5 text-xs">
              <option value="">All districts</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={injuryFilter} onChange={(e) => setInjuryFilter(e.target.value)} className="input py-1.5 text-xs">
              <option value="">All injuries</option>
              {['None', 'Minor', 'Major', 'Fatal'].map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="max-h-[520px] divide-y divide-white/5 overflow-y-auto">
            {filtered.map((v) => (
              <button key={v.id} onClick={() => setSelectedId(v.id)} className={`block w-full px-3 py-2.5 text-left ${activeId === v.id ? 'bg-steel-600/15' : 'hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-white">{v.name}</span>
                  <span className={`chip border text-[10px] ${injuryColor[v.injurySeverity]}`}>{v.injurySeverity}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-steel-300/70">{v.id} · {v.age}y · {v.gender}</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {victim ? (
            <>
              <Card title="Victim Profile" subtitle={victim.id}>
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-600/30 to-amber-900/20 text-xl font-semibold text-amber-200">
                    {victim.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{victim.name}</h2>
                    <p className="text-xs text-steel-300/70">{victim.id} · {victim.age}y · {victim.gender}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`chip border ${injuryColor[victim.injurySeverity]}`}><HeartPulse size={11} /> {victim.injurySeverity} injury</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Row icon={<Users size={14} />} label="District" value={DISTRICTS.find((d) => d.id === victim.districtId)?.name ?? victim.districtId} />
                  <Row icon={<Phone size={14} />} label="Phone" value={victim.phone} />
                  <Row icon={<AlertCircle size={14} />} label="Linked Case" value={victim.caseId} />
                </div>
              </Card>

              {linkedCase && (
                <Card title="Linked Case" subtitle={`${linkedCase.id} — ${linkedCase.crimeType}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Row label="FIR Number" value={linkedCase.firNumber} />
                    <Row label="Date" value={new Date(linkedCase.date).toLocaleString('en-IN')} />
                    <Row label="Crime Type" value={linkedCase.crimeType} />
                    <Row label="Category" value={linkedCase.category} />
                    <Row label="District" value={linkedCase.district?.name ?? linkedCase.districtId} />
                    <Row label="Status" value={linkedCase.status} />
                    <Row label="Severity" value={`${linkedCase.severity}/10`} />
                    <Row label="Weapon" value={linkedCase.weaponUsed ?? 'None'} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link to={`/case/${linkedCase.id}`} className="btn-primary text-xs">View full case</Link>
                    <Link to={`/timeline?id=${linkedCase.id}`} className="btn-outline text-xs">Case timeline</Link>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card><EmptyState icon={<Users size={40} />} title="Select a victim from the list" hint="Filter by district or injury severity." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-steel-300/60">{icon}</span>}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-steel-300/60">{label}</p>
        <p className="text-sm text-steel-100">{value}</p>
      </div>
    </div>
  );
}
