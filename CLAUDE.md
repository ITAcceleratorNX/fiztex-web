# fiztex-web

Desktop-админка Fiztex. Vite 5 + React 18 + TypeScript, Tailwind CSS 3.4,
react-router 6, TanStack Query 5, lucide-react. Тесты — Vitest + Testing Library.

```bash
pnpm dev          # vite dev server
pnpm build        # tsc -b && vite build
pnpm lint         # tsc -p tsconfig.app.json --noEmit
pnpm test         # vitest run
```

## Типы API

`src/lib/api-types.ts` **сгенерирован** из `fiztex-back/docs/openapi.json`
(`pnpm gen:api`) — не править руками, изменения затрутся.

```ts
import type { Schema } from '@/lib/apiSchemas';
type Year = Schema<'AcademicYearView'>;
```

Новые DTO брать оттуда, а не дописывать в `src/lib/types.ts`. `types.ts` —
ручной legacy Scope 1; он остаётся рабочим, но не растёт. Искать эндпоинт —
грепом по `fiztex-back/docs/api-map.md`, а не чтением Java-контроллеров.

Сгенерированные поля ответов помечены `?` (springdoc не знает nullability
Java-полей). Это не значит, что поле может не прийти.

## Дизайн-токены

CSS-переменные объявлены в `:root` в `src/index.css`, в утилиты проброшены
через `theme.extend` в `tailwind.config.js`. Доступны `text-10`, `text-11`,
`text-13`, `text-15`, `text-28`, `shadow-popover`, `text-ink`, `text-muted`,
`border-line`, `bg-surface`, `bg-disabled`, `bg-info-bg`, `bg-success-bg`,
`text-success-fg`.

Не хардкодить hex и не писать `text-[13px]` — брать токен. Нет токена —
сначала завести его в `:root`.

Ограничение: цвета-токены объявлены как hex, поэтому модификаторы
прозрачности (`bg-info-bg/50`) на них не работают. Понадобится — заменить
значение на RGB-каналы и обернуть в `rgb(var(--…) / <alpha-value>)`.

### Откуда взяты значения

Источник — Figma `Copy of fiztex`, страница «Admin schedule » (node `2015:4887`,
59 экранов). **В файле объявлены только две переменные** — `brandcolor`
(`#274185`) и `2brandcolor` (`#fb923c`). Ни типографики, ни отступов, ни
радиусов, ни теней в переменных нет; все экраны свёрстаны сырыми значениями.

Остальные токены выведены из фактических стилей репрезентативных узлов
(кнопки, бейдж, статус, карточка, форма, поповер, заголовок). Это **вывод из
вёрстки, а не выгрузка**: значения реальные, имена придуманы здесь.

Полезный факт: макет почти целиком совпадает с дефолтной палитрой Tailwind
(`gray-200/300/500`, `blue-50`, `green-100/600`, `orange-400`), а все найденные
отступы (2–24) ложатся на дефолтную шкалу без остатка. Радиусы 4/6/8/16 —
это ровно `rounded`, `rounded-md`, `rounded-lg`, `rounded-2xl`.

Вне шкалы Tailwind оказались только: кегли **10/11/13/15/28px**, цвета
**`#274185`** и **`#1a1f36`**, тень **`0 4px 6px rgb(0 0 0 / .06)`**.

## Посещаемость урока

Лист урока — `/lesson-schedule/lessons/:lessonId/attendance`
(`platform/pages/schedule/LessonAttendancePage.tsx`), вход с плитки на карточке
урока. Просмотр и правка — режимы одного экрана, как в макете.

Правила отметки (какие сочетания `status`/`mark`/`reason` допустимы, что чистится
при смене статуса, что уходит в `PATCH`) живут в `src/lib/attendanceModel.ts` и
только там: то же правило продублировано в мобилке, и разъехаться им нельзя —
цифры месячных сводок считает бэкенд. Что разрешено делать, экран не вычисляет:
`canFill`/`canPublish`/`reminder` приходят посчитанными.

Сгенерированные типы знают только `undefined` (springdoc не описывает nullability),
а бэкенд шлёт `null`. Поэтому очистка поля — это `undefined` (ключ исчезает при
сериализации, Jackson читает его как `null`), а чтение — терпимое (`?? null`).

Даты одного занятия переключает `LessonDatePicker`: `LessonView.scheduleLessonId` —
ссылка на слот расписания, по ней `GET /api/lessons?scheduleLessonId=` отдаёт то же
занятие в другие дни. Отбор идёт по физическому слоту (класс, подгруппа, день недели,
время), а не по строке таблицы, поэтому переживает переиздание расписания.

