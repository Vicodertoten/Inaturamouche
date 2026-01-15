# Getting Started – Developer Guide

Guide complet pour installer et lancer Inaturamouche en mode développement.

## 📦 Prérequis

- **Node.js** 20+ ([nodejs.org](https://nodejs.org))
- **npm** 10+ (généralement bundlé avec Node)
- **Git** (pour cloner le repo)
- **macOS/Linux/Windows** (testé sur tous)

Vérifier :
```bash
node --version    # v20.10.0 ou supérieur
npm --version     # 10.0.0 ou supérieur
git --version     # 2.x
```

---

## 🚀 Installation locale

### 1️⃣ Cloner le repository

```bash
git clone https://github.com/user/inaturamouche.git
cd inaturamouche
```

### 2️⃣ Installer les dépendances

**Root (backend)** :
```bash
npm install
```

**Client (frontend)** :
```bash
npm --prefix client install
```

Ou en une ligne :
```bash
npm install && npm --prefix client install
```

### 3️⃣ Configurer les variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
# ============================================
# SERVER CONFIGURATION
# ============================================

# Port sur lequel écoute l'API Express
PORT=3001

# Mode Node
NODE_ENV=development

# Liste des proxies de confiance (pour X-Forwarded-* headers)
# En dev local : loopback, uniquelocal
# En production : adapter selon le proxy reverse
TRUST_PROXY_LIST=loopback,uniquelocal

# ============================================
# CLIENT CONFIGURATION (optionnel en dev)
# ============================================

# URL de base de l'API côté frontend
# En dev : http://localhost:3001 (défaut si non défini)
# En prod : https://api.inaturamouche.com
VITE_API_URL=http://localhost:3001

# ============================================
# LOGGING (optionnel)
# ============================================

# Niveau de log Pino : trace, debug, info, warn, error, fatal
# Défaut : info
LOG_LEVEL=debug
```

**Pour la production**, voir [DEPLOYMENT.md](./guides/ops/DEPLOYMENT.md).

---

## 💻 Mode développement (deux terminaux)

### Terminal 1 – Backend (API Express)

```bash
npm run dev
```

**Output attendu** :
```
[nodemon] 3.1.10
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): .
[nodemon] watching extensions: js,mjs,json
server listening on port 3001
GET http://localhost:3001/api/quiz-question OK
```

- API écoute sur `http://localhost:3001`
- Redémarre automatiquement (nodemon) si changement `.js` détecté
- Logs JSON via Pino

### Terminal 2 – Frontend (Vite dev server)

```bash
npm --prefix client run dev
```

**Output attendu** :
```
VITE v5.0.0  ready in 123 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

- Frontend sur `http://localhost:5173`
- Proxy `/api/` → `http://localhost:3001` (configuré dans `vite.config.js`)
- Hot reload en direct

### 🌐 Ouvrir dans le navigateur

Aller sur : **http://localhost:5173**

Vous devriez voir l'app Inaturamouche avec le lobby et le configurateur.

---

## 🏗️ Build pour la production

### Build frontend

```bash
npm --prefix client run build
```

Génère `client/dist/` avec la build optimisée (minification, tree-shaking, etc.).

### Build complet + Docker

```bash
npm run build
```

Cela exécute :
1. Build client (installe devDeps, lance Vite build)
2. Copie `client/dist/` dans la structure serveur
3. Génère image Docker (voir Dockerfile)

### Lancer localement en production

```bash
# Sans Docker
npm start

# Avec Docker
docker build -t inaturamouche .
docker run -p 3001:3001 inaturamouche
```

Frontend est servi statiquement par Express depuis `/public/` ou `client/dist/`.

---

## 🧪 Tests et vérifications

### Tous les tests

```bash
npm test
```

Lance :
- Tests Node (server) : `node --test ./tests/*.mjs`
- Tests client : `npm --prefix client run test`

### Tests serveur uniquement

```bash
node --test ./tests/*.mjs
```

Fichiers de test :
- `tests/api-errors.test.mjs` – Gestion d'erreurs API
- `tests/quiz-utils.test.mjs` – Utilitaires quizz (cooldown, etc.)
- `tests/server/errors.test.mjs` – Erreurs serveur

### Tests client uniquement

```bash
npm --prefix client run test
```

Fichiers de test :
- `client/tests/api.test.mjs` – Appels API, transformations
- `client/tests/api-errors.test.mjs` – Gestion erreurs frontend
- `client/tests/filterReducer.test.mjs` – Logique filtres
- `client/tests/formatters.test.mjs` – Format dates/nombres
- `client/tests/notifications.test.mjs` – Système notifications

### Vérifier la parité i18n

```bash
npm run check:i18n
```

Affiche :
- Compte des clés par locale (should be equal)
- Clés manquantes/extras par rapport à `fr.js`

Exemple :
```
Checking i18n parity...
fr.js: 234 keys
en.js: 234 keys ✓
nl.js: 232 keys ✗ (MISSING: game.hint, game.retry)
```

### Linting frontend

```bash
npm --prefix client run lint
```

Lance ESLint sur `client/src/` et `client/tests/`.

### CI complet (comme en GitHub Actions)

```bash
npm run ci
```

Exécute :
```bash
npm run check:i18n && npm test
```

---

## 📁 Structure des répertoires clés

```
inaturamouche/
├── .env                          # Variables d'env (⚠️ NE PAS commit)
├── .env.example                  # Template (à adapter)
├── server.js                     # Entry point Express
├── package.json                  # Dépendances root + scripts npm
│
├── client/
│   ├── package.json              # Dépendances frontend
│   ├── vite.config.js            # Config Vite + PWA
│   ├── eslint.config.js          # Config ESLint
│   ├── index.html                # Template HTML
│   └── src/
│       ├── main.jsx              # React entry
│       ├── App.jsx               # Composant root
│       ├── context/              # GameContext, UserContext, etc.
│       ├── components/           # Composants React
│       ├── hooks/                # Custom hooks
│       ├── services/api.js       # Appels API
│       ├── locales/              # i18n (fr.js, en.js, nl.js)
│       └── tests/                # Tests client
│
├── lib/
│   ├── quiz-utils.js             # Utilitaires (cooldown, etc.)
│   └── smart-cache.js            # SmartCache (LRU + SWR)
│
├── shared/
│   └── data/
│       ├── common_european_mushrooms.json
│       └── common_european_trees.json
│
├── server/
│   ├── packs/                    # Logique packs
│   └── index.js
│
├── tests/                        # Tests serveur
│   ├── api.test.mjs
│   ├── errors.test.mjs
│   └── ...
│
├── docs/                         # Ancienne documentation
│   ├── ARCHITECTURE_BACKEND.md
│   └── FRONTEND_GUIDE.md
│
└── wiki/                         # 🆕 Nouvelle documentation centralisée
    ├── README.md                 # Index + Quick Start
    ├── ARCHITECTURE.md           # Vue d'ensemble unifiée
    ├── GETTING_STARTED.md        # Ce fichier
    ├── CONTRIBUTING.md           # Conventions, i18n, tests
    ├── API_REFERENCE.md          # Contrats routes
    │
    ├── guides/
    │   ├── backend/
    │   │   ├── QUIZ_PIPELINE.md
    │   │   ├── CACHE_STRATEGY.md
    │   │   └── OBSERVABILITY.md
    │   ├── frontend/
    │   │   ├── GAME_STATE.md
    │   │   ├── PWA_OFFLINE.md
    │   │   ├── COMPONENTS.md
    │   │   └── STYLING.md
    │   └── ops/
    │       ├── DEPLOYMENT.md
    │       └── MONITORING.md
    │
    └── diagrams/
        ├── quiz-pipeline.mmd
        ├── state-machine.mmd
        └── cache-strategy.mmd
```

---

## 🔥 Commandes npm

### Root

| Commande | Description |
|----------|-------------|
| `npm install` | Installe dépendances backend |
| `npm run dev` | Lance API en dev (nodemon) |
| `npm start` | Lance API en prod |
| `npm run build` | Build client + Docker image |
| `npm test` | Tests Node + client |
| `npm run check:i18n` | Vérifie parité traductions |
| `npm run ci` | CI complet (i18n + tests) |
| `npm run lint` | Lint frontend |

### Frontend (`npm --prefix client run ...`)

| Commande | Description |
|----------|-------------|
| `install` | Installe dépendances client |
| `dev` | Dev server Vite (:5173) |
| `build` | Build optimisée pour prod |
| `preview` | Prévisualise build prod localement |
| `test` | Tests Vitest |
| `lint` | ESLint + check |

---

## 🐛 Debugging

### Backend

**Logs Pino** :
```bash
npm run dev 2>&1 | grep -E "(error|warn|quiz-question)"
```

**Node debugger** :
```bash
node --inspect server.js
# Puis ouvrir chrome://inspect/
```

**Headers debug** (dans DevTools Network) :
- `Server-Timing` – Temps par étape pipeline
- `X-Cache-Key` – Clé de cache utilisée
- `X-Lure-Buckets` – Distribution LCA near/mid/far
- `X-Pool-Obs` / `X-Pool-Taxa` – Volume données iNat

### Frontend

**React DevTools** (Chrome extension) :
- Inspecter GameContext, UserContext
- Trace renders, profiler performance

**Network tab (DevTools)** :
- Voir appels `/api/quiz-question`
- Checker headers `Server-Timing`

**Vue DevTools / App Layout** :
- Clicker header → reset game state
- Ouvrir PreferencesMenu → langue, thème, volume

**Logs console** :
- `window.gameState` (si exposé)
- API responses JSON

---

## 🌐 URLs de développement

| Ressource | URL |
|-----------|-----|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:3001 |
| **API quiz** | http://localhost:3001/api/quiz-question?pack=common_european_mushrooms |
| **Autocomplete** | http://localhost:3001/api/taxa/autocomplete?q=amanita |
| **Health check** | http://localhost:3001/api/health |

---

## 📋 Checklist onboarding nouveau dev

- [ ] Node.js 20+ installé (`node -v`)
- [ ] Repo cloné et `npm install` + `npm --prefix client install` OK
- [ ] `.env` créé avec `PORT=3001`
- [ ] `npm run dev` lancé (Terminal 1)
- [ ] `npm --prefix client run dev` lancé (Terminal 2)
- [ ] Frontend accessible sur http://localhost:5173
- [ ] Tester une question → `/api/quiz-question` répond
- [ ] `npm test` passe (ou presque)
- [ ] `npm run check:i18n` OK
- [ ] Lire [ARCHITECTURE.md](./ARCHITECTURE.md) pour comprendre pipeline
- [ ] Finder un petit issue et faire PR ! 🎉

---

## 🆘 Troubleshooting

### ❌ Port 3001 déjà utilisé

```bash
# Trouver processus
lsof -i :3001

# Tuer processus
kill -9 <PID>

# Ou utiliser port différent
PORT=3002 npm run dev
```

### ❌ Vite proxy `/api` ne fonctionne pas

Vérifier `client/vite.config.js` :
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
}
```

### ❌ Tests échouent en Windows

Utiliser `bash` (WSL ou Git Bash) au lieu de `cmd.exe`.

### ❌ Cache stale en dev

Forcer refresh du SW :
```bash
# DevTools → Application → Service Workers → Unregister
# Puis refresh page
```

### ❌ i18n parity échoue

```bash
npm run check:i18n
# Ajouter clés manquantes à toutes les locales
# Relancer check
```

### ❌ Erreur `CORS` frontend → backend

Vérifier `server.js` :
```javascript
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
```

En dev, vérifier que `/api` proxy Vite est bien configuré.

---

## 🚀 Prochaines étapes

1. **Lire [ARCHITECTURE.md](./ARCHITECTURE.md)** pour comprendre pipeline + cache
2. **Explorer tests** : `npm test`, lire `tests/*.mjs`
3. **Faire une petite modif** : Changer label, couleur, texte
4. **Lancer tests** pour s'assurer que rien ne casse
5. **Ouvrir PR** ! 🎉

Besoin d'aide ? → Ouvrir une issue ou consulter [CONTRIBUTING.md](./CONTRIBUTING.md)
