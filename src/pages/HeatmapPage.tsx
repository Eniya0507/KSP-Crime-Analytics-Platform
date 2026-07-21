import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, TrendingUp, TrendingDown, Minus, ArrowRight, MapPin } from 'lucide-react';
import { PageHeader, Card, SeverityMeter, CategoryPill, EmptyState } from '../components/ui';
import { useI18n } from '../i18n';
import MapView, { type MapPoint } from '../components/MapView';
import { hotspots } from '../data/analytics';
import { allCases } from '../data/generator';
import { DISTRICTS, crimeDefByType } from '../data/catalog';

export default function HeatmapPage() {
  const { t } = useI18n();
  const hs = useMemo(() => hotspots(), []);
  const [districtId, setDistrictId] = useState('');
  const [minCount, setMinCount] = useState(0);

  const filtered = useMemo(() => hs.filter((h) => (!districtId || h.districtId === districtId) && h.count >= minCount), [hs, districtId, minCount]);

  const points: MapPoint[] = useMemo(() => {
    const cases = districtId ? allCases().filter((c) => c.districtId === districtId) : allCases();
    return cases.map((c) => ({
      lat: c.lat,
      lng: c.lng,
      weight: c.severity / 10,
      popup: `<b>${c.id}</b><br/>${c.crimeType}<br/>Severity ${c.severity}/10<br/>${new Date(c.date).toLocaleDateString('en-IN')}`,
    }));
  }, [districtId]);

  const center: [number, number] = districtId
    ? [DISTRICTS.find((d) => d.id === districtId)!.lat, DISTRICTS.find((d) => d.id === districtId)!.lng]
    : [15.3, 76.0];

  // Nearby crime prediction: for a selected hotspot, find cases within proximity
  const [selected, setSelected] = useState(hs[0]?.id ?? '');
  const selectedHs = hs.find((h) => h.id === selected);
  const nearby = useMemo(() => {
    if (!selectedHs) return [];
    return allCases()
      .filter((c) => Math.hypot(c.lat - selectedHs.lat, c.lng - selectedHs.lng) < 0.3)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 6);
  }, [selectedHs]);

  return (
    <div>
      <PageHeader
        title={t('page_heatmap_title')}
        subtitle={t('page_heatmap_sub')}
        action={
          <div className="flex items-center gap-2">
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="input w-auto">
              <option value="">All Karnataka</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Crime Heatmap" subtitle={districtId ? `${DISTRICTS.find((d) => d.id === districtId)?.name} — ${points.length} cases` : `Statewide — ${points.length} cases`} className="lg:col-span-2" bodyClass="p-2">
          <MapView points={points} center={center} zoom={districtId ? 10 : 7} height={480} heatmap />
        </Card>

        <Card title="Hotspot Zones" subtitle="Ranked by case volume" bodyClass="p-0">
          <div className="max-h-[480px] divide-y divide-white/5 overflow-y-auto">
            {filtered.map((h) => {
              const TrendIcon = h.trend === 'rising' ? TrendingUp : h.trend === 'falling' ? TrendingDown : Minus;
              const trendColor = h.trend === 'rising' ? 'text-rose-400' : h.trend === 'falling' ? 'text-emerald-400' : 'text-steel-300/60';
              return (
                <button
                  key={h.id}
                  onClick={() => setSelected(h.id)}
                  className={`block w-full px-4 py-3 text-left transition ${selected === h.id ? 'bg-steel-600/15' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{h.districtName}</p>
                    <TrendIcon size={14} className={trendColor} />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-steel-300/80">
                    <span className="stat-num">{h.count} cases</span>
                    <span>sev {h.severityAvg}</span>
                    <span className="truncate">{h.topCrime}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <EmptyState icon={<MapPin size={32} />} title="No hotspots in range" />}
          </div>
        </Card>
      </div>

      {selectedHs && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Zone Analysis" subtitle={selectedHs.districtName} className="lg:col-span-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel-300/70">Total cases</span>
                <span className="stat-num text-white">{selectedHs.count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel-300/70">Avg severity</span>
                <SeverityMeter value={Math.round(selectedHs.severityAvg)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel-300/70">Top crime</span>
                <span className="text-sm text-white">{selectedHs.topCrime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel-300/70">Trend</span>
                <span className={`chip ${selectedHs.trend === 'rising' ? 'bg-rose-500/15 text-rose-300' : selectedHs.trend === 'falling' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-steel-500/15 text-steel-300'}`}>
                  <Flame size={11} /> {selectedHs.trend}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel-300/70">Category</span>
                <CategoryPill category={crimeDefByType(selectedHs.topCrime).category} />
              </div>
            </div>
          </Card>

          <Card title="Nearby Crime Prediction" subtitle="Recent incidents near zone centroid" className="lg:col-span-2" bodyClass="p-0">
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead><tr><th>Case</th><th>Crime Type</th><th>Date</th><th>Severity</th><th></th></tr></thead>
                <tbody>
                  {nearby.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/case/${c.id}`} className="font-mono text-steel-100 hover:text-steel-300">{c.id}</Link></td>
                      <td className="text-white">{c.crimeType}</td>
                      <td className="text-steel-300/80">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                      <td><SeverityMeter value={c.severity} /></td>
                      <td><Link to={`/case/${c.id}`} className="text-steel-300 hover:text-white"><ArrowRight size={14} /></Link></td>
                    </tr>
                  ))}
                  {nearby.length === 0 && <tr><td colSpan={5} className="text-center text-steel-300/60">No recent nearby cases</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Card title="Emerging Crime Zones" subtitle="Districts with rising trends require attention" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hs.filter((h) => h.trend === 'rising').slice(0, 6).map((h) => (
            <div key={h.id} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-rose-400" />
                <p className="text-sm font-medium text-white">{h.districtName}</p>
              </div>
              <p className="mt-1 text-xs text-steel-300/80">{h.count} cases · avg severity {h.severityAvg} · {h.topCrime}</p>
              <Link to={`/network?dist=${h.districtId}`} className="mt-2 inline-flex items-center gap-1 text-xs text-steel-300 hover:text-white">
                Investigate network <ArrowRight size={11} />
              </Link>
            </div>
          ))}
          {hs.filter((h) => h.trend === 'rising').length === 0 && <p className="text-sm text-steel-300/60">No rising zones detected.</p>}
        </div>
      </Card>
    </div>
  );
}