Контракт экрана — `.cursor/tasks/attendance/screens/LessonAttendancePage.md`,
контракт API — `fiztex-back/docs/attendance-read-contract.md`.

## Расхождения макета и кода

Не устранены — требуют продуктового решения, не правьте молча:

| Что | В Figma | В коде |
|---|---|---|
| Шрифт | Geist (Regular/Medium/SemiBold/Bold) | `Inter` — Geist не в зависимостях |
| Основная кнопка | `btn-primary` = навy `#274185` | `variant="primary"` = `brand-500` оранжевый |
| Радиус кнопок и инпутов | 8px (`rounded-lg`) | `rounded-xl` 12px — доминирует |
| Тени на карточках | нет, только 1px `#e5e7eb` | `.card` = `shadow-card ring-1` |
| `btn-danger` | оранжевый `#fb923c` | `danger` = `red-500` |

Не проверено: `#9ca3af` (33 вхождения в коде) и `#1e293b` (23) в выборке из
Figma не встретились — либо из неотсемплированных частей макета, либо добавлены
в коде мимо дизайна. Прежде чем заводить в токены — сверить.

## Карта: Figma → код

### Базовые компоненты (`src/components/ui/`)

| Figma | Код | Замечание |
|---|---|---|
| `btn-orange` | `Button variant="primary"` | цвета совпадают |
| `btn-primary` | — | навy-кнопки в коде нет |
| `btn-secondary` | `Button variant="secondary"` | в макете 13px, радиус 8 |
| `btn-danger`, `btn-destructive` | `Button variant="danger"` | цвет расходится |
| `btn-save-disabled` | `Button disabled` | макет: `#d1d5db` |
| `badge`, `area-badge` | `Badge` | 11px, радиус 4 |
| `status-green` | `MaterialStatusBadge`, `TestStatusBadge` | остальные статусы сверить |
| `Card_Working_Days`, `Card_Events` | `.card` в `index.css` | без тени, радиус 16 |
| `settings-card` | — | отдельного компонента нет |
| `DayChip` | `WeekdayPicker` | 64×48, активный — навy |
| `form-field` + `input-box` | `Field` + `TextInput` | радиус 8, метка 13px |
| `dropdown-popover`, `dropdown-item` | `Select` | единственная тень в макете |

Без сопоставления в Figma (искать при следующем проходе): `Avatar`,
`ConfirmDialog`, `CopyCode`, `DateRangeInput`, `DraftQuestionBadge`,
`DraftReviewBanner`, `Modal`, `SearchInput`, `StatCard`, `StateBlock`,
`Switch`, `Tabs`, `TimeInput`, `Toggle`.

`Switch` и `Toggle` — два отдельных файла с похожей ролью; вероятно дубль
одного компонента макета. Проверить при сверке.

### Каркас (`src/components/layout/`)

| Figma | Код |
|---|---|
| `Component 1` (инстанс 220×1080 на всех экранах) | `Sidebar` |
| — | `AppLayout`, `AppHeader`, `Logo` |

### Формулы

Текст вопроса, варианта ответа, эталонного ответа и критериев может содержать формулы
(`$…$`, `$$…$$` — см. `fiztex-back/docs/formula-contract.md`). Выводить такой текст только
через `MathText`, а не `{q.text}`: иначе ученик увидит разметку. Редактирование —
`FormulaField` (поле + кнопка «Формула» + предпросмотр), окно формулы — `FormulaEditorModal`
(MathLive подгружается динамическим `import()`). Живая проверка полей — `lib/formulaChecks.ts`.

### Рисунок к вопросу

Схема, график или чертёж хранится не в теле теста, а своим эндпоинтом
(`POST/DELETE /api/admin/questions/{id}/image`), поэтому сохранение вопросов его не трогает.
Загрузка — `QuestionImageField` (только для уже сохранённого вопроса: у нового нет id), показ
ученику и в разборе — `QuestionFigure`. Увеличение — наложение внутри страницы, а не новая
вкладка: во время попытки уход со страницы античит считает нарушением.

### Прочее

- `src/components/review/` — `AnswerReviewCard`, `PhotoViewer`, `ScoreEditor`, `SuspiciousLog`
- `src/platform/components/` — `AccountActionsMenu`, `CreateUserMenu`, `ProfileChrome`, `TagSearchField`
- Модалки: 18 в `src/platform/modals/`, 14 в `src/pages/modals/`
- CSS-классы вместо компонентов: `.card`, `.input-base`, `.label-base`,
  `.bg-grid`, `.no-scrollbar` в `src/index.css` — кандидаты на вынос в `ui/`

### Как читать макет

`get_variable_defs` требует **слой**, а не страницу: на node страницы
(`2015:4887`) он падает с невнятным «nothing selected». Передавайте id фрейма.
