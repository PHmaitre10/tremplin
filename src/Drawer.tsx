import { useEffect, useState } from "react";
import { Application, ApplicationInput, Kind, STATUSES, Status } from "./api";
import { errText, useT } from "./i18n";

interface Props {
  initial: Application | null;
  defaultStatus: Status;
  defaultKind?: Kind;
  onSave: (d: ApplicationInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function Drawer({ initial, defaultStatus, defaultKind, onSave, onDelete, onClose }: Props) {
  const [f, setF] = useState<ApplicationInput>({
    company: initial?.company ?? "", title: initial?.title ?? "", kind: initial?.kind ?? defaultKind ?? "stage", url: initial?.url ?? "",
    location: initial?.location ?? "", status: initial?.status ?? defaultStatus, notes: initial?.notes ?? "", deadline: initial?.deadline ?? null,
  });
  const { t } = useT();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => setF({ ...f, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await onSave({ ...f, url: f.url || null, location: f.location || null, notes: f.notes || null, deadline: f.deadline || null });
    } catch (err) { setError(err); }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("drawer.aria")}>
        <form onSubmit={submit}>
          <h2>{initial ? t("drawer.edit") : t("drawer.new")}</h2>
          <label>{t("drawer.company")}<input required autoFocus value={f.company} onChange={(e) => set("company", e.target.value)} /></label>
          <label>{t("drawer.position")}<input required value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label>{t("drawer.type")}
            <select value={f.kind} onChange={(e) => set("kind", e.target.value as Kind)}>
              <option value="stage">{t("kind.stage")}</option>
              <option value="emploi">{t("kind.emploi")}</option>
            </select>
          </label>
          <label>{t("drawer.location")}<input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} /></label>
          <label>{t("drawer.link")}<input type="text" inputMode="url" autoComplete="off" value={f.url ?? ""} onChange={(e) => set("url", e.target.value)} /></label>
          <label>{t("drawer.deadline")}<input type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} /></label>
          <label>{t("drawer.status")}
            <select value={f.status} onChange={(e) => set("status", e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </label>
          <label>{t("drawer.notes")}<textarea rows={5} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
          {error !== null && <p role="alert" className="error">{errText(error, t)}</p>}
          <div className="actions">
            <button className="primary">{t("drawer.save")}</button>
            <button type="button" onClick={onClose}>{t("drawer.cancel")}</button>
            {onDelete && <button type="button" className="danger" onClick={() => confirm(t("drawer.confirmDelete")) && onDelete()}>{t("drawer.delete")}</button>}
          </div>
        </form>
      </aside>
    </div>
  );
}
