import { useState, type ReactNode } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Loader2, Plus } from 'lucide-react';
import { Card, EmptyState, HelpText } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
}

interface Props<T> {
  title: string;
  subtitle?: string;
  addLabel: string;
  onAdd: () => void;
  search: string;
  onSearch: (s: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading: boolean;
  error?: string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (col: string) => void;
  actions: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}

export function EntityTable<T>({
  title, subtitle, addLabel, onAdd, search, onSearch, searchPlaceholder,
  filters, columns, rows, rowKey, loading, error, total, page, pageSize,
  onPageChange, sortBy, sortDir: _sortDir, onSort, actions,
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;

  return (
    <div className="flex flex-1 flex-col space-y-3 min-h-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-steel-300/70">{subtitle}</p>}
        </div>
        <button onClick={onAdd} className="btn-primary py-2 px-3 text-xs shadow-glow self-start sm:self-auto"><Plus size={14} /> {addLabel}</button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden" bodyClass="p-0 flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Search & Filters Toolbar */}
        <div className="p-3 border-b border-white/5 bg-ink-950/40 space-y-2.5 shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-300/60" />
              <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder ?? 'Search…'} className="input pl-9 py-1.5 text-xs" />
            </div>
            <div className="text-xs text-steel-300/80 shrink-0 font-mono">
              {loading ? 'Loading…' : <><span className="stat-num text-white font-bold">{total}</span> record{total === 1 ? '' : 's'}</>}
            </div>
          </div>
          {filters && <div className="pt-1">{filters}</div>}
        </div>

        {error && <p className="m-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 shrink-0">{error}</p>}

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-steel-300/60"><Loader2 size={22} className="animate-spin" /> <span className="ml-2 text-xs">Loading records…</span></div>
          ) : rows.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={<Search size={32} />} title="No records found" hint="Try adjusting your search or add a new record." />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="tbl w-full">
                <thead className="sticky top-0 bg-ink-900/95 backdrop-blur-sm z-10">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className={c.className}>
                        {c.sortable && onSort ? (
                          <button onClick={() => onSort(c.sortKey ?? c.key)} className={`inline-flex items-center gap-1 hover:text-white ${sortBy === (c.sortKey ?? c.key) ? 'text-white font-semibold' : ''}`}>
                            {c.header} <ArrowUpDown size={10} />
                          </button>
                        ) : c.header}
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={rowKey(row)}>
                      {columns.map((c) => <td key={c.key} className={c.className}>{c.render(row)}</td>)}
                      <td>
                        <div className="flex items-center gap-1">{actions(row)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-2.5 border-t border-white/5 bg-ink-950/40 flex items-center justify-between shrink-0 text-xs">
            <HelpText>Showing {startIdx + 1}-{Math.min(startIdx + pageSize, total)} of {total}</HelpText>
            <div className="flex items-center gap-1">
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="px-2 text-xs font-mono text-steel-200">Page {page} / {totalPages}</span>
              <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Reusable field components for form modals
export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label} {required && <span className="text-rose-400">*</span>}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-steel-300/60">{hint}</p>}
    </div>
  );
}

// Hook for a paginated entity manager state
export function usePageState(initialSort: string) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(initialSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const onSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  return { page, setPage, sortBy, sortDir, onSort };
}
