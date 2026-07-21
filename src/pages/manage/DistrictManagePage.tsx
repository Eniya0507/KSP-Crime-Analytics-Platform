import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, MapPin } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { EntityTable, type Column, Field } from '../../components/EntityTable';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useI18n } from '../../i18n';
import {
  searchDistricts, createDistrict, updateDistrict, deleteDistrict,
  type DistrictInput, type PageQuery,
} from '../../lib/db';
import { addAuditLog } from '../../lib/db';
import { useAuthStore } from '../../store/auth';
import type { District } from '../../types';

const REGIONS: District['region'][] = ['Bengaluru', 'Mysuru', 'Belagavi', 'Kalaburagi', 'Dakshina Kannada', 'Hubballi', 'Coastal', 'Central'];
const PAGE_SIZE = 15;

export default function DistrictManagePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<District[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<District | null>(null);
  const [deleting, setDeleting] = useState<District | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DistrictInput>(emptyForm());

  function emptyForm(): DistrictInput {
    return { id: '', name: '', region: 'Bengaluru', lat: 12.97, lng: 77.59, population: 1000000 };
  }

  const runQuery = useCallback(async () => {
    setLoading(true); setError('');
    const pq: PageQuery = {
      query: search || undefined,
      filters: { region: regionFilter },
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try { const r = await searchDistricts(pq); setRows(r.rows); setTotal(r.total); }
    catch (e: any) { setError(e?.message ?? 'Failed'); setRows([]); setTotal(0); }
    finally { setLoading(false); }
  }, [search, regionFilter, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const onSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormErr(''); setShowForm(true); };
  const openEdit = (d: District) => {
    setEditing(d);
    setForm({ id: d.id, name: d.name, region: d.region, lat: d.lat, lng: d.lng, population: d.population });
    setFormErr(''); setShowForm(true);
  };

  const submit = async () => {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('District name is required'); return; }
    if (!form.id?.trim() && !editing) { setFormErr('District code (ID) is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateDistrict(editing.id, form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Updated district ${editing.id}`, category: 'Case Access', detail: form.name });
      } else {
        await createDistrict(form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Created district ${form.id}`, category: 'Case Access', detail: form.name });
      }
      setShowForm(false); void runQuery();
    } catch (e: any) { setFormErr(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteDistrict(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted district ${deleting.id}`, category: 'Case Access', detail: deleting.name });
    void runQuery();
  };

  const columns: Column<District>[] = [
    { key: 'id', header: 'Code', sortable: true, render: (d) => <span className="font-mono text-xs text-steel-300/80">{d.id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (d) => <span className="text-white">{d.name}</span> },
    { key: 'region', header: 'Region', sortable: true, render: (d) => <span className="chip bg-steel-600/20 text-steel-200">{d.region}</span> },
    { key: 'population', header: 'Population', sortable: true, render: (d) => <span className="text-steel-300/80">{d.population.toLocaleString('en-IN')}</span> },
    { key: 'coords', header: 'Coordinates', render: (d) => <span className="inline-flex items-center gap-1 font-mono text-xs text-steel-300/70"><MapPin size={11} /> {d.lat.toFixed(2)}, {d.lng.toFixed(2)}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('page_district_manage_title')} subtitle={t('page_district_manage_sub')} />
      <EntityTable
        title="Districts" subtitle={`${total} total`}
        addLabel="Add District" onAdd={openCreate}
        search={search} onSearch={(s) => { setSearch(s); setPage(1); }} searchPlaceholder="Name, code, region…"
        filters={
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}>
              <option value="">All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        }
        columns={columns} rows={rows} rowKey={(d) => d.id} loading={loading} error={error}
        total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
        sortBy={sortBy} sortDir={sortDir} onSort={onSort}
        actions={(d) => (
          <>
            <button onClick={() => openEdit(d)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(d)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal
        open={showForm} onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.id}` : 'Add District'} wide
        footer={<><button onClick={() => setShowForm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="District Code (ID)" required><input className="input" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))} placeholder="e.g. BLR" disabled={!!editing} /></Field>
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Region"><select className="input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Population"><input type="number" min={0} className="input" value={form.population} onChange={(e) => setForm((f) => ({ ...f, population: +e.target.value }))} /></Field>
          <Field label="Latitude"><input type="number" step={0.0001} className="input" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: +e.target.value }))} /></Field>
          <Field label="Longitude"><input type="number" step={0.0001} className="input" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: +e.target.value }))} /></Field>
        </div>
        {formErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formErr}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`Permanently delete district "${deleting?.name}"? All stations, officers, and cases in this district will be cascade-deleted. This cannot be undone.`}
        confirmLabel="Delete" danger
      />
    </div>
  );
}
