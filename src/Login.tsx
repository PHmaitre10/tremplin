import { useEffect, useState } from "react";
import Logo from "./Logo";
import { authConfig, forgot, login, login2fa, register, resetPassword } from "./api";
import { LangSwitch, errText, useT } from "./i18n";

type Mode = "login" | "register" | "forgot" | "reset";

export default function Login({ onDone, resetToken, onReset, notice }: { onDone: () => void; resetToken?: string; onReset?: () => void; notice?: string }) {
  const { t, lang } = useT();
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);   // étape 2 : double authentification
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailOn, setEmailOn] = useState(false);
  useEffect(() => { authConfig().then((c) => setEmailOn(c.email_enabled)).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo("");
    try {
      if (mode === "forgot") { await forgot(email, lang); setInfo(t("forgot.sent")); return; }
      if (mode === "reset") {
        await resetPassword(resetToken ?? "", password, code, lang);
        if (onReset) { onReset(); return; }
        setMode("login"); setPassword(""); setCode(""); setInfo(t("reset.done")); return;
      }
      if (challenge) { await login2fa(challenge, code); onDone(); return; }
      if (mode === "register") await register(email, password, lang);
      const r = await login(email, password);
      if (r.requires2fa) { setChallenge(r.challenge); setPassword(""); }
      else onDone();
    } catch (err) {
      setError(err);
    } finally { setBusy(false); }
  }

  const reset = () => { setChallenge(null); setCode(""); setRecovery(false); setError(null); };
  const go = (m: Mode) => { setMode(m); setError(null); setInfo(""); setPassword(""); setCode(""); };
  const pwInput = (autoComplete: string, minLen: number) => (
    <input type="password" required minLength={minLen} autoComplete={autoComplete} value={password} onChange={(e) => setPassword(e.target.value)} />
  );

  return (
    <main className="auth">
      <div className="langbar"><LangSwitch /></div>
      <h1><Logo size={40} />Tremplin</h1>
      {notice && <p className="note">{notice}</p>}
      {info && <p className="note" role="status">{info}</p>}
      {challenge ? (
        <>
          <p className="lede"><strong>{t("login.twofaTitle")}</strong><br />{t("login.codeHint")}</p>
          <form onSubmit={submit}>
            <label>{recovery ? t("login.recovery") : t("login.code")}
              {recovery
                ? <input type="text" required autoFocus autoComplete="off" placeholder="XXXXX-XXXXX" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
                : <input type="text" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
                    placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />}
            </label>
            {error !== null && <p role="alert" className="error">{errText(error, t)}</p>}
            <button className="primary" disabled={busy}>{t("login.verify")}</button>
          </form>
          <button className="link" onClick={() => { setRecovery(!recovery); setCode(""); setError(null); }}>{recovery ? t("login.useApp") : t("login.useRecovery")}</button>
          <br /><button className="link" onClick={reset}>{t("login.back")}</button>
        </>
      ) : mode === "forgot" ? (
        <>
          <p className="lede"><strong>{t("forgot.title")}</strong><br />{t("forgot.text")}</p>
          <form onSubmit={submit}>
            <label>{t("login.email")}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {error !== null && <p role="alert" className="error">{errText(error, t)}</p>}
            <button className="primary" disabled={busy}>{t("forgot.send")}</button>
          </form>
          <button className="link" onClick={() => go("login")}>{t("login.back")}</button>
        </>
      ) : mode === "reset" ? (
        <>
          <p className="lede"><strong>{t("reset.title")}</strong></p>
          <form onSubmit={submit}>
            <label>{t("account.newPw")}{pwInput("new-password", 10)}</label>
            <small>{t("login.hint")}</small>
            <label>{t("reset.code")}<input type="text" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} /></label>
            {error !== null && <p role="alert" className="error">{errText(error, t)}</p>}
            <button className="primary" disabled={busy}>{t("reset.submit")}</button>
          </form>
          <button className="link" onClick={() => (resetToken ? window.location.assign(window.location.pathname) : go("login"))}>{t("login.back")}</button>
        </>
      ) : (
        <>
          <p className="lede">{t("login.lede")}</p>
          <ul className="perks"><li>{t("login.perk1")}</li><li>{t("login.perk2")}</li><li>{t("login.perk3")}</li></ul>
          <form onSubmit={submit}>
            <label>{t("login.email")}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>{t("login.password")}{pwInput(mode === "login" ? "current-password" : "new-password", mode === "register" ? 10 : 1)}</label>
            {mode === "register" && <small>{t("login.hint")}</small>}
            {error !== null && <p role="alert" className="error">{errText(error, t)}</p>}
            <button className="primary" disabled={busy}>{mode === "login" ? t("login.submit") : t("login.create")}</button>
          </form>
          {mode === "login" && emailOn && <><button className="link" onClick={() => go("forgot")}>{t("login.forgot")}</button><br /></>}
          <button className="link" onClick={() => go(mode === "login" ? "register" : "login")}>
            {mode === "login" ? t("login.toRegister") : t("login.toLogin")}
          </button>
        </>
      )}
    </main>
  );
}
