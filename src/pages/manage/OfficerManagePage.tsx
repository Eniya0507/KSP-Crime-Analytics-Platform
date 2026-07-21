import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, UserCog } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { EntityTable, type Column, Field } from '../../components/EntityTable';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { DISTRICTS, RANKS } from '../../data/catalog';
import {
  searchOfficers, createOfficer, updateOfficer, deleteOfficer, fetchDistricts, fetchStations,
  assignOfficerToCase, type OfficerInput, type PageQuery,
} from '../../lib/db';
import { addAuditLog } from '../../lib/db';
import { useAuthStore } from '../../store/auth';
import type { PoliceOfficer, District, PoliceStation } from '../../types';

const PAGE_SIZE = 15;

export default function OfficerManagePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rows, setRows] = useState<PoliceOfficer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState<District[]>(DISTRICTS);
  const [stations, setStations] = useState<PoliceStation[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PoliceOfficer | null>(null);
  const [deleting, setDeleting] = useState<PoliceOfficer | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OfficerInput>(emptyForm());

  // Assign-to-case modal state
  const [assignTarget, setAssignTarget] = useState<PoliceOfficer | null>(null);
  const [assignCaseId, setAssignCaseId] = useState('');
  const [assignErr, setAssignErr] = useState('');
  const [assigning, setAssigning] = useState(false);

  function emptyForm(): OfficerInput {
    return { id: '', name: '', rank: RANKS[5] ?? 'Sub-Inspector', stationId: '', districtId: DISTRICTS[0]?.id ?? '', yearsOfService: 1, casesHandled: 0, clearanceRate: 0.6, phone: '' };
  }

  useEffect(() => {
    void (async () => {
      try { setDistricts(await fetchDistricts()); const s = await fetchStations(); setStations(s); } catch { /**/ }
    })();
  }, []);
  useEffect(() => { void (async () => { try { setStations(await fetchStations(districtFilter || undefined)); } catch { /**/ } })(); }, [districtFilter]);

  const runQuery = useCallback(async () => {
    setLoading(true); setError('');
    const pq: PageQuery = {
      query: search || undefined,
      filters: { district_id: districtFilter, station_id: stationFilter, rank: rankFilter },
      page, pageSize: PAGE_SIZE, sortBy, sortDir,
    };
    try { const r = await searchOfficers(pq); setRows(r.rows); setTotal(r.total); }
    catch (e: any) { setError(e?.message ?? 'Failed'); setRows([]); setTotal(0); }
    finally { setLoading(false); }
  }, [search, districtFilter, stationFilter, rankFilter, page, sortBy, sortDir]);

  useEffect(() => { void runQuery(); }, [runQuery]);

  const onSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm(), stationId: stations[0]?.id ?? '' }); setFormErr(''); setShowForm(true); };
  const openEdit = (o: PoliceOfficer) => {
    setEditing(o);
    setForm({ id: o.id, name: o.name, rank: o.rank, stationId: o.stationId, districtId: o.districtId, yearsOfService: o.yearsOfService, casesHandled: o.casesHandled, clearanceRate: o.clearanceRate, phone: o.phone });
    setFormErr(''); setShowForm(true);
  };

  const submit = async () => {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Name is required'); return; }
    if (!form.stationId) { setFormErr('Station is required'); return; }
    if (!form.phone.trim()) { setFormErr('Phone is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateOfficer(editing.id, form);
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Updated officer ${editing.id}`, category: 'Case Access', detail: form.name });
      } else {
        await createOfficer({ ...form, id: `OFC-${Date.now().toString(36).toUpperCase()}` });
        await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Created officer`, category: 'Case Access', detail: form.name });
      }
      setShowForm(false); void runQuery();
    } catch (e: any) { setFormErr(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteOfficer(deleting.id);
    await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Deleted officer ${deleting.id}`, category: 'Case Access', detail: deleting.name });
    void runQuery();
  };

  const confirmAssign = async () => {
    if (!assignTarget || !assignCaseId.trim()) { setAssignErr('Case ID is required'); return; }
    setAssigning(true); setAssignErr('');
    try {
      await assignOfficerToCase(assignCaseId.trim().toUpperCase(), assignTarget.id);
      await addAuditLog({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Assigned ${assignTarget.id} to ${assignCaseId}`, category: 'Case Access', detail: assignTarget.name });
      setAssignTarget(null); setAssignCaseId('');
    } catch (e: any) { setAssignErr(e?.message ?? 'Failed to assign'); }
    finally { setAssigning(false); }
  };

  const onDistrictChange = (districtId: string) => {
    setForm((f) => ({ ...f, districtId, stationId: '' }));
    void (async () => { try { const s = await fetchStations(districtId); setStations(s); } catch { /**/ } })();
  };

  const columns: Column<PoliceOfficer>[] = [
    { key: 'id', header: 'ID', sortable: true, render: (o) => <span className="font-mono text-xs text-steel-300/80">{o.id}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (o) => <span className="text-white">{o.name}</span> },
    { key: 'rank', header: 'Rank', sortable: true, render: (o) => <span className="chip bg-steel-600/20 text-steel-200">{o.rank}</span> },
    { key: 'district', header: 'District', render: (o) => <span className="text-steel-300/80">{districts.find((d) => d.id === o.districtId)?.name ?? o.districtId}</span> },
    { key: 'station', header: 'Station', render: (o) => <span className="text-steel-300/80">{stations.find((s) => s.id === o.stationId)?.name ?? o.stationId}</span> },
    { key: 'service', header: 'Service', sortable: true, sortKey: 'years_of_service', render: (o) => <span className="text-steel-300/80">{o.yearsOfService}y</span> },
    { key: 'cases', header: 'Cases', sortable: true, sortKey: 'cases_handled', render: (o) => <span className="text-steel-300/80">{o.casesHandled}</span> },
    { key: 'clearance', header: 'Clearance', sortable: true, sortKey: 'clearance_rate', render: (o) => <span className="text-emerald-300/80">{Math.round(o.clearanceRate * 100)}%</span> },
    { key: 'phone', header: 'Phone', render: (o) => <span className="font-mono text-xs text-steel-300/80">{o.phone}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('page_officer_manage_title')} subtitle={t('page_officer_manage_sub')} />
      <EntityTable
        title="Police Officers" subtitle={`${total} total`}
        addLabel="Add Officer" onAdd={openCreate}
        search={search} onSearch={(s) => { setSearch(s); setPage(1); }} searchPlaceholder="Name, ID, rank, phone…"
        filters={
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setStationFilter(''); setPage(1); }}>
              <option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="input" value={stationFilter} onChange={(e) => { setStationFilter(e.target.value); setPage(1); }}>
              <option value="">All stations</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={rankFilter} onChange={(e) => { setRankFilter(e.target.value); setPage(1); }}>
              <option value="">All ranks</option>{RANKS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        }
        columns={columns} rows={rows} rowKey={(o) => o.id} loading={loading} error={error}
        total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
        sortBy={sortBy} sortDir={sortDir} onSort={onSort}
        actions={(o) => (
          <>
            <button onClick={() => setAssignTarget(o)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-amber-300" title="Assign to Case"><UserCog size={14} /></button>
            <button onClick={() => openEdit(o)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-blue-300" title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(o)} className="rounded p-1 text-steel-300 hover:bg-white/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal
        open={showForm} onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.id}` : 'Add Officer'} wide
        footer={<><button onClick={() => setShowForm(false)} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Rank"><select className="input" value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="District"><select className="input" value={form.districtId} onChange={(e) => onDistrictChange(e.target.value)}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Station" required><select className="input" value={form.stationId} onChange={(e) => setForm((f) => ({ ...f, stationId: e.target.value }))}><option value="">Select station</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Phone" required><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91-XXXXX-XXXXX" /></Field>
          <Field label="Years of Service"><input type="number" min={0} max={45} className="input" value={form.yearsOfService} onChange={(e) => setForm((f) => ({ ...f, yearsOfService: +e.target.value }))} /></Field>
          <Field label="Cases Handled"><input type="number" min={0} className="input" value={form.casesHandled} onChange={(e) => setForm((f) => ({ ...f, casesHandled: +e.target.value }))} /></Field>
          <Field label="Clearance Rate (0-1)"><input type="number" min={0} max={1} step={0.01} className="input" value={form.clearanceRate} onChange={(e) => setForm((f) => ({ ...f, clearanceRate: +e.target.value }))} /></Field>
        </div>
        {formErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formErr}</p>}
      </Modal>

      <Modal
        open={!!assignTarget} onClose={assigning ? () => {} : () => setAssignTarget(null)}
        title={`Assign to Case — ${assignTarget?.name ?? ''}`}
        footer={<><button onClick={() => setAssignTarget(null)} disabled={assigning} className="btn-ghost">Cancel</button>
          <button onClick={confirmAssign} disabled={assigning} className="btn-primary">{assigning ? 'Assigning…' : 'Assign'}</button></>}
      >
        <p className="mb-3 text-sm text-steel-300/80">Assign <span className="text-white">{assignTarget?.rank} {assignTarget?.name}</span> ({assignTarget?.id}) as investigating officer.</p>
        <Field label="Case ID" required><input className="input" value={assignCaseId} onChange={(e) => setAssignCaseId(e.target.value)} placeholder="KSP-00001" /></Field>
        {assignErr && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{assignErr}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.id}?`} message={`Permanently delete officer "${deleting?.name}"? Cases assigned to them will become unassigned. This cannot be undone.`}
        confirmLabel="Delete" danger
      />
    </div>
  );
}
