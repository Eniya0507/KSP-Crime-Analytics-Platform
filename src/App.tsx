import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuthStore } from './store/auth';
import CatalystGate from './components/CatalystGate';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ChatbotPage from './pages/ChatbotPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HeatmapPage from './pages/HeatmapPage';
import ForecastPage from './pages/ForecastPage';
import NetworkPage from './pages/NetworkPage';
import TimelinePage from './pages/TimelinePage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import AccusedPage from './pages/AccusedPage';
import VictimPage from './pages/VictimPage';
import PatrolPage from './pages/PatrolPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import AccusedManagePage from './pages/manage/AccusedManagePage';
import VictimManagePage from './pages/manage/VictimManagePage';
import OfficerManagePage from './pages/manage/OfficerManagePage';
import StationManagePage from './pages/manage/StationManagePage';
import DistrictManagePage from './pages/manage/DistrictManagePage';

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    // CatalystGate verifies credentials + loads live data before rendering anything.
    // If credentials are missing or invalid it shows the setup screen instead.
    <CatalystGate>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"       element={<DashboardPage />} />
            <Route path="search"          element={<SearchPage />} />
            <Route path="case/:id"        element={<CaseDetailPage />} />
            <Route path="chatbot"         element={<ChatbotPage />} />
            <Route path="analytics"       element={<AnalyticsPage />} />
            <Route path="heatmap"         element={<HeatmapPage />} />
            <Route path="forecast"        element={<ForecastPage />} />
            <Route path="network"         element={<NetworkPage />} />
            <Route path="timeline"        element={<TimelinePage />} />
            <Route path="reports"         element={<ReportsPage />} />
            <Route path="alerts"          element={<AlertsPage />} />
            <Route path="accused"         element={<AccusedPage />} />
            <Route path="victim"          element={<VictimPage />} />
            <Route path="patrol"          element={<PatrolPage />} />
            <Route path="audit"           element={<AuditPage />} />
            <Route path="settings"        element={<SettingsPage />} />
            <Route path="manage/accused"  element={<AccusedManagePage />} />
            <Route path="manage/victims"  element={<VictimManagePage />} />
            <Route path="manage/officers" element={<OfficerManagePage />} />
            <Route path="manage/stations" element={<StationManagePage />} />
            <Route path="manage/districts" element={<DistrictManagePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </CatalystGate>
  );
}
