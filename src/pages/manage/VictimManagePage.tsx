import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { EntityTable, type Column, Field } from '../../components/EntityTable';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { DISTRICTS } from '../../data/catalog';
import {
  searchVictims, createVictim, updateVictim, deleteVictim, fetchDistricts,
  type VictimInput, type PageQuery,
} from '../../lib/db';
import { addAuditLog } from '../../lib/db';
import { useAuthStore } from '../../store/auth';
import type { Victim, District } from '../../types';

const INJURY: Victim['injurySeverity'][] = ['None', 'Minor', 'Major', 'Fatal'];
const PAGE_SIZE = 15;

export default function VictimManagePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [injuryFilter, setInjuryFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<Victim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState<District[]>(DISTRICTS);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Victim | null>(null);
  const [deleting, setDeleting] = useState<Victim | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VictimInput>(emptyForm());

  function emptyForm(): VictimInput {
    return { id: '', caseId: '', name: '', age: 30, gender: 'Male', districtId: DISTRICTS[0]?.id ?? '', injurySeverity: 'None', phone: '' };
  }

  useEffect(() => { void (async () => { try { setDistricts(await fetchDistricts()); } catch { /* */ } })(); }, []);

  const runQuery = useCallback(async () => {
    setLoading(true); setError('');
    const pq: PageQuery = {
      query: search || undefined,
      filters: { district_id: districtFilter, injury_severity: injuryFilter, gender: genderFilter },
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try {
      const r = await searchVictims(pq);
      setRows(r.rows); setTotal(r.total);
    } catch (e: any) { setError(e?.message ?? 'Failed'); setRows([]); setTotal(0); }
    finally { setLoading(false); }
  }, [search, districtFilter, injuryFilter, genderFilter, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const onSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormErr(''); setShowForm(true); };
  const openEdit = (v: Victim) => {
    setEditing(v);
    setForm({ id: v.id, caseId: v.caseId, name: v.name, age: v.age, gender: v.gender, districtId: v.districtId, injurySeverity: v.injurySeverity, phone: v.phone });
    setFormErr(''); setShowForm(true);
  };

  const submit = async () => {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Name is required'); return; }
    if (!form.caseId.trim()) { setFormErr('Case ID is required'); return; }
    if (!form.phone.trim()) { setFormErr('Phone is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateVictim(editing.id, form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Updated victim ${editing.id}`, category: 'Case Access', detail: form.name });
      } else {
        await createVictim({ ...form, id: `VIC-${Date.now().toString(36).toUpperCase()}` });
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Created victim`, category: 'Case Access', detail: form.name });
      }
      setShowForm(false); void runQuery();
    } catch (e: any) { setFormErr(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteVictim(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted victim ${deleting.id}`, category: 'Case Access', detail: deleting.name });
    void runQuery();
  };

  const injuryColor = (s: Victim['injurySeverity']) =>
    s === 'Fatal' ? 'bg-rose-500/15 text-rose-300' : s === 'Major' ? 'bg-orange-500/15 text-orange-300' : s === 'Minor' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-steel-300/70';

  const columns: Column<Victim>[] = [
    { key: 'id', header: 'ID', sortable: true, render: (v) => <span className="font-mono text-xs text-steel-300/80">{v.id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (v) => <span className="text-white">{v.name}</span> },
    { key: 'caseId', header: 'Case', render: (v) => <Link to={`/case/${v.caseId}`} className="font-mono text-xs text-steel-100 hover:text-steel-300">{v.caseId}</Link> },
    { key: 'age', header: 'Age', sortable: true, render: (v) => <span className="text-steel-300/80">{v.age}y · {v.gender}</span> },
    { key: 'district', header: 'District', render: (v) => <span className="text-steel-300/80">{districts.find((d) => d.id === v.districtId)?.name ?? v.districtId}</span> },
    { key: 'injury', header: 'Injury', sortable: true, sortKey: 'injury_severity', render: (v) => <span className={`chip ${injuryColor(v.injurySeverity)}`}>{v.injurySeverity}</span> },
    { key: 'phone', header: 'Phone', render: (v) => <span className="font-mono text-xs text-steel-300/80">{v.phone}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('page_victim_manage_title')} subtitle={t('page_victim_manage_sub')} />
      <EntityTable
        title="Victim Records" subtitle={`${total} total`}
        addLabel="Add Victim" onAdd={openCreate}
        search={search} onSearch={(s) => { setSearch(s); setPage(1); }} searchPlaceholder="Name, ID, phone…"
        filters={
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}>
              <option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="input" value={injuryFilter} onChange={(e) => { setInjuryFilter(e.target.value); setPage(1); }}>
              <option value="">All injuries</option>{INJURY.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}>
              <option value="">All genders</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
        }
        columns={columns} rows={rows} rowKey={(v) => v.id} loading={loading} error={error}
        total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
        sortBy={sortBy} sortDir={sortDir} onSort={onSort}
        actions={(v) => (
          <>
            <Link to={`/victim?id=${v.id}`} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-white" title="View"><Eye size={14} /></Link>
            <button onClick={() => openEdit(v)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(v)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal
        open={showForm} onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.id}` : 'Add Victim'} wide
        footer={<><button onClick={() => setShowForm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Case ID" required><input className="input" value={form.caseId} onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))} placeholder="KSP-00001" /></Field>
          <Field label="Age"><input type="number" min={1} max={120} className="input" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: +e.target.value }))} /></Field>
          <Field label="Gender"><select className="input" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Victim['gender'] }))}><option>Male</option><option>Female</option><option>Other</option></select></Field>
          <Field label="District"><select className="input" value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Phone" required><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91-XXXXX-XXXXX" /></Field>
          <Field label="Injury Severity"><select className="input" value={form.injurySeverity} onChange={(e) => setForm((f) => ({ ...f, injurySeverity: e.target.value as Victim['injurySeverity'] }))}>{INJURY.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        {formErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formErr}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`Permanently delete victim "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete" danger
      />
    </div>
  );
}
