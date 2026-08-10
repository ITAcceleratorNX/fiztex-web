import { createElement, StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttemptEvents } from './useAttemptEvents';
import { entranceApi } from '@/lib/entranceApi';

vi.mock('@/lib/entranceApi', () => ({
  entranceApi: { logEvent: vi.fn() },
}));

const logEvent = vi.mocked(entranceApi.logEvent);

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
}

describe('useAttemptEvents', () => {
  beforeEach(() => {
    logEvent.mockClear();
    setHidden(false);
  });

  afterEach(() => {
    cleanup(); // unmount hooks so their document/window listeners don't leak into the next test
    setHidden(false);
  });

  it('logs exactly one tab_switch (not also focus_lost) when the tab is hidden, and hides content', () => {
    const { result } = renderHook(() => useAttemptEvents(42, true, 0, () => 7));

    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const types = logEvent.mock.calls.map((c) => c[1]);
    expect(types).toEqual(['tab_switch']);
    expect(logEvent).toHaveBeenCalledWith(42, 'tab_switch', expect.any(String), {
      questionId: 7,
      keepalive: false,
    });
    expect(result.current.contentHidden).toBe(true);
    expect(result.current.violationCount).toBe(1);
  });

  // ТЗ §6: «дату, время и тип каждого события». Каждое — ровно один раз: журнал
  // с дублями завышает число нарушений, по которому школа судит о поступающем.
  it('logs one tab_switch per real switch even under StrictMode double-invocation', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);
    renderHook(() => useAttemptEvents(42, true, 0, () => 7), { wrapper });

    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(logEvent.mock.calls.map((c) => c[1])).toEqual(['tab_switch']);
    expect(logEvent.mock.calls[0]?.[2]).toBe('switch #1');
  });

  it('continues switch numbering from the count the attempt already had', () => {
    const { result } = renderHook(() => useAttemptEvents(42, true, 3, () => null));

    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(logEvent.mock.calls[0]?.[2]).toBe('switch #4');
    expect(result.current.tabSwitchCount).toBe(4);
  });

  it('logs focus_returned on return but keeps content hidden until resume()', () => {
    const { result } = renderHook(() => useAttemptEvents(42, true, 0, () => null));

    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      setHidden(false);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(logEvent.mock.calls.map((c) => c[1])).toEqual(['tab_switch', 'focus_returned']);
    expect(result.current.contentHidden).toBe(true);
    expect(result.current.showTabSwitchWarning).toBe(true);

    act(() => result.current.resume());
    expect(result.current.contentHidden).toBe(false);
  });

  it('logs screenshot_attempt on PrintScreen and counts it as a violation', () => {
    const { result } = renderHook(() => useAttemptEvents(42, true, 0, () => 3));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'PrintScreen' }));
    });

    expect(logEvent).toHaveBeenCalledWith(42, 'screenshot_attempt', expect.any(String), {
      questionId: 3,
      keepalive: false,
    });
    expect(result.current.violationCount).toBe(1);
    expect(result.current.contentHidden).toBe(true);
  });

  it('does not attach listeners when inactive', () => {
    renderHook(() => useAttemptEvents(42, false, 0, () => 1));

    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'PrintScreen' }));
    });

    expect(logEvent).not.toHaveBeenCalled();
  });
});
