export type Status = "saved" | "applied" | "interview" | "offer" | "rejected";
export const STATUSES: Status[] = ["saved", "applied", "interview", "offer", "rejected"];

/** Erreur de l'API : `code` est stable et indépendant de la langue (traduit par l'interface). */
export class ApiError extends Error {
  constructor(public code: string, public retryMin?: number) { super(code); }
}

export type Kind = "stage" | "emploi";
export interface Application {
  id: number; company: string; title: string; kind: Kind; url: string | null; location: string | null;
  status: Status; notes: string | null; deadline: string | null; position: number; created_at: string; updated_at: string;
}
export type ApplicationInput = Pick<Application, "company" | "title" | "kind" | "url" | "location" | "status" | "notes" | "deadline">;

const BASE = import.meta.env.VITE_API_URL ?? "/api";
export const VERSION = "5.0";

// La session vit dans un cookie HttpOnly posé par le serveur : le JavaScript ne voit jamais le jeton.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...init.headers } });
  } catch { throw new ApiError("network"); }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const d = body?.detail;
    let code = "invalid_request";
    if (typeof d === "string") code = d;
    else if (Array.isArray(d)) {
      const m = String(d[0]?.msg ?? "").replace(/^Value error, /, "");
      if (/^[a-z_]+$/.test(m)) code = m;
    }
    if (res.status === 401 && code === "not_authenticated" && path !== "/auth/me") onUnauthorized?.();  // session expirée
    const wait = Number(res.headers.get("Retry-After"));
    throw new ApiError(code, wait ? Math.max(1, Math.ceil(wait / 60)) : undefined);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export type LoginResult = { requires2fa: false } | { requires2fa: true; challenge: string };
export async function login(email: string, password: string): Promise<LoginResult> {
  const r = await request<{ requires_2fa: boolean; challenge: string | null }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return r.requires_2fa && r.challenge ? { requires2fa: true, challenge: r.challenge } : { requires2fa: false };
}
export const login2fa = (challenge: string, code: string) =>
  request<unknown>("/auth/login/2fa", { method: "POST", body: JSON.stringify({ challenge, code }) });
export const logout = () => request<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
export const register = (email: string, password: string, lang = "fr") =>
  request(`/auth/register?lang=${lang}`, { method: "POST", body: JSON.stringify({ email, password }) });

export const listApplications = () => request<Application[]>("/applications");
export const createApplication = (d: ApplicationInput) => request<Application>("/applications", { method: "POST", body: JSON.stringify(d) });
export const updateApplication = (id: number, d: Partial<Application>) =>
  request<Application>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(d) });
export const deleteApplication = (id: number) => request<void>(`/applications/${id}`, { method: "DELETE" });

export const me = () => request<{ id: number; email: string; totp_enabled: boolean; email_verified: boolean }>("/auth/me");
export const exportData = () => request<unknown>("/me/export");
export const logoutAll = () => request<void>("/auth/logout-all", { method: "POST" });
export const changePassword = (current_password: string, new_password: string, code?: string, lang = "fr") =>
  request<unknown>(`/auth/change-password?lang=${lang}`, { method: "POST", body: JSON.stringify({ current_password, new_password, code: code || null }) });
export const deleteAccount = (password: string, code?: string) =>
  request<void>("/me", { method: "DELETE", body: JSON.stringify({ password, code: code || null }) });

export const twoFaSetup = () => request<{ secret: string; uri: string; qr: string }>("/auth/2fa/setup", { method: "POST" });
export const twoFaEnable = (code: string) =>
  request<{ recovery_codes: string[] }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
export const twoFaDisable = (password: string, code: string) =>
  request<unknown>("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
export const twoFaNewCodes = (password: string, code: string) =>
  request<{ recovery_codes: string[] }>("/auth/2fa/recovery-codes", { method: "POST", body: JSON.stringify({ password, code }) });

export const authConfig = () => request<{ email_enabled: boolean }>("/auth/config");
export const forgot = (email: string, lang: string) => request<unknown>("/auth/forgot", { method: "POST", body: JSON.stringify({ email, lang }) });
export const resetPassword = (token: string, new_password: string, code: string, lang: string) =>
  request<void>("/auth/reset", { method: "POST", body: JSON.stringify({ token, new_password, code: code || null, lang }) });
export const verifyEmail = (token: string) => request<void>("/auth/verify", { method: "POST", body: JSON.stringify({ token }) });
export const resendVerification = (lang: string) => request<unknown>(`/auth/verify/send?lang=${lang}`, { method: "POST" });
