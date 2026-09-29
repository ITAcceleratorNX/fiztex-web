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

  // Keep only the active dialog and its ancestor path interactive. This also covers
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
  const focusable = getFocusableElements(top.dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    focusElement(top.dialog);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !top.dialog.contains(active))) {
    event.preventDefault();
    focusElement(last);
  } else if (!event.shiftKey && (active === last || !top.dialog.contains(active))) {
    event.preventDefault();
    focusElement(first);
  }
}

function onDialogKeyDown(entry: ModalEntry | null, event: ReactKeyboardEvent<HTMLDivElement>) {
  if (!entry || modalStack.at(-1) !== entry || event.key !== 'Escape' || event.defaultPrevented) return;

  const target = event.target instanceof HTMLElement ? event.target : null;
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
  if (!top || top.dialog.contains(event.target as Node)) return;
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
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            data-modal-close
            type="button"
            aria-label="Закрыть окно"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
