import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { Logo, PhysTechMark } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { cx, initials } from '@/lib/format';
import { navSectionsForRole, type NavItem, type NavSection } from './navConfig';

/**
 * Ключ свёрнутого состояния. Оно переживает перезагрузку намеренно: свернув панель ради
 * места на экране, человек не хочет разворачивать её заново после каждого F5.
 */
const COLLAPSED_KEY = 'fiztex.sidebar.collapsed';

/**
 * Последняя открытая группа. Тоже переживает перезагрузку: без неё на «Главной» — она
 * не входит ни в одну группу — меню состояло бы из одних заголовков, и первый переход
 * стоил бы лишнего клика каждый раз.
 */
const OPEN_SECTION_KEY = 'fiztex.sidebar.section';

const RAIL_WIDTH = 'w-[72px]';
const PANEL_WIDTH = 'w-[220px]';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    // Приватное окно или заблокированные site data: панель просто останется развёрнутой.
    return false;
  }
}

function readOpenSection(): string | null {
  try {
    return localStorage.getItem(OPEN_SECTION_KEY);
  } catch {
    return null;
  }
}

function isRouteActive(to: string, end: boolean | undefined, pathname: string): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function isBranchActive(item: NavItem, pathname: string): boolean {
  return (
    isRouteActive(item.to, item.end, pathname) ||
    (item.children ?? []).some((child) => isRouteActive(child.to, child.end, pathname))
  );
}

/**
 * Боковое меню.
 *
 * <p><b>Два независимых состояния, и это не усложнение, а следствие замера.</b> У
 * администратора шестнадцать пунктов в четырёх группах — это 991 px меню в окно 708 px.
 * Ширина тут ни при чём: свернуть панель в рельс проблему не решает, потому что болит
 * высота. Поэтому:
 *
 * <ul>
 *   <li><b>Группы складываются</b> (аккордеон). Открыта та, в которой пользователь сейчас;
 *       остальные — одна строка с числом пунктов. Меню перестаёт прокручиваться, и
 *       «много разделов» начинает читаться как структура школы, а не как длинный список.</li>
 *   <li><b>Рельс раскрывается по наведению</b> — поверх страницы, не двигая её. Подписи
 *       возвращаются без единого клика, а контент навсегда получает лишние 148 px.</li>
 * </ul>
 *
 * <p>Панель поэтому нарисована абсолютом внутри распорки: ширину в раскладке задаёт
 * распорка (72 или 220), а видимую ширину — сама панель. Иначе наведение раздвигало бы
 * страницу и текст под курсором прыгал бы.
 */
