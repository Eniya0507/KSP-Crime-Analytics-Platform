import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, MapPin } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { EntityTable, type Column, Field } from '../../components/EntityTable';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { DISTRICTS } from '../../data/catalog';
import {
  searchStations, createStation, updateStation, deleteStation, fetchDistricts,
  type StationInput, type PageQuery,
} from '../../lib/db';
import { addAuditLog } from '../../lib/db';
import { useAuthStore } from '../../store/auth';
import type { PoliceStation, District } from '../../types';

const ZONES = ['Urban', 'Rural', 'Industrial', 'Coastal', 'Border'];
const PAGE_SIZE = 15;

export default function StationManagePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<PoliceStation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState<District[]>(DISTRICTS);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PoliceStation | null>(null);
  const [deleting, setDeleting] = useState<PoliceStation | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StationInput>(emptyForm());

  function emptyForm(): StationInput {
    return { id: '', name: '', districtId: DISTRICTS[0]?.id ?? '', zone: 'Urban', lat: DISTRICTS[0]?.lat ?? 12.97, lng: DISTRICTS[0]?.lng ?? 77.59, jurisdictionPop: 100000 };
  }

  useEffect(() => { void (async () => { try { setDistricts(await fetchDistricts()); } catch { /**/ } })(); }, []);

  const runQuery = useCallback(async () => {
    setLoading(true); setError('');
    const pq: PageQuery = {
      query: search || undefined,
      filters: { district_id: districtFilter, zone: zoneFilter },
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try { const r = await searchStations(pq); setRows(r.rows); setTotal(r.total); }
    catch (e: any) { setError(e?.message ?? 'Failed'); setRows([]); setTotal(0); }
    finally { setLoading(false); }
  }, [search, districtFilter, zoneFilter, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const onSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormErr(''); setShowForm(true); };
  const openEdit = (s: PoliceStation) => {
    setEditing(s);
    setForm({ id: s.id, name: s.name, districtId: s.districtId, zone: s.zone, lat: s.lat, lng: s.lng, jurisdictionPop: s.jurisdictionPop });
    setFormErr(''); setShowForm(true);
  };

  const submit = async () => {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Station name is required'); return; }
    if (!form.districtId) { setFormErr('District is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateStation(editing.id, form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Updated station ${editing.id}`, category: 'Case Access', detail: form.name });
      } else {
        const id = form.id?.trim() || `${form.districtId}-PS-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        await createStation({ ...form, id });
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Created station`, category: 'Case Access', detail: form.name });
      }
      setShowForm(false); void runQuery();
    } catch (e: any) { setFormErr(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteStation(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted station ${deleting.id}`, category: 'Case Access', detail: deleting.name });
    void runQuery();
  };

  const columns: Column<PoliceStation>[] = [
    { key: 'id', header: 'ID', sortable: true, render: (s) => <span className="font-mono text-xs text-steel-300/80">{s.id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (s) => <span className="text-white">{s.name}</span> },
    { key: 'district', header: 'District', render: (s) => <span className="text-steel-300/80">{districts.find((d) => d.id === s.districtId)?.name ?? s.districtId}</span> },
    { key: 'zone', header: 'Zone', sortable: true, render: (s) => <span className="chip bg-cyan-500/15 text-cyan-300">{s.zone}</span> },
    { key: 'pop', header: 'Jurisdiction Pop.', sortable: true, sortKey: 'jurisdiction_pop', render: (s) => <span className="text-steel-300/80">{s.jurisdictionPop.toLocaleString('en-IN')}</span> },
    { key: 'coords', header: 'Coordinates', render: (s) => <span className="inline-flex items-center gap-1 font-mono text-xs text-steel-300/70"><MapPin size={11} /> {s.lat.toFixed(2)}, {s.lng.toFixed(2)}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('page_station_manage_title')} subtitle={t('page_station_manage_sub')} />
      <EntityTable
        title="Police Stations" subtitle={`${total} total`}
        addLabel="Add Station" onAdd={openCreate}
        search={search} onSearch={(s) => { setSearch(s); setPage(1); }} searchPlaceholder="Name, ID, zone…"
        filters={
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}>
              <option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="input" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }}>
              <option value="">All zones</option>{ZONES.map((z) => <option key={z}>{z}</option>)}
            </select>
          </div>
        }
        columns={columns} rows={rows} rowKey={(s) => s.id} loading={loading} error={error}
        total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
        sortBy={sortBy} sortDir={sortDir} onSort={onSort}
        actions={(s) => (
          <>
            <button onClick={() => openEdit(s)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(s)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal
        open={showForm} onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.id}` : 'Add Police Station'} wide
        footer={<><button onClick={() => setShowForm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Station Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Bengaluru Town PS 6" /></Field>
          <Field label="District" required><select className="input" value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Zone"><select className="input" value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Jurisdiction Population"><input type="number" min={0} className="input" value={form.jurisdictionPop} onChange={(e) => setForm((f) => ({ ...f, jurisdictionPop: +e.target.value }))} /></Field>
          <Field label="Latitude"><input type="number" step={0.0001} className="input" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: +e.target.value }))} /></Field>
          <Field label="Longitude"><input type="number" step={0.0001} className="input" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: +e.target.value }))} /></Field>
          {!editing && <Field label="Custom ID (optional)" hint="Leave blank to auto-generate"><input className="input" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="auto-generated" /></Field>}
        </div>
        {formErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formErr}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`Permanently delete station "${deleting?.name}"? All officers and cases at this station will be affected. This cannot be undone.`}
        confirmLabel="Delete" danger
      />
    </div>
  );
}
