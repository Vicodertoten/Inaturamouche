# Inaturamouche – Le Quiz Naturaliste basé sur la Science

Quiz photo temps réel fondé sur les données iNaturalist : algorithmes phylogénétiques pour choisir les leurres, filtres géographiques/ saisonniers, PWA prête pour le terrain.

## Features clés
- PWA avec cache différencié (quiz en `NetworkOnly`, métadonnées en `SWR`, photos iNat en `CacheFirst`).
- Algorithme de leurres intelligent (proximité LCA near/mid/far, anti-répétition cible/observation).
- Packs préconfigurés + mode filtres libres (taxons inclus/exclus, bbox ou place, période ou fenêtre saisonnière).
- Modes de jeu facile/difficile, préchargement de la prochaine question, profils et achievements persistés côté client.
- Observabilité intégrée : `Server-Timing`, `X-Lure-Buckets`, `X-Pool-*` pour inspecter les performances.

## Quick Start
```bash
# 1) Installer les dépendances serveur
npm install

# 2) Installer les dépendances client
npm --prefix client install

# 3) Démarrer en dev (2 terminaux)
npm run dev              # API Express + nodemon (port 3001)
npm --prefix client run dev   # Front Vite (port 5173, proxy /api)

# 4) Build prod
npm run build            # build client/ et copie dans l'image Docker
npm start                # lance l'API en mode prod
```
- **Docker** : `docker build -t inaturamouche .` puis `docker run -p 3001:3001 inaturamouche`.
- **Tests** : `npm test` lance les tests Node + client (node --test).

## Architecture technique
- **Backend** : Node/Express 5, Zod pour la validation, Pino pour les logs, caches LRU mémoire, appels iNaturalist avec retries/timeout.  
- **Frontend** : React 19 + Vite + vite-plugin-pwa, routing React Router, contextes `GameContext`/`UserContext` pour l'état global.  
- **Docs détaillées** :  
  - `docs/ARCHITECTURE_BACKEND.md` (pipeline, caches, observabilité)  
  - `docs/API_REFERENCE.md` (contrats de routes, paramètres, erreurs)  
  - `docs/FRONTEND_GUIDE.md` (state machine, PWA, composants)

## Variables d'environnement
- `PORT` (défaut `3001`) : port HTTP de l'API.  
- `TRUST_PROXY_LIST` (défaut `loopback,uniquelocal`) : liste Express trust proxy, CSV.  
- `VITE_API_URL` (optionnel côté client) : base URL de l'API utilisée par le front ; sinon `http://localhost:3001` en dev, Render en prod.

## Ressources utiles
- Prod front : https://inaturamouche.netlify.app  
- Prod API : https://inaturamouche-api.onrender.com  
- Wiki technique : voir le dossier `docs/` pour les pipelines backend, les contrats API et l'architecture React.