export function Sidebar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  // Меню зависит от роли: разделы админки под учителем отвечают 401 и рвут сессию.
  const sections = navSectionsForRole(admin?.role);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [peeking, setPeeking] = useState(false);

  // Свёрнутая панель, на которую навели (или в которой оказался фокус), выглядит как
  // развёрнутая. `focus-within` не роскошь: с клавиатуры наведения не бывает, а меню
  // из безымянных значков непроходимо.
  const wide = !collapsed || peeking;

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* хранилище недоступно — состояние живёт до перезагрузки */
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((value) => !value);
    // Свернули мышью, не убирая курсор с панели, — иначе она осталась бы «раскрытой по
    // наведению» и выглядела бы так, будто кнопка не сработала.
    setPeeking(false);
  }, []);

  // Только складывающиеся группы: «Главная» лежит в безымянной секции, и считать её
  // активной значило бы закрывать открытую группу каждый раз, когда человек заглянул на
  // главную. Группа, в которой он работает, переход на главную переживает.
  const activeSectionId = useMemo(
    () =>
      sections.find(
        (section) =>
          Boolean(section.label) &&
          section.items.some((item) => isBranchActive(item, location.pathname)),
      )?.id ?? null,
    [sections, location.pathname],
  );
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    () => activeSectionId ?? readOpenSection(),
  );

  // Переход в раздел из другой группы открывает эту группу. Ручной выбор при этом живёт
  // до следующего перехода: закрыл группу, чтобы посмотреть соседнюю, — она не схлопнется
  // обратно сама.
  useEffect(() => {
    if (activeSectionId) setOpenSectionId(activeSectionId);
  }, [activeSectionId]);

  useEffect(() => {
    try {
      if (openSectionId) localStorage.setItem(OPEN_SECTION_KEY, openSectionId);
      else localStorage.removeItem(OPEN_SECTION_KEY);
    } catch {
      /* хранилище недоступно — выбор живёт до перезагрузки */
    }
  }, [openSectionId]);

  return (
    <div className={cx('relative shrink-0 transition-[width] duration-200', collapsed ? RAIL_WIDTH : PANEL_WIDTH)}>
      <aside
        onMouseEnter={() => collapsed && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
        onFocus={() => collapsed && setPeeking(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPeeking(false);
        }}
        className={cx(
          'absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden bg-navy-700 transition-[width] duration-200',
          wide ? PANEL_WIDTH : RAIL_WIDTH,
          // Тень только у раскрытой поверх страницы: у закреплённой панели края всё равно
          // нет, а тень «в никуда» выглядит грязью.
          collapsed && peeking && 'shadow-2xl shadow-navy-950/40',
        )}
      >
        {/* Figma 2015:7789 — 140px, bottom 120px, 8% белого. В рельсе знака нет:
         * на 72 точках он превращается в пятно поперёк всей ширины. */}
        {wide && (
          <PhysTechMark className="pointer-events-none absolute bottom-[120px] left-1/2 size-[140px] -translate-x-1/2 text-white/[0.08]" />
        )}

        <div className={cx('flex items-center justify-center', wide ? 'px-6 pb-6 pt-12' : 'px-2 pb-4 pt-6')}>
          {wide ? (
            /* Figma 2015:7728 — высота лого 36px. Ширину не фиксирую на 133px:
             * в макете это обрезанный фрагмент (соотношение 3.69), а наш ассет —
             * 496×198 (2.505), растягивание исказило бы знак. */
            <Logo className="h-9 w-auto" />
          ) : (
            /* Рельс показывает знак без слова: локап в 72 точки не помещается, а
             * обрезанный читается как ошибка вёрстки. */
            <PhysTechMark className="h-[30px] w-auto text-white" />
          )}
        </div>

        <nav className="no-scrollbar relative z-10 flex-1 overflow-y-auto pb-4 pt-1">
          {sections.map((section, index) => (
            <SidebarSection
              key={section.id}
              section={section}
              wide={wide}
              first={index === 0}
              open={openSectionId === section.id}
              onToggle={() =>
                setOpenSectionId((current) => (current === section.id ? null : section.id))
              }
            />
          ))}
        </nav>

        <SidebarFooter
          wide={wide}
          collapsed={collapsed}
          onToggle={toggle}
          fullName={admin?.fullName}
          onLogout={logout}
        />
      </aside>
    </div>
  );
}

/**
 * Группа меню.
 *
 * <p>Складывается только группа с названием. Безымянная — это «Главная» в одиночестве, и
 * заголовок «▸ 1 пункт» над ней был бы церемонией вокруг одной строки.
 *
 * <p>В рельсе заголовков нет — они туда не помещаются ни целиком, ни аббревиатурой, — но
 * группировка остаётся линией-разделителем: без неё шестнадцать значков сливаются в стену.
 * Рельс при этом показывает <b>все</b> пункты, а не только открытую группу: узкая полоса —
 * это быстрый переход «всё сразу», и прятать в ней половину значков значило бы заставлять
 * наводиться ради того, что и так помещается.
 */
