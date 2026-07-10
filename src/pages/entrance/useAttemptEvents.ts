import { useEffect } from 'react';
import { entranceApi } from '@/lib/entranceApi';

/**
 * Basic anti-cheat event logging for an active attempt (TZ section 12): focus loss / return and
 * page close. Events are best-effort and never block the UX. The backend records STARTED / RESUMED
 * on its own during the start call, so this hook only covers what the browser can observe.
 */
export function useAttemptEvents(attemptId: number, active: boolean): void {
  useEffect(() => {
    if (!active) return;

    let focused = true;
    const markLost = (details: string) => {
      if (focused) {
        focused = false;
        entranceApi.logEvent(attemptId, 'focus_lost', details);
      }
    };
    const markReturned = () => {
      if (!focused) {
        focused = true;
        entranceApi.logEvent(attemptId, 'focus_returned');
      }
    };

    const onVisibility = () => (document.hidden ? markLost('visibilitychange:hidden') : markReturned());
    const onBlur = () => markLost('window:blur');
    const onFocus = () => markReturned();
    // keepalive lets the request survive the page unload.
    const onPageHide = () => entranceApi.logEvent(attemptId, 'page_closed', 'pagehide', true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [attemptId, active]);
}
