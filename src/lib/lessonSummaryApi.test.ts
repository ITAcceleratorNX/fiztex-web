import { expect, it, vi } from 'vitest';
import { lessonSummaryApi } from './lessonSummaryApi';
import { requestMultipart } from './api';
vi.mock('./api', () => ({ request: vi.fn(), requestMultipart: vi.fn() }));

it('источник конспекта загружается скрытым от учеников атомарно', async () => {
  const file = new File(['Текст'], 'lesson.txt');
  await lessonSummaryApi.upload(12, file);
  const [path, form] = vi.mocked(requestMultipart).mock.calls[0];
  expect(path).toBe('/lessons/12/materials/files');
  expect(form.get('file')).toBe(file);
  expect(form.get('visibleToStudents')).toBe('false');
});
