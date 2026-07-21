import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Share2, Users, Crown, Link2, Search, Filter } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/ui';
import { useI18n } from '../i18n';
import NetworkGraph from '../components/NetworkGraph';
import { buildNetwork } from '../data/analytics';
import { DISTRICTS, GANG_NAMES } from '../data/catalog';
import { getAccusedById } from '../data/analytics';
import { addAudit, useAuthStore } from '../store/auth';

export default function NetworkPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const [districtId, setDistrictId] = useState(params.get('dist') ?? '');
  const [gang, setGang] = useState(params.get('gang') ?? '');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const p = new URLSearchParams();
    if (districtId) p.set('dist', districtId);
    if (gang) p.set('gang', gang);
    setParams(p, { replace: true });
  }, [districtId, gang, setParams]);

  const data = useMemo(() => buildNetwork(districtId || undefined, gang || undefined), [districtId, gang]);

  useEffect(() => {
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Network analysis viewed', category: 'Case Access', detail: `dist=${districtId || 'all'} gang=${gang || 'all'}` });
  }, [districtId, gang, user]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return { ...data, nodes: data.nodes.filter((n) => n.label.toLowerCase().includes(q)) };
  }, [data, search]);

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-5.5rem)] min-h-0 space-y-3">
      <PageHeader
        title={t('page_network_title')}
        subtitle={t('page_network_sub')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={districtId} onChange={(e) => { setDistrictId(e.target.value); }} className="input w-auto text-xs py-1.5">
              <option value="">{t('network_allDistricts')}</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={gang} onChange={(e) => setGang(e.target.value)} className="input w-auto text-xs py-1.5">
              <option value="">{t('network_allGangs')}</option>
              {GANG_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        }
      />

      {/* Compact Stat Bar */}
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4 shrink-0">
        <StatCard icon={<Users size={16} />} label={t('network_gangsIdentified')} value={data.gangs.length} accent="text-purple-300" />
        <StatCard icon={<Share2 size={16} />} label={t('network_nodes')} value={data.nodes.length} accent="text-steel-300" />
        <StatCard icon={<Link2 size={16} />} label={t('network_edges')} value={data.edges.length} accent="text-cyan-300" />
        <StatCard icon={<Link2 size={16} />} label={t('network_predictedLinks')} value={data.hiddenLinks.length} accent="text-rose-300" />
      </div>

      {/* Main Grid: Fills available space, graph canvas stretches to height */}
      <div className="flex-1 grid gap-3 lg:grid-cols-4 min-h-0 overflow-hidden">
        <Card
          title={t('network_graph')}
          subtitle={t('network_graphSub')}
          className="lg:col-span-3 flex flex-col h-full min-h-0 overflow-hidden"
          bodyClass="flex-1 p-0 flex flex-col min-h-0 overflow-hidden relative"
          action={
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-300/60" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('network_filterNodes')} className="w-36 sm:w-48 rounded-md border border-white/10 bg-ink-900/60 py-1 pl-8 pr-2 text-xs text-steel-100 outline-none focus:border-steel-500/50" />
            </div>
          }
        >
          {filteredNodes.nodes.length === 0 ? (
            <div className="my-auto py-12">
              <EmptyState icon={<Filter size={36} />} title={t('network_noNodes')} />
            </div>
          ) : (
            <div className="flex-1 w-full h-full min-h-[420px]">
              <NetworkGraph data={filteredNodes} height={600} />
            </div>
          )}
        </Card>

        {/* Right Sidebar Panels */}
        <div className="lg:col-span-1 flex flex-col gap-3 h-full min-h-0 overflow-y-auto">
          <Card title={t('network_gangLeaders')} subtitle={t('network_gangLeadersSub')} className="flex-1 min-h-[140px]" bodyClass="p-0 overflow-hidden">
            <div className="max-h-48 divide-y divide-white/5 overflow-y-auto">
              {data.leaders.map((l) => (
                <Link key={l.accusedId} to={`/accused?id=${l.accusedId}`} className="block px-3 py-2 transition hover:bg-white/5">
                  <div className="flex items-center gap-1.5">
                    <Crown size={12} className="text-amber-400 shrink-0" />
                    <p className="truncate text-xs font-medium text-white">{l.name}</p>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-steel-300/70">{l.gang} · {l.cases} {t('cases')} · {t('network_centrality')} {l.centrality}</p>
                </Link>
              ))}
              {data.leaders.length === 0 && <p className="px-3 py-4 text-center text-xs text-steel-300/60">{t('network_noLeaders')}</p>}
            </div>
          </Card>

          <Card title={t('network_hiddenLinks')} subtitle={t('network_hiddenLinksSub')} className="flex-1 min-h-[140px]" bodyClass="p-0 overflow-hidden">
            <div className="max-h-48 divide-y divide-white/5 overflow-y-auto">
              {data.hiddenLinks.slice(0, 12).map((l, i) => {
                const a = getAccusedById(l.a);
                const b = getAccusedById(l.b);
                return (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[11px] text-white">{a?.name ?? l.a} ↔ {b?.name ?? l.b}</p>
                      <span className="chip bg-purple-500/15 text-purple-300 text-[9px] py-0 px-1">{Math.round(l.confidence * 100)}%</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-steel-300/60">{l.reason}</p>
                  </div>
                );
              })}
              {data.hiddenLinks.length === 0 && <p className="px-3 py-4 text-center text-xs text-steel-300/60">{t('network_noHiddenLinks')}</p>}
            </div>
          </Card>

          <Card title={t('network_activeGangs')} subtitle={t('network_activeGangsSub')} className="flex-1 min-h-[140px]" bodyClass="p-0 overflow-hidden">
            <div className="max-h-48 divide-y divide-white/5 overflow-y-auto">
              {data.gangs.map((g) => (
                <div key={g.name} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">{g.name}</p>
                    <p className="text-[10px] text-steel-300/60">{g.districts.length} {t('districts')}</p>
                  </div>
                  <span className="chip bg-purple-500/15 text-purple-300 text-[10px] py-0.5 px-1.5">{g.members} {t('network_members')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="card p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-steel-300/70">{label}</p>
          <p className="stat-num text-lg font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-lg bg-white/5 p-1.5 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}
