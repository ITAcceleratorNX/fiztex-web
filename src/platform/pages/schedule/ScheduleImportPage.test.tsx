import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ScheduleImportPage } from './ScheduleImportPage';

const listAcademicYears = vi.fn();
const listPeriods = vi.fn();
const getConstructorContext = vi.fn();
const resolveScheduleDraft = vi.fn();
const listScheduleLessons = vi.fn();
const createScheduleLesson = vi.fn();
const deleteScheduleLesson = vi.fn();

vi.mock('@/platform/services', () => ({
  listAcademicYears: (...args: unknown[]) => listAcademicYears(...args),
  listPeriods: (...args: unknown[]) => listPeriods(...args),
  getConstructorContext: (...args: unknown[]) => getConstructorContext(...args),
}));

vi.mock('@/platform/services/schedules', () => ({
  resolveScheduleDraft: (...args: unknown[]) => resolveScheduleDraft(...args),
  listScheduleLessons: (...args: unknown[]) => listScheduleLessons(...args),
  createScheduleLesson: (...args: unknown[]) => createScheduleLesson(...args),
  deleteScheduleLesson: (...args: unknown[]) => deleteScheduleLesson(...args),
}));

// Создание недостающего идёт настоящим `runProvisioning` — подменены только
// эндпоинты, чтобы тест проверял порядок и тела запросов, а не заглушку шага.
const createClass = vi.fn();
const createSchoolSubject = vi.fn();
const createBellTemplate = vi.fn();
const addPeriod = vi.fn();
const assignBindings = vi.fn();
const createGroupSet = vi.fn();
const createSubgroup = vi.fn();

vi.mock('@/platform/services/classes', () => ({
  createClass: (...args: unknown[]) => createClass(...args),
}));
vi.mock('@/platform/services/schoolSubjects', () => ({
  createSchoolSubject: (...args: unknown[]) => createSchoolSubject(...args),
}));
vi.mock('@/lib/scheduleSettingsApi', () => ({
  scheduleSettingsApi: {
    createBellTemplate: (...args: unknown[]) => createBellTemplate(...args),
    addPeriod: (...args: unknown[]) => addPeriod(...args),
    assignBindings: (...args: unknown[]) => assignBindings(...args),
  },
}));
vi.mock('@/lib/schedule2bApi', () => ({
  subgroupsApi: {
    createGroupSet: (...args: unknown[]) => createGroupSet(...args),
    createSubgroup: (...args: unknown[]) => createSubgroup(...args),
  },
}));

/**
 * Файл для загрузки собираем настоящим zip-ом: экран читает `.xlsx` сам, и подмена
 * читателя проверяла бы разбор, которого в проде нет.
 */
async function xlsxFile(rows: string[][]): Promise<File> {
  const encoder = new TextEncoder();
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const columnName = (index: number) => {
    let name = '';
    let value = index + 1;
    while (value > 0) {
      const rest = (value - 1) % 26;
      name = String.fromCharCode(65 + rest) + name;
      value = Math.floor((value - rest) / 26);
    }
    return name;
  };
  const sheetXml =
    '<worksheet><sheetData>' +
    rows
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">` +
          row
            .map((cell, cellIndex) =>
              cell
                ? `<c r="${columnName(cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escape(cell)}</t></is></c>`
                : '',
            )
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>';

  const files = [
    {
      name: 'xl/workbook.xml',
      content: '<workbook><sheets><sheet name="5 кл" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ];

  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const entry = new Uint8Array(46 + nameBytes.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint32(20, data.length, true);
    entryView.setUint32(24, data.length, true);
    entryView.setUint16(28, nameBytes.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    central.push(entry);
    offset += local.length;
  }
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of [...locals, ...central, eocd]) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  const file = new File([bytes], 'schedule.xlsx');
  // jsdom не реализует File.arrayBuffer — экран читает файл именно так.
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer.slice(0, total),
  });
  return file;
}

const ROWS = [
  ['понедельник', '', '5а-1', '', '5а-2', ''],
  ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113'],
  ['08.30 - 09.10', '2', 'худ труд', '5', 'худ труд', '5'],
];

const SCHOOL = {
  periods: [],
  classes: [{ id: 1, name: '5А' }],
  subjects: [
    { id: 10, name: 'Математика' },
    { id: 11, name: 'Информатика' },
    { id: 12, name: 'Художественный труд' },
  ],
  teachers: [
    { id: 100, fullName: 'Тулегенова Бота Ержановна', subjectIds: [10] },
    { id: 101, fullName: 'Мукашева Бану Асхатовна', subjectIds: [11] },
    { id: 103, fullName: 'Ахметова Гулим Сериковна', subjectIds: [12] },
  ],
  weekdays: ['MONDAY'],
};

