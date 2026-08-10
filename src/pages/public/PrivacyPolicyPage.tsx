import { useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Home, Languages } from 'lucide-react';
import { EntranceShell } from '@/pages/entrance/EntranceShell';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ROUTES } from '@/lib/routes';
import {
  PRIVACY_POLICY,
  POLICY_UI,
  type PolicyBlock,
  type PolicyLocale,
} from '@/lib/privacyPolicy';

/**
 * Политика конфиденциальности, русская и английская версии.
 *
 * <p>Язык живёт в query-параметре, а не в состоянии компонента: у каждой версии
 * должна быть своя прямая ссылка. Её спрашивают магазины приложений и присылают
 * в переписке, а «откройте и переключите тумблер» ссылкой не является.
 *
 * <p>Страница публичная: политику читают до входа, в том числе те, у кого
 * учётной записи нет вовсе.
 */
export function PrivacyPolicyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = parseLocale(searchParams.get('lang'));

  // Политику открывают с трёх разных экранов, поэтому возврат — по истории, а не
  // на конкретный адрес: уводить со страницы анонса на форму входа неправильно.
  //
  // `key === 'default'` — внутренней истории нет: страницу открыли прямой
  // ссылкой (из магазина приложений, из переписки, в новой вкладке), и
  // `navigate(-1)` увёл бы с сайта. Считаем один раз при монтировании:
  // переключение языка делает `replace`, ключ перестаёт быть `'default'`,
  // а возвращаться по-прежнему некуда.
  const cameFromApp = useRef(location.key !== 'default').current;

  const doc = PRIVACY_POLICY[locale];
  const ui = POLICY_UI[locale];
  useDocumentTitle(doc.title);

  function switchLocale() {
    // replace, чтобы переключение языка не засоряло историю браузера.
    setSearchParams({ lang: ui.otherLocale }, { replace: true });
  }

  return (
    <EntranceShell size="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {cameFromApp ? (
          <button type="button" onClick={() => navigate(-1)} className={BACK_LINK}>
            <ArrowLeft className="h-4 w-4" />
            {ui.back}
          </button>
        ) : (
          <Link to={ROUTES.publicAnnouncements} className={BACK_LINK}>
            <Home className="h-4 w-4" />
            {ui.home}
          </Link>
        )}
        <button
          type="button"
          onClick={switchLocale}
          lang={ui.otherLocale}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy-800 shadow-card ring-1 ring-slate-200/70 transition hover:ring-brand-500/40"
        >
          <Languages className="h-4 w-4 text-brand-500" />
          {ui.switchTo}
        </button>
      </div>

      {/* lang нужен не для красоты: без него скринридер прочитает английский текст по-русски. */}
      <article lang={locale} className="mt-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-navy-800 sm:text-3xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{doc.updatedAt}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-navy-800">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </EntranceShell>
  );
}

/** Кнопка «Назад» и ссылка «На главную» выглядят одинаково — различие в поведении. */
const BACK_LINK =
  'inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-navy-800';

function Block({ block }: { block: PolicyBlock }) {
  if (block.type === 'h3') {
    return <h3 className="pt-2 text-base font-semibold text-navy-800">{block.text}</h3>;
  }
  if (block.type === 'ul') {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm leading-relaxed text-slate-600">{block.text}</p>;
}

/** Неизвестный или отсутствующий язык — русский: платформа русскоязычная. */
function parseLocale(raw: string | null): PolicyLocale {
  return raw === 'en' ? 'en' : 'ru';
}
