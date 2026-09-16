import { ApiError } from '@/lib/api';
import { FEEDBACK_ERRORS, type FeedbackEntry, type SaveFeedbackEntryResult } from '@/lib/monthlyFeedbackApi';

/**
 * `idle` — сохранять нечего и ничего не происходило; `saved` — последнее изменение принято;
 * `conflict` — запись изменили на другом устройстве, ждём выбора; `locked` — лист опубликован,
 * месяц закрыт или ученик ушёл: писать больше некуда.
 */
export type DraftStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'locked';

export type DraftState = {
  text: string;
  status: DraftStatus;
  error: string | null;
  /** Запись с другого устройства при конфликте; `null` — там её удалили. */
  theirs: FeedbackEntry | null;
};

export type DraftOptions = {
  initial: FeedbackEntry | null | undefined;
  save: (body: { text: string; version: number | null }) => Promise<SaveFeedbackEntryResult>;
  onChange: (state: DraftState) => void;
  /** Лист больше не принимает записи: экран перечитывает его и переходит в чтение. */
  onLocked?: (error: ApiError) => void;
  /** Взят текст с другого устройства: прогресс листа знает только сервер. */
  onResync?: () => void;
  debounceMs?: number;
};

/** Контракт T4: 1,5–2 с после последнего нажатия. */
export const FEEDBACK_AUTOSAVE_DELAY_MS = 1500;

const LOCKING_CODES: ReadonlySet<string> = new Set([
  FEEDBACK_ERRORS.sheetPublished,
  FEEDBACK_ERRORS.monthClosed,
  FEEDBACK_ERRORS.notInRoster,
]);

/**
 * Автосохранение одного отзыва (контракт T4, «Правила клиента»).
 *
 * <p>Главное правило — **один запрос за раз**. Версия записи приходит ответом, и второй запрос,
 * отправленный до ответа первого, ушёл бы со старой версией и получил бы 409 от самого себя.
 * Поэтому изменения во время сохранения не отправляются сразу, а дожидаются ответа.
 *
 * <p>Сравнение «есть ли что сохранять» идёт с **отправленным** текстом, а не с тем, что вернул
 * сервер: сервер нормализует пробелы и переводы строк, и подмена поля его версией во время
 * набора прыгала бы курсором.
 */
export class FeedbackDraft {
  private text: string;
  private sentText: string;
  private version: number | null;
  private status: DraftStatus = 'idle';
  private error: string | null = null;
  private theirs: FeedbackEntry | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<boolean> | null = null;
  private readonly options: DraftOptions;

  constructor(options: DraftOptions) {
    this.options = options;
    this.text = options.initial?.text ?? '';
    this.sentText = this.text;
    this.version = options.initial?.version ?? null;
  }

  get state(): DraftState {
    return { text: this.text, status: this.status, error: this.error, theirs: this.theirs };
  }

  edit(text: string): void {
    this.text = text;
    if (this.status === 'conflict' || this.status === 'locked') {
      this.emit();
      return;
    }
    if (this.status !== 'saving') {
      this.status = text === this.sentText ? (this.status === 'idle' ? 'idle' : 'saved') : 'dirty';
      this.error = null;
    }
    this.emit();
    this.schedule();
  }

  /**
   * Сохранить немедленно — «Готово», «Следующий ученик», закрытие окна.
   *
   * @returns `true`, когда на сервере ровно то, что в поле
   */
  flush(): Promise<boolean> {
    this.clearTimer();
    if (this.status === 'conflict' || this.status === 'locked') return Promise.resolve(false);
    if (this.inFlight) return this.inFlight.then(() => this.flush());
    if (this.text === this.sentText) {
      if (this.status === 'dirty' || this.status === 'error') {
        this.status = 'saved';
        this.error = null;
        this.emit();
      }
      return Promise.resolve(true);
    }

    const text = this.text;
    this.status = 'saving';
    this.error = null;
    this.emit();

    this.inFlight = this.options
      .save({ text, version: this.version })
      .then((result) => {
        this.version = result.entry?.version ?? null;
        this.sentText = text;
        this.status = this.text === text ? 'saved' : 'dirty';
        return true;
      })
      .catch((error: unknown) => {
        this.fail(error);
        return false;
      })
      .finally(() => {
        this.inFlight = null;
        this.emit();
        if (this.status === 'dirty') this.schedule();
      });
    return this.inFlight;
  }

  /** «Оставить мой»: тот же текст поверх чужой версии (контракт T4). */
  keepMine(): Promise<boolean> {
    if (this.status !== 'conflict') return Promise.resolve(true);
    this.version = this.theirs?.version ?? null;
    this.sentText = this.theirs?.text ?? '';
    this.theirs = null;
    this.status = 'dirty';
    return this.flush();
  }

  /** «Взять с другого устройства»: поле получает их текст, сохранять нечего. */
  takeTheirs(): void {
    if (this.status !== 'conflict') return;
    this.text = this.theirs?.text ?? '';
    this.sentText = this.text;
    this.version = this.theirs?.version ?? null;
    this.theirs = null;
    this.status = 'saved';
    this.emit();
    this.options.onResync?.();
  }

  dispose(): void {
    this.clearTimer();
  }

  private fail(error: unknown): void {
    if (error instanceof ApiError && error.code === FEEDBACK_ERRORS.versionConflict) {
      this.status = 'conflict';
      this.theirs = conflictEntry(error);
      return;
    }
    if (error instanceof ApiError && error.code && LOCKING_CODES.has(error.code)) {
      this.status = 'locked';
      this.error = error.message;
      this.options.onLocked?.(error);
      return;
    }
    this.status = 'error';
    this.error = error instanceof Error && error.message ? error.message : 'Не удалось сохранить';
  }

  private schedule(): void {
    this.clearTimer();
    if (this.status !== 'dirty') return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.debounceMs ?? FEEDBACK_AUTOSAVE_DELAY_MS);
  }

  private clearTimer(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.options.onChange(this.state);
  }
}

/** `details.entry` конфликта версий: текущая запись или `null`, если её удалили. */
export function conflictEntry(error: ApiError): FeedbackEntry | null {
  const details = error.details as { entry?: FeedbackEntry | null } | undefined;
  return details?.entry ?? null;
}
