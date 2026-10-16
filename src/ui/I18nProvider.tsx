import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DICTS, I18nContext, initialLang, saveLang, type Lang } from './i18n.ts';

/** Holds the current language (Serbian by default) and keeps `<html lang>` in sync. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      t: DICTS[lang],
      setLang: (next: Lang) => {
        saveLang(next);
        setLangState(next);
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
