import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Modal } from './Modal';
import { DISTRICTS, CRIME_TYPES, crimeDefByType } from '../data/catalog';
import { fetchStations, fetchOfficers, createCase, updateCase, type CaseInput } from '../lib/db';
import type { CrimeCase, CrimeCategory, CaseStatus } from '../types';

const STATUSES: CaseStatus[] = ['Open', 'Under Investigation', 'Charge Sheet Filed', 'Closed', 'Pending'];
const TIME_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: CrimeCase | null;
}

export function CaseFormModal({ open, onClose, onSaved, existing }: Props) {
  const [districts] = useState(DISTRICTS);
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [officers, setOfficers] = useState<{ id: string; name: string; rank: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState<CaseInput>(emptyForm());

  function emptyForm(): CaseInput {
    const def = CRIME_TYPES[0];
    return {
      firNumber: '', crimeType: def.type, category: def.category, ipcSections: def.ipc,
      status: 'Open', districtId: DISTRICTS[0].id, stationId: '', officerId: '',
      lat: DISTRICTS[0].lat, lng: DISTRICTS[0].lng,
      date: new Date().toISOString().slice(0, 16),
      timeOfDay: 'Morning', severity: 5, valueLossInr: 0, weaponUsed: null,
      locationType: 'Street', description: '',
    };
  }

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        id: existing.id,
        firNumber: existing.firNumber, crimeType: existing.crimeType, category: existing.category,
        ipcSections: existing.ipcSections, status: existing.status,
        districtId: existing.districtId, stationId: existing.stationId, officerId: existing.officerId,
        lat: existing.lat, lng: existing.lng, date: existing.date.slice(0, 16),
        timeOfDay: existing.timeOfDay, severity: existing.severity, valueLossInr: existing.valueLossInr,
        weaponUsed: existing.weaponUsed, locationType: existing.locationType, description: existing.description,
      });
    } else {
      setForm(emptyForm());
      setErr('');
    }
    // load stations for default district
    void loadStations(DISTRICTS[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  async function loadStations(districtId: string) {
    try {
      const s = await fetchStations(districtId);
      setStations(s.map((x) => ({ id: x.id, name: x.name })));
      const o = await fetchOfficers(undefined, districtId);
      setOfficers(o.map((x) => ({ id: x.id, name: x.name, rank: x.rank })));
    } catch (e) { /* ignore */ }
  }

  function onDistrictChange(districtId: string) {
    const d = districts.find((x) => x.id === districtId);
    setForm((f) => ({ ...f, districtId, stationId: '', officerId: '', lat: d?.lat ?? f.lat, lng: d?.lng ?? f.lng }));
    void loadStations(districtId);
  }

  function onCrimeTypeChange(crimeType: string) {
    const def = crimeDefByType(crimeType);
    setForm((f) => ({ ...f, crimeType, category: def.category, ipcSections: def.ipc, severity: def.baseSeverity }));
  }

  const submit = async () => {
    setErr('');
    if (!form.firNumber.trim()) { setErr('FIR number is required'); return; }
    if (!form.stationId) { setErr('Police station is required'); return; }
    setSaving(true);
    try {
      if (existing) {
        await updateCase(existing.id, form);
      } else {
        await createCase({ ...form, id: `KSP-${Date.now().toString(36).toUpperCase()}` });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={existing ? `Edit Case ${existing.id}` : 'Register New FIR / Case'}
      wide
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {existing ? 'Save Changes' : 'Create Case'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">FIR Number <span className="text-rose-400">*</span></label>
          <input className="input" value={form.firNumber} onChange={(e) => setForm((f) => ({ ...f, firNumber: e.target.value }))} placeholder="e.g. BLR-PS1/2026/00012" />
        </div>
        <div>
          <label className="label">Crime Type</label>
          <select className="input" value={form.crimeType} onChange={(e) => onCrimeTypeChange(e.target.value)}>
            {CRIME_TYPES.map((c) => <option key={c.type} value={c.type}>{c.type}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CrimeCategory }))}>
            {(['Violent','Property','Cyber','Economic','Narcotics','Against Women','Against Children','Public Order'] as CrimeCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">District</label>
          <select className="input" value={form.districtId} onChange={(e) => onDistrictChange(e.target.value)}>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Police Station <span className="text-rose-400">*</span></label>
          <select className="input" value={form.stationId} onChange={(e) => setForm((f) => ({ ...f, stationId: e.target.value }))}>
            <option value="">Select station</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Investigating Officer</label>
          <select className="input" value={form.officerId} onChange={(e) => setForm((f) => ({ ...f, officerId: e.target.value }))}>
            <option value="">Unassigned</option>
            {officers.map((o) => <option key={o.id} value={o.id}>{o.rank} {o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CaseStatus }))}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date & Time</label>
          <input type="datetime-local" className="input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Time of Day</label>
          <select className="input" value={form.timeOfDay} onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value as typeof form.timeOfDay }))}>
            {TIME_OF_DAY.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Severity (1-10)</label>
          <input type="number" min={1} max={10} className="input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: +e.target.value }))} />
        </div>
        <div>
          <label className="label">Value Loss (INR)</label>
          <input type="number" min={0} className="input" value={form.valueLossInr} onChange={(e) => setForm((f) => ({ ...f, valueLossInr: +e.target.value }))} />
        </div>
        <div>
          <label className="label">IPC Sections (comma-separated)</label>
          <input className="input" value={form.ipcSections.join(', ')} onChange={(e) => setForm((f) => ({ ...f, ipcSections: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
        </div>
        <div>
          <label className="label">Location Type</label>
          <select className="input" value={form.locationType} onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value }))}>
            {['Residence','Street','Market','Highway','Bank','Shop','Park','Office','Farm','School Vicinity','Bus Stand','ATM','Temple'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Weapon Used</label>
          <select className="input" value={form.weaponUsed ?? ''} onChange={(e) => setForm((f) => ({ ...f, weaponUsed: e.target.value || null }))}>
            <option value="">None</option>
            {['Knife','Iron Rod','Firearm','Stick','Stone','Blunt Object','Acid','Rope'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Case narrative…" />
        </div>
      </div>
      {err && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</p>}
    </Modal>
  );
}
