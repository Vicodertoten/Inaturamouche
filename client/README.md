# Client

SPA React de iNaturaQuizz (Vite + PWA).

## Stack

- React 19
- React Router
- Vite
- vite-plugin-pwa
- Vitest + Playwright

## Routes UI

- `/`
- `/play`
- `/end`
- `/collection`
- `/profile`

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test -- --run
npm run test:e2e
```

## API consommee

Client principal: `client/src/services/api.js`.

Endpoints utilises:
- `/api/quiz-question`
- `/api/quiz/submit`
- `/api/quiz/explain`
- `/api/reports`
- `/api/packs`
- `/api/taxa/autocomplete`
- `/api/taxon/:id`
- `/api/taxa`
- `/api/places`
- `/api/places/by-id`

## PWA

Config: `client/vite.config.js`.

- quiz: `NetworkOnly`
- metadata: `StaleWhileRevalidate`
- images/assets: `CacheFirst`

## Reference

- `wiki/guides/frontend/GAME_STATE.md`
- `wiki/guides/frontend/PWA_OFFLINE.md`
- `wiki/API_REFERENCE.md`
