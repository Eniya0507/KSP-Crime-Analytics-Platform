import { useMemo, useState } from 'react';
import { Download, BarChart3, Map, Calendar } from 'lucide-react';
import { PageHeader, Card } from '../components/ui';
import { useI18n } from '../i18n';
import { TrendLine, BarChartX, Donut, StackedBar, RadarX, CHART_COLORS } from '../components/charts';
import { exportAnalyticsPdf } from '../ai/reports';
import {
  monthlyTrend, yearlyTrend, districtBreakdown, stationBreakdown, categoryDistribution,
  crimeTypeDistribution, seasonalPattern, timeOfDayBreakdown,
  demographicsAgeDistribution, demographicsGenderDistribution,
  demographicsOccupationDistribution, demographicsSocialRiskIndicators,
} from '../data/analytics';
import { DISTRICTS, CRIME_TYPES } from '../data/catalog';
import { addAudit, useAuthStore } from '../store/auth';

export default function AnalyticsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [year, setYear] = useState<number>(0); // 0 = all years
  const [districtId, setDistrictId] = useState('');
  const [stationDist, setStationDist] = useState('');
  const [activeTab, setActiveTab] = useState<'temporal' | 'sociological'>('temporal');

  const monthly = useMemo(() => (year ? monthlyTrend(year) : monthlyTrend()), [year]);
  const yearly = useMemo(() => yearlyTrend().map((y) => ({ label: String(y.year), count: y.count, solved: y.solved })), []);
  const dist = useMemo(() => districtBreakdown(), []);
  const stations = useMemo(() => stationBreakdown(stationDist || undefined).slice(0, 12), [stationDist]);
  const cat = useMemo(() => categoryDistribution().map((c) => ({ name: c.category, value: c.count })), []);
  const ct = useMemo(() => crimeTypeDistribution(), []);
  const seasonal = useMemo(() => seasonalPattern(), []);
  const tod = useMemo(() => timeOfDayBreakdown(), []);

  // Sociological Data Calculations
  const ageData = useMemo(() => demographicsAgeDistribution().map(d => ({ label: d.range, accused: d.accused, victims: d.victims })), []);
  const genderData = useMemo(() => demographicsGenderDistribution().map(d => ({ label: d.gender, accused: d.accused, victims: d.victims })), []);
  const occupationData = useMemo(() => demographicsOccupationDistribution().slice(0, 12), []);
  const riskData = useMemo(() => demographicsSocialRiskIndicators(), []);

  const exportReport = () => {
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Exported analytics PDF', category: 'Report', detail: 'Crime analytics report' });
    exportAnalyticsPdf();
  };

  // Radar: district comparison across metrics
  const radarData = useMemo(() => {
    const top5 = dist.slice(0, 5);
    const max = Math.max(...top5.map((d) => d.count));
    return top5.map((d) => ({
      metric: d.name.split(' ')[0],
      value: Math.round((d.count / max) * 100),
      unsolved: Math.round((d.unsolved / d.count) * 100),
    }));
  }, [dist]);

  return (
    <div>
      <PageHeader
        title={t('page_analytics_title')}
        subtitle={t('page_analytics_sub')}
        action={
          <div className="flex items-center gap-2">
            <select value={year} onChange={(e) => setYear(+e.target.value)} className="input w-auto">
              <option value={0}>All years</option>
              {[2022, 2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportReport} className="btn-primary"><Download size={15} /> PDF</button>
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="mb-6 flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('temporal')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'temporal'
              ? 'border-steel-400 text-white'
              : 'border-transparent text-steel-400 hover:text-white'
          }`}
        >
          Temporal & Geographic
        </button>
        <button
          onClick={() => setActiveTab('sociological')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'sociological'
              ? 'border-steel-400 text-white'
              : 'border-transparent text-steel-400 hover:text-white'
          }`}
        >
          Sociological & Demographics
        </button>
      </div>

      {activeTab === 'temporal' ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Monthly Crime Trend" subtitle={year ? `${year} — solved vs total` : 'All years — solved vs total'}>
              <TrendLine data={monthly} xKey="label" yKey="count" yKey2="solved" height={280} />
            </Card>
            <Card title="Yearly Crime Trend" subtitle="Year-over-year case volume">
              <TrendLine data={yearly} xKey="label" yKey="count" yKey2="solved" height={280} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="Category Distribution" subtitle="Share by crime category">
              <Donut data={cat} height={280} />
            </Card>
            <Card title="Seasonal Pattern" subtitle="Crime by month (all years aggregated)">
              <BarChartX data={seasonal} xKey="month" yKey="count" color="#22d3ee" height={280} />
            </Card>
            <Card title="Time of Day" subtitle="When crimes occur">
              <BarChartX data={tod} xKey="tod" yKey="count" color="#f59e0b" height={280} />
            </Card>
          </div>

          <Card title="District Analysis" subtitle="Case volume, solved & unsolved per district" className="mt-4" bodyClass="p-0">
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead><tr><th>District</th><th>Total</th><th>Solved</th><th>Unsolved</th><th>Clearance %</th><th>Distribution</th></tr></thead>
                <tbody>
                  {dist.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-white">{d.name}</td>
                      <td className="stat-num">{d.count}</td>
                      <td className="text-emerald-300">{d.solved}</td>
                      <td className="text-rose-300">{d.unsolved}</td>
                      <td>{Math.round((d.solved / d.count) * 100)}%</td>
                      <td><div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-steel-500" style={{ width: `${Math.round((d.count / dist[0].count) * 100)}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Police Station Analysis" subtitle={stationDist ? `Stations in ${DISTRICTS.find((d) => d.id === stationDist)?.name}` : 'Top stations statewide'}
              action={<select value={stationDist} onChange={(e) => setStationDist(e.target.value)} className="input w-auto text-xs"><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
            >
              <BarChartX data={stations} xKey="name" yKey="count" color="#3b82f6" height={320} horizontal />
            </Card>
            <Card title="Top District Comparison" subtitle="Solved vs unsolved rate (radar)">
              <RadarX data={radarData} key2="unsolved" height={320} />
            </Card>
          </div>

          <Card title="Crime Type Distribution" subtitle="All 29 crime types ranked" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ct.slice(0, 12).map((c) => (
                <div key={c.type} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{c.type}</p>
                    <span className="stat-num text-steel-100">{c.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full" style={{ width: `${(c.count / ct[0].count) * 100}%`, background: CHART_COLORS[ct.indexOf(c) % CHART_COLORS.length] }} />
                  </div>
                  <p className="mt-1 text-[11px] text-steel-300/60">{c.category} · {Math.round((c.count / ct.reduce((s, x) => s + x.count, 0)) * 1000) / 10}% of total</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Age Distribution" subtitle="Age range comparison of accused vs. victims">
              <StackedBar data={ageData} keys={['accused', 'victims']} height={300} />
            </Card>
            <Card title="Gender distribution" subtitle="Gender representation among accused and victims">
              <StackedBar data={genderData} keys={['accused', 'victims']} height={300} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="Offender Social Risk Profile" subtitle="Classification of repeat offenders" className="lg:col-span-1">
              <Donut data={riskData} height={280} />
            </Card>
            <Card title="Offender Occupation Profile" subtitle="Top occupations of accused individuals" className="lg:col-span-2">
              <BarChartX data={occupationData} xKey="name" yKey="value" color="#a78bfa" height={280} horizontal />
            </Card>
          </div>

          <Card title="Sociological Risk Factors" subtitle="Sociodemographic observations" className="mt-4">
            <div className="space-y-3 text-sm text-steel-300/80 leading-relaxed">
              <p>
                💡 <strong>Age Bands:</strong> Demographic splits reveal a high concentration of offender activity in the <strong>18-25</strong> and <strong>26-35</strong> categories. High-priority crime intervention and community integration efforts are most effective within this age band.
              </p>
              <p>
                💡 <strong>Occupation and Socioeconomic Profile:</strong> The dominant representation of <strong>Daily Wage</strong> and <strong>Unemployed</strong> brackets among accused points to key social risk indicators. Sociological studies support that economic vulnerability is strongly correlated with property and petty crime rates.
              </p>
              <p>
                💡 <strong>Risk Indicators:</strong> The Offender Social Risk model scores repeat offenders using historical priors, gang involvement, and crime category severity. <strong>High and Critical risk offenders</strong> have coordinated patrols tracking their recidivism footprint statewide.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
