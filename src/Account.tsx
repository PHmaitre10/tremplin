import { useEffect, useState } from "react";
import {
  VERSION, changePassword, deleteAccount, exportData, listApplications, logoutAll, me,
  twoFaDisable, twoFaEnable, twoFaNewCodes, twoFaSetup,
} from "./api";
import { errText, useT } from "./i18n";

export default function Account({ onGone }: { onGone: () => void }) {
  const { t, lang } = useT();
  const [email, setEmail] = useState("");
  const [totp, setTotp] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwCode, setPwCode] = useState("");
  const [del, setDel] = useState("");
  const [delCode, setDelCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mgmt, setMgmt] = useState<"disable" | "codes" | null>(null);
  const [mPw, setMPw] = useState("");
  const [mCode, setMCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { me().then((u) => { setEmail(u.email); setTotp(u.totp_enabled); }).catch(() => {}); }, []);

  const run = async (fn: () => Promise<void>) => {
    setMsg(""); setErr(null);
    try { await fn(); } catch (e) { setErr(e); }
  };
  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="account">
      <h2>{t("account.title")}</h2>
      <p className="count">{email}</p>
      {msg && <p className="note">{msg}</p>}
      {err !== null && <p role="alert" className="error">{errText(err, t)}</p>}

      <section className="twofa">
        <h3>{t("account.twofa")}<span className={`state ${totp ? "on" : ""}`}>{totp ? t("account.twofaOn") : t("account.twofaOff")}</span></h3>
        <p>{t("account.twofaText")}</p>

        {codes && (
          <div>
            <h4>{t("account.recoveryTitle")}</h4>
            <p className="warn">{t("account.recoveryWarn")}</p>
            <div className="codes">{codes.map((c) => <code key={c}>{c}</code>)}</div>
            <div className="row">
              <button onClick={async () => { await navigator.clipboard?.writeText(codes.join("\n")); setCopied(true); }}>{copied ? t("account.copied") : t("account.copy")}</button>
              <button onClick={() => download(new Blob([codes.join("\r\n") + "\r\n"], { type: "text/plain" }), "tremplin-recovery-codes.txt")}>{t("account.downloadCodes")}</button>
              <button className="primary" onClick={() => { setCodes(null); setCopied(false); }}>{t("account.recoveryDone")}</button>
            </div>
          </div>
        )}

        {!totp && !setup && !codes && (
          <button className="primary" onClick={() => run(async () => { setSetup(await twoFaSetup()); })}>{t("account.twofaEnable")}</button>
        )}
        {!totp && setup && (
          <form onSubmit={(e) => { e.preventDefault(); run(async () => {
            const r = await twoFaEnable(setupCode);
            setCodes(r.recovery_codes); setSetup(null); setSetupCode(""); setTotp(true); setMsg(t("account.twofaEnabledMsg"));
          }); }}>
            <p>{t("account.twofaScan")}</p>
            <img className="qr" src={setup.qr} alt="QR code" />
            <p>{t("account.twofaManual")} <code className="secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code></p>
            <label>{t("account.twofaCode")}<input type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
              value={setupCode} onChange={(e) => setSetupCode(e.target.value)} /></label>
            <div className="row">
              <button className="primary">{t("account.twofaConfirm")}</button>
              <button type="button" onClick={() => { setSetup(null); setSetupCode(""); }}>{t("account.cancel")}</button>
            </div>
          </form>
        )}

        {totp && !codes && (
          <>
            <div className="row">
              <button onClick={() => { setMgmt(mgmt === "codes" ? null : "codes"); setMPw(""); setMCode(""); }}>{t("account.newRecovery")}</button>
              <button onClick={() => { setMgmt(mgmt === "disable" ? null : "disable"); setMPw(""); setMCode(""); }}>{t("account.twofaDisable")}</button>
            </div>
            {mgmt && (
              <form onSubmit={(e) => { e.preventDefault(); run(async () => {
                if (mgmt === "codes") { setCodes((await twoFaNewCodes(mPw, mCode)).recovery_codes); }
                else { await twoFaDisable(mPw, mCode); setTotp(false); setMsg(t("account.twofaDisabledMsg")); }
                setMgmt(null); setMPw(""); setMCode("");
              }); }}>
                {mgmt === "codes" && <p>{t("account.newRecoveryText")}</p>}
                <label>{t("login.password")}<input type="password" required autoComplete="current-password" value={mPw} onChange={(e) => setMPw(e.target.value)} /></label>
                <label>{t("account.codeOrRecovery")}<input type="text" required autoComplete="one-time-code" maxLength={20} value={mCode} onChange={(e) => setMCode(e.target.value)} /></label>
                <button className="primary">{mgmt === "codes" ? t("account.newRecovery") : t("account.twofaDisable")}</button>
              </form>
            )}
          </>
        )}
      </section>

      <section>
        <h3>{t("account.changePw")}</h3>
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await changePassword(cur, next, pwCode, lang); setCur(""); setNext(""); setPwCode(""); setMsg(t("account.pwChanged")); }); }}>
          <label>{t("account.currentPw")}<input type="password" required autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
          <label>{t("account.newPw")}<input type="password" required minLength={10} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <small>{t("login.hint")}</small>
          {totp && <label>{t("account.codeOrRecovery")}<input type="text" required autoComplete="one-time-code" maxLength={20} value={pwCode} onChange={(e) => setPwCode(e.target.value)} /></label>}
          <button className="primary">{t("account.change")}</button>
        </form>
      </section>

      <section>
        <h3>{t("account.sessions")}</h3>
        <p>{t("account.sessionsText")}</p>
        <button onClick={() => run(async () => { await logoutAll(); onGone(); })}>{t("account.closeAll")}</button>
      </section>

      <section>
        <h3>{t("account.myData")}</h3>
        <p>{t("account.dataText")}</p>
        <button onClick={() => run(async () => {
          download(new Blob([JSON.stringify(await exportData(), null, 2)], { type: "application/json" }), "tremplin-data.json");
        })}>{t("account.dlJson")}</button>{" "}
        <button onClick={() => run(async () => {
          const sep = lang === "fr" ? ";" : ",";  // Excel français attend des points-virgules
          const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
          const rows = (await listApplications()).map((a) =>
            [a.company, a.title, t(`kind.${a.kind}`), t(`status.${a.status}`), a.location, a.url, a.deadline, a.notes, a.created_at.slice(0, 10)].map(cell).join(sep));
          const head = ["company", "position", "type", "status", "location", "link", "deadline", "notes", "created"].map((k) => cell(t(`csv.${k}`))).join(sep);
          download(new Blob(["\ufeff" + [head, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), "tremplin-applications.csv");
        })}>{t("account.dlCsv")}</button>
      </section>

      <section>
        <h3>{t("account.delete")}</h3>
        <p>{t("account.deleteText")}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (confirm(t("account.confirmDelete"))) run(async () => { await deleteAccount(del, delCode); onGone(); }); }}>
          <label>{t("account.confirmPw")}<input type="password" required autoComplete="current-password" value={del} onChange={(e) => setDel(e.target.value)} /></label>
          {totp && <label>{t("account.codeOrRecovery")}<input type="text" required autoComplete="one-time-code" maxLength={20} value={delCode} onChange={(e) => setDelCode(e.target.value)} /></label>}
          <button className="danger">{t("account.delete")}</button>
        </form>
      </section>
      <p className="ver">{t("account.version", { v: VERSION })}</p>
    </main>
  );
}
