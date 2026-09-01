import { QrCode } from 'lucide-react';
import { cx } from '@/lib/format';
import type { AttendanceQrOutcome } from '@/lib/attendanceQrApi';

/**
 * Отметка получена сканированием (ТЗ FE-001 §4).
 *
 * Источник берётся из списка сканов урока, а не из листа: бэкенд в самом листе его не
 * отдаёт, и менять контракт эта задача не должна.
 *
 * <b>Второй случай — не украшение.</b> `TEACHER_MARK_KEPT` значит, что ученик отсканировал
 * код, но статус ему уже поставил человек, и ручная отметка приоритетнее (backend §6). Это
 * единственное место, где учитель узнаёт, что отметил «отсутствовал» того, кто был в
 * классе, — поэтому чип показывается и здесь, но другим тоном.
 *
 * Цвет ничего не сообщает в одиночку: чип всегда подписан буквами «QR», а точное время и
 * смысл — в подсказке.
 */
export function QrSourceChip({
  outcome,
  scannedAt,
}: {
  outcome: AttendanceQrOutcome;
  scannedAt?: string;
}) {
  // «Уже отмечен» новой строки в журнале сканов не создаёт, но контракт его допускает —
  // на строку журнала он влияет так же, как обычная отметка по коду.
  const kept = outcome === 'TEACHER_MARK_KEPT';
  const at = scannedAt ? timeOf(scannedAt) : null;

  return (
    <span
      title={
        kept
          ? `Сканировал${at ? ` в ${at}` : ''}, статус поставлен вручную`
          : `Отмечен по QR${at ? ` в ${at}` : ''}`
      }
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-10 font-bold',
        kept ? 'bg-neutral-bg text-neutral-fg' : 'bg-navy-50 text-navy-700',
      )}
    >
      <QrCode className="size-3" aria-hidden />
      QR
    </span>
  );
}

function timeOf(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
