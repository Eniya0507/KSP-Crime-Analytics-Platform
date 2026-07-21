import { useMemo, useState } from 'react';
import { Navigation, MapPin, Users, AlertCircle, ArrowRight } from 'lucide-react';
import { PageHeader, Card, EmptyState, Banner } from '../components/ui';
import { useI18n } from '../i18n';
import MapView, { type MapPoint } from '../components/MapView';
import { patrolRecommendations } from '../ai/forecast';
import { DISTRICTS } from '../data/catalog';
import { addAudit, useAuthStore } from '../store/auth';

const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  High: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  Low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
};

export default function PatrolPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const recs = useMemo(() => patrolRecommendations(), []);
  const [selected, setSelected] = useState(recs[0]?.id ?? '');
  const active = recs.find((r) => r.id === selected);

  const points: MapPoint[] = useMemo(() => {
    if (!active) return [];
    return active.waypoints.map((w, i) => ({
      lat: w.lat, lng: w.lng, weight: 0.7, color: '#ef4444',
      popup: `<b>${active.districtName}</b><br/>Waypoint ${i + 1}<br/>${w.label}`,
    }));
  }, [active]);

  const center: [number, number] = active
    ? [DISTRICTS.find((d) => d.id === active.districtId)!.lat, DISTRICTS.find((d) => d.id === active.districtId)!.lng]
    : [15.3, 76.0];

  return (
    <div>
      <PageHeader
        title={t('page_patrol_title')}
        subtitle={t('page_patrol_sub')}
        action={<button onClick={() => addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Viewed patrol recommendations', category: 'Prediction', detail: `${recs.length} routes` })} className="btn-outline"><Navigation size={15} /> Refresh</button>}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Recommended Routes" subtitle={`${recs.length} districts prioritized`} className="lg:col-span-1" bodyClass="p-0">
          <div className="max-h-[600px] divide-y divide-white/5 overflow-y-auto">
            {recs.map((r) => (
              <button key={r.id} onClick={() => setSelected(r.id)} className={`block w-full px-4 py-3 text-left ${selected === r.id ? 'bg-steel-600/15' : 'hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{r.districtName}</p>
                  <span className={`chip border text-[10px] ${PRIORITY_COLOR[r.priority]}`}>{r.priority}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-steel-300/70">{r.recommendedOfficers} officers · {r.focusCrimes[0] ?? '—'}</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {active ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card><p className="text-xs text-steel-300/70">Priority</p><p className={`mt-1 chip border text-sm ${PRIORITY_COLOR[active.priority]}`}>{active.priority}</p></Card>
                <Card><p className="text-xs text-steel-300/70">Recommended Officers</p><p className="mt-1 stat-num text-2xl text-white">{active.recommendedOfficers}</p></Card>
                <Card><p className="text-xs text-steel-300/70">Waypoints</p><p className="mt-1 stat-num text-2xl text-white">{active.waypoints.length}</p></Card>
              </div>

              <Card title={`Patrol Route — ${active.districtName}`} subtitle="Optimized patrol waypoints through hotspot centroids" bodyClass="p-2">
                <MapView points={points} center={center} zoom={10} height={380} heatmap markers />
              </Card>

              <Card title="Deployment Rationale" subtitle="AI reasoning for this recommendation">
                <Banner kind={active.priority === 'Critical' ? 'error' : active.priority === 'High' ? 'warning' : 'info'}>
                  {active.reason}
                </Banner>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="section-title mb-2">Focus Crimes</p>
                    <div className="flex flex-wrap gap-2">
                      {active.focusCrimes.map((c) => <span key={c} className="chip bg-steel-600/15 text-steel-200">{c}</span>)}
                    </div>
                  </div>
                  <div>
                    <p className="section-title mb-2">Patrol Waypoints</p>
                    <ol className="space-y-1.5">
                      {active.waypoints.map((w, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-steel-200">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-steel-600/30 text-[10px] font-bold text-steel-200">{i + 1}</span>
                          <MapPin size={12} className="text-steel-400" /> {w.label} · {w.lat.toFixed(3)}, {w.lng.toFixed(3)}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </Card>

              <Card title="Resource Allocation" subtitle="Suggested deployment plan">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2"><Users size={14} className="text-steel-400" /><span className="text-xs text-steel-300/80">Patrol teams</span></div>
                    <p className="mt-1 text-lg font-semibold text-white">{Math.ceil(active.recommendedOfficers / 2)} teams</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2"><AlertCircle size={14} className="text-amber-400" /><span className="text-xs text-steel-300/80">Shift recommendation</span></div>
                    <p className="mt-1 text-lg font-semibold text-white">Night + Evening</p>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card><EmptyState icon={<Navigation size={40} />} title="No patrol recommendations" hint="Insufficient hotspot data." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}
