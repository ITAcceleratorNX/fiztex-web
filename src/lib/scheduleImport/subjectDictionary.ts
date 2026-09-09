/**
 * Словарь предметов школьного расписания.
 *
 * В файле один предмет назван по-разному: на двух языках («каз яз» и «қазақ тілі»),
 * сокращённо и полностью («информ», «информатика», «инф»), с опечатками («худ турд»,
 * «геграфия»). Разбор ячейки без словаря пришлось бы делать по последнему слову, а
 * там стоят инициалы учителя — и «ист. Каз» без учителя превратилось бы в предмет
 * «ист» у преподавателя «Каз».
 *
 * Поэтому ячейка читается наоборот: сначала со строки снимается самый длинный
 * известный псевдоним предмета, остаток — инициалы. Тот же словарь потом сопоставляет
 * канонический предмет со справочником школы: имя предмета из базы нормализуется теми
 * же правилами и ищется среди псевдонимов.
 *
 * Словарь описывает **написания**, а не учебный план: алгебра, геометрия и математика
 * остаются разными предметами, потому что в файле они стоят в разных классах и у
 * разных учителей — свести их значило бы решить за школу, чего в расписании нет.
 */

export interface SubjectDefinition {
  key: string;
  /** Как предмет называется в отчётах импорта, если в справочнике его нет. */
  label: string;
  /** Написания в нормализованном виде (см. `normalizeSubjectText`). */
  aliases: string[];
}

/**
 * Разбивает текст на слова, сохраняя оригинал: сравнение идёт по строчным формам,
 * а инициалы учителя нужны в исходном регистре — «КШ», а не «кш».
 */
export function tokenizeSubjectCell(text: string): { original: string[]; normalized: string[] } {
  const original = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return { original, normalized: original.map((token) => token.toLowerCase().replace(/ё/g, 'е')) };
}

/** Нормализованная форма строки целиком — ею описаны псевдонимы и имена из базы. */
export function normalizeSubjectText(text: string): string {
  return tokenizeSubjectCell(text).normalized.join(' ');
}

export const SUBJECT_DEFINITIONS: SubjectDefinition[] = [
  {
    key: 'KAZ_LANGUAGE',
    label: 'Казахский язык',
    aliases: [
      'каз яз', 'каз язык', 'казахский язык', 'казахский',
      'қаз яз', 'қаз тілі', 'қазақ тілі', 'каз тілі', 'қазақ тіл',
    ],
  },
  {
    key: 'KAZ_LITERATURE',
    label: 'Казахская литература',
    aliases: [
      'каз лит', 'каз литература', 'казахская литература',
      'қаз әдебиет', 'қазақ әдебиеті', 'қаз әд', 'қаз әдебиеті', 'қазақ әдебиет',
    ],
  },
  {
    key: 'RUS_LANGUAGE',
    label: 'Русский язык',
    aliases: [
      'русс яз', 'русс язык', 'рус яз', 'рус язык', 'русский язык', 'русский',
      'орыс тілі', 'орыс тіл',
    ],
  },
  {
    key: 'RUS_LITERATURE',
    label: 'Русская литература',
    aliases: [
      'рус лит', 'рус лит ра', 'русс лит', 'русс лит ра', 'рус литература',
      'русская литература', 'рас лит', 'рул лит', 'орыс әдебиеті',
    ],
  },
  {
    key: 'ENGLISH',
    label: 'Английский язык',
    aliases: [
      'англ яз', 'англ язык', 'английский язык', 'английский',
      'ағылшын', 'ағылшын тілі', 'ағылш тілі', 'ағылшын тіл',
    ],
  },
  { key: 'MATH', label: 'Математика', aliases: ['матем', 'математика', 'математик'] },
  { key: 'ALGEBRA', label: 'Алгебра', aliases: ['алгебра'] },
  { key: 'GEOMETRY', label: 'Геометрия', aliases: ['геом', 'геометрия'] },
  {
    key: 'INFORMATICS',
    label: 'Информатика',
    aliases: ['информ', 'информатика', 'инф', 'информа', 'инорм', 'иинформатика', 'информатик'],
  },
  {
    key: 'PROGRAMMING',
    label: 'Программирование',
    aliases: ['программ', 'програм', 'программирование'],
  },
  { key: 'PHYSICS', label: 'Физика', aliases: ['физика'] },
  { key: 'CHEMISTRY', label: 'Химия', aliases: ['химия'] },
  { key: 'BIOLOGY', label: 'Биология', aliases: ['биология', 'биолог'] },
  { key: 'GEOGRAPHY', label: 'География', aliases: ['география', 'географ', 'геграфия'] },
  {
    key: 'NATURAL_SCIENCE',
    label: 'Естествознание',
    aliases: ['естествознание', 'естеств', 'жаратылыстану'],
  },
  {
    key: 'KAZ_HISTORY',
    label: 'История Казахстана',
    aliases: [
      'ист каз', 'истказ', 'ист қаз', 'история казахстана', 'ист казахстана',
      'қаз тарих', 'қаз тариз', 'қазақстан тарихы', 'қазақстан тарих',
    ],
  },
  {
    key: 'WORLD_HISTORY',
    label: 'Всемирная история',
    aliases: [
      'всемир ист', 'всем ист', 'всемирная ист', 'всемирная история', 'всемир история',
      'дүниежүзі тарихы', 'дүние жүзі тарихы',
    ],
  },
  { key: 'HISTORY', label: 'История', aliases: ['история', 'тарих'] },
  {
    key: 'PHYSICAL_EDUCATION',
    label: 'Физическая культура',
    aliases: [
      'физ ра', 'физра', 'физкультура', 'физическая культура', 'физ культура',
      'дене шынықтыру', 'дене шынықт', 'дене шын',
    ],
  },
  {
    key: 'ART_LABOUR',
    label: 'Художественный труд',
    aliases: [
      'худ труд', 'худ турд', 'хруд труд', 'художественный труд', 'худож труд',
      'көркем еңбек',
    ],
  },
  { key: 'MUSIC', label: 'Музыка', aliases: ['музыка', 'музыка ән', 'ән'] },
  { key: 'ROBOTICS', label: 'Робототехника', aliases: ['робот', 'робототехника'] },
  {
    key: 'CLASS_HOUR',
    label: 'Классный час',
    aliases: ['кл час', 'классный час', 'клас час', 'сынып сағаты'],
  },
  {
    key: 'APPLIED_MATH',
    label: 'Прикладные задачи',
    aliases: [
      'приклад задачи', 'прикл задачи', 'приклад зад', 'прикл зад',
      'прикладные задачи', 'прикладная математика',
    ],
  },
  {
    key: 'MILITARY_TRAINING',
    label: 'НВП',
    aliases: ['нвп', 'аәд', 'начальная военная подготовка', 'нвтп'],
  },
  { key: 'PROJECTS', label: 'Проекты', aliases: ['проекты', 'проект'] },
];

