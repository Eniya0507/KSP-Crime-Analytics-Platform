import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, X, ChevronRight, ChevronLeft, Plus, Pencil, Trash2, Archive, RotateCcw, Loader2, ArrowUpDown } from 'lucide-react';
import { PageHeader, Card, StatusPill, CategoryPill, SeverityMeter, EmptyState, HelpText } from '../components/ui';
import { Modal, ConfirmDialog } from '../components/Modal';
import { CaseFormModal } from '../components/CaseFormModal';
import { useI18n } from '../i18n';
import { DISTRICTS, CRIME_TYPES } from '../data/catalog';
import { fetchCases, setCaseStatus, archiveCase, deleteCase, fetchDistricts, fetchStations, type CaseQuery } from '../lib/db';
import { addAuditLog } from '../lib/db';
import { useAuthStore } from '../store/auth';
import type { CrimeCategory, CaseStatus, CrimeCase, District, PoliceStation } from '../types';

const STATUSES: CaseStatus[] = ['Open', 'Under Investigation', 'Charge Sheet Filed', 'Closed', 'Pending'];
const PAGE_SIZE = 15;

export default function SearchPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [crimeType, setCrimeType] = useState('');
  const [category, setCategory] = useState<CrimeCategory | ''>('');
  const [districtId, setDistrictId] = useState(params.get('dist') ?? '');
  const [stationId, setStationId] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [ipc, setIpc] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minSeverity, setMinSeverity] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'value_loss_inr'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [districts, setDistricts] = useState<District[]>(DISTRICTS);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [results, setResults] = useState<CrimeCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CrimeCase | null>(null);
  const [deleting, setDeleting] = useState<CrimeCase | null>(null);
  const [statusTarget, setStatusTarget] = useState<CrimeCase | null>(null);
  const [newStatus, setNewStatus] = useState<CaseStatus>('Open');

  useEffect(() => {
    void (async () => {
      try { setDistricts(await fetchDistricts()); } catch { /* keep defaults */ }
    })();
  }, []);
  useEffect(() => {
    void (async () => {
      try { setStations(await fetchStations(districtId || undefined)); } catch { /* */ }
    })();
  }, [districtId]);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    const q: CaseQuery = {
      query: query || undefined,
      crimeType: crimeType || undefined,
      category: category || undefined,
      districtId: districtId || undefined,
      stationId: stationId || undefined,
      status: status || undefined,
      ipc: ipc || undefined,
      from: from || undefined,
      to: to || undefined,
      minSeverity: minSeverity || undefined,
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try {
      const r = await fetchCases(q);
      setResults(r.cases);
      setTotal(r.total);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load cases');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, crimeType, category, districtId, stationId, status, ipc, from, to, minSeverity, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void runQuery();
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (districtId) p.set('dist', districtId);
    if (status) p.set('status', status);
    setParams(p, { replace: true });
  };

  const reset = () => {
    setQuery(''); setCrimeType(''); setCategory(''); setDistrictId(''); setStationId('');
    setStatus(''); setIpc(''); setFrom(''); setTo(''); setMinSeverity(0); setPage(1);
    setParams({}, { replace: true });
  };

  const toggleSort = (col: 'date' | 'severity' | 'value_loss_inr') => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const activeFilters = [crimeType, category, districtId, stationId, status, ipc, from, to, minSeverity > 0 ? `sev≥${minSeverity}` : ''].filter(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;

  const onSaved = () => { void runQuery(); };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteCase(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted case ${deleting.id}`, category: 'Case Access', detail: deleting.firNumber });
    onSaved();
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    await setCaseStatus(statusTarget.id, newStatus);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Changed status of ${statusTarget.id} to ${newStatus}`, category: 'Case Access', detail: statusTarget.firNumber });
    onSaved();
  };

  const doArchive = async (c: CrimeCase) => {
    await archiveCase(c.id, true);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Archived case ${c.id}`, category: 'Case Access', detail: c.firNumber });
    onSaved();
  };

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-5.5rem)] min-h-0 space-y-3">
      <PageHeader title={t('page_search_title')} subtitle={t('page_search_sub')} action={
        <button onClick={() => setShowCreate(true)} className="btn-primary py-1.5 px-3 text-xs"><Plus size={14} /> Register New FIR</button>
      } />

      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden" bodyClass="p-0 flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Search & Filter Header Toolbar */}
        <div className="p-3 border-b border-white/5 bg-ink-950/40 shrink-0">
          <form onSubmit={runSearch} className="space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-300/60" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')} className="input pl-9 py-1.5 text-xs" />
              </div>
              <div className="flex items-center gap-1.5">
                <button type="submit" className="btn-primary py-1.5 px-3 text-xs" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} {t('search')}</button>
                <button type="button" onClick={() => setShowFilters((v) => !v)} className="btn-outline py-1.5 px-2.5 text-xs">
                  <Filter size={14} /> {t('search_filters')} {activeFilters.length > 0 && <span className="chip ml-1 bg-steel-600/30 text-steel-200">{activeFilters.length}</span>}
                </button>
                {(activeFilters.length > 0 || query) && <button type="button" onClick={reset} className="btn-ghost py-1.5 px-2 text-xs"><X size={14} /> {t('clear')}</button>}
              </div>
            </div>

            {showFilters && (
              <div className="grid gap-2.5 border-t border-white/5 pt-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <label className="label text-[11px]">{t('search_crimeType')}</label>
                  <select className="input py-1 text-xs" value={crimeType} onChange={(e) => setCrimeType(e.target.value)}>
                    <option value="">{t('all')}</option>
                    {CRIME_TYPES.map((c) => <option key={c.type} value={c.type}>{c.type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">{t('category')}</label>
                  <select className="input py-1 text-xs" value={category} onChange={(e) => setCategory(e.target.value as CrimeCategory | '')}>
                    <option value="">{t('all')}</option>
                    {(['Violent','Property','Cyber','Economic','Narcotics','Against Women','Against Children','Public Order'] as CrimeCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">{t('district')}</label>
                  <select className="input py-1 text-xs" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setStationId(''); }}>
                    <option value="">{t('all')}</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">{t('station')}</label>
                  <select className="input py-1 text-xs" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                    <option value="">{t('all')}</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">{t('search_status')}</label>
                  <select className="input py-1 text-xs" value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)}>
                    <option value="">{t('all')}</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">IPC Section</label>
                  <input className="input py-1 text-xs" value={ipc} onChange={(e) => setIpc(e.target.value)} placeholder="e.g. 302" />
                </div>
                <div>
                  <label className="label text-[11px]">{t('search_dateRange')}</label>
                  <input type="date" className="input py-1 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label text-[11px]">To Date</label>
                  <input type="date" className="input py-1 text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            )}
          </form>

          <div className="mt-2.5 flex items-center justify-between text-xs">
            <p className="text-steel-300/80">
              {loading ? t('loading') : <><span className="stat-num text-white font-bold">{total}</span> cases found</>}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-steel-300/70">
              <button onClick={() => toggleSort('date')} className={`btn-ghost py-0.5 px-1.5 ${sortBy === 'date' ? 'text-white font-semibold' : ''}`}>{t('date')} <ArrowUpDown size={11} className="inline" /></button>
              <button onClick={() => toggleSort('severity')} className={`btn-ghost py-0.5 px-1.5 ${sortBy === 'severity' ? 'text-white font-semibold' : ''}`}>{t('severity')} <ArrowUpDown size={11} className="inline" /></button>
              <button onClick={() => toggleSort('value_loss_inr')} className={`btn-ghost py-0.5 px-1.5 ${sortBy === 'value_loss_inr' ? 'text-white font-semibold' : ''}`}>{t('dash_valueLoss')} <ArrowUpDown size={11} className="inline" /></button>
            </div>
          </div>
        </div>

        {error && <p className="m-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 shrink-0">{error}</p>}

        {/* Scrollable Table Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!loading && results.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={<Search size={36} />} title={t('search_noResults')} hint="Try widening filters or register a new FIR." />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20 text-steel-300/60"><Loader2 size={22} className="animate-spin" /> <span className="ml-2 text-xs">Loading cases…</span></div>
          ) : (
            <div className="table-wrap border-0">
              <table className="tbl w-full">
                <thead className="sticky top-0 bg-ink-900/95 backdrop-blur-sm z-10">
                  <tr><th>{t('dash_case')}</th><th>{t('search_firNumber')}</th><th>{t('search_crimeType')}</th><th>{t('category')}</th><th>{t('district')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('severity')}</th><th>{t('actions')}</th></tr>
                </thead>
                <tbody>
                  {results.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/case/${c.id}`} className="font-mono text-steel-100 hover:text-cyan-300 font-medium">{c.id}</Link></td>
                      <td className="font-mono text-xs text-steel-300/80">{c.firNumber}</td>
                      <td className="text-white font-medium">{c.crimeType}</td>
                      <td><CategoryPill category={c.category} /></td>
                      <td className="text-steel-300/80">{districts.find((d) => d.id === c.districtId)?.name ?? c.districtId}</td>
                      <td className="text-steel-300/80">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                      <td><StatusPill status={c.status} /></td>
                      <td><SeverityMeter value={c.severity} /></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link to={`/case/${c.id}`} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-white" title={t('view')}><ChevronRight size={14} /></Link>
                          <button onClick={() => setEditing(c)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title={t('edit')}><Pencil size={13} /></button>
                          <button onClick={() => { setStatusTarget(c); setNewStatus(c.status); }} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-amber-300" title="Change Status"><RotateCcw size={13} /></button>
                          <button onClick={() => doArchive(c)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-steel-200" title="Archive"><Archive size={13} /></button>
                          <button onClick={() => setDeleting(c)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title={t('delete')}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-2.5 border-t border-white/5 bg-ink-950/40 flex items-center justify-between shrink-0 text-xs">
            <HelpText>Showing {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, total)} of {total}</HelpText>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="px-2 font-mono text-steel-200">Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </Card>

      <CaseFormModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={onSaved} />
      <CaseFormModal open={!!editing} onClose={() => setEditing(null)} onSaved={onSaved} existing={editing} />
      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`This permanently deletes case ${deleting?.id} (${deleting?.firNumber}) and all linked accused/victims. This cannot be undone.`}
        confirmLabel="Delete" danger
      />
      <Modal
        open={!!statusTarget} onClose={() => setStatusTarget(null)}
        title={`Change Status — ${statusTarget?.id ?? ''}`}
        footer={
          <>
            <button onClick={() => setStatusTarget(null)} className="btn-ghost">Cancel</button>
            <button onClick={confirmStatus} className="btn-primary"><RotateCcw size={14} /> Update Status</button>
          </>
        }
      >
        <p className="mb-3 text-sm text-steel-300/80">Current: <StatusPill status={statusTarget?.status ?? 'Open'} /></p>
        <label className="label">New Status</label>
        <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value as CaseStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="mt-3 text-xs text-steel-300/60">Cases set to "Closed" or "Charge Sheet Filed" are automatically marked solved.</p>
      </Modal>
    </div>
  );
}
