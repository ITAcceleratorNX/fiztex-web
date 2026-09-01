import { useEffect, useRef } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QrPoster } from '@/components/ui/QrPoster';

interface AttendanceQrOverlayProps {
  /** Строка для кода; пока её нет, показываем состояние ожидания, а не пустой квадрат. */
  payload: string | null;
  lessonTitle: string;
  /** Когда урок кончится — после этого момента код мёртв, и показывать его классу нельзя. */
  lessonEndsAt: string | null;
  busy: boolean;
  onReissue: () => void;
  /** Закрыть код. Все три пути выхода зовут именно его — других последствий у выхода нет. */
  onClose: () => void;
}

/**
 * Код на весь экран (ТЗ FE-001 §3).
 *
 * <b>Оверлей и есть сессия.</b> Экран открыт — код действует, экран закрыт — код погашен.
 * Отвергнутый вариант «свернуть, не закрывая» давал два выхода с разными последствиями:
 * учитель не обязан помнить, какой из них выключает код в классе. Поэтому `Esc`, крестик
 * и «Закрыть» делают одно и то же — путей выхода три, последствие одно.
 *
 * <b>Уход со страницы код не гасит</b> (этим занимается только явное закрытие): сетевой
 * сбой и случайное обновление вкладки не должны убивать отметку посреди урока. Сервер
 * сам перестанет принимать код в конце занятия.
 *
 * Счётчика отметившихся и таймера здесь нет — ТЗ §7 исключает оба, хотя данные для
 * счётчика приходят тем же ответом.
 */
export function AttendanceQrOverlay({
  payload,
  lessonTitle,
  lessonEndsAt,
  busy,
  onReissue,
  onClose,
}: AttendanceQrOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Фокус уходит на «Закрыть» и не покидает оверлей, пока он открыт; при закрытии
  // возвращается на кнопку, которая его открыла, — этим занимается браузер, потому что
  // источник фокуса остаётся в документе.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);

  // Звонок гасит код на сервере, поэтому в этот момент экран закрывается сам. Это не
  // таймер на экране (ТЗ §7 его исключает), а отказ показывать классу мёртвый код.
  useEffect(() => {
    if (!lessonEndsAt) return;
    const delay = new Date(lessonEndsAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay > 2_147_483_647) return;
    if (delay <= 0) {
      onCloseRef.current();
      return;
    }
    const timer = window.setTimeout(() => onCloseRef.current(), delay);
    return () => window.clearTimeout(timer);
  }, [lessonEndsAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="fixed inset-0 bg-slate-900/80 animate-fade-in motion-reduce:animate-none" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`QR-код посещаемости: ${lessonTitle}`}
        className="relative flex max-h-full w-full max-w-3xl flex-col gap-6 overflow-y-auto rounded-2xl bg-white px-6 py-6 shadow-pop animate-scale-in motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-4">
          {/* Какой это урок: учитель должен видеть, что показывает код нужного занятия. */}
          <p className="text-15 font-semibold text-ink">{lessonTitle}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть QR-код"
            className="-mr-2 -mt-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {payload ? (
          <QrPoster payload={payload} />
        ) : (
          <div
            className="mx-auto animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none"
            style={{ width: 'clamp(180px, min(100vh - 260px, 70vw), 560px)', aspectRatio: '1 / 1' }}
          />
        )}

        {/* Читает класс, а не учитель, — поэтому крупно. */}
        <p className="text-center text-28 font-semibold text-ink">
          Отсканируйте код в приложении PhysTech
        </p>

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              onClick={onReissue}
              loading={busy}
            >
              Показать новый код
            </Button>
            <Button data-autofocus onClick={onClose} disabled={busy}>
              Закрыть
            </Button>
          </div>
          {/* Подтверждения у перевыпуска нет: диалог на каждое «не сканируется» надоедает
              сильнее, чем разовая потеря кода, который ещё никто не успел отсканировать. */}
          <p className="text-11 text-muted">Прежний код перестанет действовать</p>
        </div>
      </div>
    </div>
  );
}
