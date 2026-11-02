import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';

const GAP = 8;
const MARGIN = 8;

export interface PanelPlacement {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight?: number;
}

/**
 * Где поставить панель у якоря, чтобы она целиком осталась в окне.
 *
 * Правым краем к правому краю якоря, под ним — как раньше рисовались выпадающие оценки; не
 * помещается снизу — над якорем; не помещается нигде — во всю высоту окна с прокруткой.
 * Слева панель упирается в отступ окна, а не уезжает за него: при ширине около 365 px
 * абсолютный попап оценки вылезал влево под боковое меню, и нажатие по оценке открывало
 * раздел меню (QA-04).
 */
export function placePanel(
  anchor: Pick<DOMRect, 'top' | 'bottom' | 'right'>,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): PanelPlacement {
  const maxWidth = Math.max(0, viewport.width - MARGIN * 2);
  const width = Math.min(panel.width, maxWidth);
  const left = Math.max(MARGIN, Math.min(anchor.right - width, viewport.width - width - MARGIN));
  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - panel.height;
  if (below + panel.height <= viewport.height - MARGIN) return { top: below, left, maxWidth };
  if (above >= MARGIN) return { top: above, left, maxWidth };
  return { top: MARGIN, left, maxWidth, maxHeight: Math.max(0, viewport.height - MARGIN * 2) };
}

/**
 * Всплывающая панель у элемента, внутри которого её отрисовали (якорь — родитель).
 *
 * Панель уходит порталом в `body` с `position: fixed`: так её не обрезает ни таблица, ни
 * прокручиваемая карточка, и она лежит поверх бокового меню, а не под ним. Положение
 * пересчитывается при прокрутке, изменении окна и размера самой панели.
 *
 * Открывшись, панель забирает фокус на первый (или отмеченный) элемент: из-за портала она
 * стоит в конце документа, и без этого с клавиатуры до неё было бы не дойти.
 */
export const AnchoredPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AnchoredPanel({ className, style, children, ...rest }, ref) {
    const anchorRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => panelRef.current as HTMLDivElement);
    const [placement, setPlacement] = useState<PanelPlacement | null>(null);

    const update = useCallback(() => {
      const anchor = anchorRef.current?.parentElement;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      setPlacement(placePanel(
        anchor.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ));
    }, []);

    useLayoutEffect(() => {
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
      if (panelRef.current) observer?.observe(panelRef.current);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
        observer?.disconnect();
      };
    }, [update]);

    useLayoutEffect(() => {
      const anchor = anchorRef.current?.parentElement;
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>('[aria-pressed="true"]')
        ?? panel?.querySelector<HTMLElement>('button:not([disabled]), select, input');
      target?.focus({ preventScroll: true });
      return () => {
        // Фокус возвращается туда, откуда панель открыли, — иначе он терялся бы в конце body.
        if (panel?.contains(document.activeElement)) {
          anchor?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
        }
      };
    }, []);

    const position: CSSProperties = placement
      ? {
          position: 'fixed',
          top: placement.top,
          left: placement.left,
          maxWidth: placement.maxWidth,
          maxHeight: placement.maxHeight,
          overflowY: placement.maxHeight != null ? 'auto' : undefined,
        }
      : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' };

    return (
      <>
        <span ref={anchorRef} hidden />
        {createPortal(
          <div ref={panelRef} className={cx('z-[60]', className)} style={{ ...style, ...position }} {...rest}>
            {children}
          </div>,
          document.body,
        )}
      </>
    );
  },
);
