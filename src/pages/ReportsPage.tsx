import { useState } from 'react';
import { FileText, Download, FileBarChart, MessageSquare, FileSearch, ScrollText, Zap } from 'lucide-react';
import { PageHeader, Card, Banner } from '../components/ui';
import { useI18n } from '../i18n';
import {
  exportDashboardPdf, exportAnalyticsPdf, exportConversationPdf, exportAuditPdf, exportCasePdf, exportInvestigationPdf,
  exportDashboardSmartBrowz, exportAnalyticsSmartBrowz, exportInvestigationSmartBrowz,
} from '../ai/reports';
import { useChatStore } from '../store/chat';
import { useAuditStore, useAuthStore, addAudit } from '../store/auth';
import { allCases } from '../data/generator';

export default function ReportsPage() {
  const { t } = useI18n();
  const { messages } = useChatStore();
  const { entries } = useAuditStore();
  const { user } = useAuthStore();
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [caseId, setCaseId] = useState('');
  const [useSmartBrowz, setUseSmartBrowz] = useState(false);
  const [_sbWorking, setSbWorking] = useState<boolean | null>(null);

  const logAndRun = (name: string, fn: () => void) => {
    fn();
    setLastGenerated(name);
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Generated ${name}`, category: 'Report', detail: 'PDF export via print' });
  };

  const logAndRunAsync = (name: string, fn: () => Promise<void>) => {
    fn().then(() => {
      setLastGenerated(name);
      addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Generated ${name}`, category: 'Report', detail: 'PDF via SmartBrowz / print fallback' });
    }).catch(() => {
      setLastGenerated(name + ' (fallback)');
    });
  };

  const reports = [
    {
      icon: <FileBarChart size={20} />,
      title: t('reports_dashboard'),
      desc: t('reports_dashboardDesc'),
      action: () => useSmartBrowz
        ? logAndRunAsync('Dashboard PDF', exportDashboardSmartBrowz)
        : logAndRun('Dashboard PDF', exportDashboardPdf),
      color: 'text-blue-300 bg-blue-500/10',
    },
    {
      icon: <FileSearch size={20} />,
      title: t('reports_analytics'),
      desc: t('reports_analyticsDesc'),
      action: () => useSmartBrowz
        ? logAndRunAsync('Analytics PDF', exportAnalyticsSmartBrowz)
        : logAndRun('Analytics PDF', exportAnalyticsPdf),
      color: 'text-cyan-300 bg-cyan-500/10',
    },
    {
      icon: <FileText size={20} />,
      title: t('reports_investigation'),
      desc: t('reports_investigationDesc'),
      action: () => {
        if (!caseId) { alert('Enter a Case ID in the field below first'); return; }
        useSmartBrowz
          ? logAndRunAsync(`Investigation ${caseId} PDF`, () => exportInvestigationSmartBrowz(caseId))
          : logAndRun(`Investigation ${caseId} PDF`, () => exportInvestigationPdf(caseId));
      },
      disabled: !caseId,
      color: 'text-emerald-300 bg-emerald-500/10',
    },
    {
      icon: <MessageSquare size={20} />,
      title: t('reports_conversation'),
      desc: `${messages.length} ${t('reports_conversationDesc')}`,
      action: () => logAndRun('Conversation PDF', () => exportConversationPdf(messages)),
      disabled: messages.length === 0,
      color: 'text-purple-300 bg-purple-500/10',
    },
    {
      icon: <ScrollText size={20} />,
      title: t('reports_audit'),
      desc: `${entries.length} ${t('reports_auditDesc')}`,
      action: () => logAndRun('Audit PDF', () => exportAuditPdf(entries)),
      disabled: entries.length === 0,
      color: 'text-amber-300 bg-amber-500/10',
    },
  ];

  return (
    <div className="flex flex-1 flex-col space-y-3">
      <PageHeader
        title={t('page_reports_title')}
        subtitle={t('page_reports_sub')}
        action={<span className="text-xs text-steel-300/70 font-mono">{allCases().length} {t('reports_available')}</span>}
      />

      {lastGenerated && (
        <div className="mb-2">
          <Banner kind="success">{t('reports_opened')}</Banner>
        </div>
      )}

      {/* SmartBrowz toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-300">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{t('reports_smartbrowz')}</p>
            <p className="text-[11px] text-steel-300/70">
              {useSmartBrowz ? t('reports_smartbrowzOn') : t('reports_smartbrowzOff')}
            </p>
          </div>
        </div>
        <button
          id="smartbrowz-toggle"
          onClick={() => { setUseSmartBrowz((v) => !v); setSbWorking(null); }}
          className={`relative h-6 w-11 rounded-full transition ${useSmartBrowz ? 'bg-violet-600' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${useSmartBrowz ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.title} className="card-hover flex flex-col justify-between">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${r.color}`}>{r.icon}</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-white">{r.title}</h3>
                <p className="mt-1 text-[11px] text-steel-300/80 leading-relaxed">{r.desc}</p>
              </div>
            </div>
            <button onClick={r.action} disabled={r.disabled} className="btn-primary mt-3 text-xs py-1.5 justify-center w-full">
              <Download size={13} /> {t('reports_generatePdf')}
            </button>
          </Card>
        ))}
      </div>

      {/* Case-specific reports section */}
      <Card title={t('reports_caseSpecific')} subtitle={t('reports_caseSpecificSub')} className="mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="label text-xs">{t('reports_caseId')}</label>
            <input
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder={t('reports_caseIdPlaceholder')}
              className="input text-xs py-1.5"
            />
          </div>
          <div className="flex items-center gap-2 pt-4 sm:pt-0">
            <button
              onClick={() => {
                if (!caseId.trim()) return;
                logAndRun(`Case ${caseId} PDF`, () => exportCasePdf(caseId.trim()));
              }}
              disabled={!caseId.trim()}
              className="btn-outline text-xs py-1.5"
            >
              <Download size={13} /> {t('reports_casePdf')}
            </button>
            <button
              onClick={() => {
                if (!caseId.trim()) return;
                useSmartBrowz
                  ? logAndRunAsync(`Investigation ${caseId} PDF`, () => exportInvestigationSmartBrowz(caseId.trim()))
                  : logAndRun(`Investigation ${caseId} PDF`, () => exportInvestigationPdf(caseId.trim()));
              }}
              disabled={!caseId.trim()}
              className="btn-primary text-xs py-1.5"
            >
              <Download size={13} /> {t('reports_investigationPdf')}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-steel-300/60">{t('reports_tipCaseId')}</p>
      </Card>
    </div>
  );
}
