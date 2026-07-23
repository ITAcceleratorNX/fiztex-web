import { useCallback, useEffect, useRef, useState } from 'react';
import { entranceApi } from '@/lib/entranceApi';
import type { AttemptEventType } from '@/lib/entranceTypes';

/**
 * Anti-cheat tracking for an active attempt (TZ §2/§3). One suspicious action → exactly one
 * logged event and one counted violation: a tab switch / minimize (`visibilitychange:hidden`)
 * and a window focus loss (`blur`) are de-duplicated so leaving the tab is not counted twice.
 * On any leave the test content is hidden (`contentHidden`) and stays hidden until the applicant
 * taps «Продолжить» (`resume`). Screenshots are best-effort (PrintScreen only — the browser
 * cannot reliably detect OS screenshots, per TZ §6). Every log is best-effort and never blocks
 * the UX; the backend records STARTED / RESUMED itself during the start call.
 */
export function useAttemptEvents(
  attemptId: number,
  active: boolean,
  initialTabSwitchCount = 0,
  getCurrentQuestionId?: () => number | null,
) {
  const [tabSwitchCount, setTabSwitchCount] = useState(initialTabSwitchCount);
  const [violationCount, setViolationCount] = useState(0);
  const [contentHidden, setContentHidden] = useState(false);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);

  const getQuestionIdRef = useRef(getCurrentQuestionId);
  getQuestionIdRef.current = getCurrentQuestionId;

  const dismissTabSwitchWarning = useCallback(() => setShowTabSwitchWarning(false), []);
  const resume = useCallback(() => setContentHidden(false), []);

  useEffect(() => {
    setTabSwitchCount(initialTabSwitchCount);
  }, [attemptId, initialTabSwitchCount]);

  useEffect(() => {
    if (!active) return;

    const questionId = () => getQuestionIdRef.current?.() ?? null;
    const log = (type: AttemptEventType, details?: string, keepalive = false) =>
      entranceApi.logEvent(attemptId, type, details, { questionId: questionId(), keepalive });

    // A single "away" episode logs one violation and one focus_returned. `away` guards the
    // leave; `blurTimer` defers the window_blur decision so a tab switch (blur → hidden) is
    // attributed once, as tab_switch, not blur + tab_switch.
    let away = false;
    let blurTimer: number | undefined;

    const leave = (type: AttemptEventType, details?: string) => {
      if (away) return;
      away = true;
      window.clearTimeout(blurTimer);
      if (type === 'tab_switch') {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          log('tab_switch', `switch #${next}`);
          return next;
        });
      } else {
        log(type, details);
      }
      setViolationCount((v) => v + 1);
      setContentHidden(true);
    };

    const returned = (details: string) => {
      if (!away) return;
      away = false;
      window.clearTimeout(blurTimer);
      log('focus_returned', details);
      setShowTabSwitchWarning(true);
      // Content stays hidden until the applicant explicitly resumes.
    };

    const onVisibility = () => {
      if (document.hidden) {
        setContentHidden(true);
        leave('tab_switch');
      } else if (away) {
        returned('visibilitychange:visible');
      }
    };

    const onBlur = () => {
      if (document.hidden || away) return;
      // Hide immediately (anti-cheat), but wait to see whether this blur is actually a tab
      // switch/minimize — those fire blur first and visibilitychange:hidden right after.
      setContentHidden(true);
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!document.hidden) leave('window_blur', 'window:blur');
      }, 200);
    };

    const onFocus = () => {
      window.clearTimeout(blurTimer);
      if (!document.hidden && away) returned('window:focus');
    };

    const onPageHide = () => log('page_closed', 'pagehide', true);

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        log('screenshot_attempt', 'PrintScreen key');
        setViolationCount((v) => v + 1);
        setContentHidden(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [attemptId, active]);

  return {
    tabSwitchCount,
    violationCount,
    contentHidden,
    resume,
    showTabSwitchWarning,
    dismissTabSwitchWarning,
  };
}
