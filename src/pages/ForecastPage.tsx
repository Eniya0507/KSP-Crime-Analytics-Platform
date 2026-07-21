import { useMemo, useState, useEffect } from 'react';
import { Download, TrendingUp, Brain, Gauge } from 'lucide-react';
import { PageHeader, Card, Banner } from '../components/ui';
import { useI18n } from '../i18n';
import { ForecastArea, BarChartX } from '../components/charts';
import { forecastOverall, forecastByDistrict, forecastByCrimeType } from '../ai/forecast';
import { DISTRICTS, CRIME_TYPES } from '../data/catalog';
import { addAudit, useAuthStore } from '../store/auth';
import { executeFunction, getCatalystConfig } from '../lib/catalyst';

type Mode = 'overall' | 'district' | 'crimeType';

export default function ForecastPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [mode, setMode] = useState<Mode>('overall');
  const [districtId, setDistrictId] = useState('BLR');
  const [crimeType, setCrimeType] = useState('Theft');
  const [horizon, setHorizon] = useState(6);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(() => forecastOverall(horizon));

  useEffect(() => {
    let active = true;
    const fetchForecast = async () => {
      const config = getCatalystConfig();
      if (!config.projectId || !config.token) {
        const res =
          mode === 'district' ? forecastByDistrict(districtId, horizon) :
          mode === 'crimeType' ? forecastByCrimeType(crimeType, horizon) :
          forecastOverall(horizon);
        setResult(res);
        return;
      }

      setLoading(true);
      try {
        const res = await executeFunction<any>('ksp-forecast', {
          mode,
          districtId: mode === 'district' ? districtId : undefined,
          crimeType: mode === 'crimeType' ? crimeType : undefined,
          horizon
        });
        if (active && res && res.series) {
          setResult(res);
        }
      } catch (err) {
        console.warn('[KSP] Catalyst forecast function failed, falling back to local decomposition:', err);
        if (active) {
          const res =
            mode === 'district' ? forecastByDistrict(districtId, horizon) :
            mode === 'crimeType' ? forecastByCrimeType(crimeType, horizon) :
            forecastOverall(horizon);
          setResult(res);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchForecast();
    return () => { active = false; };
  }, [mode, districtId, crimeType, horizon]);

  const futureOnly = useMemo(() => result.series.filter((p: any) => p.actual === null), [result]);
  const totalForecast = futureOnly.reduce((s: number, p: any) => s + p.forecast, 0);

  // Breakdown of forecast by crime type (approx share)
  const typeShare = useMemo(() => {
    return CRIME_TYPES.slice(0, 8).map((c, i) => ({
      name: c.type,
      count: Math.round((totalForecast / 8) * (1 + (Math.sin(i) * 0.4))),
    })).sort((a, b) => b.count - a.count);
  }, [totalForecast]);

  const logAudit = () => addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `Forecast query (${mode})`, category: 'Prediction', detail: result.summary });

  return (
    <div>
      <PageHeader
        title={t('page_forecast_title')}
        subtitle={t('page_forecast_sub')}
        action={<button onClick={() => { logAudit(); window.print(); }} className="btn-primary"><Download size={15} /> {t('forecast_save')}</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/10 bg-ink-900/60 p-1">
          {(['overall', 'district', 'crimeType'] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === m ? 'bg-steel-600 text-white' : 'text-steel-300 hover:text-white'}`}>
              {m === 'overall' ? t('forecast_overall') : m === 'district' ? t('forecast_byDistrict') : t('forecast_byCrimeType')}
            </button>
          ))}
        </div>
        {mode === 'district' && (
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="input w-auto">
            {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {mode === 'crimeType' && (
          <select value={crimeType} onChange={(e) => setCrimeType(e.target.value)} className="input w-auto">
            {CRIME_TYPES.map((c) => <option key={c.type} value={c.type}>{c.type}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2 text-xs text-steel-300/80">
          <span>{t('forecast_horizon')}</span>
          <select value={horizon} onChange={(e) => setHorizon(+e.target.value)} className="input w-auto py-1.5">
            {[3, 6, 9, 12].map((h) => <option key={h} value={h}>{h} {t('forecast_months')}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="text-xs text-steel-300/70">{t('forecast_projected')} ({horizon}mo)</div><div className="mt-1 stat-num text-2xl text-white">{totalForecast}</div></Card>
        <Card><div className="text-xs text-steel-300/70">{t('forecast_model')}</div><div className="mt-1 text-sm font-medium text-white">STL + Linear Trend</div></Card>
        <Card><div className="text-xs text-steel-300/70">{t('forecast_mape')}</div><div className="mt-1 stat-num text-2xl text-emerald-300">{result.modelMetrics.mape}%</div></Card>
        <Card><div className="text-xs text-steel-300/70">{t('forecast_rmse')}</div><div className="mt-1 stat-num text-2xl text-amber-300">{result.modelMetrics.rmse}</div></Card>
      </div>

      <Card title={t('forecast_series')} subtitle={result.method} className="mt-4">
        <ForecastArea data={result.series} height={380} />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-steel-300/80">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-cyan-400" /> {t('forecast_actual')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-steel-500" /> {t('forecast_forecast')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 bg-steel-600/30" /> {t('forecast_confidence')}</span>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={t('forecast_performance')} subtitle={t('forecast_performanceSub')} className="lg:col-span-1">
          <div className="space-y-3">
            <Metric icon={<Gauge size={16} />} label={t('forecast_mape')} value={`${result.modelMetrics.mape}%`} good={result.modelMetrics.mape < 15} />
            <Metric icon={<TrendingUp size={16} />} label={t('forecast_rmse')} value={String(result.modelMetrics.rmse)} good={result.modelMetrics.rmse < 10} />
            <Metric icon={<Brain size={16} />} label={t('forecast_method')} value="STL Decomp." good />
            <div className="rounded-lg border border-white/5 bg-ink-900/40 p-3 text-xs text-steel-300/80">
              {result.summary}
            </div>
          </div>
        </Card>

        {mode === 'overall' && (
          <Card title={t('forecast_crimeDistrib')} subtitle={t('forecast_crimeDistribSub')} className="lg:col-span-2">
            <BarChartX data={typeShare} xKey="name" yKey="count" color="#3b82f6" height={300} horizontal />
          </Card>
        )}
        {mode !== 'overall' && (
          <Card title={t('forecast_insights')} subtitle={t('forecast_insightsSub')} className="lg:col-span-2">
            <Banner kind="info">
              {result.summary}
            </Banner>
            <div className="mt-3 space-y-2 text-sm text-steel-200">
              <p>• The model decomposes historical series into trend and seasonal components to project forward.</p>
              <p>• Confidence bands widen with horizon — prioritize early months for operational planning.</p>
              <p>• Cross-reference with Hotspot detection to align spatial risk with forecast volume.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, good }: { icon: React.ReactNode; label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2 text-steel-300/80"><span className="text-steel-400">{icon}</span><span className="text-xs">{label}</span></div>
      <span className={`stat-num text-sm ${good ? 'text-emerald-300' : 'text-amber-300'}`}>{value}</span>
    </div>
  );
}
