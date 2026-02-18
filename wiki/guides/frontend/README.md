# Guide frontend

## Role

Le frontend est une SPA React (Vite) avec PWA et modes de jeu (easy, hard, riddle, taxonomic).

## Structure

- `client/src/App.jsx`: routes principales
- `client/src/pages/*`: ecrans
- `client/src/components/*`: composants UI
- `client/src/context/*`: etat global (game, user, language, packs)
- `client/src/state/*`: store Zustand (XP, streak, achievements)
- `client/src/services/api.js`: client API

Routes UI principales:

- `/`
- `/play`
- `/end`
- `/collection`
- `/profile`
- `/about`
- `/legal`

## PWA

Config dans `client/vite.config.js`:

- quiz: `NetworkOnly`
- metadata: `StaleWhileRevalidate`
- images/assets: `CacheFirst`

## i18n

Locales:

- `client/src/locales/fr.js`
- `client/src/locales/en.js`
- `client/src/locales/nl.js`

Verifier la coherence des cles via `npm run check:i18n`.

## Attribution photo

Les credits photo sont affiches dans le viewer (`ImageViewer`) via `photoMeta`.
