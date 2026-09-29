import type { KeyboardEvent } from 'react';

type RovingFocusOptions = {
  itemSelector: string;
  activateOnArrow?: boolean;
};

/** Move focus inside a tab/segmented control without adding every item to the Tab order. */
export function handleRovingFocusKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  { itemSelector, activateOnArrow = false }: RovingFocusOptions,
) {
  const container = event.currentTarget.closest('[role="tablist"], [role="radiogroup"]');
  if (!container) return;

  const items = Array.from(container.querySelectorAll<HTMLButtonElement>(itemSelector)).filter(
    (item) => !item.disabled && item.getAttribute('aria-disabled') !== 'true',
  );
  const currentIndex = items.indexOf(event.currentTarget);
  if (currentIndex < 0 || items.length === 0) return;

  let nextIndex: number | null = null;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  else if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % items.length;
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + items.length) % items.length;
  }

  if (nextIndex == null) return;
  event.preventDefault();

  const target = items[nextIndex];
  target.focus();
  if (activateOnArrow && nextIndex !== currentIndex) target.click();
}
