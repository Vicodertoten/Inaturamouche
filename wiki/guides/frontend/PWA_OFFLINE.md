# PWA & Offline-First Architecture

Guide complet de la Progressive Web App, Service Worker et stratégies cache offline.

## 📋 Table des matières

1. [PWA configuration](#pwa-configuration)
2. [Service Worker & cache policies](#service-worker--cache-policies)
3. [Offline-first workflow](#offline-first-workflow)
4. [IndexedDB persistence](#indexeddb-persistence)
5. [Troubleshooting PWA](#troubleshooting-pwa)

---

## 🔧 PWA configuration

### Vite PWA Plugin

**Configuration** : `client/vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',  // Fetch updates en background
      includeAssets: ['favicon.ico', 'robots.txt', 'site.webmanifest'],
      
      manifest: {
        name: 'Inaturamouche',
        short_name: 'INM',
        description: 'Quiz phylogénétique temps réel',
        theme_color: '#2d5016',
        background_color: '#ffffff',
        display: 'standalone',  // Full-screen PWA
        scope: '/',
        start_url: '/',
        
        icons: [
          {
            src: '/assets/inaturamouche-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/inaturamouche-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        
        screenshots: [
          {
            src: '/assets/screenshot-1.png',
            sizes: '540x720',
            type: 'image/png',
          },
        ],
        
        categories: ['education', 'lifestyle'],
        screenshots: [...],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,jpg,jpeg,gif,woff,woff2}'],
        
        runtimeCaching: [
          // Quiz endpoint: toujours frais (NetworkOnly)
          {
            urlPattern: /^https:\/\/.*\/api\/quiz-question/,
            handler: 'NetworkOnly',
            options: {
              networkTimeoutSeconds: 10,
              cacheName: 'quiz-network',
            },
          },

          // Autocomplete: SWR (cache 10 min, stale 1h)
          {
            urlPattern: /^https:\/\/.*\/(api\/taxa\/autocomplete|api\/observations\/species_counts)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-metadata',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 3600,  // 1h
              },
            },
          },

          // Photos iNat: CacheFirst (7 days, 400 entries)
          {
            urlPattern: /^https:\/\/(static\.inaturalist\.org|s3.*)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'inaturalist-photos',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 7 * 24 * 60 * 60,  // 7 days
              },
            },
          },

          // CSS/JS assets: CacheFirst
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,  // 30 days
              },
            },
          },
        ],
        
        navigateFallback: '/offline.html',  // Page offline fallback
      },

      devOptions: {
        enabled: process.env.VITE_PWA_DEV === 'true',
        suppressWarnings: true,
        navigateFallbackAllowlist: [/^(?!\/__)/],
      },
    }),
  ],
});
```

### Manifest web app

**File** : `public/site.webmanifest`

```json
{
  "name": "Inaturamouche",
  "short_name": "INM",
  "description": "Quiz phylogénétique temps réel avec données iNaturalist",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#2d5016",
  "background_color": "#ffffff",
  "orientation": "portrait-primary",
  
  "icons": [
    {
      "src": "/assets/inaturamouche-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/inaturamouche-icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Offline page

**File** : `public/offline.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offline – Inaturamouche</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .offline-container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: #333; }
    p { color: #666; font-size: 1.1rem; }
    button {
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: #2d5016;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: #1a3009; }
  </style>
</head>
<body>
  <div class="offline-container">
    <h1>🌐 You're offline</h1>
    <p>Your device is not connected to the internet.</p>
    <p>Cached content may still be available. Check back when online!</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>
```

---

## 📦 Service Worker & cache policies

### Cache policies expliquées

#### 1. **NetworkOnly** (Quiz endpoint)

```
Utilisateur demande question
  ├─ Toujours fetch réseau
  ├─ Si online: réponse serveur
  ├─ Si offline: fail, offline.html
  └─ Jamais servir stale
  
Raison: Éviter doublons question dues cooldown
```

#### 2. **StaleWhileRevalidate** (Autocomplete, metadata)

```
Utilisateur demande autocomplete
  ├─ Cache hit (fresh) ? → Servir immédiatement
  ├─ Cache hit (stale) ? → Servir + refetch en BG
  ├─ Cache miss ?        → Fetch réseau
  ├─ Si offline + hit    → Servir (stale OK)
  └─ Si offline + miss   → Fail silencieusement
  
Raison: Metadata change rarement, offline support important
```

#### 3. **CacheFirst** (Photos, assets)

```
Utilisateur demande photo
  ├─ Cache hit ? → Servir immédiatement
  ├─ Cache miss ? → Fetch réseau, cache, servir
  └─ Si offline + hit → Servir
  
Raison: Photos quasi-statiques, bandwidth important
```

---

## 🌐 Offline-first workflow

### Scénario 1: Quiz avec questions préchargées

**Before going offline :**

1. Utilisateur joue 2-3 questions
2. Questions + images cachées automatiquement
3. Service Worker: `CacheFirst` les images iNat

**Going offline :**

1. Utilisateur peut jouer questions déjà chargées
2. Nouvelles questions : NetworkOnly fail → offline.html

**Back online :**

1. Refresh page
2. SW détecte reseau, Service Worker reprend normal
3. Prefetch questions de nouveau

### Scénario 2: Configuration filters, puis play

**Before going offline :**

1. Utilisateur browse taxa/places (autocomplete API)
2. Résultats cachés (SWR)
3. Lance une partie (questions préchargées + images)

**Going offline :**

1. Jouer questions chargées ✅
2. Tenter autocomplete : stale data servie (pas internet, OK)
3. Tenter nouvelle question : NetworkOnly fail, offline.html

**Back online :**

1. Autocomplete refetchés en BG (SWR)
2. Nouvelles questions disponibles

---

## 💾 IndexedDB persistence

### Architecture

**IndexedDB** stocke:
- Scores de chaque partie
- Achievements débloqués
- Profil utilisateur (stats cumulées)
- Preferences (langue, thème)

**Jamais stocké** :
- Questions (trop volumineux)
- Photos (cache SW suffisant)
- État de jeu actif (session)

### Implémentation

```javascript
// client/src/services/db.js
import Dexie from 'dexie';

export const db = new Dexie('inaturamouche');

db.version(1).stores({
  // user profile
  profile: '&userId',

  // scores per game session
  gameSessions: '++id, timestamp',

  // achievements
  achievements: '&achievementId',

  // preferences
  preferences: '&key',
});

/**
 * Save game session
 */
export async function saveGameSession(session) {
  const id = await db.gameSessions.add({
    timestamp: Date.now(),
    score: session.score,
    maxStreak: session.maxStreak,
    questions: session.questionCount,
    gameMode: session.gameMode,
    roundResults: session.roundResults,
    filters: session.activeFilters,
  });

  // Update cumulative stats
  const profile = await db.profile.get('local_user');
  if (profile) {
    profile.totalScore += session.score;
    profile.sessionsCount++;
    await db.profile.put(profile);
  }

  return id;
}

/**
 * Fetch user profile
 */
export async function getProfile() {
  let profile = await db.profile.get('local_user');
  if (!profile) {
    profile = {
      userId: 'local_user',
      totalScore: 0,
      sessionsCount: 0,
      achievements: [],
      language: 'en',
      theme: 'light',
    };
    await db.profile.add(profile);
  }
  return profile;
}

/**
 * Unlock achievement
 */
export async function unlockAchievement(achievementId) {
  const existing = await db.achievements.get(achievementId);
  if (existing) return;  // Already unlocked

  await db.achievements.add({
    achievementId,
    unlockedAt: Date.now(),
  });

  // Update profile
  const profile = await db.profile.get('local_user');
  profile.achievements.push(achievementId);
  await db.profile.put(profile);
}
```

### React hooks

```javascript
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Hook: Subscribe to profile updates
 */
export function useProfile() {
  return useLiveQuery(() => db.profile.get('local_user'));
}

/**
 * Hook: Subscribe to game sessions
 */
export function useGameSessions(limit = 10) {
  return useLiveQuery(
    () => db.gameSessions.orderBy('timestamp').reverse().limit(limit).toArray()
  );
}

/**
 * Hook: Subscribe to achievements
 */
export function useAchievements() {
  return useLiveQuery(() => db.achievements.toArray());
}
```

### Utilisation dans composants

```javascript
// ProfilePage.jsx
function ProfilePage() {
  const profile = useProfile();
  const sessions = useGameSessions(20);
  const achievements = useAchievements();

  if (!profile) return <Spinner />;

  return (
    <div>
      <h1>Profile</h1>
      <p>Total score: {profile.totalScore}</p>
      <p>Sessions: {profile.sessionsCount}</p>
      <p>Achievements: {profile.achievements.length}</p>

      <h2>Recent games</h2>
      {sessions?.map(s => (
        <div key={s.id}>
          {s.score} pts, {s.questions} questions, {s.gameMode} mode
        </div>
      ))}
    </div>
  );
}
```

---

## 🔧 Troubleshooting PWA

### Issue: SW cache stale, données vieilles affichées

**Solution** :
```javascript
// Force cache clear
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

// Unregister SW
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});

// Hard reload
location.reload({ force: true });
```

### Issue: Offline mode → all features fail

**Expected behavior** :
- ✅ Quiz offline (si questions préchargées)
- ✅ Consulter profil (IndexedDB)
- ❌ Autocomplete (réseau required)
- ❌ Nouvelles questions (réseau required)

**Vérifier** :
- Sont les questions en cache ? (DevTools → Cache Storage)
- IndexedDB accessible ? (DevTools → Storage)

### Issue: PWA ne s'installe pas

**Vérifier** :
- ✅ HTTPS en production
- ✅ Manifest valide (`site.webmanifest`)
- ✅ Icons présentes (192x192, 512x512)
- ✅ Service Worker enregistré

**Tester** :
```bash
# Vérifier SW registration
navigator.serviceWorker.getRegistrations()

# Checker manifest
fetch('/site.webmanifest').then(r => r.json()).then(console.log)
```

### Issue: Dev mode PWA dysfonctionnel

**Enable dev PWA** :
```bash
VITE_PWA_DEV=true npm --prefix client run dev
```

**DevTools** :
- Application → Service Workers → Voir status
- Application → Cache Storage → Voir caches
- Console → Errors
- Network → Check SW interception

---

## 📈 Performance

### Metrics à monitorer

| Metric | Target | Impact |
|--------|--------|--------|
| **First Contentful Paint (FCP)** | < 1.5s | UX perception |
| **Largest Contentful Paint (LCP)** | < 2.5s | UX perception |
| **Cache hit rate** | > 80% | Bandwidth |
| **Offline availability** | 100% (cached pages) | Resilience |
| **PWA install rate** | > 5% | Adoption |

### Optimisations possibles

1. **Code splitting** : Lazy load routes
2. **Image optimization** : WebP, lazy loading, responsive images
3. **Bundle size** : Tree-shake unused code, use dynamic imports
4. **Cache warming** : Précharger questions communes au launch

---

## 🔗 Ressources

- [GAME_STATE.md](./GAME_STATE.md) – GameContext (session state)
- [COMPONENTS.md](./COMPONENTS.md) – Composants UI
- [ARCHITECTURE.md](../ARCHITECTURE.md) – Cache strategy backend
