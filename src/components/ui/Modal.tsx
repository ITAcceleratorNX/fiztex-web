import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cx } from '@/lib/format';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

type ModalEntry = {
  layer: HTMLDivElement;
  dialog: HTMLDivElement;
  previousFocus: HTMLElement | null;
  close: () => void;
};

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-4xl', '2xl': 'max-w-5xl' };
const focusableSelector = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const modalStack: ModalEntry[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalBodyOverflow: string | null = null;
let modalObserver: MutationObserver | null = null;

function notificationRegions(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-modal-notifications]'));
}

function setElementInert(element: HTMLElement, inert: boolean) {
  element.inert = inert;
  if (inert) element.setAttribute('inert', '');
  else element.removeAttribute('inert');
}

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    !element.matches(':disabled, [hidden]')
    && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && getComputedStyle(element).visibility !== 'hidden'
    && getComputedStyle(element).display !== 'none'
  ));
}

function focusElement(element: HTMLElement) {
  if (!element.hasAttribute('tabindex') && !element.matches(focusableSelector)) {
    element.setAttribute('tabindex', '-1');
  }
  element.focus({ preventScroll: true });
}

function focusFirstIn(dialog: HTMLElement) {
  const preferredCandidate = dialog.querySelector<HTMLElement>('[data-modal-initial-focus], [autofocus]');
  const preferred = preferredCandidate
    && !preferredCandidate.matches(':disabled, [hidden]')
    && !preferredCandidate.closest('[hidden], [inert], [aria-hidden="true"]')
    ? preferredCandidate
    : null;
  const focusable = getFocusableElements(dialog);
  const first = preferred
    ?? focusable.find((element) => !element.hasAttribute('data-modal-close'))
    ?? focusable[0]
    ?? dialog;
  focusElement(first);
}

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected
      && !element.matches(':disabled')
      && !element.closest('[inert], [aria-hidden="true"]'),
  );
}

function getFocusFallback(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#root main h1, #root [role="main"] h1, #root h1, main h1');
}

function syncModalEnvironment() {
  const top = modalStack.at(-1);
  if (!top) {
    notificationRegions().forEach(region => { region.style.zIndex = ''; });
    modalObserver?.disconnect();
    modalObserver = null;
    for (const [element, wasInert] of originalInert) setElementInert(element, wasInert);
    originalInert.clear();
    if (originalBodyOverflow !== null) {
      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = null;
    }
    return;
  }

  if (originalBodyOverflow === null) originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Keep the active dialog and the explicitly marked global toast portal interactive.
  // All other page content and lower dialogs remain inert. This also covers
  // sibling page content when a modal is rendered deep inside the application tree.
  const activeBranch = new Set<HTMLElement>();
  for (
    let element: HTMLElement | null = top.layer;
    element && element !== document.body;
    element = element.parentElement
  ) {
    activeBranch.add(element);
  }
  top.layer.querySelectorAll<HTMLElement>('*').forEach((element) => activeBranch.add(element));
  notificationRegions().forEach((region) => {
    activeBranch.add(region);
    region.querySelectorAll<HTMLElement>('*').forEach((element) => activeBranch.add(element));
    region.style.zIndex = String(100 + modalStack.length * 10);
  });

  document.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
    if (!originalInert.has(element)) {
      originalInert.set(element, element.inert || element.hasAttribute('inert'));
    }
    setElementInert(element, originalInert.get(element)! || !activeBranch.has(element));
  });

  modalStack.forEach((entry, index) => {
    entry.dialog.setAttribute('aria-modal', String(entry === top));
    entry.layer.style.zIndex = String(50 + index * 10);
  });
}

function onDocumentKeyDown(event: KeyboardEvent) {
  const top = modalStack.at(-1);
  if (!top || event.key !== 'Tab') return;
  const focusable = [...getFocusableElements(top.dialog), ...notificationRegions().flatMap(getFocusableElements)];
  if (focusable.length === 0) {
    event.preventDefault();
    focusElement(top.dialog);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const inside = focusable.includes(active as HTMLElement);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    focusElement(last);
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    focusElement(first);
  }
}

function onDialogKeyDown(entry: ModalEntry | null, event: ReactKeyboardEvent<HTMLDivElement>) {
  if (!entry || modalStack.at(-1) !== entry || event.key !== 'Escape' || event.defaultPrevented) return;

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest('[data-modal-notifications]')) return;
  // Select and MultiSelect stop propagation after closing their listbox, so Escape
  // reaches this handler on the next press and closes the dialog.
  if (
    target?.closest('[aria-haspopup="listbox"][aria-expanded="true"]')
    || target?.closest('[role="listbox"]')
  ) return;

  event.preventDefault();
  event.stopPropagation();
  entry.close();
}

function onDocumentFocusIn(event: FocusEvent) {
  const top = modalStack.at(-1);
  if (!top || top.dialog.contains(event.target as Node)
    || notificationRegions().some(region => region.contains(event.target as Node))) return;
  focusFirstIn(top.dialog);
}

function registerModal(entry: ModalEntry) {
  const isFirst = modalStack.length === 0;
  modalStack.push(entry);
  if (isFirst) {
    document.addEventListener('keydown', onDocumentKeyDown, true);
    document.addEventListener('focusin', onDocumentFocusIn, true);
    modalObserver = new MutationObserver(syncModalEnvironment);
    modalObserver.observe(document.body, { childList: true, subtree: true });
  }

  syncModalEnvironment();
  focusFirstIn(entry.dialog);

  return () => {
    const index = modalStack.indexOf(entry);
    if (index === -1) return;
    const wasTop = index === modalStack.length - 1;
    modalStack.splice(index, 1);
    if (modalStack.length === 0) {
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      document.removeEventListener('focusin', onDocumentFocusIn, true);
    }
    syncModalEnvironment();

    if (!wasTop) return;
    const nextTop = modalStack.at(-1);
    if (nextTop) {
      const returnTarget = entry.previousFocus;
      if (canRestoreFocus(returnTarget) && nextTop.dialog.contains(returnTarget)) {
        focusElement(returnTarget);
      } else {
        focusFirstIn(nextTop.dialog);
      }
      return;
    }

    queueMicrotask(() => {
      if (modalStack.length > 0) return;
      const returnTarget = entry.previousFocus;
      if (canRestoreFocus(returnTarget)) {
        focusElement(returnTarget);
        return;
      }
      const fallback = getFocusFallback();
      if (canRestoreFocus(fallback)) focusElement(fallback);
    });
  };
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef<ModalEntry | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openCycleRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      openCycleRef.current = false;
      openerRef.current = null;
      return;
    }
    if (!layerRef.current || !dialogRef.current) return;
    if (!openCycleRef.current) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openCycleRef.current = true;
    }
    const entry: ModalEntry = {
      layer: layerRef.current,
      dialog: dialogRef.current,
      previousFocus: openerRef.current,
      close: () => closeRef.current(),
    };
    entryRef.current = entry;
    const unregister = registerModal(entry);
    return () => {
      entryRef.current = null;
      unregister();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={layerRef}
      data-modal-layer
      onKeyDown={(event) => onDialogKeyDown(entryRef.current, event)}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={cx(
          'relative my-auto w-full rounded-2xl bg-white shadow-pop animate-scale-in',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="break-words text-lg font-bold text-ink">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 break-words text-sm leading-relaxed text-muted">{subtitle}</p>}
          </div>
          <button
            data-modal-close
            type="button"
            aria-label="Закрыть окно"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-neutral-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
