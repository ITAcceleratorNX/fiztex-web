import { KeyValueList, type KeyValueRow } from '@/components/ui/KeyValueList';
import type { KspContext, KspJobSource, KspTopicSource } from '@/lib/kspApi';
import { ORIGIN_LABEL, originOf, wishesLabel } from '@/lib/kspModel';
import { SourceBadge } from './KspPreparation';

/**
 * «Исходные данные» генерации (Figma Г1, Г2): с чем задача запущена. Значения — из самой
 * задачи (`source`), а не из формы: учитель мог уйти со страницы и вернуться, а форма жила
 * только во вкладке. Кнопок правки здесь нет — исходные данные меняют на подготовке.
 */
export function KspSourceCard({ context, source }: { context: KspContext; source: KspJobSource | undefined }) {
  const row = (key: string, label: string, field: keyof KspTopicSource): KeyValueRow | null => {
    const value = source?.[field];
    if (!value) return null;
    const origin = originOf(context, field, value);
    return {
      key, label, value,
      aside: <SourceBadge tone={origin === 'KTP' ? 'navy' : 'gray'}>{ORIGIN_LABEL[origin]}</SourceBadge>,
    };
  };
  const wishes = wishesLabel(source, context.hints);
  const rows = [
    row('section', 'Раздел', 'section'),
    row('topic', 'Тема урока', 'topic'),
    row('objectives', 'Цели обучения', 'learningObjectives'),
    wishes ? { key: 'wishes', label: 'Пожелания', value: wishes } : null,
  ].filter((item): item is KeyValueRow => item != null);

  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-xs font-bold uppercase text-planning-subtle">Исходные данные</h3>
      <KeyValueList rows={rows} />
    </section>
  );
}
