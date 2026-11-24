import { useState } from "react";
import { Kind } from "./api";
import { Lang, useT } from "./i18n";

type Opts = { q: string; city: string; kind: "" | Kind; days: string };
const KEY = "tremplin_search";
const enc = encodeURIComponent;

const CHIPS = ["dev", "analyst", "cyber", "data", "support", "network", "web", "devops"];
// Villes réparties dans tout le pays ; la valeur est ce qui part dans la recherche.
const CITIES: [string, string][] = [
  ["city.all", ""], ["city.toronto", "Toronto, ON"], ["city.montreal", "Montréal, QC"], ["city.vancouver", "Vancouver, BC"],
  ["city.calgary", "Calgary, AB"], ["city.edmonton", "Edmonton, AB"], ["city.ottawa", "Ottawa, ON"], ["city.winnipeg", "Winnipeg, MB"],
  ["city.quebec", "Québec, QC"], ["city.halifax", "Halifax, NS"], ["city.saskatoon", "Saskatoon, SK"],
];
// Nom anglais en valeur (reconnu par tous les sites), libellé selon la langue.
const PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Northwest Territories",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
];
const provKey = (p: string) => "prov." + p.toLowerCase().replace(/ /g, "_");

function loadOpts(): Opts {
  const d: Opts = { q: "", city: "", kind: "", days: "" };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return d; }
}

type Site = { name: string; note: string; href: string; partial: boolean };

function sites(o: Opts, lang: Lang, t: (k: string) => string): { search: Site[]; gov: Site[] } {
  const q = o.q.trim();
  const stage = o.kind === "stage";
  const days = o.days ? Number(o.days) : 0;
  const where = o.city.trim() || "Canada";
  const li = new URLSearchParams({ keywords: q, location: where });
  if (stage) li.set("f_E", "1");
  if (days) li.set("f_TPR", `r${days * 86400}`);
  const indeed = new URLSearchParams({ q: stage ? `${q} (stage OR stagiaire OR internship OR co-op)`.trim() : q, l: where });
  if (days) indeed.set("fromage", String(days));
  const jbQ = stage ? `${q} ${lang === "fr" ? "stage" : "internship"}`.trim() : q;
  const jobBank = lang === "fr"
    ? "https://www.guichetemplois.gc.ca/jobsearch/rechercheemplois"
    : "https://www.jobbank.gc.ca/jobsearch/jobsearch";
  const psc = lang === "fr"
    ? "https://www.canada.ca/fr/commission-fonction-publique"
    : "https://www.canada.ca/en/public-service-commission";
  return {
    search: [
      { name: t("site.jobbank.name"), note: t("site.jobbank.note"), href: `${jobBank}?searchstring=${enc(jbQ)}&locationstring=${enc(o.city.trim())}`, partial: !!days },
      { name: "Indeed", note: t("site.indeed.note"), href: `https://ca.indeed.com/jobs?${indeed}`, partial: false },
      { name: "LinkedIn", note: t(stage ? "site.linkedin.noteStage" : "site.linkedin.note"), href: `https://www.linkedin.com/jobs/search/?${li}`, partial: false },
    ],
    gov: [
      { name: t("site.gc.name"), note: t("site.gc.note"),
        href: lang === "fr" ? `${psc}/organisation/propos-nous/commission-fonction-publique-emplois.html` : "https://www.jobs.gc.ca", partial: false },
      { name: t("site.fswep.name"), note: t("site.fswep.note"),
        href: lang === "fr" ? `${psc}/emplois/services/recrutement/etudiants/programme-federal-experience-travail-etudiant.html`
                            : `${psc}/jobs/services/recruitment/students/federal-student-work-program.html`, partial: false },
      { name: t("site.students.name"), note: t("site.students.note"),
        href: lang === "fr" ? `${psc}/emplois/services/recrutement/etudiants.html` : `${psc}/jobs/services/recruitment/students.html`, partial: false },
    ],
  };
}

export default function Search({ onAdd }: { onAdd: (kind: Kind) => void }) {
  const { t, lang } = useT();
  const [o, setO] = useState<Opts>(loadOpts);
  const set = (p: Partial<Opts>) => {
    const n = { ...o, ...p };
    setO(n);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* stockage indisponible */ }
  };
  const s = sites(o, lang, t);
  const card = (cta: string) => (x: Site) => (
    <a key={x.name} className="site" href={x.href} target="_blank" rel="noreferrer noopener">
      <strong>{x.name}</strong>
      <span>{x.note}</span>
      {x.partial && <small>{t("search.noDate")}</small>}
      <em>{cta} ↗</em>
    </a>
  );

  return (
    <main className="search">
      <h2>{t("search.title")}</h2>
      <p className="lede">{t("search.lede")}</p>
      <div className="filters">
        <input placeholder={t("search.keyword")} value={o.q} onChange={(e) => set({ q: e.target.value })} aria-label={t("search.keyword")} />
        <input placeholder={t("search.place")} value={o.city} onChange={(e) => set({ city: e.target.value })} aria-label={t("search.place")} />
        <select value={PROVINCES.includes(o.city) ? o.city : ""} onChange={(e) => set({ city: e.target.value })} aria-label={t("search.province")}>
          <option value="">{t("search.anyProvince")}</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{t(provKey(p))}</option>)}
        </select>
        <select value={o.kind} onChange={(e) => set({ kind: e.target.value as "" | Kind })} aria-label={t("search.type")}>
          <option value="">{t("search.kindAll")}</option><option value="stage">{t("kind.stages")}</option><option value="emploi">{t("kind.emplois")}</option>
        </select>
        <select value={o.days} onChange={(e) => set({ days: e.target.value })} aria-label={t("search.dates")}>
          <option value="">{t("search.anyDate")}</option><option value="1">{t("search.d1")}</option><option value="3">{t("search.d3")}</option>
          <option value="7">{t("search.d7")}</option><option value="14">{t("search.d14")}</option>
        </select>
      </div>
      <div className="chips" role="group" aria-label={t("search.ideas")}>
        {CHIPS.map((c) => <button key={c} className={o.q === t(`chip.${c}`) ? "on" : ""} onClick={() => set({ q: o.q === t(`chip.${c}`) ? "" : t(`chip.${c}`) })}>{t(`chip.${c}`)}</button>)}
      </div>
      <div className="chips" role="group" aria-label={t("search.cities")}>
        {CITIES.map(([key, value]) => <button key={key} className={o.city === value ? "on" : ""} onClick={() => set({ city: value })}>{t(key)}</button>)}
      </div>

      <h3>{t("search.engines")}</h3>
      <div className="sites">{s.search.map(card(t("search.open")))}</div>
      <h3>{t("search.gov")}</h3>
      <div className="sites">{s.gov.map(card(t("search.openSite")))}</div>

      <section className="found">
        <h3>{t("search.foundTitle")}</h3>
        <p>{t("search.foundText")}</p>
        <div className="actions">
          <button className="primary" onClick={() => onAdd("stage")}>{t("search.saveStage")}</button>
          <button className="primary" onClick={() => onAdd("emploi")}>{t("search.saveJob")}</button>
        </div>
      </section>
    </main>
  );
}
