import { useMemo, useState } from 'react';
import { ScrollText, Search, Download, Trash2, LogIn, FileText, Eye, Sparkles, TrendingUp } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/ui';
import { useI18n } from '../i18n';
import { useAuditStore, useAuthStore } from '../store/auth';
import { exportAuditPdf } from '../ai/reports';
import type { AuditEntry } from '../types';

const CAT_ICON: Record<AuditEntry['category'], React.ReactNode> = {
  Login: <LogIn size={13} />,
  Report: <FileText size={13} />,
  'Case Access': <Eye size={13} />,
  'AI Query': <Sparkles size={13} />,
  Prediction: <TrendingUp size={13} />,
  Export: <Download size={13} />,
};
const CAT_COLOR: Record<AuditEntry['category'], string> = {
  Login: 'text-emerald-300 bg-emerald-500/10',
  Report: 'text-blue-300 bg-blue-500/10',
  'Case Access': 'text-steel-300 bg-steel-500/10',
  'AI Query': 'text-purple-300 bg-purple-500/10',
  Prediction: 'text-amber-300 bg-amber-500/10',
  Export: 'text-cyan-300 bg-cyan-500/10',
};

export default function AuditPage() {
  const { t } = useI18n();
  const { entries, clear } = useAuditStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | AuditEntry['category']>('all');

  const filtered = useMemo(() => entries.filter((e) =>
    (catFilter === 'all' || e.category === catFilter) &&
    (!search || e.action.toLowerCase().includes(search.toLowerCase()) || e.userName.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase()))
  ), [entries, search, catFilter]);

  const stats = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const e of entries) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const isPrivileged = user?.role === 'Admin' || user?.role === 'Supervisor';

  if (!isPrivileged) {
    return (
      <div className="flex flex-1 flex-col h-[calc(100vh-6rem)]">
        <PageHeader title={t('page_audit_title')} />
        <Card className="flex-1 flex items-center justify-center">
          <EmptyState icon={<ScrollText size={40} />} title={t('audit_restricted')} hint={t('audit_restrictedHint')} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-5.5rem)] min-h-0 space-y-3">
      <PageHeader
        title={t('page_audit_title')}
        subtitle={t('page_audit_sub')}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => exportAuditPdf(filtered)} className="btn-primary py-1.5 px-3 text-xs" disabled={filtered.length === 0}><Download size={14} /> {t('audit_exportPdf')}</button>
            {entries.length > 0 && <button onClick={() => { if (confirm(t('audit_clearConfirm'))) clear(); }} className="btn-ghost py-1.5 px-2 text-xs" title={t('clear')}><Trash2 size={14} /></button>}
          </div>
        }
      />

      {entries.length === 0 ? (
        <Card className="flex-1 flex items-center justify-center"><EmptyState icon={<ScrollText size={40} />} title={t('audit_noEntries')} hint={t('audit_noEntriesHint')} /></Card>
      ) : (
        <>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 shrink-0">
            {stats.map(([cat, count]) => (
              <div key={cat} className="card p-2.5">
                <div className={`mb-1 inline-flex rounded-md px-1.5 py-0.5 ${CAT_COLOR[cat as AuditEntry['category']]}`}>{CAT_ICON[cat as AuditEntry['category']]}</div>
                <p className="stat-num text-lg font-bold text-white">{count}</p>
                <p className="text-[10px] uppercase tracking-wide text-steel-300/70">{cat}</p>
              </div>
            ))}
          </div>

          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden" bodyClass="p-0 flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 p-2.5 bg-ink-950/40 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-300/60" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('audit_search')} className="input pl-8 py-1.5 text-xs" />
              </div>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as any)} className="input w-auto text-xs py-1.5">
                <option value="all">{t('audit_allCategories')}</option>
                {(['Login', 'Report', 'Case Access', 'AI Query', 'Prediction', 'Export'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs font-mono text-steel-300/70">{filtered.length} / {entries.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="tbl w-full">
                <thead className="sticky top-0 bg-ink-900/95 backdrop-blur-sm z-10">
                  <tr><th>{t('audit_time')}</th><th>{t('audit_user')}</th><th>{t('category')}</th><th>{t('audit_action')}</th><th>{t('audit_detail')}</th></tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-steel-300/80">{new Date(e.timestamp).toLocaleString('en-IN')}</td>
                      <td className="text-white font-medium">{e.userName}</td>
                      <td><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${CAT_COLOR[e.category]}`}>{CAT_ICON[e.category]} {e.category}</span></td>
                      <td className="text-steel-100">{e.action}</td>
                      <td className="max-w-md truncate text-xs text-steel-300/70">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
