// Shared-host-key plumbing for the client.
//
// The host opens the console once at https://<domain>/?host=<key>. We stash the
// key in localStorage, strip it back out of the address bar (a projector should
// never display it), and attach it as `x-tcf-host` to every host-only request.
// An audience phone never has a key, so it simply sends no header and the
// server keeps it out of the host routes.

const HOST_KEY_STORAGE = 'tcf_host_key';
const HOST_KEY_PARAM = 'host';
const HOST_HEADER = 'x-tcf-host';

export function getHostKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(HOST_KEY_STORAGE) || '';
  } catch (e) {
    return '';
  }
}

export function setHostKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key) localStorage.setItem(HOST_KEY_STORAGE, key);
    else localStorage.removeItem(HOST_KEY_STORAGE);
  } catch (e) {
    // Private-mode browsers: the key just won't survive a refresh.
  }
}

/**
 * Reads `?host=<key>` once on load, persists it, and rewrites the URL without
 * it so the secret is not left on screen. Returns the key now in effect.
 */
export function captureHostKeyFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get(HOST_KEY_PARAM);
    if (fromUrl) {
      setHostKey(fromUrl.trim());
      url.searchParams.delete(HOST_KEY_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {
    // Bad URL or blocked history API — fall through to whatever is stored.
  }
  return getHostKey();
}

/** Headers for a host-only request. Empty when this device has no key. */
export function hostHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const key = getHostKey();
  if (key) headers[HOST_HEADER] = key;
  return headers;
}

/** fetch() with the host key attached. Safe to use for audience routes too. */
export function hostFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const existing = (init.headers as Record<string, string>) || {};
  return fetch(input, { ...init, headers: hostHeaders(existing) });
}

/** Asks the server whether this device may drive the console. */
export async function verifyHostKey(): Promise<boolean> {
  try {
    const res = await hostFetch('/api/host/verify');
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch (e) {
    // Offline on first load: don't lock the host out of their own laptop.
    return true;
  }
}
