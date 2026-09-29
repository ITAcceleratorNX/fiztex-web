import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_OVERRIDES, type ImportProblem } from '@/lib/scheduleImport/resolveScheduleImport';
import { ScheduleImportProblems } from './ScheduleImportProblems';

describe('ScheduleImportProblems', () => {
  it('показывает одинаковые адреса строк без повторяющихся React-ключей', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const problem: ImportProblem = {
      code: 'TEACHER_NOT_FOUND',
      severity: 'error',
      value: 'ИЛ',
      message: 'Учитель ИЛ не найден',
      className: '5А',
      lessonCount: 2,
      examples: ['5 кл · строка 2', '5 кл · строка 2'],
    };

    try {
      render(
        <ScheduleImportProblems
          problems={[problem]}
          overrides={EMPTY_OVERRIDES}
          onOverride={() => {}}
        />,
      );

      expect(screen.getAllByText('5 кл · строка 2')).toHaveLength(2);
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key');
    } finally {
      consoleError.mockRestore();
    }
  });
});
