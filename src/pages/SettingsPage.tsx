import { useState, useEffect } from 'react';
import { User, Globe, Bell, Shield, Database, Server, Download, Trash2 } from 'lucide-react';
import { PageHeader, Card } from '../components/ui';
import { useAuthStore, useAuditStore, DEMO_USERS, ROLE_NAV } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useI18n } from '../i18n';
import { DISTRICTS } from '../data/catalog';
import { getCatalystConfig, saveCatalystConfig, executeFunction, zcql } from '../lib/catalyst';
import { seedDatabase } from '../lib/seed';
import { reloadLiveCache } from '../lib/db';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { clear: clearAudit } = useAuditStore();
  const { lang: chatLang, setLang: setChatLang, voiceEnabled, toggleVoice, clear: clearChat } = useChatStore();
  const { lang, setLang, t } = useI18n();

  // Keep chat language in sync with global language
  useEffect(() => {
    if (chatLang !== lang) setChatLang(lang);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const [notifAlerts, setNotifAlerts] = useState(true);
  const [notifForecast, setNotifForecast] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'darker'>('dark');

  const [projId, setProjId] = useState(() => getCatalystConfig().projectId);
  const [oauthToken, setOauthToken] = useState(() => getCatalystConfig().token);
  const [configMsg, setConfigMsg] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult] = useState('');

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projId.trim() || !oauthToken.trim()) {
      setConfigMsg('Both Project ID and OAuth Token are required.');
      return;
    }
    const current = getCatalystConfig();
    saveCatalystConfig({
      projectId: projId.trim(),
      token: oauthToken.trim(),
      tables: current.tables
    });
    setConfigMsg(t('settings_savedReloading'));
    try {
      await reloadLiveCache();
      setConfigMsg(t('settings_connected'));
    } catch (err: any) {
      setConfigMsg(`✗ Reload failed: ${err.message || err}`);
    }
  };

  const testConnection = async () => {
    if (!projId.trim() || !oauthToken.trim()) {
      setConfigMsg('Please enter both Project ID and OAuth Token first.');
      return;
    }
    setConfigMsg(t('settings_testing'));
    try {
      const res = await zcql('SELECT ROWID FROM districts LIMIT 1');
      setConfigMsg(`${t('settings_connSuccess')} ${res.length} ${t('settings_districtRecords')}`);
    } catch (err: any) {
      setConfigMsg(`${t('settings_connFailed')} ${err.message || err}`);
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedProgress('Starting seed process...');
    try {
      const res = await seedDatabase((msg) => {
        setSeedProgress((prev) => prev + '\n' + msg);
      });
      setSeedProgress((prev) => prev + `\nDone! Seeded: ${res.districts} districts, ${res.stations} stations, ${res.officers} officers, ${res.cases} cases, ${res.accused} accused, ${res.victims} victims, ${res.alerts} alerts.`);
      await reloadLiveCache();
    } catch (err: any) {
      setSeedProgress((prev) => prev + `\nError: ${err.message || err}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleTriggerCron = async () => {
    if (cronLoading) return;
    setCronLoading(true);
    setCronResult('Triggering Alerts Cron...');
    try {
      const res = await executeFunction<any>('ksp-alerts-cron', {});
      setCronResult(`Success! Function output:\n${JSON.stringify(res, null, 2)}`);
      await reloadLiveCache();
    } catch (err: any) {
      setCronResult(`Error: ${err.message || err}`);
    } finally {
      setCronLoading(false);
    }
  };

  const accessibleNav = user ? ROLE_NAV[user.role] : [];

  return (
    <div>
      <PageHeader title={t('page_settings_title')} subtitle={t('page_settings_sub')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('settings_account')} subtitle={t('settings_accountSub')}>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-semibold text-white" style={{ background: user?.avatarColor ?? '#3b82f6' }}>
              {user?.name.split(' ').map((s) => s[0]).slice(0, 2).join('') ?? 'U'}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-steel-300/70">{user?.email}</p>
              <p className="text-xs text-steel-300/70">{user?.rank} · {user?.role}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Row label={t('district')} value={DISTRICTS.find((d) => d.id === user?.districtId)?.name ?? '—'} />
            <Row label={t('station')} value={user?.stationId ?? '—'} />
            <Row label={t('role')} value={user?.role ?? '—'} />
            <Row label={t('userId')} value={user?.id ?? '—'} />
          </div>
        </Card>

        <Card title={t('settings_langVoice')} subtitle={t('settings_langVoiceSub')}>
          <div className="space-y-4">
            <div>
              <p className="label">{t('language')}</p>
              <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-1">
                <button onClick={() => setLang('en')} className={`rounded-md px-4 py-1.5 text-sm ${lang === 'en' ? 'bg-steel-600 text-white' : 'text-steel-300'}`}><Globe size={14} className="inline mr-1" /> {t('english')}</button>
                <button onClick={() => setLang('kn')} className={`rounded-md px-4 py-1.5 text-sm ${lang === 'kn' ? 'bg-steel-600 text-white' : 'text-steel-300'}`}>{t('kannada')}</button>
              </div>
            </div>
            <Toggle label={t('settings_voiceOutput')} desc={t('settings_voiceOutputDesc')} on={voiceEnabled} onToggle={toggleVoice} icon={<Bell size={15} />} />
          </div>
        </Card>

        <Card title={t('settings_notifications')} subtitle={t('settings_notificationsSub')}>
          <div className="space-y-4">
            <Toggle label={t('settings_criticalAlerts')} desc={t('settings_criticalAlertsDesc')} on={notifAlerts} onToggle={() => setNotifAlerts((v) => !v)} icon={<Bell size={15} />} />
            <Toggle label={t('settings_forecastSpikes')} desc={t('settings_forecastSpikesDesc')} on={notifForecast} onToggle={() => setNotifForecast((v) => !v)} icon={<Bell size={15} />} />
          </div>
        </Card>

        <Card title={t('settings_appearance')} subtitle={t('settings_appearanceSub')}>
          <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-1">
            <button onClick={() => setTheme('dark')} className={`rounded-md px-4 py-1.5 text-sm ${theme === 'dark' ? 'bg-steel-600 text-white' : 'text-steel-300'}`}>{t('settings_dark')}</button>
            <button onClick={() => setTheme('darker')} className={`rounded-md px-4 py-1.5 text-sm ${theme === 'darker' ? 'bg-steel-600 text-white' : 'text-steel-300'}`}>{t('settings_darker')}</button>
          </div>
        </Card>

        <Card title={t('settings_catalyst')} subtitle={t('settings_catalystSub')}>
          <form onSubmit={handleSaveConfig} className="space-y-3">
            <div>
              <label className="label">{t('settings_projectId')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('settings_projectIdPlaceholder')}
                value={projId}
                onChange={(e) => setProjId(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('settings_oauthToken')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('settings_oauthTokenPlaceholder')}
                value={oauthToken}
                onChange={(e) => setOauthToken(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary py-1.5 text-xs">{t('settings_saveConfig')}</button>
              <button
                type="button"
                onClick={testConnection}
                className="btn-outline py-1.5 text-xs"
              >
                {t('settings_testConn')}
              </button>
            </div>
            {configMsg && (
              <p className={`text-xs ${configMsg.includes('failed') || configMsg.includes('failed:') ? 'text-rose-300' : 'text-emerald-300'}`}>
                {configMsg}
              </p>
            )}
          </form>

          <div className="mt-6 border-t border-white/5 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-steel-300/70">{t('settings_dataStoreActions')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="btn-outline justify-center text-xs"
              >
                {seeding ? t('settings_seeding') : t('settings_seedCatalyst')}
              </button>
              {seedProgress && (
                <pre className="rounded-lg bg-ink-900/60 p-2.5 font-mono text-[10px] text-steel-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {seedProgress}
                </pre>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-steel-300/70">{t('settings_catalystFunctions')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTriggerCron}
                disabled={cronLoading}
                className="btn-outline justify-center text-xs"
              >
                {cronLoading ? t('settings_triggering') : t('settings_triggerCron')}
              </button>
              {cronResult && (
                <pre className="rounded-lg bg-ink-900/60 p-2.5 font-mono text-[10px] text-steel-200 whitespace-pre-wrap">
                  {cronResult}
                </pre>
              )}
            </div>
          </div>
        </Card>

        <Card title={t('settings_rbac')} subtitle={t('settings_rbacSub')}>
          <div className="flex flex-wrap gap-1.5">
            {accessibleNav.map((n) => <span key={n} className="chip bg-steel-600/15 text-steel-200">{n}</span>)}
          </div>
          <div className="mt-4">
            <p className="section-title mb-2">{t('settings_demoAccounts')}</p>
            <div className="space-y-1.5">
              {DEMO_USERS.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md bg-white/[0.03] px-3 py-1.5 text-xs">
                  <span className="text-steel-200">{u.role}</span>
                  <span className="font-mono text-steel-300/70">{u.email}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t('settings_dataManagement')} subtitle={t('settings_dataManagementSub')}>
          <div className="space-y-2">
            <button onClick={clearChat} className="btn-outline w-full justify-start"><Trash2 size={14} /> {t('settings_clearChat')}</button>
            <button onClick={() => { if (confirm(t('audit_clearConfirm'))) clearAudit(); }} className="btn-outline w-full justify-start"><Trash2 size={14} /> {t('settings_clearAudit')}</button>
            <button onClick={() => { localStorage.clear(); logout(); }} className="btn-outline w-full justify-start text-rose-300 hover:text-rose-200"><Download size={14} /> {t('settings_resetAll')}</button>
          </div>
        </Card>

        <Card title={t('settings_about')} subtitle={t('settings_aboutSub')}>
          <div className="space-y-2 text-xs text-steel-300/80">
            <p><span className="text-steel-400">{t('settings_platform')}:</span> KSP Crime Intelligence & Analytics</p>
            <p><span className="text-steel-400">{t('settings_builtFor')}:</span> Karnataka State Police Datathon 2026</p>
            <p><span className="text-steel-400">{t('settings_dataset')}:</span> 1,000 cases · 2,500 accused · 1,500 victims · 500 officers · 150 stations · 31 districts</p>
            <p><span className="text-steel-400">{t('settings_ai')}:</span> Llama 3.1 8B + RAG (FAISS, BAAI/bge-m3) · XGBoost · SHAP · Whisper · IndicTrans2</p>
            <p><span className="text-steel-400">{t('settings_backend')}:</span> FastAPI · Zoho Catalyst (Data Store, AppSail, Functions, QuickML, SmartBrowz)</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-steel-300/60">{label}</p>
      <p className="text-sm text-steel-100">{value}</p>
    </div>
  );
}

function Toggle({ label, desc, on, onToggle, icon }: { label: string; desc: string; on: boolean; onToggle: () => void; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-steel-400">{icon}</span>
        <div>
          <p className="text-sm text-white">{label}</p>
          <p className="text-xs text-steel-300/70">{desc}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-steel-600' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
