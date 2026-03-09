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

## Features principales

- **Modes de jeu**: Easy, Hard, Riddle (enigmes), Taxonomic (ascension taxonomique)
- **Systeme de progression**: XP, niveaux, streak, achievements
- **Collection**: Suivi des especes observees avec rarete
- **Partage**: Collections et defis partageables via tokens
- **PWA**: Support offline, installation sur device
- **i18n**: Support fr/en/nl avec detection automatique
- **Metrics**: Collecte first-party pour analyse produit (opt-out possible)

Routes UI principales:

- `/`: HomePage (catalogue packs, daily challenge, stats)
- `/play`: PlayPage (jeu principal avec modes easy/hard/riddle/taxonomic)
- `/end`: EndPage (recap de manche)
- `/collection`: CollectionPage (especes observees)
- `/collection/share/:token`: SharedCollectionPage (partage de collection)
- `/profile`: ProfilePage (profil utilisateur, XP, achievements)
- `/challenge/:token`: ChallengePage (defis partageables)
- `/about`: AboutPage (presentation du projet)
- `/legal`: LegalPage (mentions legales, confidentialite, attribution)

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
