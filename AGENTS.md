# fiztex-web

Контракт API искать в `../fiztex-back/docs/api-map.md`, затем точечным `jq`
в `openapi.json`. Сгенерированный `src/lib/api-types.ts` руками не править.

CI скачивает только этот репозиторий. Обычные тесты из `src/` не должны
импортировать или читать файлы соседних модулей либо требовать запущенный API.
Перед завершением запускать все стадии validate: `pnpm lint`,
`pnpm typecheck:test`, `pnpm test`, `pnpm build`. Для изменений тестов и CI
проверять также отдельный checkout без соседних репозиториев.

Проверки нескольких модулей находятся в `contracts/` и запускаются явно
через `pnpm test:contracts` в локальном монорепо. Для формул сначала обновить
снимок `pnpm sync:formula-fixtures`; источник —
`../fiztex-back/docs/formula-fixtures.json`. Порядок описан в `contracts/README.md`.
