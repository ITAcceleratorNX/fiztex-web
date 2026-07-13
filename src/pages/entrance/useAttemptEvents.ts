import { useCallback, useEffect, useState } from 'react';
import { entranceApi } from '@/lib/entranceApi';

/**
 * Anti-cheat tracking for an active attempt (TZ section 12): counts tab switches like
 * Wayground/Quizizz and logs focus loss / return and page close. Events are best-effort and
 * never block the UX. The backend records STARTED / RESUMED on its own during the start call.
 */
export function useAttemptEvents(
  attemptId: number,
  active: boolean,
  initialTabSwitchCount = 0,
) {
  const [tabSwitchCount, setTabSwitchCount] = useState(initialTabSwitchCount);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);

  const dismissTabSwitchWarning = useCallback(() => setShowTabSwitchWarning(false), []);

  useEffect(() => {
    setTabSwitchCount(initialTabSwitchCount);
  }, [attemptId, initialTabSwitchCount]);

  useEffect(() => {
    if (!active) return;

    let focused = true;

    const onVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          entranceApi.logEvent(attemptId, 'tab_switch', `switch #${next}`);
          return next;
        });
        if (focused) {
          focused = false;
          entranceApi.logEvent(attemptId, 'focus_lost', 'visibilitychange:hidden');
        }
      } else {
        if (!focused) {
          focused = true;
          entranceApi.logEvent(attemptId, 'focus_returned');
        }
        setShowTabSwitchWarning(true);
      }
    };

    const onBlur = () => {
      if (!document.hidden && focused) {
        focused = false;
        entranceApi.logEvent(attemptId, 'window_blur', 'window:blur');
      }
    };

    const onFocus = () => {
      if (!document.hidden && !focused) {
        focused = true;
        entranceApi.logEvent(attemptId, 'focus_returned');
      }
    };

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

  return { tabSwitchCount, showTabSwitchWarning, dismissTabSwitchWarning };
}
