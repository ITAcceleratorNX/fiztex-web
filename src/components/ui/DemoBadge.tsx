import { DEMO_MARK } from '@/lib/demoClass';

/** Метка тестового класса в таблицах и заголовках; в выпадающих списках — `withDemoMark`. */
export function DemoBadge() {
  return (
    <span
      title="Тестовый класс: для показа и пилота, не входит в настоящий состав школы"
      className="inline-flex shrink-0 items-center rounded bg-amber-100 px-1.5 py-0.5 text-10 font-bold uppercase tracking-wide text-amber-800"
    >
      {DEMO_MARK}
    </span>
  );
}
