const AUTH_RETURN_URL_KEY = "authReturnUrl"

/** Save current path so we can restore it after Azure AD redirect login. */
export function saveAuthReturnUrl(path?: string) {
  if (typeof window === "undefined") return
  const value =
    path ?? `${window.location.pathname}${window.location.search}${window.location.hash}`
  // Don't overwrite with bare "/" if we already have a deeper path from expiry on a deep route
  if (value === "/" || value === "") {
    const existing = sessionStorage.getItem(AUTH_RETURN_URL_KEY)
    if (existing && existing !== "/") return
  }
  sessionStorage.setItem(AUTH_RETURN_URL_KEY, value)
}

/** Read and clear a safe same-origin return path. Defaults to /dashboard. */
export function consumeAuthReturnUrl(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback
  const raw = sessionStorage.getItem(AUTH_RETURN_URL_KEY)
  sessionStorage.removeItem(AUTH_RETURN_URL_KEY)
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback
  if (raw === "/") return fallback
  return raw
}
