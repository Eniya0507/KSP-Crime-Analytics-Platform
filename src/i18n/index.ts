import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STRINGS, type Lang } from './translations';

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (l) => set({ lang: l }),
      toggle: () => set({ lang: get().lang === 'en' ? 'kn' : 'en' }),
    }),
    { name: 'ksp-i18n' },
  ),
);

// Hook: returns { lang, setLang, toggle, t }
export function useI18n() {
  const { lang, setLang, toggle } = useI18nStore();
  const t = (key: string): string => STRINGS[lang][key] ?? key;
  return { lang, setLang, toggle, t };
}

// Non-hook accessor for use outside React (e.g. in plain TS modules)
export function tr(key: string): string {
  const lang = useI18nStore.getState().lang;
  return STRINGS[lang][key] ?? key;
}
