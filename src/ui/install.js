/* "Add to Home Screen": the game installs as an app icon that opens full screen. Android and desktop Chrome give a real install prompt (beforeinstallprompt);
   iPhone has none, so the button shows the two taps instead. Pure browser code; the menu shows the button only when it can help. */
let deferred = null; const subs = new Set(); const tell = () => subs.forEach(f => { try { f(); } catch (e) { /* a closed menu */ } });
if (typeof addEventListener === 'function') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; tell(); });
  addEventListener('appinstalled', () => { deferred = null; tell(); });
}
export const onInstallChange = f => { subs.add(f); return () => subs.delete(f); };
export const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
export const isIOS = () => { const ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
const isPhone = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
/* show the button? not when it already runs as an app; yes with a real prompt, and on any phone (with the manual steps) */
export const canInstall = () => !isStandalone() && (!!deferred || isPhone());
/* a real prompt if the browser offers one, else the steps to do by hand (a line of text) */
export async function install() {
  if (deferred) { const d = deferred; deferred = null; try { d.prompt(); const r = await d.userChoice; tell(); return r && r.outcome === 'accepted' ? 'Added: look for the Game for Peace icon on your home screen.' : 'Not added.'; } catch (e) { return 'Could not open the install box: use the browser menu, then Add to Home screen.'; } }
  return isIOS() ? 'On iPhone: tap the Share button (the square with an arrow), then Add to Home Screen. Use Safari.' : 'Open the browser menu (the three dots), then Install app or Add to Home screen.';
}
/* Android and desktop Chrome use the service worker for the install box and offline start. iPhone does not need one to Add to Home Screen, and a script that never starts is worse than no offline start, so iPhone gets none (and any earlier one is removed). */
export function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    if (isIOS()) { navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())).catch(() => {}); return; }
    navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) { /* no service worker here */ }
}
