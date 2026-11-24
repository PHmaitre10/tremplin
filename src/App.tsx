import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Application, ApplicationInput, Kind, STATUSES, Status, createApplication, deleteApplication,
  VERSION, authConfig, listApplications, logout, me, resendVerification, setUnauthorizedHandler, updateApplication, verifyEmail,
} from "./api";
import Drawer from "./Drawer";
import Account from "./Account";
import Logo from "./Logo";
import Search from "./Search";
import Login from "./Login";
import { Lang, LangSwitch, TFn, errText, useT } from "./i18n";

const daysLeft = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
const fmt = (iso: string, lang: Lang) =>
  new Date(iso + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "short" });

function deadlineChip(a: Application, t: TFn, lang: Lang) {
  if (!a.deadline || a.status !== "saved") return null;
  const d = daysLeft(a.deadline);
  const cls = d < 0 ? "late" : d <= 3 ? "urgent" : d <= 7 ? "soon" : "";
  const date = fmt(a.deadline, lang);
  const text = d < 0 ? t("due.late", { date }) : d === 0 ? t("due.today") : d === 1 ? t("due.tomorrow") : t("due.date", { date });
  return <small className={`due ${cls}`}>{text}</small>;
}

// Lien reçu par courriel : /#reset=... ou /#verify=... (le fragment n'est jamais envoyé au serveur ; on l'efface de l'adresse tout de suite).
function takeLink(): { reset?: string; verify?: string } {
  const m = location.hash.match(/^#(reset|verify)=([A-Za-z0-9_-]{10,200})$/);
  if (m) history.replaceState(null, "", location.pathname + location.search);
  return m ? { [m[1]]: m[2] } : {};
}
const LINK = takeLink();

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

type Editing = { app: Application | null; status: Status; kind?: Kind } | null;

export default function App() {
  const { t, lang } = useT();
  const [authed, setAuthed] = useState<boolean | null>(null);  // null : on vérifie la session auprès du serveur
  const [apps, setApps] = useState<Application[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [error, setError] = useState<unknown>(null); // clé de message (texte) ou erreur de l'API
  const [tab, setTab] = useState<"board" | "search" | "account">("board");
  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [notice, setNotice] = useState("");
  const [resetToken, setResetToken] = useState<string | undefined>(LINK.reset);

  const stats = useMemo(() => {
    const n = (s: Status) => apps.filter((a) => a.status === s).length;
    const sent = apps.length - n("saved");
    const replies = n("interview") + n("offer") + n("rejected");
    const due = apps.filter((a) => a.status === "saved" && a.deadline && daysLeft(a.deadline) <= 7).length;
    return [
      ["stats.total", String(apps.length)], ["stats.sent", String(sent)],
      ["stats.rate", sent ? `${Math.round((replies / sent) * 100)} %` : "—"],
      ["stats.interviews", String(n("interview"))], ["stats.offers", String(n("offer"))], ["stats.due", String(due)],
    ];
  }, [apps]);

  const load = useCallback(async () => {
    try { setApps(await listApplications()); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  const refreshMe = useCallback(() => me().then((u) => { setVerified(u.email_verified); setAuthed(true); }).catch(() => setAuthed(false)), []);
  useEffect(() => { refreshMe(); authConfig().then((c) => setEmailOn(c.email_enabled)).catch(() => {}); }, [refreshMe]);
  useEffect(() => {
    if (!LINK.verify) return;
    verifyEmail(LINK.verify).then(() => { setNotice("verify.ok"); refreshMe(); }).catch((e) => setError(e));
  }, [refreshMe]);
  useEffect(() => { setUnauthorizedHandler(() => { setAuthed(false); setApps([]); setTab("board"); setEditing(null); }); return () => setUnauthorizedHandler(null); }, []);

  const signOut = () => { logout(); setAuthed(false); setApps([]); setTab("board"); setQuery(""); setKindFilter(""); setEditing(null); setError(null); };

  if (authed === null) return <p className="boot">{t("app.loading")}</p>;
  // Un lien de réinitialisation passe avant tout, même si une session est déjà ouverte (elle sera fermée par le changement).
  if (resetToken) return <Login key="reset" onDone={() => {}} resetToken={resetToken} onReset={() => { setResetToken(undefined); setAuthed(false); setApps([]); setNotice("reset.done"); }} />;
  if (!authed) return <Login key="login" onDone={() => { setAuthed(true); refreshMe(); }} notice={notice ? t(notice) : undefined} />;

  async function save(d: ApplicationInput) {
    if (editing?.app) {
      const u = await updateApplication(editing.app.id, d);
      setApps((a) => a.map((x) => (x.id === u.id ? u : x)));
    } else {
      const c = await createApplication(d);
      setApps((a) => [...a, c]);
    }
    setEditing(null);
  }

  async function remove() {
    if (!editing?.app) return;
    await deleteApplication(editing.app.id);
    setApps((a) => a.filter((x) => x.id !== editing.app!.id));
    setEditing(null);
  }

  async function drop(status: Status) {
    const id = dragId; setDragId(null); setOverCol(null);
    const card = apps.find((a) => a.id === id);
    if (!card || card.status === status) return;
    const previous = apps;
    setApps(apps.map((a) => (a.id === id ? { ...a, status } : a)));
    try { await updateApplication(card.id, { status }); }
    catch { setApps(previous); setError("board.moveError"); }
  }

  const errorText = error === null ? "" : typeof error === "string" ? t(error) : errText(error, t);

  return (
    <>
      <header className="top">
        <h1 title={`Tremplin v${VERSION}`}><Logo />Tremplin</h1>
        <nav className="tabs">
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>{t("nav.board")}</button>
          <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>{t("nav.search")}</button>
          <button className={tab === "account" ? "on" : ""} onClick={() => setTab("account")}>{t("nav.account")}</button>
        </nav>
        <span className="count" />
        <LangSwitch />
        {tab === "board" && <button className="primary" onClick={() => setEditing({ app: null, status: "saved" })}>{t("nav.add")}</button>}
        <button className="link" onClick={signOut}>{t("nav.signout")}</button>
      </header>
      {errorText && <p role="alert" className="error banner" onClick={() => setError(null)}>{errorText}</p>}
      {notice && <p className="note banner" role="status" onClick={() => setNotice("")}>{t(notice)}</p>}
      {emailOn && !verified && (
        <p className="note banner" role="status">
          {t("verify.banner")}{" "}
          <button className="link" onClick={async () => { try { await resendVerification(lang); setNotice("verify.sent"); } catch (e) { setError(e); } }}>{t("verify.resend")}</button>
        </p>
      )}
      {tab === "search" && <Search onAdd={(kind) => { setTab("board"); setEditing({ app: null, status: "saved", kind }); }} />}
      {tab === "account" && <Account onGone={signOut} />}
      {tab === "board" && (
      <>
        <div className="stats" aria-label={t("stats.aria")}>
          {stats.map(([k, v]) => <div key={k}><b>{v}</b><span>{t(k)}</span></div>)}
        </div>
        <div className="kindbar" role="group" aria-label={t("board.filterAria")}>
          {([["", "kind.all"], ["stage", "kind.stages"], ["emploi", "kind.emplois"]] as const).map(([k, l]) => (
            <button key={k} className={kindFilter === k ? "on" : ""} onClick={() => setKindFilter(k)}>{t(l)}</button>
          ))}
          <input className="boardsearch" type="search" placeholder={t("board.search")} aria-label={t("board.search")}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </>
      )}
      {tab === "board" && apps.length === 0 && (
        <section className="welcome">
          <h2>{t("welcome.title")}</h2>
          <p>{t("welcome.text")}</p>
          <div className="actions">
            <button className="primary" onClick={() => setTab("search")}>{t("welcome.search")}</button>
            <button onClick={() => setEditing({ app: null, status: "saved" })}>{t("welcome.add")}</button>
          </div>
        </section>
      )}
      {tab === "board" && apps.length > 0 && (
      <main className="board">
        {STATUSES.map((key) => {
          const cards = apps.filter((a) => a.status === key && (!kindFilter || a.kind === kindFilter) && fold(`${a.company} ${a.title} ${a.location ?? ""}`).includes(fold(query)));
          return (
            <section key={key} className={`col col-${key}${overCol === key ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(key); }}
              onDragLeave={() => setOverCol((c) => (c === key ? null : c))}
              onDrop={() => drop(key)}>
              <h2>{t(`status.${key}`)}<span>{cards.length}</span></h2>
              {cards.length === 0 && <p className="empty">{query || kindFilter ? t("board.none") : t("board.empty")}</p>}
              {cards.map((a) => (
                <article key={a.id} className="card" draggable tabIndex={0}
                  onDragStart={() => setDragId(a.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => setEditing({ app: a, status: a.status })}
                  onKeyDown={(e) => e.key === "Enter" && setEditing({ app: a, status: a.status })}>
                  <strong>{a.company}<em className={`kind kind-${a.kind}`}>{t(`kind.${a.kind}`)}</em></strong>
                  <span>{a.title}</span>
                  {a.location && <small>{a.location}</small>}
                  {deadlineChip(a, t, lang)}
                </article>
              ))}
            </section>
          );
        })}
      </main>
      )}
      {editing && (
        <Drawer initial={editing.app} defaultStatus={editing.status} defaultKind={editing.kind} onSave={save}
          onDelete={editing.app ? remove : undefined} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
