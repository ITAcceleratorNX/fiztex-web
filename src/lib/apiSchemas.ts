/**
 * Короткие псевдонимы к сгенерированным типам OpenAPI.
 *
 * `api-types.ts` генерируется скриптом `scripts/gen-api.sh` из
 * `fiztex-back/docs/openapi.json` — руками его не править.
 *
 * ```ts
 * import type { Schema } from '@/lib/apiSchemas';
 * type Year = Schema<'AcademicYearView'>;
 * ```
 *
 * Оговорка: springdoc не знает про nullability Java-полей, поэтому в ответах
 * все поля выходят опциональными (`id?: number`). Обязательными помечаются
 * только те, у которых на бэке стоит Bean Validation (`@NotNull`/`@NotBlank`),
 * — то есть в основном поля request-DTO. Не считайте `?` признаком того, что
 * поле реально может отсутствовать.
 */
import type { components, paths } from './api-types';

export type Schemas = components['schemas'];

/** Тип DTO по имени схемы: `Schema<'ClassScheduleView'>`. */
export type Schema<K extends keyof Schemas> = Schemas[K];

/** Пути API — для типизации хелперов поверх fetch. */
export type Paths = paths;