const DEFINITION_BY_KEY = new Map(SUBJECT_DEFINITIONS.map((item) => [item.key, item]));

/**
 * Псевдонимы, разложенные по словам и отсортированные от длинных к коротким:
 * «қаз әдебиет» должен выиграть у «қаз яз», а «всемир ист» — у «история».
 */
const ALIAS_INDEX = SUBJECT_DEFINITIONS.flatMap((definition) =>
  definition.aliases.map((alias) => ({ definition, words: alias.split(' ') })),
).sort((a, b) => b.words.length - a.words.length);

export function subjectDefinition(key: string): SubjectDefinition | null {
  return DEFINITION_BY_KEY.get(key) ?? null;
}

export interface SubjectCellParts {
  /** Канонический предмет, если написание удалось узнать. */
  subjectKey: string | null;
  /** Часть ячейки, прочитанная как предмет: «физ-ра» из «физ-ра КШ». */
  subjectText: string;
  /** Остаток ячейки — обычно инициалы учителя, в исходном регистре. */
  teacherText: string;
}

/**
 * Делит ячейку «предмет + инициалы» на части.
 *
 * Неизвестное написание не выбрасывается: предметом считается всё, кроме последнего
 * слова из двух-трёх заглавных букв. Так строка попадает в отчёт как «предмет не
 * распознан» вместе с учителем, а не как бессмысленная пара.
 */
export function parseSubjectCell(text: string): SubjectCellParts {
  const { original, normalized } = tokenizeSubjectCell(text);
  if (original.length === 0) return { subjectKey: null, subjectText: '', teacherText: '' };

  for (const { definition, words } of ALIAS_INDEX) {
    if (words.length > original.length) continue;
    const matches = words.every((word, index) => normalized[index] === word);
    if (!matches) continue;
    return {
      subjectKey: definition.key,
      subjectText: original.slice(0, words.length).join(' '),
      teacherText: original.slice(words.length).join(' '),
    };
  }

  const last = original[original.length - 1];
  const looksLikeInitials = original.length > 1 && /^\p{Lu}{2,3}$/u.test(last);
  return {
    subjectKey: null,
    subjectText: looksLikeInitials ? original.slice(0, -1).join(' ') : original.join(' '),
    teacherText: looksLikeInitials ? last : '',
  };
}

/** Ключ канонического предмета по названию из справочника школы. */
export function matchSubjectKeyByName(name: string): string | null {
  const normalized = normalizeSubjectText(name);
  if (!normalized) return null;
  for (const definition of SUBJECT_DEFINITIONS) {
    if (definition.aliases.includes(normalized)) return definition.key;
  }
  return null;
}
