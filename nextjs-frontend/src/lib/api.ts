// Thin fetch wrapper for the FastAPI backend (proxied same-origin via /api/*).
// - credentials: "include" so HttpOnly auth cookies flow
// - X-CSRF-Token from the readable mbp_csrf cookie on unsafe methods
// - on 401: one POST /auth/refresh then retry; else redirect to /login
// - throws ApiError {status, code, message, fields}

export const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Friendly copy for backend error codes whose raw message is terse or technical. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  invalid_invite: "This invite code is invalid or has expired. Ask the household owner for a new one.",
  owner_only: "Only the household owner can manage invite codes.",
  too_many_attempts: "Too many failed sign-in attempts. Please wait a few minutes and try again.",
  rate_limited: "Too many requests. Please wait a moment.",
  registration_closed: "Registration is closed. Ask the household owner for an invite code.",
  email_taken: "An account with this email already exists.",
  invalid_credentials: "Incorrect email or password.",
};

export function friendlyMessage(code: string | undefined, fallback: string): string {
  return (code && FRIENDLY_MESSAGES[code]) || fallback;
}

/** Human-readable error message for toasts. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (isApiError(e)) return friendlyMessage(e.code, e.message || fallback);
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Do not try refresh / redirect on 401 (used by auth endpoints & useMe). */
  noAuthRedirect?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Paths that must never trigger the refresh-and-retry dance.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/join", "/auth/refresh", "/auth/status"];

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${encodeURIComponent(name)}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function buildUrl(path: string, query?: Query): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${API_PREFIX}${p}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  // FormData (file uploads): the browser sets the multipart Content-Type with its boundary.
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie("mbp_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  return fetch(buildUrl(path, opts.query), {
    method,
    headers,
    credentials: "include",
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    signal: opts.signal,
    cache: "no-store",
  });
}

let refreshInFlight: Promise<boolean> | null = null;
/** Set while logging out: suppresses refresh + login redirects from in-flight queries. */
let loggingOut = false;

export function markLoggingOut() {
  loggingOut = true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function didRefresh(r: Response): Promise<boolean> {
  if (r.ok) return true;
  // Another tab rotated the same refresh token a moment ago (backend grace window).
  // Its response sets fresh cookies in the shared jar; give it a beat, then retry.
  if (r.status === 401) {
    const body = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === "refresh_race") {
      await sleep(750);
      return true;
    }
  }
  return false;
}

/** Single-flight refresh (per tab): concurrent 401s share one refresh request. */
function refreshSession(): Promise<boolean> {
  if (loggingOut) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = rawFetch("/auth/refresh", { method: "POST" })
      .then(didRefresh)
      .catch(() => false)
      .finally(() => {
        // Small delay so simultaneous callers reuse the same result.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      });
  }
  return refreshInFlight;
}

export function redirectToLogin() {
  if (typeof window === "undefined" || loggingOut) return;
  const { pathname, search } = window.location;
  if (["/login", "/join", "/setup"].includes(pathname)) return;
  const next = encodeURIComponent(pathname + search);
  // Full reload on purpose: drops all in-memory state/cache after auth loss.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?reauth=1&next=${next}`);
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = res.statusText || "Request failed";
  let fields: Record<string, string> | undefined;
  try {
    const data = (await res.json()) as Partial<{ error: { code: string; message: string; fields?: Record<string, string> } }>;
    if (data?.error) {
      code = data.error.code ?? code;
      message = data.error.message ?? message;
      fields = data.error.fields;
    }
  } catch {
    // non-JSON body
  }
  if (res.status === 429 && message === res.statusText) message = "Too many requests. Please wait a moment.";
  if (res.status >= 500 && code.startsWith("http_")) message = "Server error. Please try again.";
  return new ApiError(res.status, code, message, fields);
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(path, opts);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Network error. Check your connection.");
  }

  const canRefresh = !opts.noAuthRedirect && !NO_REFRESH_PATHS.some((p) => path.startsWith(p));
  if (res.status === 401 && canRefresh) {
    const ok = await refreshSession();
    if (ok) {
      res = await rawFetch(path, opts);
    }
    if (res.status === 401) {
      redirectToLogin();
      throw await toApiError(res);
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts?: Omit<RequestOptions, "method" | "query">) =>
    apiRequest<T>(path, { ...opts, method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T = void>(path: string, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};
