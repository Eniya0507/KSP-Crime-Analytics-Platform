import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronDown, Languages } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useAlertStore, visibleAlerts } from '../store/auth';
import { useShallow } from 'zustand/react/shallow';
import { DISTRICTS } from '../data/catalog';
import { addAudit } from '../store/auth';
import { useI18n } from '../i18n';
import { LANG_SHORT } from '../i18n/translations';

const ROUTE_KEY: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/search': 'search',
  '/chatbot': 'chatbot',
  '/analytics': 'analytics',
  '/heatmap': 'heatmap',
  '/forecast': 'forecast',
  '/network': 'network',
  '/timeline': 'timeline',
  '/reports': 'reports',
  '/alerts': 'alerts',
  '/accused': 'accused',
  '/victim': 'victim',
  '/patrol': 'patrol',
  '/audit': 'audit',
  '/settings': 'settings',
  '/manage/accused': 'accused_manage',
  '/manage/victims': 'victim_manage',
  '/manage/officers': 'officer_manage',
  '/manage/stations': 'station_manage',
  '/manage/districts': 'district_manage',
};

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const alerts = useAlertStore(useShallow(visibleAlerts));
  const { lang, toggle, t } = useI18n();
  const [showAlerts, setShowAlerts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const alertRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) setShowAlerts(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const routeKey = ROUTE_KEY[pathname] ?? 'dashboard';
  const title = t(`page_${routeKey}_title`);
  const sub = t(`page_${routeKey}_sub`);

  const onQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Quick search', category: 'Case Access', detail: quickSearch });
    navigate(`/search?q=${encodeURIComponent(quickSearch)}`);
    setQuickSearch('');
  };

  const criticalCount = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high').length;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-ink-900/80 px-4 backdrop-blur-md sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-steel-300 hover:bg-white/5 lg:hidden">
        <Menu size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h2>
        <p className="hidden truncate text-xs text-steel-300/70 sm:block">{sub}</p>
      </div>

      {/* Quick search */}
      <form onSubmit={onQuickSearch} className="hidden items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 md:flex">
        <Search size={14} className="text-steel-300/60" />
        <input
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          placeholder={t('quickSearch')}
          className="w-48 bg-transparent text-sm text-steel-50 placeholder:text-steel-300/40 outline-none"
        />
      </form>

      {/* Language toggle */}
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-1.5 text-xs text-steel-200 transition hover:border-steel-500/40 hover:bg-white/5"
        title={t('language')}
      >
        <Languages size={13} /> {LANG_SHORT[lang]}
      </button>

      {/* Alerts dropdown */}
      <div className="relative" ref={alertRef}>
        <button onClick={() => setShowAlerts((v) => !v)} className="relative rounded-lg p-2 text-steel-300 hover:bg-white/5">
          <Bell size={18} />
          {criticalCount > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {criticalCount}
            </span>
          )}
        </button>
        {showAlerts && (
          <div className="absolute right-0 top-12 z-30 w-80 rounded-xl border border-white/10 bg-ink-850 p-2 shadow-card">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-steel-300/70">{t('activeAlerts')} ({alerts.length})</p>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {alerts.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { navigate('/alerts'); setShowAlerts(false); }}
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${a.severity === 'critical' ? 'bg-rose-500' : a.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                    <p className="truncate text-xs font-medium text-white">{a.title}</p>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-steel-300/70">{a.message}</p>
                </button>
              ))}
              {alerts.length === 0 && <p className="px-3 py-4 text-center text-xs text-steel-300/60">{t('noAlerts')}</p>}
            </div>
            <button onClick={() => { navigate('/alerts'); setShowAlerts(false); }} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-steel-200 hover:bg-white/10">
              {t('viewAllAlerts')}
            </button>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button onClick={() => setShowProfile((v) => !v)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-white/5">
          <div className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: user?.avatarColor ?? '#3b82f6' }}>
            {user?.name.split(' ').map((s) => s[0]).slice(0, 2).join('') ?? 'U'}
          </div>
          <ChevronDown size={14} className="text-steel-300/60" />
        </button>
        {showProfile && (
          <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-white/10 bg-ink-850 p-3 shadow-card">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: user?.avatarColor ?? '#3b82f6' }}>
                {user?.name.split(' ').map((s) => s[0]).slice(0, 2).join('') ?? 'U'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-[11px] text-steel-300/70">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-1 py-2 text-xs">
              <div className="flex justify-between"><span className="text-steel-300/70">{t('role')}</span><span className="text-steel-100">{user?.role}</span></div>
              <div className="flex justify-between"><span className="text-steel-300/70">{t('rank')}</span><span className="text-steel-100">{user?.rank}</span></div>
              <div className="flex justify-between"><span className="text-steel-300/70">{t('district')}</span><span className="text-steel-100">{DISTRICTS.find((d) => d.id === user?.districtId)?.name ?? '—'}</span></div>
            </div>
            <button onClick={() => { navigate('/settings'); setShowProfile(false); }} className="w-full rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-steel-200 hover:bg-white/10">
              {t('settings')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

