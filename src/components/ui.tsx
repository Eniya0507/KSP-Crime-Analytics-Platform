import type { ReactNode } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle2 } from 'lucide-react';
import type { CaseStatus, CrimeCategory } from '../types';

// ---- Status pill ----
export function StatusPill({ status }: { status: CaseStatus }) {
  const map: Record<CaseStatus, string> = {
    Open: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'Under Investigation': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'Charge Sheet Filed': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    Closed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Pending: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  };
  return <span className={`chip border ${map[status]}`}>{status}</span>;
}

// ---- Category pill ----
export function CategoryPill({ category }: { category: CrimeCategory }) {
  const map: Record<CrimeCategory, string> = {
    Violent: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    Property: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Cyber: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    Economic: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    Narcotics: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    'Against Women': 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    'Against Children': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    'Public Order': 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  };
  return <span className={`chip border ${map[category]}`}>{category}</span>;
}

// ---- Risk badge ----
export function RiskBadge({ score, level }: { score: number; level: 'Low' | 'Medium' | 'High' | 'Critical' }) {
  const color =
    level === 'Critical' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : level === 'High' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
    : level === 'Medium' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return (
    <span className={`chip border ${color}`}>
      <ShieldCheck size={12} />
      {level} · {score}
    </span>
  );
}

// ---- Severity meter ----
export function SeverityMeter({ value }: { value: number }) {
  const pct = (value / 10) * 100;
  const color = value >= 8 ? 'bg-rose-500' : value >= 6 ? 'bg-orange-500' : value >= 4 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="stat-num text-xs text-steel-200">{value}/10</span>
    </div>
  );
}

// ---- Card ----
export function Card({ title, subtitle, action, children, className = '', bodyClass = '' }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-steel-300/70">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`p-5 ${bodyClass}`}>{children}</div>
    </section>
  );
}

// ---- KPI card ----
export function KpiCard({ label, value, icon, trend, accent = 'blue', hint }: {
  label: string; value: ReactNode; icon: ReactNode; trend?: { dir: 'up' | 'down' | 'flat'; value: string }; accent?: 'blue' | 'cyan' | 'amber' | 'rose' | 'emerald' | 'purple'; hint?: string;
}) {
  const accentMap = {
    blue: 'from-steel-600/20 text-steel-300',
    cyan: 'from-cyan-600/20 text-cyan-300',
    amber: 'from-amber-600/20 text-amber-300',
    rose: 'from-rose-600/20 text-rose-300',
    emerald: 'from-emerald-600/20 text-emerald-300',
    purple: 'from-purple-600/20 text-purple-300',
  } as const;
  return (
    <div className="card card-hover relative overflow-hidden p-4">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accentMap[accent]} to-transparent blur-2xl`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-steel-300/70">{label}</p>
          <p className="mt-1 stat-num text-2xl text-white">{value}</p>
        </div>
        <div className={`rounded-lg bg-white/5 p-2 ${accentMap[accent].split(' ')[1]}`}>{icon}</div>
      </div>
      {(trend || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend && (
            <span className={trend.dir === 'up' ? 'text-emerald-400' : trend.dir === 'down' ? 'text-rose-400' : 'text-steel-300/70'}>
              {trend.dir === 'up' ? '▲' : trend.dir === 'down' ? '▼' : '■'} {trend.value}
            </span>
          )}
          {hint && <span className="text-steel-300/50">{hint}</span>}
        </div>
      )}
    </div>
  );
}

// ---- Empty state ----
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-steel-300/40">{icon}</div>}
      <p className="text-sm text-steel-200">{title}</p>
      {hint && <p className="text-xs text-steel-300/60">{hint}</p>}
    </div>
  );
}

// ---- Toast / banner ----
export function Banner({ kind, children }: { kind: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  const map = {
    info: { icon: Info, cls: 'border-blue-500/30 bg-blue-500/10 text-blue-200' },
    success: { icon: CheckCircle2, cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
    warning: { icon: AlertTriangle, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
    error: { icon: XCircle, cls: 'border-rose-500/30 bg-rose-500/10 text-rose-200' },
  } as const;
  const M = map[kind];
  const Icon = M.icon;
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${M.cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

// ---- Page header ----
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-steel-300/70">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ---- Spinner ----
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span className="inline-block animate-sweep rounded-full border-2 border-white/15 border-t-steel-400" style={{ width: size, height: size }} />
  );
}

// ---- Inline help text ----
export function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-steel-300/60">{children}</p>;
}
