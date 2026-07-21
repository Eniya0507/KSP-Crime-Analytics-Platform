import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Flame, Users, Share2, TrendingUp, ShieldAlert, RotateCcw, X } from 'lucide-react';
import { PageHeader, Card, EmptyState, Banner } from '../components/ui';
import { useI18n } from '../i18n';
import { useAlertStore, visibleAlerts } from '../store/auth';
import { useShallow } from 'zustand/react/shallow';
import { DISTRICTS } from '../data/catalog';
import type { Alert } from '../types';

const SEV_COLOR: Record<Alert['severity'], string> = {
  critical: 'border-rose-500/40 bg-rose-500/10',
  high: 'border-orange-500/40 bg-orange-500/10',
  medium: 'border-amber-500/40 bg-amber-500/10',
  low: 'border-steel-500/40 bg-steel-500/10',
};
const SEV_DOT: Record<Alert['severity'], string> = {
  critical: 'bg-rose-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-steel-500',
};
const SEV_LABEL: Record<Alert['severity'], string> = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW',
};
const CAT_ICON: Record<Alert['category'], React.ReactNode> = {
  Hotspot: <Flame size={14} />,
  'Repeat Offender': <Users size={14} />,
  Network: <Share2 size={14} />,
  'Forecast Spike': <TrendingUp size={14} />,
  Risk: <ShieldAlert size={14} />,
};

export default function AlertsPage() {
  const { t } = useI18n();
  const alerts = useAlertStore(useShallow(visibleAlerts));
  const { dismiss, restore, dismissed } = useAlertStore();
  const [filter, setFilter] = useState<'all' | Alert['severity']>('all');
  const [catFilter, setCatFilter] = useState<'all' | Alert['category']>('all');

  const filtered = useMemo(() => alerts.filter((a) => (filter === 'all' || a.severity === filter) && (catFilter === 'all' || a.category === catFilter)), [alerts, filter, catFilter]);

  const counts = useMemo(() => ({
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  }), [alerts]);

  return (
    <div>
      <PageHeader
        title={t('page_alerts_title')}
        subtitle={t('page_alerts_sub')}
        action={dismissed.length > 0 ? <button onClick={restore} className="btn-outline"><RotateCcw size={15} /> Restore ({dismissed.length})</button> : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AlertStat label="Critical" count={counts.critical} color="text-rose-300" dot="bg-rose-500" />
        <AlertStat label="High" count={counts.high} color="text-orange-300" dot="bg-orange-500" />
        <AlertStat label="Medium" count={counts.medium} color="text-amber-300" dot="bg-amber-500" />
        <AlertStat label="Low" count={counts.low} color="text-steel-300" dot="bg-steel-500" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-1">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filter === s ? 'bg-steel-600 text-white' : 'text-steel-300 hover:text-white'}`}>
              {s === 'all' ? 'All severities' : SEV_LABEL[s]}
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as any)} className="input w-auto text-xs">
          <option value="all">All categories</option>
          {(['Hotspot', 'Repeat Offender', 'Network', 'Forecast Spike', 'Risk'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Bell size={40} />} title="No alerts match the current filter" hint="Adjust severity or category filters, or restore dismissed alerts." /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((a) => (
            <div key={a.id} className={`rounded-xl border p-4 ${SEV_COLOR[a.severity]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[a.severity]} animate-pulseDot`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-steel-300/80">{SEV_LABEL[a.severity]}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-steel-300/70">{CAT_ICON[a.category]} {a.category}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-white">{a.title}</p>
                    <p className="mt-0.5 text-xs text-steel-300/80">{a.message}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-steel-300/60">
                      <span>{DISTRICTS.find((d) => d.id === a.districtId)?.name ?? a.districtId}</span>
                      <span>· {new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button onClick={() => dismiss(a.id)} className="rounded-md p-1 text-steel-300/60 hover:bg-white/10 hover:text-white"><X size={14} /></button>
                  <Link to={a.category === 'Network' ? '/network' : a.category === 'Hotspot' ? '/heatmap' : '/dashboard'} className="text-xs text-steel-300 hover:text-white">View →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dismissed.length > 0 && (
        <div className="mt-4">
          <Banner kind="info">{dismissed.length} alert(s) dismissed. Click "Restore" above to bring them back.</Banner>
        </div>
      )}
    </div>
  );
}

function AlertStat({ label, count, color, dot }: { label: string; count: number; color: string; dot: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-steel-300/70">{label}</p>
          <p className={`mt-1 stat-num text-2xl ${color}`}>{count}</p>
        </div>
        <span className={`h-3 w-3 rounded-full ${dot} ${count > 0 ? 'animate-pulseDot' : ''}`} />
      </div>
    </div>
  );
}
