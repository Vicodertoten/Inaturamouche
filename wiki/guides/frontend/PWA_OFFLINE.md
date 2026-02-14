# PWA / Offline

Configuration dans `client/vite.config.js` via `vite-plugin-pwa`.

## Regles runtime cache

- `/api/quiz-question`: `NetworkOnly`
- `/api/taxa/autocomplete` + `/api/observations/species_counts`: `StaleWhileRevalidate`
- autres `/api/*`: `NetworkOnly`
- images iNaturalist + assets: `CacheFirst`

## Service worker

- enregistrement en production dans `client/src/main.jsx`
- `registerSW({ immediate: true })`

## Consequences UX

- le quiz live demande le reseau pour eviter les questions stale
- les metadata et assets beneficient du cache pour fluidite

## Tests

- lint/build client dans CI
- E2E smoke couvre Home -> Play -> End + report modal
