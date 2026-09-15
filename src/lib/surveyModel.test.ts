import { describe, expect, it } from 'vitest';
import {
  SURVEY_VARIANT_COPY,
  canPublishSurvey,
  groupAudienceClasses,
  publishBlockedReason,
  surveyStatusLabel,
  toAudienceClasses,
} from './surveyModel';
import type { Survey } from './surveyApi';

function survey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: 1,
    status: 'DRAFT',
    questionCount: 1,
    audienceClassIds: [10],
    targetsStudents: true,
    targetsParents: false,
    ...overrides,
  };
}

describe('surveyStatusLabel', () => {
  it('переводит статусы дословно', () => {
    expect(surveyStatusLabel('DRAFT')).toBe('Черновик');
    expect(surveyStatusLabel('ACTIVE')).toBe('Активен');
    expect(surveyStatusLabel('COMPLETED')).toBe('Завершён');
  });

  it('пустой статус читается как черновик', () => {
    expect(surveyStatusLabel(undefined)).toBe('Черновик');
  });
});

describe('canPublishSurvey', () => {
  it('разрешает публикацию, когда есть вопросы, аудитория и получатель', () => {
    expect(canPublishSurvey(survey())).toBe(true);
  });

  it('запрещает публикацию не-черновика', () => {
    expect(canPublishSurvey(survey({ status: 'ACTIVE' }))).toBe(false);
  });

  it('запрещает публикацию без вопросов', () => {
    expect(canPublishSurvey(survey({ questionCount: 0 }))).toBe(false);
  });

  it('запрещает публикацию без аудитории', () => {
    expect(canPublishSurvey(survey({ audienceClassIds: [] }))).toBe(false);
  });

  it('запрещает публикацию без получателей', () => {
    expect(canPublishSurvey(survey({ targetsStudents: false, targetsParents: false }))).toBe(false);
  });

  it('разрешает, если получатели — только родители', () => {
    expect(canPublishSurvey(survey({ targetsStudents: false, targetsParents: true }))).toBe(true);
  });
});

describe('publishBlockedReason', () => {
  it('не даёт причины, когда публикация разрешена', () => {
    expect(publishBlockedReason(survey())).toBeNull();
  });

  it('перечисляет все недостающие условия сразу', () => {
    const reason = publishBlockedReason(
      survey({ questionCount: 0, audienceClassIds: [], targetsStudents: false, targetsParents: false }),
    );
    expect(reason).toContain('вопрос');
    expect(reason).toContain('класс');
    expect(reason).toContain('получателей');
  });

  it('не даёт причины у уже опубликованного опроса', () => {
    expect(publishBlockedReason(survey({ status: 'ACTIVE', questionCount: 0 }))).toBeNull();
  });
});

describe('классы аудитории', () => {
  it('параллели сортируются числом, классы — по литере, пустые поля DTO не роняют дерево', () => {
    const classes = toAudienceClasses([
      { id: 3, name: '10Б', grade: '10', letter: 'Б', studentsCount: 20 },
      { id: 1, name: '2А', grade: '2', letter: 'А', studentsCount: 25 },
      { id: 2, name: '10А', grade: '10', letter: 'А' },
      { name: 'без id' },
    ]);
    expect(classes).toHaveLength(3);
    expect(classes.find((c) => c.id === 2)?.studentsCount).toBe(0);

    const groups = groupAudienceClasses(classes);
    expect(groups.map((g) => g.grade)).toEqual(['2', '10']);
    expect(groups[1].classes.map((c) => c.name)).toEqual(['10А', '10Б']);
  });
});

describe('вывески раздела', () => {
  it('психологический тест — без AI-анализа и только для учеников', () => {
    expect(SURVEY_VARIANT_COPY.psychology.aiAnalysis).toBe(false);
    expect(SURVEY_VARIANT_COPY.psychology.studentsOnly).toBe(true);
    expect(SURVEY_VARIANT_COPY.school.aiAnalysis).toBe(true);
    expect(SURVEY_VARIANT_COPY.school.studentsOnly).toBe(false);
  });
});

