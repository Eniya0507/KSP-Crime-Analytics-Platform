import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role, AuditEntry, Alert } from '../types';
import { allAlerts } from '../data/generator';

// ---- Pre-seeded demo users (one per role) for the Datathon ----
export const DEMO_USERS: (User & { password: string })[] = [
  {
    id: 'U-ADMIN', name: 'Dr. K. Subramanya', email: 'admin@ksp.gov.in', password: 'admin123',
    role: 'Admin', rank: 'Director General', stationId: 'BLR-PS1', districtId: 'BLR',
    avatarColor: '#3b82f6',
  },
  {
    id: 'U-SUP', name: 'Meera Nair', email: 'supervisor@ksp.gov.in', password: 'super123',
    role: 'Supervisor', rank: 'SP', stationId: 'MYS-PS1', districtId: 'MYS',
    avatarColor: '#22d3ee',
  },
  {
    id: 'U-INV', name: 'Arjun Reddy', email: 'investigator@ksp.gov.in', password: 'invest123',
    role: 'Investigator', rank: 'Inspector', stationId: 'BLR-PS2', districtId: 'BLR',
    avatarColor: '#f59e0b',
  },
  {
    id: 'U-ANA', name: 'Sneha Hegde', email: 'analyst@ksp.gov.in', password: 'analyst123',
    role: 'Analyst', rank: 'DySP', stationId: 'DWD-PS1', districtId: 'DWD',
    avatarColor: '#10b981',
  },
];

// Role-based navigation access
export const ROLE_NAV: Record<Role, string[]> = {
  Admin: ['dashboard', 'search', 'chatbot', 'analytics', 'heatmap', 'forecast', 'network', 'timeline', 'reports', 'alerts', 'accused', 'victim', 'patrol', 'audit', 'settings', 'accused_manage', 'victim_manage', 'officer_manage', 'station_manage', 'district_manage'],
  Supervisor: ['dashboard', 'search', 'chatbot', 'analytics', 'heatmap', 'forecast', 'network', 'timeline', 'reports', 'alerts', 'accused', 'victim', 'patrol', 'audit', 'settings', 'accused_manage', 'victim_manage', 'officer_manage', 'station_manage', 'district_manage'],
  Investigator: ['dashboard', 'search', 'chatbot', 'heatmap', 'network', 'timeline', 'reports', 'alerts', 'accused', 'victim', 'patrol', 'settings', 'accused_manage', 'victim_manage'],
  Analyst: ['dashboard', 'search', 'chatbot', 'analytics', 'heatmap', 'forecast', 'network', 'reports', 'alerts', 'accused', 'victim', 'patrol', 'settings'],
};

interface AuthState {
  user: User | null;
  loginAt: string | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  hasAccess: (key: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loginAt: null,
      login: (email, password) => {
        const u = DEMO_USERS.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
        if (!u) return { ok: false, error: 'Invalid credentials. Use a demo account below.' };
        const { password: _pw, ...safe } = u;
        set({ user: safe, loginAt: new Date().toISOString() });
        addAudit({ userId: u.id, userName: u.name, action: 'Login', category: 'Login', detail: `Role: ${u.role}` });
        return { ok: true };
      },
      logout: () => {
        const u = get().user;
        if (u) addAudit({ userId: u.id, userName: u.name, action: 'Logout', category: 'Login', detail: 'Session ended' });
        set({ user: null, loginAt: null });
      },
      hasAccess: (key) => {
        const u = get().user;
        if (!u) return false;
        return ROLE_NAV[u.role].includes(key);
      },
    }),
    { name: 'ksp-auth' },
  ),
);

// ---- Audit log store ----
interface AuditState {
  entries: AuditEntry[];
  add: (e: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) =>
        set((s) => ({
          entries: [
            { ...e, id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() },
            ...s.entries,
          ].slice(0, 500),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'ksp-audit' },
  ),
);

export function addAudit(e: Omit<AuditEntry, 'id' | 'timestamp'>) {
  useAuditStore.getState().add(e);
}

// ---- Alert store (from synthetic data, dismissible) ----
interface AlertState {
  alerts: Alert[];
  dismissed: string[];
  dismiss: (id: string) => void;
  restore: () => void;
}
export const useAlertStore = create<AlertState>((set) => ({
  alerts: allAlerts(),
  dismissed: [],
  dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),
  restore: () => set({ dismissed: [] }),
}));

export const visibleAlerts = (s: AlertState): Alert[] => s.alerts.filter((a) => !s.dismissed.includes(a.id));