const CLASS_SCOPE = {
  ...SCHOOL,
  bellTemplate: {
    id: 7,
    name: 'Первая смена',
    status: 'ACTIVE',
    periods: [
      { id: 71, bellTemplateId: 7, lessonNumber: 1, startTime: '07:45:00', endTime: '08:25:00', sortOrder: 0 },
      { id: 72, bellTemplateId: 7, lessonNumber: 2, startTime: '08:30:00', endTime: '09:10:00', sortOrder: 1 },
    ],
  },
  groupSets: [
    { id: 5, name: 'Деление класса', subgroups: [{ id: 51, name: 'Группа 1' }, { id: 52, name: 'Группа 2' }] },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ScheduleImportPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function uploadSchedule(user: ReturnType<typeof userEvent.setup>) {
  // Select — кнопка, а не <select>: год виден как текст на триггере.
  await screen.findByText('2026-2027');
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, await xlsxFile(ROWS));
}

beforeEach(() => {
  vi.clearAllMocks();
  listAcademicYears.mockResolvedValue([
    { id: '1', name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31', status: 'ACTIVE', createdAt: '' },
  ]);
  listPeriods.mockResolvedValue([
    { id: '9', academicYearId: '1', name: '1 четверть', type: 'QUARTER', startDate: '', endDate: '', status: 'ACTIVE' },
  ]);
  getConstructorContext.mockImplementation((params: { classId?: number }) =>
    Promise.resolve(params.classId ? CLASS_SCOPE : SCHOOL),
  );
  resolveScheduleDraft.mockResolvedValue({ id: 42 });
  listScheduleLessons.mockResolvedValue([]);
  createScheduleLesson.mockResolvedValue({ id: 1 });
  createClass.mockImplementation((input: { name: string }) =>
    Promise.resolve({ id: '77', name: input.name }),
  );
  createSchoolSubject.mockResolvedValue({ id: 90, name: '' });
  createBellTemplate.mockResolvedValue({ id: 300, name: '' });
  addPeriod.mockResolvedValue({ id: 301 });
  assignBindings.mockResolvedValue([]);
  createGroupSet.mockResolvedValue({ id: 400, name: 'Деление класса' });
  createSubgroup.mockResolvedValue({ id: 401 });
});

describe('ScheduleImportPage', () => {

  it('показывает разбор файла и то, что требует исправления', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    expect(await screen.findByText('Классы в файле: 1')).toBeInTheDocument();
    // «худ труд» — предмет без учителя: файл его не называет, и урок не собран.
    expect(
      await screen.findByText(/не указан учитель для «Художественный труд»/),
    ).toBeInTheDocument();
    expect(screen.getByText('1 строка требует правки')).toBeInTheDocument();
  });

  it('не даёт импортировать класс, пока в нём есть неразобранные строки', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    await screen.findByText('Классы в файле: 1');
    expect(screen.getByLabelText('Импортировать 5а')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Импортировать: 0 классов/ })).toBeDisabled();
  });

  it('выбор учителя в отчёте открывает класс к импорту', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    await screen.findByText(/не указан учитель для «Художественный труд»/);
    const row = screen.getByText(/не указан учитель для «Художественный труд»/).closest('tr')!;
    await user.click(within(row).getByRole('button'));
    await user.click(await screen.findByRole('option', { name: 'Ахметова Гулим Сериковна' }));

    const checkbox = await screen.findByLabelText('Импортировать 5а');
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);
    expect(screen.getByRole('button', { name: /Импортировать: 1 класс, 3 урока/ })).toBeEnabled();
  });

  it('записывает уроки теми же запросами, что и конструктор', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    await screen.findByText(/не указан учитель для «Художественный труд»/);
    const row = screen.getByText(/не указан учитель для «Художественный труд»/).closest('tr')!;
    await user.click(within(row).getByRole('button'));
    await user.click(await screen.findByRole('option', { name: 'Ахметова Гулим Сериковна' }));
    const checkbox = await screen.findByLabelText('Импортировать 5а');
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /Импортировать: 1 класс,/ }));

    await waitFor(() => expect(createScheduleLesson).toHaveBeenCalledTimes(3));
    expect(resolveScheduleDraft).toHaveBeenCalledWith({
      academicYearId: 1,
      academicPeriodId: 9,
      classId: 1,
    });
    const bodies = createScheduleLesson.mock.calls.map(([, body]) => body);
    expect(bodies).toContainEqual({
      weekday: 'MONDAY',
      lessonPeriodId: 71,
      subjectId: 10,
      teacherId: 100,
      targetType: 'SUBGROUP',
      subgroupId: 51,
      room: '303',
    });
    expect(bodies).toContainEqual({
      weekday: 'MONDAY',
      lessonPeriodId: 72,
      subjectId: 12,
      teacherId: 103,
      targetType: 'CLASS',
      subgroupId: null,
      room: '5',
    });
    expect(await screen.findByText('Создано уроков: 3')).toBeInTheDocument();
  });

  it('не трогает непустой черновик, пока это не выбрано явно', async () => {
    listScheduleLessons.mockResolvedValue([{ id: 5 }]);
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    await screen.findByText(/не указан учитель для «Художественный труд»/);
    const row = screen.getByText(/не указан учитель для «Художественный труд»/).closest('tr')!;
    await user.click(within(row).getByRole('button'));
    await user.click(await screen.findByRole('option', { name: 'Ахметова Гулим Сериковна' }));
    const checkbox = await screen.findByLabelText('Импортировать 5а');
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /Импортировать: 1 класс,/ }));

    expect(await screen.findByText(/В черновике уже 1 уроков/)).toBeInTheDocument();
    expect(createScheduleLesson).not.toHaveBeenCalled();
    expect(deleteScheduleLesson).not.toHaveBeenCalled();
  });
});

