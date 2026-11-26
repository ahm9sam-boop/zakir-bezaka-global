// Access to Capacitor native plugins from the remote-loaded web app, without bundling Capacitor.
type Cap = {
  isNativePlatform?: () => boolean;
  registerPlugin?: (name: string) => unknown;
  Plugins?: Record<string, unknown>;
};
const cache: Record<string, unknown> = {};

export function isNative(): boolean {
  const c = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return !!c?.isNativePlatform?.();
}

export function getPlugin<T = any>(name: string): T | null {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { Capacitor?: Cap }).Capacitor;
  if (!c?.isNativePlatform?.()) return null;
  if (cache[name]) return cache[name] as T;
  let p: unknown = null;
  try { p = c.registerPlugin?.(name) ?? null; } catch { p = null; }
  if (!p) p = c.Plugins?.[name] ?? null;
  if (p) cache[name] = p;
  return (p as T) || null;
}

/** Ask for every permission the app needs, once, automatically on the native app. */
export async function requestAllPermissionsOnce(): Promise<void> {
  if (!isNative()) return;
  try {
    const ln = getPlugin('LocalNotifications');
    if (ln) {
      const p = await ln.checkPermissions();
      if (p.display !== 'granted') await ln.requestPermissions();
    }
  } catch { /* ignore */ }
  try {
    const fs = getPlugin('Filesystem');
    if (fs) {
      const p = await fs.checkPermissions();
      if (p.publicStorage !== 'granted') await fs.requestPermissions();
    }
  } catch { /* ignore */ }
  try {
    if (!localStorage.getItem('zk_mic_asked') && navigator.mediaDevices?.getUserMedia) {
      localStorage.setItem('zk_mic_asked', '1');
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach((t) => t.stop());
    }
  } catch { /* user may deny */ }
}
