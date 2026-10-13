import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/lib/api';
import { homeworkAiApi } from './homeworkAiApi';

vi.mock('@/lib/api', () => ({
  request: vi.fn().mockResolvedValue({}), requestBlob: vi.fn(), requestMultipart: vi.fn(),
}));

describe('homeworkAiApi.apply', () => {
  beforeEach(() => vi.mocked(request).mockClear());

  it('передаёт серверу явный режим добавления', async () => {
    await homeworkAiApi.apply(7, 12, 'APPEND');
    expect(request).toHaveBeenCalledWith('/homework/7/ai-generations/12/append', { method: 'POST' });
  });

  it('сохраняет прежний запрос для замены и клиентов без режима', async () => {
    await homeworkAiApi.apply(7, 12);
    await homeworkAiApi.apply(7, 12, 'REPLACE');
    expect(request).toHaveBeenNthCalledWith(1, '/homework/7/ai-generations/12/apply', { method: 'POST' });
    expect(request).toHaveBeenNthCalledWith(2, '/homework/7/ai-generations/12/apply', { method: 'POST' });
  });
});
