/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand orange (active tab, primary buttons)
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fda55b',
          500: '#fb923c', // Figma primary — active tab, primary buttons
          600: '#f97316',
          700: '#ea580c',
        },
        // Sidebar navy — 700 is the exact brand blue from the Fiztex logo (#274185).
        navy: {
          50: '#eef1f8',
          100: '#dbe2f0',
          400: '#5670a8',
          500: '#3a5490',
          600: '#2e4a89',
          700: '#274185',
          800: '#1f3570',
          900: '#182a5c',
          950: '#101d42',
        },
        // Семантические токены из макета Figma — см. :root в src/index.css.
        // Добавлены поверх шкал brand/navy, которые сознательно не тронуты:
        // на них висит вся существующая вёрстка.
        ink: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        subtle: 'var(--color-text-subtle)',
        link: 'var(--color-link)',
        line: 'var(--color-border-default)',
        surface: 'var(--color-surface)',
        disabled: 'var(--color-bg-disabled)',
        info: {
          bg: 'var(--color-info-bg)',
          badge: 'var(--color-info-badge-bg)',
          fg: 'var(--color-info-fg)',
        },
        // Типы событий школьного календаря и статус занятий.
        vacation: {
          bg: 'var(--color-vacation-bg)',
          fg: 'var(--color-vacation-fg)',
        },
        holiday: {
          bg: 'var(--color-holiday-bg)',
          fg: 'var(--color-holiday-fg)',
        },
        neutral: {
          bg: 'var(--color-neutral-bg)',
          fg: 'var(--color-neutral-fg)',
        },
        'no-lessons': {
          bg: 'var(--color-no-lessons-bg)',
          fg: 'var(--color-no-lessons-fg)',
        },
        pill: {
          active: 'var(--color-pill-active-bg)',
        },
        success: {
          bg: 'var(--color-success-bg)',
          fg: 'var(--color-success-fg)',
          border: 'var(--color-success-border)',
        },
        attention: {
          bg: 'var(--color-attention-bg)',
          fg: 'var(--color-attention-fg)',
        },
        danger: {
          bg: 'var(--color-danger-bg)',
        },
        warning: {
          bg: 'var(--color-warning-bg)',
        },
      },
      fontFamily: {
        // ВНИМАНИЕ: в макете шрифт Geist (Regular/Medium/SemiBold/Bold).
        // Здесь оставлен Inter — Geist не добавлен в зависимости,
        // подстановка сломала бы рендер. Решение по шрифту не принято.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Кегли макета, которых нет в шкале Tailwind.
        // Заменяют text-[10px] / text-[11px] / text-[13px] в вёрстке.
        10: 'var(--text-10)',
        11: 'var(--text-11)',
        13: 'var(--text-13)',
        15: 'var(--text-15)',
        28: 'var(--text-28)',
      },
      height: {
        // Ряды таймлайна занятости: 70px просмотр (2015:11009), 60px правка
        // (2015:11496). Обе высоты вне 4px-шкалы Tailwind — заведены явно,
        // чтобы не разъезжались между режимами.
        'slot-row': '70px',
        'slot-row-edit': '60px',
        // Ячейка месячной сетки школьного календаря (2015:10227).
        'slot-row-lg': '72px',
      },
      width: {
        // Колонка «ВРЕМЯ» в сетке занятости (2015:10997) — вне 4px-шкалы.
        'slot-time-col': '100px',
        // Селектор фильтра подстраниц расписания (2015:12037).
        'filter-select': '200px',
        // Фиксированные колонки таблицы событий календаря (2015:9782).
        // Колонка «ДАТЫ» тянется, остальные держат ширину — как в макете.
        'col-event-title': '200px',
        'col-event-type': '180px',
        'col-event-scope': '150px',
        'col-event-actions': '60px',
      },
      minWidth: {
        // Ниже этого сетка занятости уезжает в свой горизонтальный скролл,
        // чтобы дни не схлопывались в нечитаемые колонки.
        'slot-grid': '640px',
      },
      minHeight: {
        // Две колонки экрана занятости равной высоты (2015:11068): в макете
        // 935px при артборде 1080, здесь — нижняя граница, дальше по контенту.
        'availability-columns': '36rem',
      },
      letterSpacing: {
        // Подписи селекторов-фильтров (2015:12038).
        filter: '0.5px',
      },
      maxWidth: {
        // Ширина текста пустых состояний: 340px при 13px (2015:11338)
        // и 400px при 14px (2015:11167). Обе вне шкалы Tailwind.
        'state-text': '340px',
        'state-text-wide': '400px',
        // Ширина модалки «Новое событие» (2015:10714).
        'modal-form': '480px',
      },
      maxHeight: {
        // Скролл-список классов в модалке события (2015:10760).
        'class-list': '320px',
      },
      borderWidth: {
        // Рамка активного слота и кнопки «Отменить» (2015:12018, 2015:11553).
        1.5: '1.5px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        pop: '0 10px 30px -10px rgba(15, 23, 42, 0.25)',
        popover: 'var(--shadow-popover)',
        panel: 'var(--shadow-panel)',
        slot: 'var(--shadow-slot)',
        dialog: 'var(--shadow-dialog)',
        toast: 'var(--shadow-toast)',
        'toast-error': 'var(--shadow-toast-error)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.16s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