describe('ScheduleImportPage · создание недостающего', () => {
  beforeEach(() => {
    // Школа пустая: ни классов, ни предметов, ни учителей, ни шаблона звонков.
    getConstructorContext.mockResolvedValue({
      periods: [],
      classes: [],
      subjects: [],
      teachers: [],
      weekdays: ['MONDAY'],
      bellTemplate: null,
      groupSets: [],
    });
  });

  it('перечисляет, чего не хватает, и отдельно — учителей', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);

    expect(await screen.findByText('Не хватает в школе')).toBeInTheDocument();
    expect(screen.getByLabelText('Создать: Классы')).toBeChecked();
    expect(screen.getByLabelText('Создать: Шаблоны звонков')).toBeChecked();
    expect(screen.getByText('Звонки 07:45–09:10 (уроков 2, классов 1)')).toBeInTheDocument();
    // Учителей шаг не создаёт: из двух букв карточку не собрать, и полей для них нет.
    expect(screen.queryByLabelText('Создать: Учителя')).toBeNull();
    expect(screen.queryByLabelText('ФИО для ТБ')).toBeNull();
    expect(screen.queryByRole('button', { name: /Заполнить случайно/ })).toBeNull();
  });

  it('создаёт класс, предметы, звонки и подгруппы теми же эндпоинтами', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);
    await screen.findByText('Не хватает в школе');

    await user.click(screen.getByRole('button', { name: 'Создать недостающее' }));

    await waitFor(() => expect(createClass).toHaveBeenCalled());
    expect(createClass).toHaveBeenCalledWith({
      academicYearId: '1',
      name: '5а',
      grade: '5',
      letter: 'а',
    });
    expect(createSchoolSubject.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining(['Математика', 'Информатика', 'Художественный труд']),
    );
    expect(createBellTemplate).toHaveBeenCalledWith({
      academicYearId: 1,
      name: 'Звонки 07:45–09:10',
    });
    expect(addPeriod).toHaveBeenCalledWith(300, {
      lessonNumber: 1,
      startTime: '07:45:00',
      endTime: '08:25:00',
    });
    // Привязка идёт к только что созданному классу, иначе звонок останется ничей.
    expect(assignBindings).toHaveBeenCalledWith(300, { classIds: [77], replaceExisting: true });
    expect(createGroupSet).toHaveBeenCalledWith({ classId: 77, name: 'Деление класса' });
    expect(createSubgroup.mock.calls.map(([body]) => body.name)).toEqual(['Группа 1', 'Группа 2']);
  });

  it('снятая галочка означает «этот вид не создавать»', async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadSchedule(user);
    await screen.findByText('Не хватает в школе');

    await user.click(screen.getByLabelText('Создать: Классы'));
    await user.click(screen.getByRole('button', { name: 'Создать недостающее' }));

    await waitFor(() => expect(createSchoolSubject).toHaveBeenCalled());
    expect(createClass).not.toHaveBeenCalled();
  });
});
