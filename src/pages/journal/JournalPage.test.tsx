import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalPage } from './JournalPage';

const useGradebookContext = vi.fn();
const useJournal = vi.fn();
const useClassFinals = vi.fn();
const setFinal = vi.fn();
const publishFinals = vi.fn();

const useAssessmentSheets = vi.fn();
const saveScores = vi.fn();
const saveStatus = vi.fn();
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useAssessmentSheets: (...args: unknown[]) => useAssessmentSheets(...args),
  useSaveAssessmentScores: () => ({ mutateAsync: saveScores, isPending: false }),
  useGradebookContext: (...args: unknown[]) => useGradebookContext(...args),
  useJournal: (...args: unknown[]) => useJournal(...args),
  useClassFinals: (...args: unknown[]) => useClassFinals(...args),
  useSetFinalGrade: () => ({ mutateAsync: setFinal, isPending: false }),
  usePublishClassFinals: () => ({ mutateAsync: publishFinals, isPending: false }),
  usePeriodBreakdown: () => ({ isPending: true, data: undefined }),
  useSaveAttestationStatus: () => ({ mutateAsync: saveStatus, isPending: false }),
}));

function context() {
  return {
    academicYear: { id: 5, name: '2026/2027', startDate: '2026-08-01', endDate: '2027-05-25' },
    periods: [
      {
        id: 7,
        name: '1 четверть',
        startDate: '2026-08-01',
        endDate: '2026-11-23',
        current: true,
      },
    ],
    scopes: [
      { classId: 18, className: '7 «А»', subjectId: 2, subjectName: 'Математика' },
      { classId: 18, className: '7 «А»', subjectId: 3, subjectName: 'Физика' },
    ],
  };
}

function journal() {
  return {
    classId: 18,
    subgroupId: null,
    availableSubgroups: [],
    period: { id: 7, name: '1 четверть', windowFrom: '2026-08-01', windowTo: '2026-11-23' },
    columns: [
      {
        key: 'LESSON:449',
        type: 'LESSON',
        sourceId: 449,
        date: '2026-09-09',
        lessonNumber: 1,
        active: true,
      },
      {
        key: 'LESSON:450',
        type: 'LESSON',
        sourceId: 450,
        date: '2026-09-10',
        lessonNumber: 2,
        active: false,
      },
      // Урок без оценки — та самая клетка, которая ведёт в урок.
      {
        key: 'LESSON:451',
        type: 'LESSON',
        sourceId: 451,
        date: '2026-09-11',
        lessonNumber: 3,
        active: true,
      },
    ],
    rows: [
      {
        studentProfileId: 19,
        studentName: 'Иванов Арсен',
        currentMember: true,
        average: { value: 4.33, count: 1, visibleCount: 1 },
        cells: [{ columnKey: 'LESSON:449', grades: [{ id: 1, scaleCode: '4+' }] }],
      },
    ],
  };
}

