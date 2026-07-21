import { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen, CheckCircle2, AlertTriangle, Users, Share2, IndianRupee,
  TrendingUp, ShieldAlert, Activity, ArrowRight, Clock, ShieldCheck
} from 'lucide-react';
import { KpiCard, Card, StatusPill, CategoryPill, SeverityMeter, RiskBadge } from '../components/ui';
import { useI18n } from '../i18n';
import { TrendLine, Donut, BarChartX } from '../components/charts';
import { kpis, monthlyTrend, categoryDistribution, crimeTypeDistribution, districtBreakdown, hotspots, repeatOffenders, allCases } from '../data/analytics';
import { useAlertStore, visibleAlerts, addAudit, useAuthStore } from '../store/auth';
import { useShallow } from 'zustand/react/shallow';

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const k = useMemo(() => kpis(), []);
  const monthly = useMemo(() => monthlyTrend(), []);
  const catDist = useMemo(() => categoryDistribution().map((c) => ({ name: c.category, value: c.count })), []);
  const topCrimes = useMemo(() => crimeTypeDistribution().slice(0, 8), []);
  const topDistricts = useMemo(() => districtBreakdown().slice(0, 8), []);
  const hs = useMemo(() => hotspots().slice(0, 5), []);
  const ro = useMemo(() => repeatOffenders(6), []);
  const recent = useMemo(() => {
    return [...allCases()].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6);
  }, []);
  const alerts = useAlertStore(useShallow(visibleAlerts));
  const { user } = useAuthStore();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Viewed Dashboard', category: 'Case Access', detail: 'Statewide overview' });
  }, [user]);

  const formattedDateTime = useMemo(() => {
    return currentTime.toLocaleString(lang === 'kn' ? 'kn-IN' : 'en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [currentTime, lang]);

  return (
    <div>
      {/* Professional Enterprise Command Center Header */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-r from-ink-900/90 via-ink-800/80 to-steel-950/90 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulseDot" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {t('brand')} · {t('ksp')}
              </span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white">
              {t('page_dashboard_title')}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-300">
              <span className="flex items-center gap-1.5 font-medium text-amber-300">
                <ShieldCheck size={14} className="text-amber-400" />
                {t('dash_welcome')}, {user?.name || 'Officer'}
              </span>
              <span className="text-steel-400">|</span>
              <span className="text-steel-300">
                {t('role')}: <strong className="text-white font-medium">{user?.role || 'Administrator'}</strong>
              </span>
              <span className="text-steel-400">|</span>
              <span className="text-steel-300">
                {t('rank')}: <strong className="text-white font-medium">{user?.rank || 'Superintendent'}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-1.5 font-mono text-xs text-steel-200">
              <Clock size={13} className="text-cyan-400" />
              <span>{formattedDateTime}</span>
            </div>
            <Link to="/reports" className="btn-primary text-xs py-2 px-3 shadow-glow">
              <TrendingUp size={14} /> {t('generateReport')}
            </Link>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label={t('dash_totalCases')} value={k.totalCases.toLocaleString('en-IN')} icon={<FolderOpen size={18} />} accent="blue" trend={{ dir: 'up', value: '+12% YoY' }} />
        <KpiCard label={t('dash_clearance')} value={`${k.clearance}%`} icon={<CheckCircle2 size={18} />} accent="emerald" trend={{ dir: 'up', value: '+2.1%' }} />
        <KpiCard label={t('dash_openCases')} value={k.open.toLocaleString('en-IN')} icon={<AlertTriangle size={18} />} accent="amber" />
        <KpiCard label={t('dash_highSeverity')} value={k.highSeverity} icon={<ShieldAlert size={18} />} accent="rose" />
        <KpiCard label={t('dash_repeatOffenders')} value={k.repeatOffenders} icon={<Users size={18} />} accent="purple" />
        <KpiCard label={t('dash_activeGangs')} value={k.activeGangs} icon={<Share2 size={18} />} accent="cyan" />
        <KpiCard label={t('dash_valueLoss')} value={`₹${(k.valueLossInr / 10000000).toFixed(1)} Cr`} icon={<IndianRupee size={18} />} accent="amber" />
        <KpiCard label={t('dash_activeAlerts')} value={k.alerts} icon={<Activity size={18} />} accent="rose" />
        <KpiCard label={t('dash_accused')} value={k.accused.toLocaleString('en-IN')} icon={<Users size={18} />} accent="blue" />
        <KpiCard label={t('dash_victims')} value={k.victims.toLocaleString('en-IN')} icon={<Users size={18} />} accent="amber" />
        <KpiCard label={t('dash_officers')} value={k.officers} icon={<Users size={18} />} accent="emerald" />
        <KpiCard label={t('dash_stations')} value={k.stations} icon={<FolderOpen size={18} />} accent="cyan" />
      </div>

      {/* Charts row */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title={t('dash_monthlyTrend')} subtitle={t('dash_monthlyTrendSub')} className="lg:col-span-2">
          <TrendLine data={monthly} xKey="label" yKey="count" yKey2="solved" height={280} />
        </Card>
        <Card title={t('dash_crimeCategories')} subtitle={t('dash_crimeCategoriesSub')}>
          <Donut data={catDist} height={280} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={t('dash_topCrimeTypes')} subtitle={t('dash_topCrimeTypesSub')}>
          <BarChartX data={topCrimes} xKey="type" yKey="count" color="#3b82f6" height={260} horizontal />
        </Card>
        <Card title={t('dash_topDistricts')} subtitle={t('dash_topDistrictsSub')}>
          <BarChartX data={topDistricts} xKey="name" yKey="count" color="#22d3ee" height={260} horizontal />
        </Card>
        <Card title={t('dash_criticalAlerts')} subtitle={t('dash_criticalAlertsSub')} bodyClass="p-0">
          <div className="divide-y divide-white/5">
            {alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-rose-500' : a.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'} animate-pulseDot`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{a.title}</p>
                  <p className="truncate text-xs text-steel-300/70">{a.message}</p>
                </div>
                <Link to="/alerts" className="text-steel-300/60 hover:text-white"><ArrowRight size={14} /></Link>
              </div>
            ))}
            {alerts.length === 0 && <p className="px-5 py-8 text-center text-sm text-steel-300/60">{t('dash_noAlerts')}</p>}
          </div>
        </Card>
      </div>

      {/* Recent cases + repeat offenders + hotspots */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={t('dash_recentCases')} subtitle={t('dash_recentCasesSub')} className="lg:col-span-2" bodyClass="p-0">
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('dash_case')}</th>
                  <th>{t('dash_crimeType')}</th>
                  <th>{t('district')}</th>
                  <th>{t('status')}</th>
                  <th>{t('severity')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/case/${c.id}`} className="font-mono text-steel-100 hover:text-steel-300">{c.id}</Link></td>
                    <td>{c.crimeType}</td>
                    <td className="text-steel-300/80">{c.districtId}</td>
                    <td><StatusPill status={c.status} /></td>
                    <td><SeverityMeter value={c.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={t('dash_repeatOffenders')} subtitle={t('dash_repeatOffendersSub')}>
          <div className="space-y-2">
            {ro.map((a) => (
              <Link to={`/accused?id=${a.id}`} key={a.id} className="block rounded-lg border border-white/5 bg-white/[0.03] p-3 transition hover:border-steel-500/30 hover:bg-white/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <RiskBadge score={a.riskScore} level={a.riskScore >= 75 ? 'Critical' : a.riskScore >= 55 ? 'High' : a.riskScore >= 35 ? 'Medium' : 'Low'} />
                </div>
                <p className="mt-1 text-xs text-steel-300/70">{a.priorsCount} {t('dash_priors')} · {a.gangAffiliation ?? t('dash_noGang')}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('dash_hotspots')} subtitle={t('dash_hotspotsSub')} className="mt-4" bodyClass="p-0">
        <div className="table-wrap border-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('district')}</th>
                <th>{t('cases')}</th>
                <th>{t('dash_avgSeverity')}</th>
                <th>{t('dash_topCrime')}</th>
                <th>{t('dash_trend')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hs.map((h) => (
                <tr key={h.id}>
                  <td className="font-medium text-white">{h.districtName}</td>
                  <td className="stat-num">{h.count}</td>
                  <td>{h.severityAvg}/10</td>
                  <td><CategoryPill category={topCrimes.find((c) => c.type === h.topCrime)?.category ?? 'Violent'} /> {h.topCrime}</td>
                  <td>
                    <span className={`chip ${h.trend === 'rising' ? 'bg-rose-500/15 text-rose-300' : h.trend === 'falling' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-steel-500/15 text-steel-300'}`}>
                      {t(h.trend as any) || h.trend}
                    </span>
                  </td>
                  <td><Link to="/heatmap" className="text-steel-300 hover:text-white">{t('viewMap')} <ArrowRight size={12} className="inline" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