function SidebarSection({
  section,
  wide,
  first,
  open,
  onToggle,
}: {
  section: NavSection;
  wide: boolean;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const collapsible = Boolean(section.label);

  if (!wide) {
    return (
      <div className={cx('space-y-0.5', !first && 'mt-1.5 border-t border-white/10 pt-1.5')}>
        {section.items.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </div>
    );
  }

  if (!collapsible) {
    return (
      <div className="mb-2">
        {section.items.map((item) => (
          <SidebarNavItem key={item.to} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-7 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 transition hover:text-white/60"
      >
        <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
        {/* Число пунктов — единственное, что закрытая группа может сказать о себе.
         * Без него «ПРИЁМ ▸» не отличить от пустого раздела. */}
        {!open && <span className="shrink-0 tabular-nums text-white/25">{section.items.length}</span>}
        <ChevronDown
          className={cx('size-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
        />
      </button>

      {open && (
        <div className="pb-2">
          {section.items.map((item) => (
            <SidebarNavItem key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Низ панели: кнопка сворачивания и профиль.
 *
 * <p>Кнопка стоит здесь, а не по центру панели, как в макете, и не внутри меню, как было
 * сначала. В макете нарисовано меню учителя из пяти пунктов, и «центр панели» там и есть
 * «сразу под меню»; у администратора пунктов шестнадцать, они доходят до центра, и кнопка
 * там резала строку синей полосой. Низ панели — единственное место, где она не пересекается
 * с меню ни при какой длине и не уезжает вместе с прокруткой.
 *
 * <p>Слева, а не справа, тоже намеренно: при раскрытии по наведению панель растёт вправо,
 * и кнопка у правого края убегала бы из-под курсора ровно в тот момент, когда к ней тянутся.
 */
function SidebarFooter({
  wide,
  collapsed,
  onToggle,
  fullName,
  onLogout,
}: {
  wide: boolean;
  collapsed: boolean;
  onToggle: () => void;
  fullName?: string;
  onLogout: () => void;
}) {
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;
  const label = collapsed ? 'Развернуть меню' : 'Свернуть меню';

  return (
    <div className={cx('relative z-10 pb-6', wide ? 'px-4' : 'px-2')}>
      <div className={cx('mb-2 flex', wide ? 'justify-start pl-1' : 'justify-center')}>
        <button
          type="button"
          onClick={onToggle}
          title={label}
          aria-label={label}
          aria-expanded={!collapsed}
          className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
        >
          <Icon className="size-4" />
        </button>
      </div>

      {wide ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xs font-bold text-white">
            {fullName ? initials(fullName) : 'A'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-13 font-semibold text-white">
              {fullName ?? 'Администратор'}
            </p>
            <p className="truncate text-11 text-white/60">Администратор</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Выйти"
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      ) : (
        /* В макете у рельса нарисован только аватар, но выход убирать нельзя: другого
         * места у него нет, а до наведения панель о нём не расскажет. */
        <div className="flex flex-col items-center gap-2">
          <span
            title={fullName ?? 'Администратор'}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
          >
            {fullName ? initials(fullName) : 'A'}
          </span>
          <button
            type="button"
            onClick={onLogout}
            title="Выйти"
            aria-label="Выйти"
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Renders one nav item; expands children when this branch is on-route. */
function SidebarNavItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const children = item.children ?? [];
  const selfActive = isRouteActive(item.to, item.end, location.pathname);
  const childActive = children.some((child) =>
    isRouteActive(child.to, child.end, location.pathname),
  );
  const branchOpen = selfActive || childActive;

  if (children.length === 0) {
    return <TopLevelLink item={item} />;
  }

  return (
    <div
      className={cx(
        // Без overflow-hidden: верхнее сопряжение декора выходит за пределы ветки.
        // Нижний радиус поэтому задан на последнем пункте, а не обрезкой.
        branchOpen && 'rounded-tl-[24px] rounded-bl-[24px] bg-white/45',
      )}
    >
      <NavLink
        to={item.to}
        end={item.end}
        className={cx(
          'nav-fillets relative z-10 flex h-[52px] items-center gap-3 pl-7 pr-3 text-sm transition',
          branchOpen
            ? cx(
                'font-semibold text-navy-700',
                selfActive && !childActive
                  ? 'nav-fillets-active rounded-tl-[24px] bg-white'
                  : 'bg-transparent',
              )
            : 'font-normal text-white/45 hover:text-white/80',
        )}
      >
        <item.icon
          className={cx('size-[18px] shrink-0', branchOpen ? 'text-navy-700' : 'text-white/45')}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cx(
            'size-6 shrink-0 transition-transform',
            branchOpen ? 'text-navy-700' : 'text-white/45 -rotate-90',
          )}
        />
      </NavLink>

      {branchOpen &&
        children.map((child, index) => (
          <ChildLink
            key={child.to}
            item={child}
            isLast={index === children.length - 1}
          />
        ))}
    </div>
  );
}

/**
 * Пункт рельса (Figma `sidebar-tekushchiy-urok-inactive`): пилюля со значком по центру.
 *
 * <p>Роли те же, что у широкого пункта: активный белый, «Текущий урок» оранжевый,
 * остальные — просто значок. Сопряжений (`nav-fillets`) здесь нет ни у кого: пилюля не
 * доходит до края панели, и «вырезать» её из полотна не из чего.
 *
 * <p>Высота 44, а не 52 как в макете: у администратора шестнадцать пунктов, и на макетном
 * шаге рельс выходил длиннее развёрнутого меню — то есть свёрнутый вид делал хуже ровно то,
 * ради чего его сворачивают. Подпись при этом никуда не делась: она в `title` и в раскрытии
 * по наведению.
 */
function RailLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const Icon = item.icon;
  const active = isBranchActive(item, location.pathname);
  const tone = item.accent
    ? 'bg-brand-500 text-white hover:bg-brand-600'
    : active
      ? 'bg-white text-navy-700'
      : 'text-white/45 hover:bg-white/10 hover:text-white/80';

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      className={cx(
        'relative z-10 mx-3 flex h-11 items-center justify-center rounded-full transition',
        tone,
      )}
    >
      <Icon className="size-[18px] shrink-0" />
    </NavLink>
  );
}

function TopLevelLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (item.accent) return <AccentLink item={item} />;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'nav-fillets relative z-10 flex h-12 items-center gap-3 pl-6 pr-3 text-sm transition',
          isActive
            ? 'nav-fillets-active rounded-tl-[24px] rounded-bl-[24px] bg-white font-semibold text-navy-700'
            : 'font-normal text-white/45 hover:text-white/80',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cx('size-5 shrink-0', isActive ? 'text-navy-700' : 'text-white/45')} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.noApi ? (
            <span
              className={cx(
                'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                isActive ? 'bg-navy-50 text-navy-500' : 'bg-white/10 text-white/40',
              )}
            >
              нет API
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/**
 * Пункт-действие (Figma `sidebar-tekushchiy-urok`): всегда оранжевый, без состояния
 * «вы здесь».
 *
 * <p>Подсветки активного маршрута здесь нет намеренно, а не по недосмотру: адрес пункта —
 * переход, он сразу заменяет себя карточкой урока, и «активным» этот пункт не бывает
 * дольше одного кадра. Мигающая подсветка на пути к другому экрану читалась бы как сбой.
 *
 * <p>Форма — пилюля, скруглённая только слева и упирающаяся в правый край. Сопряжений
 * (`nav-fillets`) у неё в макете нет, в отличие от активного пункта: тот «вырезан» из
 * полотна меню, а эта кнопка положена поверх него.
 */
function AccentLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className="relative z-10 flex h-12 items-center gap-3 rounded-l-full bg-brand-500 pl-6 pr-3 text-sm font-semibold text-white transition hover:bg-brand-600"
    >
      <Icon className="size-5 shrink-0 text-white" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </NavLink>
  );
}

function ChildLink({ item, isLast }: { item: NavItem; isLast: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'nav-fillets relative z-10 flex h-[52px] items-center gap-3 pl-7 pr-3 text-sm transition',
          // Радиус на последнем пункте безусловно: обёртка больше не режет по overflow.
          isLast && 'rounded-bl-[24px]',
          isActive
            ? 'nav-fillets-active bg-white font-semibold text-navy-700'
            : 'font-normal text-navy-700/80 hover:bg-white/40 hover:text-navy-700',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cx('size-[18px] shrink-0', isActive ? 'text-navy-700' : 'text-navy-700/70')}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.noApi ? (
            <span className="shrink-0 rounded bg-navy-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-navy-500">
              нет API
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}