function finals(overrides: Record<string, unknown> = {}) {
  return {
    classId: 18,
    subjectId: 2,
    academicPeriodId: 7,
    academicYearId: 5,
    canManage: true,
    rows: [
      {
        studentProfileId: 19,
        studentName: 'Иванов Арсен',
        currentMember: true,
        average: 4.33,
        recommendedValue: 4,
        finalGrade: null,
        yearLocked: false,
        // Действия строки считает сервер (ATTESTATION-001): учитель, итога нет.
        canEditResult: true,
        canChangeAttestation: true,
        canConfirmPublication: false,
        historyCount: 0,
      },
    ],
    allowedResultKinds: ['NUMERIC', 'TEMP_UNATTESTED', 'NOT_ATTESTED', 'NOT_STUDIED'],
    canManageAttestation: true,
    ...overrides,
  };
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/grades${search}`]}>
      <Routes>
        <Route path="/grades" element={<JournalPage />} />
        <Route path="/lesson-schedule/lessons/:lessonId/grades" element={<p>Открыт лист оценок урока</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function resetMocks() {
  vi.clearAllMocks();
  useAssessmentSheets.mockReturnValue([]);
  useGradebookContext.mockReturnValue({
    data: context(),
    isPending: false,
    isError: false,
    error: null,
  });
  useJournal.mockReturnValue({ data: journal(), isPending: false, isError: false, error: null });
  useClassFinals.mockReturnValue({
    data: finals(),
    isPending: false,
    isError: false,
    error: null,
  });
}

describe('JournalPage', () => {
  beforeEach(resetMocks);

  it('открывается на текущей четверти и первой доступной паре «класс + предмет»', () => {
    renderPage();

    expect(useJournal).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 18, subjectId: 2, academicPeriodId: 7 }),
    );
    expect(screen.getByRole('button', { name: 'Оценка 4+' })).toBeInTheDocument();
  });

  /** Журнал — зеркало: пустая клетка ведёт в урок, где оценку и ставят. */
  it('пустая клетка активного урока ведёт на экран оценок урока', () => {
    renderPage();

    const link = screen.getAllByRole('link').find((node) => node.textContent === '+');
    expect(link).toHaveAttribute('href', '/lesson-schedule/lessons/451/grades');
  });

  it('урок прежней версии расписания с оценками не называется несостоявшимся (пилот 3.3)', () => {
    const data = journal();
    data.columns[1] = { ...data.columns[1], state: 'LESSON_SUPERSEDED' } as (typeof data.columns)[number];
    useJournal.mockReturnValue({ data, isPending: false, isError: false, error: null });
    renderPage();

    expect(screen.queryByText(/не состоялось/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/не состоялось/i)).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /10\.09\s*Урок 2/ })).toBeInTheDocument();
    // Шапка колонки и пустая клетка ученика без оценки говорят одно и то же.
    expect(screen.getAllByTitle(/прежней версии расписания/)).toHaveLength(2);
  });

  it('отменённый урок помечен отменой, а пустая клетка объясняет, что новых оценок не будет', () => {
    const data = journal();
    data.columns[1] = { ...data.columns[1], state: 'LESSON_CANCELLED' } as (typeof data.columns)[number];
    useJournal.mockReturnValue({ data, isPending: false, isError: false, error: null });
    renderPage();

    expect(screen.getByRole('columnheader', { name: /10\.09\s*Отмена/ })).toBeInTheDocument();
    expect(screen.getAllByTitle(/^Урок отменён\./)).toHaveLength(2);
  });

  it('показывает сетку без единой оценки и позволяет открыть первый урок через заголовок', async () => {
    const empty = journal();
    useJournal.mockReturnValue({ data: { ...empty, rows: empty.rows.map(row => ({ ...row, cells: [] })) },
      isPending: false, isError: false, error: null });
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Оценок пока нет');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Иванов Арсен' })).toBeInTheDocument();
    const firstLessonHeader = screen.getByRole('columnheader', { name: /09\.09\s*Урок 1/ });
    await userEvent.click(within(firstLessonHeader).getByRole('link', { name: /09\.09\s*Урок 1/ }));
    expect(screen.getByText('Открыт лист оценок урока')).toBeInTheDocument();
  });

  /** СОР/СОЧ — своя колонка за уроком (V142): в клетке балл работы, заголовок ведёт в урок работы. */
  it('колонка работы СОР стоит за уроком, показывает балл и ведёт в карточку урока', () => {
    const data = journal();
    const work = {
      key: 'ASSESSMENT_WORK:71',
      type: 'ASSESSMENT_WORK',
      sourceId: 71,
      lessonId: 449,
      date: '2026-09-09',
      lessonNumber: 1,
      title: 'СОР 1',
      assessmentKind: 'SOR',
      assessmentStatus: 'CONDUCTED',
      maxScore: 20,
      active: true,
      state: 'ACTIVE',
    } as unknown as (typeof data.columns)[number];
    data.columns.splice(1, 0, work);
    data.rows[0] = {
      ...data.rows[0],
      cells: [{ columnKey: 'ASSESSMENT_WORK:71', grades: [], assessmentResult: { resultId: 5, workId: 71, score: 0, maxScore: 20 } }],
    } as unknown as (typeof data.rows)[number];
    useJournal.mockReturnValue({ data, isPending: false, isError: false, error: null });
    renderPage();

    const header = screen.getByRole('columnheader', { name: /09\.09\s*СОР 1/ });
    expect(within(header).getByRole('link')).toHaveAttribute('href', '/lesson-schedule/lessons/449');
    // Ноль — полноценный балл, и с одним баллом работы журнал уже не «пустой».
    expect(screen.getByRole('button', { name: 'Оценка 0/20' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /** Ввод баллов работ в журнале (Figma D13–D17, ТЗ Frontend §3). */
  describe('ввод баллов СОР/СОЧ', () => {
    function withWork(kind: 'SOR' | 'SOCH', canManage: boolean, saved: number | null = null) {
      const data = journal();
      data.columns.splice(1, 0, {
        key: 'ASSESSMENT_WORK:71', type: 'ASSESSMENT_WORK', sourceId: 71, lessonId: 449, date: '2026-09-09',
        title: kind === 'SOR' ? 'СОР 1' : 'СОЧ', assessmentKind: kind, assessmentStatus: 'CONDUCTED', maxScore: 20,
        active: true, state: 'ACTIVE',
      } as unknown as (typeof data.columns)[number]);
      useJournal.mockReturnValue({ data, isPending: false, isError: false, error: null });
      const studentId = data.rows[0].studentProfileId as number;
      useAssessmentSheets.mockReturnValue([{
        data: {
          canManage, canCorrect: canManage,
          work: { id: 71, kind, maxScore: 20 },
          students: [{ studentProfileId: studentId, studentName: 'Иванов Арсен', score: saved, version: saved == null ? null : 3, inAudience: true }],
        },
      }]);
      return studentId;
    }

    it('заголовок колонки показывает максимум работы', () => {
      withWork('SOR', true);
      renderPage();
      expect(screen.getByRole('columnheader', { name: /СОР 1 \/ 20/ })).toBeInTheDocument();
    });

    it('без права от сервера клетки не редактируются', () => {
      withWork('SOR', false);
      renderPage();
      expect(screen.queryByRole('button', { name: /поставить балл/ })).toBeNull();
    });

    it('копит правки, показывает «Изменено N» и сохраняет явным действием', async () => {
      const user = userEvent.setup();
      const studentId = withWork('SOR', true);
      saveScores.mockResolvedValue({ saved: [`71:${studentId}`], failed: [] });
      renderPage();

      await user.click(screen.getByRole('button', { name: /СОР 1: Иванов Арсен: поставить балл/ }));
      await user.type(screen.getByRole('textbox', { name: /Балл СОР 1/ }), '17');
      expect(screen.getByText('Изменён 1 балл · ещё не сохранены')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Сохранить баллы' }));

      expect(saveScores).toHaveBeenCalledWith({
        changes: [expect.objectContaining({ workId: 71, studentProfileId: studentId, score: 17, before: null, kind: 'SOR' })],
        reason: undefined,
      });
    });

    it('больше максимума: ошибка в клетке, сохранить нельзя', async () => {
      const user = userEvent.setup();
      withWork('SOR', true);
      renderPage();

      await user.click(screen.getByRole('button', { name: /поставить балл/ }));
      await user.type(screen.getByRole('textbox', { name: /Балл СОР 1/ }), '23');
      expect(screen.getByRole('alert')).toHaveTextContent('Не больше 20');
      expect(screen.getByText('Исправьте ошибку, чтобы сохранить')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Сохранить баллы' })).toBeDisabled();
    });

    it('«Отменить» сбрасывает несохранённые правки', async () => {
      const user = userEvent.setup();
      withWork('SOR', true);
      renderPage();
      await user.click(screen.getByRole('button', { name: /поставить балл/ }));
      await user.type(screen.getByRole('textbox', { name: /Балл СОР 1/ }), '5');
      await user.click(screen.getByRole('button', { name: 'Отменить' }));
      expect(screen.queryByRole('button', { name: 'Сохранить баллы' })).toBeNull();
      expect(saveScores).not.toHaveBeenCalled();
    });

    it('исправление СОЧ просит причину и отправляет её вместе с баллами', async () => {
      const user = userEvent.setup();
      withWork('SOCH', true, 15);
      saveScores.mockResolvedValue({ saved: ['x'], failed: [] });
      renderPage();

      await user.click(screen.getByRole('button', { name: /сейчас 15/ }));
      const input = screen.getByRole('textbox', { name: /Балл СОЧ/ });
      await user.clear(input);
      await user.type(input, '11');
      expect(screen.getByText('Было 15')).toBeInTheDocument();
      expect(screen.getByText('Изменён 1 балл · исправление попадёт в историю')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Сохранить баллы' }));

      const dialog = screen.getByRole('dialog');
      const confirm = within(dialog).getByRole('button', { name: 'Сохранить баллы' });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByRole('textbox'), 'Пересчитал работу');
      await user.click(confirm);
      expect(saveScores).toHaveBeenCalledWith({
        changes: [expect.objectContaining({ kind: 'SOCH', score: 11, before: 15, version: 3 })],
        reason: 'Пересчитал работу',
      });
    });

    it('после частичного отказа не рисует успех, а называет ошибку и оставляет упавшую правку', async () => {
      const user = userEvent.setup();
      const studentId = withWork('SOR', true);
      saveScores.mockResolvedValue({ saved: [], failed: [{ key: `71:${studentId}`, message: 'Балл уже изменили' }] });
      renderPage();
      await user.click(screen.getByRole('button', { name: /поставить балл/ }));
      await user.type(screen.getByRole('textbox', { name: /Балл СОР 1/ }), '9');
      await user.click(screen.getByRole('button', { name: 'Сохранить баллы' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Сохранено 0 из 1. Балл уже изменили');
      expect(screen.getByRole('textbox', { name: /Балл СОР 1/ })).toHaveValue('9');
    });
  });

  it('показывает отдельное пустое состояние только когда в журнале нет учеников', () => {
    useJournal.mockReturnValue({ data: { ...journal(), rows: [] }, isPending: false, isError: false, error: null });
    renderPage();
    expect(screen.getByText('В классе нет учеников')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('в режиме месяца журнал запрашивается окном дат внутри четверти', () => {
    renderPage('?window=month&month=7:2026-9');

    expect(useJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        academicPeriodId: 7,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      }),
    );
  });

  it('публикация недоступна, пока итог есть не у всех', () => {
    renderPage('?tab=finals');

    expect(screen.getByRole('button', { name: 'Опубликовать итоги четверти' })).toBeDisabled();
    expect(
      screen.getByText(/Выставьте оценку всем ученикам, чтобы опубликовать итоги четверти/),
    ).toBeInTheDocument();
  });

  it('выставляет итог выбранным значением', async () => {
    const user = userEvent.setup();
    setFinal.mockResolvedValue({ id: 3 });
    renderPage('?tab=finals');

    await user.click(screen.getByRole('button', { name: '5' }));

    expect(setFinal).toHaveBeenCalledWith({
      finalGradeId: null,
      studentProfileId: 19,
      subjectId: 2,
      academicPeriodId: 7,
      value: 5,
      resultKind: 'NUMERIC',
      resultReason: undefined,
    });
  });

  /** §8: админ экран открывает, но выставлять не может — решает сервер, а не роль на клиенте. */
  it('без права выставления не показывает выбор оценки и кнопку публикации', () => {
    useClassFinals.mockReturnValue({
      data: finals({
        canManage: false,
        canManageAttestation: false,
        rows: [{ ...finals().rows[0], canEditResult: false, canChangeAttestation: false }],
      }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage('?tab=finals');

    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Опубликовать итоги четверти' }),
    ).not.toBeInTheDocument();
  });

  /** GRADES-003: четверть по политике — проценты компонентов и итог вместо среднего. */
  it('по политике оценивания показывает проценты компонентов и балл из максимума', () => {
    const policy = {
      policyId: 1,
      name: 'Kundelik',
      components: [
        { code: 'FORMATIVE', title: 'ФО', weightPercent: 25 },
        { code: 'SOR', title: 'СОР', weightPercent: 25 },
        { code: 'SOCH', title: 'СОЧ', weightPercent: 50 },
      ],
      bands: [{ minPercent: 65, value: 4, label: 'Хорошо' }],
    };
    const base = journal();
    useJournal.mockReturnValue({
      data: {
        ...base,
        gradingPolicy: policy,
        rows: [
          {
            ...base.rows[0],
            cells: [{ columnKey: 'LESSON:449', grades: [{ id: 1, score: 15, maxScore: 20, gradeType: 'SUMMATIVE_SECTION' }] }],
            result: {
              status: 'CALCULATED',
              percent: 84.2,
              roundedPercent: 84,
              recommendedValue: 4,
              components: [
                { code: 'FORMATIVE', workCount: 7, percent: 84.29, contribution: 21.07 },
                { code: 'SOR', workCount: 2, percent: 72.5, contribution: 18.13 },
                { code: 'SOCH', workCount: 1, percent: 90, contribution: 45 },
              ],
              missingComponents: [],
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole('button', { name: 'Оценка 15/20' })).toBeInTheDocument();
    expect(screen.getByText('ФО %')).toBeInTheDocument();
    expect(screen.getByText('84,29%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /84%/ })).toBeInTheDocument();
    expect(screen.queryByText('Ср. балл')).not.toBeInTheDocument();
    expect(screen.getByText(/ФО 25 · СОР 25 · СОЧ 50/)).toBeInTheDocument();
  });

  it('итоги по политике предлагают значения, которые прислал сервер', () => {
    useClassFinals.mockReturnValue({
      data: finals({ gradingPolicy: { components: [], bands: [] }, allowedValues: [3, 4, 5] }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage('?tab=finals');

    expect(screen.getByText('Процент за четверть')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
  });

  it('итог без СОЧ объясняет, чего не хватает, и подписывает шкалу итога (пилот 3.1, 3.2)', () => {
    const base = finals();
    useClassFinals.mockReturnValue({
      data: {
        ...base,
        gradingPolicy: { name: 'РК 25/25/50', components: [], bands: [] },
        allowedValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        rows: base.rows.map((row) => ({
          ...row,
          recommendedValue: null,
          result: { status: 'INCOMPLETE', missingComponents: ['SOCH'] },
        })),
      },
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage('?tab=finals');

    expect(screen.getByText('Нет СОЧ')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('не посчитан у 1 из 1 ученика: нет СОЧ');
    expect(screen.getByText(/оценка 1–10 по порогам политики «РК 25\/25\/50»/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  /** Публикация — только после окончания четверти; выставлять итоги можно заранее. */
  it('до окончания четверти кнопка публикации выключена и называет дату', () => {
    useClassFinals.mockReturnValue({
      data: finals({
        publicationOpen: false,
        publishableFrom: '2026-10-26',
        rows: [{ ...finals().rows[0], finalGrade: { id: 3, value: 4, status: 'DRAFT' } }],
      }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage('?tab=finals');

    expect(screen.getByRole('button', { name: 'Опубликовать итоги четверти' })).toBeDisabled();
    expect(screen.getByText(/опубликовать — после окончания четверти, с 26\.10/)).toBeInTheDocument();
  });
});

describe('Статусы ВНА/НА (ATTESTATION-001)', () => {
  beforeEach(resetMocks);

  it('ВНА открывает окно с причиной и сохраняет статус от имени учителя', async () => {
    const user = userEvent.setup();
    saveStatus.mockResolvedValue({ id: 3 });
    renderPage('?tab=finals');

    await user.click(screen.getByRole('button', { name: 'ВНА — Временно не аттестован' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Итог отложен/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Сохранить статус' }));
    expect(saveStatus).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Укажите причину — не короче 5 символов')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Длительная болезнь' }));
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить статус' }));
    expect(saveStatus).toHaveBeenCalledWith({
      author: 'TEACHER',
      finalGrade: null,
      studentProfileId: 19,
      subjectId: 2,
      academicPeriodId: 7,
      resultKind: 'TEMP_UNATTESTED',
      value: null,
      reason: 'Длительная болезнь',
    });
    expect(setFinal).not.toHaveBeenCalled();
  });

  it('расшифровывает ВНА и НА рядом со шкалой итога', () => {
    renderPage('?tab=finals');

    expect(screen.getByText(/временно не аттестован\. Итог отложен/)).toBeInTheDocument();
    expect(screen.getByText(/не аттестован\. Решение за четверть/)).toBeInTheDocument();
  });
});

describe('School assessment constraints', () => {
  it('does not offer any final marks in first grade', () => {
    useClassFinals.mockReturnValue({ data: finals({ assessmentMode: 'NO_ASSESSMENT', canManage: false }), isPending: false, isError: false });
    renderPage('?tab=finals');
    expect(screen.getByText('В 1 классе учебные достижения не оцениваются')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Опубликовать итоги четверти' })).not.toBeInTheDocument();
  });
  it('records credit as a separate result without a numeric value', async () => {
    const user = userEvent.setup();
    useClassFinals.mockReturnValue({ data: finals({ assessmentMode: 'PASS_FAIL', allowedResultKinds: ['PASS', 'FAIL'] }), isPending: false, isError: false });
    renderPage('?tab=finals');
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Зачёт$/ }));
    expect(setFinal).toHaveBeenCalledWith(expect.objectContaining({ resultKind: 'PASS', value: null }));
  });
  it('does not offer ordinary editing for a published numeric final', () => {
    const data = finals();
    data.rows[0].finalGrade = { id: 3, value: 5, status: 'PUBLISHED', resultKind: 'NUMERIC' } as never;
    data.rows[0].canEditResult = false;
    useClassFinals.mockReturnValue({ data, isPending: false, isError: false });
    renderPage('?tab=finals');
    expect(screen.queryByRole('button', { name: /^4$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'История итога' })).toBeInTheDocument();
  });
  it('keeps historical year selection available when the current year has no assignments', async () => {
    const user = userEvent.setup();
    useGradebookContext.mockReturnValue({ data: { ...context(), scopes: [], academicYears: [
      { id: 5, name: '2026/2027', status: 'ACTIVE' }, { id: 4, name: '2025/2026', status: 'ARCHIVED' },
    ] }, isPending: false, isError: false });
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Учебный год журнала' }));
    await user.click(screen.getByRole('option', { name: '2025/2026 · Архив' }));
    expect(useGradebookContext).toHaveBeenLastCalledWith(true, 4);
  });
});
