import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { SaveFeedbackEntryResult } from '@/lib/monthlyFeedbackApi';
import { FeedbackDraft, type DraftOptions, type DraftState } from './feedbackDraft';

type Deferred = { resolve: (value: SaveFeedbackEntryResult) => void; reject: (error: unknown) => void };

/** Сервер под рукой теста: каждый вызов ждёт, пока тест сам ответит. */
function server() {
  const calls: { body: { text: string; version: number | null }; reply: Deferred }[] = [];
  const save = vi.fn(
    (body: { text: string; version: number | null }) =>
      new Promise<SaveFeedbackEntryResult>((resolve, reject) => {
        calls.push({ body, reply: { resolve, reject } });
      }),
  );
  return { calls, save };
}

function saved(version: number, text = 'x'): SaveFeedbackEntryResult {
  return { entry: { id: 1, text, version }, progress: { filled: 1, total: 2, missing: 1 } };
}

function draft(options: Partial<DraftOptions> & Pick<DraftOptions, 'save'>) {
  const states: DraftState[] = [];
  const instance = new FeedbackDraft({
    initial: null,
    debounceMs: 1500,
    onChange: (state) => states.push(state),
    ...options,
  });
  return { instance, states, last: () => states[states.length - 1] };
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('FeedbackDraft', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('сохраняет после паузы в наборе, а не на каждое нажатие', async () => {
    const { calls, save } = server();
    const { instance, last } = draft({ save, initial: { id: 1, text: 'было', version: 3 } });

    instance.edit('было и');
    await vi.advanceTimersByTimeAsync(1000);
    instance.edit('было и стало');
    await vi.advanceTimersByTimeAsync(1499);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((call) => call.body)).toEqual([{ text: 'было и стало', version: 3 }]);
    expect(last().status).toBe('saving');

    calls[0].reply.resolve(saved(4));
    await settle();
    expect(last().status).toBe('saved');
  });

  it('один запрос за раз: набранное во время сохранения уходит с новой версией', async () => {
    const { calls, save } = server();
    const { instance, last } = draft({ save });

    instance.edit('а');
    const first = instance.flush();
    instance.edit('аб');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);

    calls[0].reply.resolve(saved(0, 'а'));
    await first;
    expect(last().status).toBe('dirty');

    await vi.advanceTimersByTimeAsync(1500);
    expect(calls[1].body).toEqual({ text: 'аб', version: 0 });
  });

  it('flush во время сохранения дожидается его и досохраняет остаток', async () => {
    const { calls, save } = server();
    const { instance } = draft({ save });

    instance.edit('а');
    void instance.flush();
    instance.edit('аб');
    const done = instance.flush();

    calls[0].reply.resolve(saved(0, 'а'));
    await settle();
    calls[1].reply.resolve(saved(1, 'аб'));
    await expect(done).resolves.toBe(true);
    expect(calls[1].body.version).toBe(0);
  });

  it('тот же текст не отправляется', async () => {
    const { save } = server();
    const { instance } = draft({ save, initial: { id: 1, text: 'текст', version: 1 } });
    instance.edit('текст!');
    instance.edit('текст');
    await expect(instance.flush()).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('конфликт версий: ждёт выбора, «оставить мой» повторяет с их версией', async () => {
    const { calls, save } = server();
    const { instance, last } = draft({ save, initial: { id: 1, text: 'мой', version: 1 } });

    instance.edit('мой новый');
    const attempt = instance.flush();
    calls[0].reply.reject(
      new ApiError(409, 'conflict', 'MONTHLY_FEEDBACK_ENTRY_VERSION_CONFLICT', {
        entry: { id: 1, text: 'чужой', version: 5 },
      }),
    );
    await expect(attempt).resolves.toBe(false);
    expect(last()).toMatchObject({ status: 'conflict', theirs: { version: 5 } });

    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);

    const kept = instance.keepMine();
    expect(calls[1].body).toEqual({ text: 'мой новый', version: 5 });
    calls[1].reply.resolve(saved(6, 'мой новый'));
    await expect(kept).resolves.toBe(true);
  });

  it('конфликт: «взять с другого устройства» кладёт их текст и просит перечитать лист', () => {
    const { calls, save } = server();
    const onResync = vi.fn();
    const { instance, last } = draft({ save, onResync });

    instance.edit('мой');
    void instance.flush();
    calls[0].reply.reject(
      new ApiError(409, 'conflict', 'MONTHLY_FEEDBACK_ENTRY_VERSION_CONFLICT', { entry: null }),
    );
    return vi.advanceTimersByTimeAsync(0).then(() => {
      instance.takeTheirs();
      expect(last()).toMatchObject({ status: 'saved', text: '', theirs: null });
      expect(onResync).toHaveBeenCalledOnce();
    });
  });

  it('опубликованный лист: запись закрывается, экран узнаёт об этом', async () => {
    const { calls, save } = server();
    const onLocked = vi.fn();
    const { instance, last } = draft({ save, onLocked });

    instance.edit('текст');
    const attempt = instance.flush();
    calls[0].reply.reject(new ApiError(409, 'Лист опубликован', 'MONTHLY_FEEDBACK_SHEET_PUBLISHED'));
    await expect(attempt).resolves.toBe(false);
    expect(last()).toMatchObject({ status: 'locked', error: 'Лист опубликован' });
    expect(onLocked).toHaveBeenCalledOnce();

    instance.edit('ещё');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
  });

  it('обрыв связи: ошибка, следующее изменение пробует снова', async () => {
    const { calls, save } = server();
    const { instance, last } = draft({ save });

    instance.edit('а');
    void instance.flush();
    calls[0].reply.reject(new ApiError(0, 'Нет связи'));
    await settle();
    expect(last()).toMatchObject({ status: 'error', error: 'Нет связи' });

    instance.edit('аб');
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls[1].body).toEqual({ text: 'аб', version: null });
  });
});
