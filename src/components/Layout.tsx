import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-bg flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 px-3 py-3 sm:px-5 lg:px-6 flex flex-col min-h-0">
          <div key={pathname} className="animate-fadeIn flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-white/5 px-6 py-2.5 text-center text-[11px] text-steel-300/50 shrink-0">
          {t('footer')} · {t('role')}: {user?.name ?? t('guest')}
        </footer>
      </div>
    </div>
  );
}
