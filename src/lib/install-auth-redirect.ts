let installed = false;

/**
 * Sends the browser to /login when any same-origin /api call answers 401
 * (expired or revoked session) — otherwise a tab left open past expiry just
 * shows generic fetch errors. Wraps window.fetch once, so the ~all hooks
 * that call fetch directly are covered without touching each of them.
 * /api/auth/* is exempt: a wrong password at login is also a 401.
 */
export function installAuthRedirect() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await original(input, init);
    if (response.status === 401) {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
        window.location.origin,
      );
      const isApi = url.origin === window.location.origin && url.pathname.startsWith("/api/");
      if (isApi && !url.pathname.startsWith("/api/auth/") && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return response;
  };
}
