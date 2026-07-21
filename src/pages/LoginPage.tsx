import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, LogIn, AlertCircle, Eye, EyeOff, Languages } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuthStore, DEMO_USERS } from '../store/auth';
import { useI18n } from '../i18n';
import { LANG_SHORT } from '../i18n/translations';

interface FormVals {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { user, login } = useAuthStore();
  const navigate = useNavigate();
  const { lang, toggle, t } = useI18n();
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const { register, handleSubmit, setValue } = useForm<FormVals>();

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = (v: FormVals) => {
    const res = login(v.email, v.password);
    if (res.ok) navigate('/dashboard');
    else setErr(t('login_invalid'));
  };

  const quickFill = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
    setErr('');
  };

  const features = [
    t('login_feature_1'), t('login_feature_2'), t('login_feature_3'),
    t('login_feature_4'), t('login_feature_5'), t('login_feature_6'),
  ];

  return (
    <div className="app-bg relative flex min-h-screen items-center justify-center p-4">
      {/* Language toggle - top right */}
      <button
        onClick={toggle}
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-850/60 px-3 py-2 text-xs text-steel-200 backdrop-blur transition hover:border-steel-500/40 hover:bg-white/5"
        title={t('language')}
      >
        <Languages size={14} /> {LANG_SHORT[lang]}
      </button>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/5 bg-ink-850/70 backdrop-blur-md shadow-card lg:grid-cols-2">
        {/* Left: brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-steel-600/20 via-transparent to-cyan-600/10" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-steel-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-600/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-steel-600 to-steel-800 shadow-glow">
                <Shield size={24} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{t('ksp')}</p>
                <p className="text-xs text-steel-300/80">{t('brandSub')}</p>
              </div>
            </div>
            <h1 className="mt-10 text-3xl font-bold leading-tight text-white">
              {t('login_heroTitle')}
            </h1>
            <p className="mt-4 max-w-sm text-sm text-steel-300/80">
              {t('login_heroSub')}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
              {features.map((f) => (
                <div key={f} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-steel-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-steel-400" /> {f}
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-[11px] text-steel-300/50">{t('login_confidential')}</p>
        </div>

        {/* Right: login form */}
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-steel-600 to-steel-800">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('brand')}</p>
              <p className="text-[11px] text-steel-300/80">{t('brandSub')}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white">{t('login_signInTitle')}</h2>
          <p className="mt-1 text-sm text-steel-300/70">{t('login_signInSub')}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="label">{t('email')}</label>
              <input type="email" className="input" placeholder={t('login_emailPlaceholder')} {...register('email', { required: true })} />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" {...register('password', { required: true })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-300/60 hover:text-white">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <AlertCircle size={14} /> {err}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5">
              <LogIn size={16} /> {t('signIn')}
            </button>
          </form>

          <div className="mt-8">
            <p className="section-title mb-3">{t('login_demoTitle')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => quickFill(u.email, u.password)}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-steel-500/40 hover:bg-white/10"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: u.avatarColor }}>
                    {u.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{u.role}</p>
                    <p className="truncate text-[10px] text-steel-300/70">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
