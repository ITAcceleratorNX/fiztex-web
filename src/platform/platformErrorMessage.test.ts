import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { platformErrorMessage } from './platformErrorMessage';

describe('platformErrorMessage', () => {
  it('превращает код конфликта активного учебного года в понятное действие', () => {
    expect(platformErrorMessage(
      new ApiError(409, 'ANOTHER_YEAR_ACTIVE', 'ANOTHER_YEAR_ACTIVE'),
      'Не удалось сохранить.',
    )).toBe('Сначала завершите текущий учебный год, затем активируйте другой.');
  });

  it('не показывает код или техническое сообщение неизвестной ошибки сервера', () => {
    expect(platformErrorMessage(
      new ApiError(500, 'NullPointerException at AcademicYearService', 'INTERNAL_ERROR'),
      'Не удалось загрузить учебные годы. Попробуйте ещё раз.',
    )).toBe('Не удалось загрузить учебные годы. Попробуйте ещё раз.');
  });

  it('объясняет ошибку связи и сохраняет сообщения локальной проверки формы', () => {
    expect(platformErrorMessage(new ApiError(0, 'fetch failed'), 'Не удалось сохранить.'))
      .toBe('Нет связи с сервером. Проверьте подключение и попробуйте снова.');
    expect(platformErrorMessage(new Error('Укажите дату окончания'), 'Не удалось сохранить.'))
      .toBe('Укажите дату окончания');
  });
});
