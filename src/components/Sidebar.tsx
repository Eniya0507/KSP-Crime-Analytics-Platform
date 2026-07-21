import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Search, MessageSquare, BarChart3, Map, TrendingUp, Share2,
  Clock, FileText, Bell, User, Users, Navigation, Settings, ScrollText,
  Shield, LogOut, ChevronRight, X, Building2, MapPin,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import type { Role } from '../types';

interface NavItem {
  key: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { key: 'dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'search', to: '/search', icon: Search },
  { key: 'chatbot', to: '/chatbot', icon: MessageSquare },
  { key: 'analytics', to: '/analytics', icon: BarChart3 },
  { key: 'heatmap', to: '/heatmap', icon: Map },
  { key: 'forecast', to: '/forecast', icon: TrendingUp },
  { key: 'network', to: '/network', icon: Share2 },
  { key: 'timeline', to: '/timeline', icon: Clock },
  { key: 'reports', to: '/reports', icon: FileText },
  { key: 'alerts', to: '/alerts', icon: Bell },
  { key: 'accused', to: '/accused', icon: User },
  { key: 'victim', to: '/victim', icon: Users },
  { key: 'patrol', to: '/patrol', icon: Navigation },
  { key: 'audit', to: '/audit', icon: ScrollText, roles: ['Admin', 'Supervisor'] },
  { key: 'settings', to: '/settings', icon: Settings },
  { key: 'accused_manage', to: '/manage/accused', icon: User },
  { key: 'victim_manage', to: '/manage/victims', icon: Users },
  { key: 'officer_manage', to: '/manage/officers', icon: Shield },
  { key: 'station_manage', to: '/manage/stations', icon: Building2 },
  { key: 'district_manage', to: '/manage/districts', icon: MapPin },
];

const NAV_GROUPS: { titleKey: string; keys: string[] }[] = [
  { titleKey: 'group_overview', keys: ['dashboard', 'search', 'chatbot'] },
  { titleKey: 'group_intelligence', keys: ['analytics', 'heatmap', 'forecast', 'network', 'timeline'] },
  { titleKey: 'group_operations', keys: ['reports', 'alerts', 'accused', 'victim', 'patrol'] },
  { titleKey: 'group_administration', keys: ['audit', 'settings', 'accused_manage', 'victim_manage', 'officer_manage', 'station_manage', 'district_manage'] },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, hasAccess, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/5 bg-ink-900/95 backdrop-blur-md transition-transform duration-300 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-steel-600 to-steel-800 shadow-glow">
            <Shield size={20} className="text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900 animate-pulseDot" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{t('brand')}</p>
            <p className="truncate text-[11px] text-steel-300/70">{t('brandSub')}</p>
          </div>
          <button onClick={onClose} className="text-steel-300/60 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((g) => {
            const items = NAV.filter((n) => g.keys.includes(n.key) && hasAccess(n.key));
            if (!items.length) return null;
            return (
              <div key={g.titleKey}>
                <p className="section-title mb-2 px-3">{t(g.titleKey)}</p>
                <div className="space-y-0.5">
                  {items.map((n) => (
                    <NavLink
                      key={n.key}
                      to={n.to}
                      onClick={onClose}
                      className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                    >
                      <n.icon size={16} className="shrink-0" />
                      <span className="truncate">{t(`nav_${n.key}`)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: user?.avatarColor ?? '#3b82f6' }}>
              {user?.name.split(' ').map((s) => s[0]).slice(0, 2).join('') ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-steel-300/70">{user?.rank} · {user?.role}</p>
            </div>
            <button onClick={handleLogout} title={t('logout')} className="rounded-lg p-1.5 text-steel-300/70 hover:bg-white/10 hover:text-rose-300">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export { NAV, NAV_GROUPS };
export const NAV_KEYS = NAV.map((n) => n.key);
export function ChevronLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className="inline-flex items-center gap-1 text-xs text-steel-300 hover:text-white">
      {label} <ChevronRight size={12} />
    </NavLink>
  );
}
