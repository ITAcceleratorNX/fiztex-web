import type { Survey, SurveyAudienceClass, SurveyStatus } from '@/lib/surveyApi';

/**
 * Слова статуса опроса одним местом на весь веб — как `sheetStateLabel` у посещаемости
 * и `homeworkStateLabel` у ДЗ. Мобилке предстоит показывать то же самое, и разъехаться
 * им нельзя: строки дословные, не переформулировать по месту.
 */
export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  COMPLETED: 'Завершён',
};

export function surveyStatusLabel(status: SurveyStatus | null | undefined): string {
  return status ? SURVEY_STATUS_LABELS[status] : SURVEY_STATUS_LABELS.DRAFT;
}

/**
 * Предусловия публикации (§ ТЗ на `POST /publish`), пересказанные здесь только для того,
 * чтобы заранее выключить кнопку — не чтобы заменить проверку сервера. Сервер остаётся
 * источником истины: 409 с `SURVEY_NO_QUESTIONS` / `SURVEY_NO_AUDIENCE` / `SURVEY_NO_TARGET`
 * по-прежнему возможен и обрабатывается отдельно.
 */
export function canPublishSurvey(survey: Survey | null | undefined): boolean {
  if (!survey || survey.status !== 'DRAFT') return false;
  return (
    (survey.questionCount ?? 0) > 0 &&
    (survey.audienceClassIds?.length ?? 0) > 0 &&
    Boolean(survey.targetsStudents || survey.targetsParents)
  );
}

/**
 * Почему публикация выключена — рядом с кнопкой, а не после отказа сервера: три причины
 * не исключают друг друга, и молчащая кнопка читалась бы как поломка.
 */
export function publishBlockedReason(survey: Survey | null | undefined): string | null {
  if (!survey || survey.status !== 'DRAFT') return null;
  const missing: string[] = [];
  if (!(survey.questionCount ?? 0)) missing.push('добавьте хотя бы один вопрос');
  if (!(survey.audienceClassIds?.length ?? 0)) missing.push('выберите хотя бы один класс');
  if (!(survey.targetsStudents || survey.targetsParents)) {
    missing.push('включите получателей — учеников или родителей');
  }
  if (missing.length === 0) return null;
  return `Нельзя опубликовать: ${missing.join(', ')}.`;
}

/**
 * Раздел опросов в двух вывесках (PSYCHOLOGIST-002): школьные опросы администрации и
 * психологические тесты психолога. Экраны одни и те же, различаются слова, вкладка AI-анализа
 * и аудитория: психологический тест проходят только ученики, а ответы в модель не уходят.
 */
export type SurveyVariant = 'school' | 'psychology';

export interface SurveyVariantCopy {
  listTitle: string;
  listDescription: string;
  createLabel: string;
  createTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  /** Психолог пишет в описание инструкцию: мобилка показывает её перед первым вопросом. */
  descriptionLabel: string;
  descriptionHint: string;
  descriptionPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  backLabel: string;
  publishedToast: string;
  endLabel: string;
  endTitle: string;
  endMessage: string;
  endedToast: string;
  loadError: string;
  /** Вкладка «AI-анализ» — только у школьных опросов. */
  aiAnalysis: boolean;
  /** Психологический тест назначается только ученикам. */
  studentsOnly: boolean;
}

export const SURVEY_VARIANT_COPY: Record<SurveyVariant, SurveyVariantCopy> = {
  school: {
    listTitle: 'Опросы',
    listDescription: 'Опросы для учеников и родителей: вопросы, аудитория, результаты и AI-анализ ответов.',
    createLabel: 'Создать опрос',
    createTitle: 'Новый опрос',
    nameLabel: 'Название опроса',
    namePlaceholder: 'Например: Удовлетворённость учёбой',
    descriptionLabel: 'Описание',
    descriptionHint: 'Необязательно',
    descriptionPlaceholder: 'О чём опрос и зачем он проводится',
    emptyTitle: 'Пока нет опросов',
    emptyDescription: 'Создайте опрос, добавьте вопросы и выберите аудиторию.',
    backLabel: 'К опросам',
    publishedToast: 'Опрос опубликован',
    endLabel: 'Завершить опрос',
    endTitle: 'Завершить опрос?',
    endMessage: 'Опрос перестанет принимать ответы. Это действие нельзя отменить.',
    endedToast: 'Опрос завершён',
    loadError: 'Не удалось загрузить опрос',
    aiAnalysis: true,
    studentsOnly: false,
  },
  psychology: {
    listTitle: 'Психологические тесты',
    listDescription:
      'Тесты для учеников: вопросы, классы и ответы — именные или анонимные. Результаты видите только вы.',
    createLabel: 'Создать тест',
    createTitle: 'Новый психологический тест',
    nameLabel: 'Название теста',
    namePlaceholder: 'Например: Тревожность перед экзаменами',
    descriptionLabel: 'Инструкция для учеников',
    descriptionHint: 'Необязательно, ученик увидит её перед первым вопросом',
    descriptionPlaceholder: 'Например: правильных ответов нет — отвечайте так, как чувствуете',
    emptyTitle: 'Пока нет тестов',
    emptyDescription: 'Создайте тест, добавьте вопросы и выберите классы.',
    backLabel: 'К психологическим тестам',
    publishedToast: 'Тест опубликован',
    endLabel: 'Завершить тест',
    endTitle: 'Завершить тест?',
    endMessage: 'Тест перестанет принимать ответы. Это действие нельзя отменить.',
    endedToast: 'Тест завершён',
    loadError: 'Не удалось загрузить тест',
    aiAnalysis: false,
    studentsOnly: true,
  },
};

/** Класс для дерева выбора аудитории — ровно то, что читают вкладка и `ClassGradePicker`. */
export interface AudienceClass {
  id: number;
  name: string;
  grade: string;
  letter: string;
  studentsCount: number;
}

export interface AudienceGradeGroup {
  grade: string;
  classes: AudienceClass[];
}

/** DTO бэкенда в строгий вид: поля ответа springdoc помечает необязательными. */
export function toAudienceClasses(classes: SurveyAudienceClass[] | undefined): AudienceClass[] {
  return (classes ?? [])
    .filter((c) => c.id != null)
    .map((c) => ({
      id: c.id as number,
      name: c.name ?? '',
      grade: c.grade ?? '',
      letter: c.letter ?? '',
      studentsCount: c.studentsCount ?? 0,
    }));
}

/**
 * Классы по параллелям. Сортировка «числом», а не строкой — иначе 10-е и 11-е встали бы между
 * 1-м и 2-м; внутри параллели — по литере.
 */
export function groupAudienceClasses(classes: AudienceClass[]): AudienceGradeGroup[] {
  const byGrade = new Map<string, AudienceClass[]>();
  for (const schoolClass of classes) {
    byGrade.set(schoolClass.grade, [...(byGrade.get(schoolClass.grade) ?? []), schoolClass]);
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }))
    .map(([grade, group]) => ({
      grade,
      classes: [...group].sort((a, b) => a.letter.localeCompare(b.letter, 'ru')),
    }));
}

