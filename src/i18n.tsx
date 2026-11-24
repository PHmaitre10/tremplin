import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import { ApiError } from "./api";

export type Lang = "fr" | "en";
type Params = Record<string, string | number>;
export type TFn = (key: string, params?: Params) => string;

const dicts: Record<Lang, Record<string, string>> = { fr, en };
const KEY = "tremplin_lang";

function initialLang(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "fr" || s === "en") return s;
  } catch { /* stockage indisponible */ }
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

const make = (lang: Lang): TFn => (key, params) => {
  let s = dicts[lang][key] ?? dicts.fr[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: TFn }>({ lang: "fr", setLang: () => {}, t: make("fr") });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = useMemo(() => make(lang), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("app.title");
  }, [lang, t]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* stockage indisponible */ }
  };
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** Message lisible pour une erreur de l'API, dans la langue choisie. */
export function errText(e: unknown, t: TFn): string {
  if (e instanceof ApiError && dicts.fr[`err.${e.code}`]) return t(`err.${e.code}`, { min: e.retryMin ?? 1 });
  return t("err.generic");
}

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className="langswitch" role="group" aria-label={t("lang.aria")}>
      {(["fr", "en"] as const).map((l) => (
        <button key={l} className={lang === l ? "on" : ""} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
