// In local dev, NEXT_PUBLIC_API_URL points straight at the server
// (http://localhost:4000 — see .env.local.example) since client and server
// are "same site" there (both localhost) and cookies work fine directly.
// In production this is left UNSET on purpose: an empty base means every
// request path is relative to this app's own origin, which Next's rewrite
// (next.config.mjs) then proxies to the real API server-side — see that
// file for why (Safari's cross-site cookie blocking).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Routes where a 401 means exactly what it says ("wrong credentials" /
// "no session yet") rather than "access token expired" — retrying these
// via /auth/refresh would be pointless (refresh itself needs the refresh
// cookie, which login/register don't have yet) or would mask a real
// wrong-password error as something else.
const NO_REFRESH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

// Multiple queries can 401 around the same moment (e.g. group + balances
// firing together right as the access token expires). Without this, each
// would kick off its own /auth/refresh call — wasteful, and racy since the
// refresh token is rotated on use, so a second concurrent refresh would
// fail against an already-rotated token. Sharing one in-flight promise
// means every caller waits on and benefits from the same refresh.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Cookies carry the access/refresh tokens now (see server/src/lib/tokens.ts)
    // instead of a client-held bearer token — this tells fetch to send and
    // accept them even though client and server are on different domains.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "Something went wrong");
  }

  return body as T;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (err) {
    const shouldRetry = err instanceof ApiError && err.status === 401 && !NO_REFRESH_PATHS.includes(path);
    if (!shouldRetry) throw err;

    const refreshed = await refreshSession();
    if (!refreshed) throw err;

    return request<T>(path, options);
  }
}
