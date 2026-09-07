import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

/**
 * Пометка машинного содержимого — парная к {@code DraftQuestionBadge}.
 *
 * <p>Это не метаданные, а предупреждение: перед классом отвечает учитель, и он должен
 * помнить об этом в момент, когда жмёт «Опубликовать», а не когда ребёнок принесёт
 * ошибку домой.
 *
 * <p>Пометка, а не заливка карточки цветом: когда машинных вопросов десять из десяти,
 * цветной фон перестаёт что-либо выделять и превращается просто в фон.
 *
 * <p><b>Компактный вид — для строки таблицы</b>, где на пометку нет ширины, а сама она
 * нужна не меньше: список заданий — то место, где учитель решает, какие перечитать
 * перед публикацией. Один компонент на оба вида, чтобы слово и цвет не разъехались.
 */
export function AiGeneratedBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        title={LABEL}
        aria-label={LABEL}
        role="img"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
      >
        <Sparkles className="size-3" aria-hidden />
      </span>
    );
  }

  return (
    <Badge tone="purple" dot>
      {LABEL}
    </Badge>
  );
}

const LABEL = 'Сгенерировано ИИ';
