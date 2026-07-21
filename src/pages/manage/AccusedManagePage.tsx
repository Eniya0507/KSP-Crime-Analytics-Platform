import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { EntityTable, type Column, Field } from '../../components/EntityTable';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { DISTRICTS, GANG_NAMES } from '../../data/catalog';
import { RiskBadge } from '../../components/ui';
import {
  searchAccused, createAccused, updateAccused, deleteAccused, fetchDistricts,
  type AccusedInput, type PageQuery,
} from '../../lib/db';
import { addAuditLog } from '../../lib/db';
import { useAuthStore } from '../../store/auth';
import type { Accused, District } from '../../types';

const STATUSES: Accused['status'][] = ['Arrested', 'Absconding', 'On Bail', 'In Custody', 'Surrendered'];
const PAGE_SIZE = 15;

export default function AccusedManagePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [gangFilter, setGangFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<Accused[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState<District[]>(DISTRICTS);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Accused | null>(null);
  const [deleting, setDeleting] = useState<Accused | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccusedInput>(emptyForm());

  function emptyForm(): AccusedInput {
    return {
      id: '', caseId: '', name: '', age: 25, gender: 'Male', districtId: DISTRICTS[0]?.id ?? '',
      priorsCount: 0, riskScore: 20, status: 'Arrested', phone: '', aadhaarLast4: '',
      gangAffiliation: null, occupation: 'Unemployed',
    };
  }

  useEffect(() => { void (async () => { try { setDistricts(await fetchDistricts()); } catch { /* keep defaults */ } })(); }, []);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    const pq: PageQuery = {
      query: search || undefined,
      filters: { district_id: districtFilter, gang_affiliation: gangFilter, status: statusFilter },
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try {
      const r = await searchAccused(pq);
      setRows(r.rows);
      setTotal(r.total);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [search, districtFilter, gangFilter, statusFilter, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const onSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormErr(''); setShowForm(true); };
  const openEdit = (a: Accused) => {
    setEditing(a);
    setForm({
      id: a.id, caseId: a.caseId, name: a.name, age: a.age, gender: a.gender, districtId: a.districtId,
      priorsCount: a.priorsCount, riskScore: a.riskScore, status: a.status, phone: a.phone,
      aadhaarLast4: a.aadhaarLast4, gangAffiliation: a.gangAffiliation, occupation: a.occupation,
    });
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
        await updateAccused(editing.id, form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Updated accused ${editing.id}`, category: 'Case Access', detail: form.name });
      } else {
        await createAccused({ ...form, id: `ACC-${Date.now().toString(36).toUpperCase()}` });
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Created accused`, category: 'Case Access', detail: form.name });
      }
      setShowForm(false);
      void runQuery();
    } catch (e: any) {
      setFormErr(e?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteAccused(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted accused ${deleting.id}`, category: 'Case Access', detail: deleting.name });
    void runQuery();
  };

  const columns: Column<Accused>[] = [
    { key: 'id', header: 'ID', sortable: true, render: (a) => <span className="font-mono text-xs text-steel-300/80">{a.id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (a) => <span className="text-white">{a.name}</span> },
    { key: 'caseId', header: 'Case', render: (a) => <Link to={`/case/${a.caseId}`} className="font-mono text-xs text-steel-100 hover:text-steel-300">{a.caseId}</Link> },
    { key: 'age', header: 'Age', sortable: true, render: (a) => <span className="text-steel-300/80">{a.age}y · {a.gender}</span> },
    { key: 'district', header: 'District', render: (a) => <span className="text-steel-300/80">{districts.find((d) => d.id === a.districtId)?.name ?? a.districtId}</span> },
    { key: 'risk', header: 'Risk', sortable: true, sortKey: 'risk_score', render: (a) => <RiskBadge score={a.riskScore} level={a.riskScore >= 75 ? 'Critical' : a.riskScore >= 55 ? 'High' : a.riskScore >= 35 ? 'Medium' : 'Low'} /> },
    { key: 'priors', header: 'Priors', sortable: true, sortKey: 'priors_count', render: (a) => <span className="text-steel-300/80">{a.priorsCount}</span> },
    { key: 'status', header: 'Status', render: (a) => <span className="chip bg-white/5 text-steel-200">{a.status}</span> },
    { key: 'gang', header: 'Gang', render: (a) => a.gangAffiliation ? <span className="chip bg-purple-500/15 text-purple-300">{a.gangAffiliation}</span> : <span className="text-steel-300/50">—</span> },
  ];

  return (
    <div>
      <PageHeader title={t('page_accused_manage_title')} subtitle={t('page_accused_manage_sub')} />

      <EntityTable
        title="Accused Records" subtitle={`${total} total`}
        addLabel="Add Accused" onAdd={openCreate}
        search={search} onSearch={(s) => { setSearch(s); setPage(1); }} searchPlaceholder="Name, ID, phone, occupation…"
        filters={
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="input" value={gangFilter} onChange={(e) => { setGangFilter(e.target.value); setPage(1); }}>
              <option value="">All gangs</option>
              {GANG_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="">None</option>
            </select>
            <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
        columns={columns} rows={rows} rowKey={(a) => a.id} loading={loading} error={error}
        total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
        sortBy={sortBy} sortDir={sortDir} onSort={onSort}
        actions={(a) => (
          <>
            <Link to={`/accused?id=${a.id}`} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-white" title="View"><Eye size={14} /></Link>
            <button onClick={() => openEdit(a)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(a)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal
        open={showForm} onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.id}` : 'Add Accused'} wide
        footer={<><button onClick={() => setShowForm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Case ID" required hint="Link to an existing case (e.g. KSP-00001)"><input className="input" value={form.caseId} onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))} placeholder="KSP-00001" /></Field>
          <Field label="Age"><input type="number" min={18} max={100} className="input" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: +e.target.value }))} /></Field>
          <Field label="Gender"><select className="input" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Accused['gender'] }))}><option>Male</option><option>Female</option><option>Other</option></select></Field>
          <Field label="District"><select className="input" value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Phone" required><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91-XXXXX-XXXXX" /></Field>
          <Field label="Aadhaar (last 4)"><input className="input" maxLength={4} value={form.aadhaarLast4} onChange={(e) => setForm((f) => ({ ...f, aadhaarLast4: e.target.value }))} /></Field>
          <Field label="Occupation"><select className="input" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}>{['Daily Wage','Farmer','Driver','Trader','Unemployed','Construction Worker','IT Employee','Mechanic','Salesman','Domestic Worker'].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Accused['status'] }))}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Gang Affiliation"><select className="input" value={form.gangAffiliation ?? ''} onChange={(e) => setForm((f) => ({ ...f, gangAffiliation: e.target.value || null }))}><option value="">None</option>{GANG_NAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Priors Count"><input type="number" min={0} className="input" value={form.priorsCount} onChange={(e) => setForm((f) => ({ ...f, priorsCount: +e.target.value }))} /></Field>
          <Field label="Risk Score (0-100)"><input type="number" min={0} max={100} className="input" value={form.riskScore} onChange={(e) => setForm((f) => ({ ...f, riskScore: +e.target.value }))} /></Field>
        </div>
        {formErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formErr}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`Permanently delete accused "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete" danger
      />
    </div>
  );
}
