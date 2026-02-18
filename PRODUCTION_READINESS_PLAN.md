# 📊 PLAN DE MATURATION VERS PRODUCTION  
**iNaturaQuizz — 3 mois de stabilité + leadership**

**Code:** Février 18, 2026  
**Status:** Blueprint détaillé adapté à votre codebase      
**Timeline:** 2-3 mois calendaire

---

## 🎯 OBJECTIF GLOBAL

Faire passer l'app d'un **"cool prototype"** à une **"app prête pour partnership iNaturalist"**

```
Aujourd'hui:
❌ Prototype avancé (seul dev)
❌ Attributions minimales
❌ Monitoring basique
❌ Frontend peut avoir des rough edges

DANS 3 MOIS:
✅ Production-grade (stabilité 99%+)
✅ Attribution cristalline
✅ Logs structures + monitoring
✅ Design cohérent
✅ Base utilisateurs réels (100+)
```

---

## 🔍 ANALYSE DE L'APP EXISTANTE

### ✅ Ce qui existe DÉJÀ (bien!)

| Aspect | Status | Code |
|--------|--------|------|
| **Attribution iNat** | ✅ Présent | `client/src/components/Footer.jsx` mentions iNat |
| **Page légale** | ✅ Complète | `client/src/pages/LegalPage.jsx` (sections RGPD, attribution) |
| **Design** | ✅ Sophistiqué | 70+ componesnts CSS (7,3k LOC) |
| **Frontend UX** | ✅ Riche | HomePage 817 lignes de logique nice |
| **PWA** | ✅ Configuré | `VitePWA` + ServiceWorker + manifest |
| **Logging serveur** | ✅ Pino JSON | Structuré, prêt |
| **Tests** | ✅ 155 fichiers | Unit + integration + E2E Playwright |
| **CI/CD** | ✅ Complet | lint + i18n + test + build + smoke |
| **BUILD SIZE** | ✅ Bon | ~600 KB gzipped (raisonnable) |

### ⚠️ Ce qui manque (nécessaire pour 3 mois)

| Item | Critère | Effort |
|------|---------|--------|
| **UX Polish** | Design cohérent mobile | ⭐⭐ |
| **Error Sentry** | Crash tracking prod | ⭐ |
| **Analytics minimal** | Usage stats (pas Google!) | ⭐⭐ |
| **Performance audit** | Mobile Web Vitals | ⭐ |
| **Attribution visibility** | Footer more prominent | ⭐ |
| **"About" page** | Educational purpose doc | ⭐ |
| **Uptime monitoring** | Ping healthz endpoint | ⭐ |
| **Stress testing** | 100 concurrent users | ⭐⭐ |

---

## 📋 LE PLAN: 5 MISSIONS ADAPTÉES

### **MISSION 1: Frontend UX Polish** ⭐⭐⭐

**Objectif:** Pas de "work-in-progress feels", mobile parfait

#### 1.1 Audit Design Cohérence

```bash
# Semaine 1 — Diagnostic
□ Tester sur iPhone 12 (small phone)
□ Tester sur iPad (tablet)
□ Vérifier tous breakpoints
□ Screenshot comparaison pages principales
  ├─ HomePage.jsx (layout)
  ├─ PlayPage.jsx (game flow)
  ├─ ProfilePage.jsx (stats display)
  ├─ EndPage.jsx (recap screen)

# Noter les issues
□ Texte trop grand/petit?
□ Espacement inconsistent?
□ Boutons pas clairement cliquables?
□ Images mal responsive?
```

#### 1.2 Fix Mobile Critical Path

```javascript
// client/src/styles/responsive.css — CRÉER fichier
// Améliorer breakpoints existants

// Issues probables à fixer:
□ HomePage hero CTA button (padding mobile?)
□ PlayPage image viewer (fit-contain vs cover?)
□ EndPage stats layout (vertical stack?)
□ Profile badges (grid wrapping?)

// Refrence: HomePage.css est déjà bon, copier patterns
```

**Action pratique (3-4h):**
```bash
# Tester sur DevTools iPhone
# Fixer les 5-10 issues critiques
# Vérifier scroll fluide (60 fps)
# Performance: npm --prefix client run build
```

#### 1.3 Animation & Transitions Smooth

```css
/* client/src/styles/animations.css — CRÉER fichier */

/* Audit existant:
   FloatingXPIndicator.css ✓ (nice)
   LevelUpNotification.css ✓ (clean)
   RarityCelebration.css ✓ (polished)
   
   À améliorer:
   - Transition entre pages (fade-in?)
   - Loading skeleton animations
   - Button hover states (more feedback)
*/

.page-transition-enter {
  opacity: 0;
  transform: translateY(10px);
}
.page-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 300ms ease-out;
}
```

#### 1.4 Performance Mobile (Vitals)

```bash
# Test avec Lighthouse (DevTools)
TARGETS:
□ FCP (First Contentful Paint) < 2s
□ LCP (Largest Contentful Paint) < 2.5s
□ CLS (Cumulative Layout Shift) < 0.1
□ TTI (Time to Interactive) < 3.5s

# Optimisations déjà faites: ✓
□ Code splitting (lazy routes) ✓
□ Image optimization needed?
  └─ Compress pack preview images?
  └─ WebP format?
  └─ Lazy load off-screen images?

# Dev: npm --prefix client run build
# Then: devtools → Lighthouse
```

**Semaine Allouée:** 1 semaine (5-7h)

---

### **MISSION 2: Production Readiness** ⭐⭐⭐⭐

**Objectif:** Monitoring, error tracking, stability

#### 2.1 Error Tracking (Sentry)

**Pourquoi?** Détecter crashes en prod (users pas vous localement)

```bash
# 1. Setup Sentry (free tier OK)
npm install @sentry/react @sentry/tracing

# 2. Initialiser main.jsx
# client/src/main.jsx

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN, // → .env
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter dev/test events
    if (import.meta.env.DEV) return null;
    return event;
  },
});

function App() { /* ... */ }
export default Sentry.withProfiler(App);
```

```javascript
// server/index.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: config.nodeEnv,
  tracesSampleRate: 0.1,
});

// Middleware
app.use(Sentry.Handlers.requestHandler());
// ... routes ...
app.use(Sentry.Handlers.errorHandler());
```

```bash
# .env
VITE_SENTRY_DSN=https://xxx@sentry.io/yyyy
SENTRY_DSN=https://xxx@sentry.io/yyyy
```

**Cost:** Free tier (5k events/month suffisant)  
**Setup Time:** 2h  
**Benefit:** Découvrez les bugs avant users

#### 2.2 Uptime Monitoring

**Pourquoi?** Être alerté si app crashe

**Option A: Ping simpl (FREE)**
```javascript
// server/routes/health.js — EXISTS ALREADY
// GET /healthz

// Use external monitoring: Uptimerobot (free, 50 monitors)
// → ping https://inaturaquizz.com/healthz every 5 min
// → alert Slack if down
```

**Option B: Better observability**
```bash
npm install node-schedule pino-datadog # or Grafana

# server/config/monitoring.js — CREATE
export function setupMonitoring() {
  // Log key metrics every 5 min
  setInterval(() => {
    logger.info({
      uptime_sec: process.uptime(),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date(),
    }, 'app-health-check');
  }, 5 * 60 * 1000);
}
```

**Recommended:** Free UptimeRobot + Slack webhook  
**Setup Time:** 1h  
**Cost:** $0

#### 2.3 Logs Structurés (Pino - Déjà bon!)

```javascript
// Vérifier que les logs IMPORTANT sont marqués
// server/services/iNaturalistClient.js

// BON:
logger?.warn({ status: response.status }, 'iNat fetch failed');
logger?.error({ error: err.message }, 'iNat fetch exhausted retries');

// AMÉLIORER - ajouter contexte:
logger?.error({
  error: err.message,
  stack: err.stack,
  endpoint: 'observations',
  userId: req?.user?.id, // si existe
  timestamp: Date.now(),
}, 'API error');

// Visualiser: curl http://localhost:3001/healthz
```

**Setup Time:** 0.5h (just add more context)  
**Benefit:** Logs utilisables pour debugging

#### 2.4 Test de Stabilité (1 semaine)

```bash
# SEMAINE 2-3: Monitoring production
□ Lancer app en prod (déjà sur Fly.io ✓)
□ Chaque jour: vérifier logs Sentry
□ Chaque jour: vérifier uptime monitor
□ NOTE: tous problèmes
□ Garder running 7+ jours SANS crashes

# Checklist stabilité:
□ Zéro crash sur la semaine
□ Load tests OK (voir Mission 5)
□ API response times OK (< 800ms p95)
□ Pas d'erreurs de mémoire (memory leaks?)
```

**Semaine Allouée:** 2 (monitoring setup + 1 week runtime watch)

---

### **MISSION 3: Attribution Cristalline** ⭐⭐⭐

**Objectif:** iNat savoir CLEAERLY qu'on respecte leurs données

#### 3.1 Footer Upgrade

**Status:** Footer existe, mais peut être mieux visible

```javascript
// client/src/components/Footer/Footer.jsx — EXISTING (improve it)

// ACTUEL:
<p className="footer-attribution">
  {t('footer.inat_attribution', {}, 
    'Données naturalistes fournies par iNaturalist (CC BY-NC)...')}
</p>

// AMÉLIORÉ:
<div className="footer-section footer-inat-credit">
  <p className="footer-heading">
    <strong>📊 Source des données</strong>
  </p>
  <p>
    Les observations et photos proviennent de 
    <a href="https://www.inaturalist.org" target="_blank" rel="noopener">
      iNaturalist  
    </a>
    , une initiative de la California Academy of Sciences 
    et National Geographic Society.
  </p>
  <p className="footer-licenses">
    <strong>Licences des observations :</strong>
    <br/>
    <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC</a> · 
    <a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a> · 
    <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>
  </p>
</div>
```

**CSS Update:**
```css
/* client/src/components/Footer/Footer.css */

.footer-inat-credit {
  border-top: 1px solid #ddd;
  padding-top: 1rem;
  margin-top: 1rem;
  font-size: 0.9rem;
  line-height: 1.6;
}

.footer-inat-credit a {
  color: #0073e6;
  text-decoration: underline;
}

.footer-licenses {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}
```

#### 3.2 Créer Page "À Propos"

**Path:** Créer `/client/src/pages/AboutPage.jsx`

```javascript
// client/src/pages/AboutPage.jsx — NEW FILE
import { useLanguage } from '../context/LanguageContext';
import './AboutPage.css';

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="screen about-screen">
      <h1>{t('about.title', {}, 'À propos d\'iNaturaQuizz')}</h1>

      <section className="about-section">
        <h2>{t('about.what_is', {}, 'C\'est quoi?')}</h2>
        <p>
          iNaturaQuizz est un jeu éducatif gratuit qui vous aide 
          à apprendre l'identification des espèces naturelles à travers 
          un quiz interactif basé sur de vraies observations.
        </p>
      </section>

      <section className="about-section">
        <h2>{t('about.mission', {}, 'Notre mission')}</h2>
        <ul>
          <li>Rendre l'apprentissage nature accessible et amusant</li>
          <li>Célébrer la biodiversité réelle capturée par iNaturalist</li>
          <li>Promouvoir science citoyenne</li>
          <li>Zero tracking, respect de votre vie privée</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>{t('about.data_source', {}, 'Source des données')}</h2>
        <p>
          Les observations et photos proviennent de{' '}
          <a href="https://www.inaturalist.org" target="_blank">
            iNaturalist
          </a>
          , une plateforme collaborative internationale.
        </p>
        <p>
          Chaque observation est identifiée par la communauté 
          et marquée "Research Grade" (standard scientifique).
        </p>
        <p>
          <strong>Attribution :</strong> Chaque photo affiche le nom 
          de l'observateur original et la licence.
        </p>
      </section>

      <section className="about-section">
        <h2>{t('about.privacy', {}, 'Confidentialité')}</h2>
        <ul>
          <li>✓ Zéro authentification requise</li>
          <li>✓ Zéro tracking (pas Google Analytics)</li>
          <li>✓ Zéro cookies tiers</li>
          <li>✓ Données sauvegardées localement (votre navigateur)</li>
          <li>✓ Conforme RGPD</li>
        </ul>
        <p>
          Consultez notre{' '}
          <a href="/legal#privacy">politique de confidentialité</a>
        </p>
      </section>

      <section className="about-section">
        <h2>{t('about.support', {}, 'Soutien')}</h2>
        <p>
          iNaturaQuizz est un projet personnel et gratuit. 
          Si vous aimez, vous pouvez :
        </p>
        <ul>
          <li>Partager avec vos amis</li>
          <li>Contribuer sur <a href="https://github.com/Vicodertoten/Inaturamouche">GitHub</a></li>
          <li>Soutenir iNaturalist directement</li>
        </ul>
      </section>

      <section className="about-section">
        <p className="about-footer">
          Fait with 🦋 by insect enthusiasts
        </p>
      </section>
    </div>
  );
}
```

**CSS:**
```css
/* client/src/pages/AboutPage.css */

.about-screen {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.about-screen h1 {
  margin-bottom: 1.5rem;
  font-size: 2rem;
}

.about-section {
  margin-bottom: 2rem;
}

.about-section h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: #333;
}

.about-section p,
.about-section ul {
  line-height: 1.6;
  color: #555;
}

.about-section ul {
  margin-left: 1.5rem;
}

.about-section li {
  margin-bottom: 0.5rem;
}

.about-section a {
  color: #0073e6;
  text-decoration: underline;
}

.about-footer {
  text-align: center;
  margin-top: 2rem;
  color: #999;
  font-size: 0.9rem;
}
```

**Ajouter route:**
```javascript
// client/src/App.jsx
const AboutPage = lazy(() => import('./pages/AboutPage'));

// Dans <Routes>:
<Route path="about" element={<AboutPage />} />
```

**Link from Footer:**
```javascript
// client/src/components/Footer/Footer.jsx
<Link to="/about" className="footer-link">
  {t('footer.about', {}, 'À propos')}
</Link>
```

#### 3.3 Mettre en avant les crédits dans le jeu

```javascript
// client/src/components/SpeciesDetailModal.jsx — EXISTING (enhance)

// Chercher où les photos sont affichées
// AJOUTER attribution observer:

<div className="species-photo-credit">
  <p className="photo-photographer">
    📷 Photo par <strong>{observation.observer_name}</strong>
  </p>
  <p className="photo-license">
    Licence: <a href="https://...">CC-BY-NC</a>
  </p>
</div>
```

**Semaine Allouée:** 1 (design + implémentation)

---

### **MISSION 4: Documentation Minimale** ⭐⭐

**Objectif:** Users comprennent le projet, pas juste l'interface

#### 4.1 README Amélioré

```markdown
# iNaturaQuizz

## 🎮 Qu'est-ce que c'est?

Un **quiz éducatif gratuit** pour apprendre l'identification 
d'espèces naturelles à travers un jeu interactif basé sur 
des **observations réelles iNaturalist**.

## 🎯 Objectifs

- Rendre l'apprentissage nature **amusant et accessible**
- Célébrer la **biodiversité réelle**
- Promouvoir la **science participative**
- **Zero tracking, zéro donnees collectées**

## 🌍 Source des données

Les observations et photos proviennent de 
[iNaturalist](https://inaturalist.org), une plateforme 
collaborative internationale financée par la California 
Academy of Sciences et National Geographic.

**Toutes les observations sont:**
- Identifiées par la communauté
- Marquées "Research Grade" (qualité scientifique)
- Under Creative Commons licenses (CC0, CC-BY, CC-BY-NC)

## 🚀 Démarrage rapide

```bash
# Installation
npm ci && npm --prefix client ci

# Dev (2 terminals)
npm run dev
npm --prefix client run dev
```

[... rest of existing setup ...]

## 📊 Conformité API iNaturalist

✓ Respecte rate limit (14 req concurrent)
✓ User-Agent identifié
✓ Cache local (< 80% appels API)
✓ Zéro extraction massive
✓ Attribution visible

[Docs complètes](./wiki/INDEX.md)

## 📝 Licences

- **Code:** ISC (see LICENSE)
- **Data:** CC-BY-NC, CC-BY, CC0 (see each observation)
- **Attribution:** iNaturalist community observers

## 🤝 Contribution

Open source! Pour contribuer:
1. Fork sur [GitHub](https://github.com/Vicodertoten/Inaturamouche)
2. Créer feature branch
3. Soumettre PR

## 📜 Légal

- [Mentions légales & CGU](/legal)
- [Politique de confidentialité & RGPD](/legal#privacy)
- [Attribution iNaturalist](/legal#attribution)

---

Made with 🦋 for nature lovers
```

#### 4.2 Créer `wiki/ARCHITECTURE.md` minimale

**Path:** `wiki/ARCHITECTURE.md`

```markdown
# Architecture iNaturaQuizz

## 🏗️ Stack

- **Frontend:** React 19 + Vite + PWA
- **Backend:** Node.js ESM + Express 5
- **Data:** iNaturalist API v1 (observations, taxa, places)
- **Caching:** In-memory SmartCache (Pino logging)

## 🔄 Data Flow

1. User selects pack → HomePage
2. Start game → API call `/api/quiz-question`
3. Backend queries iNaturalist API
4. Generate question (with lures + confusion map)
5. Client displays + handles answer
6. Score calculated (HMAC-verified)

## 📊 Key Services

- `iNaturalistClient.js` - API wrapper (retry, rate limit, circuit breaker)
- `questionGenerator.js` - Quiz creation logic
- `lureBuilder.js` - Wrong answer generation
- `confusionMap.js` - Similar species detection

## 🗄️ Data Models

### Observation
```js
{
  id, taxon_id, latitude, longitude, 
  observed_on, observer_name,
  photos: [{ url, license, attribution }]
}
```

### Taxon
```js
{
  id, name, ancestors, rank, 
  preferred_common_name, iconic_taxon_id
}
```

[More details in code...]
```

#### 4.3 .env.example clarity

```bash
# server/.env.example
# Déjà existe mais améliorer commentaires

# ── iNaturalist API ──
# Respecte: max 100 req/min, nous utilisons 14 concurrent
INAT_MAX_CONCURRENT_REQUESTS=14
INAT_REQUEST_TIMEOUT_MS=8000
INAT_MAX_RETRIES=2

# ── Error tracking ──
SENTRY_DSN=                       # Get from sentry.io
VITE_SENTRY_DSN=                  # Frontend Sentry

# ── Monitoring ──
UPTIME_ROBOT_API_KEY=            # Optional: UptimeRobot
```

**Semaine Allouée:** 0.5 (writing markdown is fast)

---

### **MISSION 5: Scaling Plan** ⭐⭐⭐

**Objectif:** Prêt pour 100+ concurrent users

#### 5.1 Load Testing

**Tool:** K6 (free, easy)

```bash
npm install -g k6

# test/load-test.js
export const options = {
  vus: 100,           // 100 virtual users
  duration: '5m',     // 5 minutes
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% requests < 800ms
    http_req_failed: ['rate<0.1'],    // < 10% errors
  },
};

export default function () {
  const res = http.get('http://localhost:3001/api/quiz-question', {
    params: { pack_id: 'belgium_birds' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'response < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}
```

```bash
# Run
k6 run test/load-test.js

# Expected output:
# ✓ 500/500 requests successful
# ✓ p95 duration: 600ms
# ✓ Memory stable
```

#### 5.2 Tracer Usage réel

```javascript
// server/middleware/logging.js — ADD metrics
logger.info({
  route: req.path,
  method: req.method,
  userId: req?.user?.id,
  timestamp: Date.now(),
  duration_ms: Date.now() - startTime,
}, 'request-completed');

// Parse logs chaque jour:
// curl -H "Authorization: Bearer $FLY_TOKEN" \
//   https://api.machines.internal/apps/inaturamouche-api/logs
```

#### 5.3 Cache Tuning

```javascript
// server/config/index.js — optimize based on load
// Si > 100 concurrent users:

questionCacheTtl: 15 * 60 * 1000,      // ↑ from 10 min
questionCacheStaleTtl: 45 * 60 * 1000, // ↑ from 30 min
maxCacheEntries: 1000,                  // ↑ from 500
```

#### 5.4 Stress Test Checklist

```bash
SEMAINE 4-5: Stress testing

□ Run K6 test locally (100 VU)
  └─ Verify p95 < 800ms
  └─ Check memory doesn't leak

□ Monitor Fly.io dashboard
  └─ CPU usage
  └─ Memory usage
  └─ Request/sec throughput

□ Check iNaturalist API logs
  └─ No rate limit 429 errors
  └─ Circuit breaker not triggered

□ Verify cache hit ratios
  └─ aim for > 70% on /quiz-question

□ Review Sentry
  └─ No crashes during test
```

**Semaine Allouée:** 1-2 (testing + tuning)

---

## 📅 TIMELINE COMPLÈTE (3 MOIS)

```
═════════════════════════════════════════════════════════════════

JANVIER 2026 (Non applicable, on est en Février)

═════════════════════════════════════════════════════════════════

FÉVRIER — SEMAINES 1-2 (Feb 18 - Mar 4)
  
  MISSION 1: Frontend UX Polish
  ├─ Feb 18-20 (Week 1): Design audit + mobile fixes (3h)
  │  □ Test responsive breakpoints
  │  □ Fix 5-10 UI issues
  │  └─ Perf audit (Lighthouse)
  │
  ├─ Feb 25-27 (Week 2): Animations + polish (4h)
  │  □ Smooth transitions
  │  □ Loading states
  │  └─ Accessibility check
  │
  MISSION 2 (parallel): Production Readiness START
  ├─ Feb 20-22: Sentry setup (2h)
  │  □ npm install @sentry/react
  │  □ main.jsx integration
  │  └─ Test Sentry dashboard
  │
  └─ Feb 27-Mar 1: UptimeRobot + basic monitoring (1h)
      □ Setup free tier monitoring
      □ Slack webhook
      └─ Deploy to prod

═════════════════════════════════════════════════════════════════

MARS — SEMAINES 3-5 (Mar 4 - Mar 18)

  MISSION 2: Production Readiness CONTINUE
  ├─ Mar 4-6: Monitoring watch (runtime)
  │  □ Deploy v1.0 with Sentry
  │  □ Watch logs daily
  │  □ Fix crashes as they appear
  │
  └─ Mar 9-11: Load testing + tuning (8h)
      □ K6 setup
      □ Run 100 VU test
      □ Tune caches if needed

  MISSION 3: Attribution Polish
  ├─ Mar 11-13: Footer upgrade + About page (6h)
  │  □ Enhance Footer.jsx with iNat credit
  │  □ Create AboutPage.jsx
  │  □ Add route + link
  │
  └─ Mar 16-18: Test on prod
      □ Verify attribution visible
      □ Verify About page indexed by SEO

═════════════════════════════════════════════════════════════════

AVRIL — SEMAINES 6-8 (Mar 25 - Apr 8)

  MISSION 4: Documentation
  ├─ Mar 25-27: README + architecture docs (3h)
  │  □ Improve README.md
  │  □ Update wiki/ARCHITECTURE.md
  │  └─ Clarify .env.example
  │
  MISSION 5: Scaling Plan (parallel)
  ├─ Apr 1-3: Stress testing (8h)
  │  □ K6 load test (100 VU)
  │  □ Monitor Fly.io metrics
  │  □ Tune if needed
  │
  └─ Apr 5-8: Real user beta
      □ Invite 50-100 users
      □ Monitor Sentry
      □ Gather feedback

═════════════════════════════════════════════════════════════════

AVRIL (SUITE) — SEMAINES 9-10-11 (Apr 8 - Apr 28)

  STABILITÉ PRODUCTION (3 semaines)
  ├─ Daily:
  │  □ Check Sentry dashboard
  │  □ Verify uptime
  │  □ Review logs for anomalies
  │
  ├─ Weekly:
  │  □ Analyze user feedback
  │  □ Fix bugs from users
  │  □ Optimize based on patterns
  │
  └─ End of week:
      □ Prepare partnership approach

═════════════════════════════════════════════════════════════════

FIN AVRIL (MAY 1 onwards)

  READY FOR iNAT OUTREACH ✅
  └─ 3+ weeks of stable production ✓
  └─ Clear attribution ✓
  └─ Polished UI ✓
  └─ 100+ real users ✓
  └─ Monitoring in place ✓

```

---

## 💼 ASSIGNMENTS BY WEEK

### Week 1-2 (Feb 18 - Mar 4): UX + Monitoring Setup
```
Priority: HIGH
Owner: You (solo dev)
Time: ~10-15h
Deliverable: 
  - Responsive mobile fixes
  - Sentry monitoring live
  - UptimeRobot alert configured
```

### Week 3-4 (Mar 4 - Mar 18): Monitoring Watch + Attribution
```
Priority: HIGH
Owner: You (solo dev) + prod watch
Time: ~10-15h coding + ongoing monitoring
Deliverable:
  - 1 week stable production
  - About page + footer improvements
  - Zero crashes during test period
```

### Week 5-6 (Mar 18 - Apr 1): Docs + Load Testing
```
Priority: MEDIUM
Owner: You
Time: ~10-15h
Deliverable:
  - Documentation complete
  - Load test passed (100 VU)
  - Architecture documented
```

### Week 7-12 (Apr 1 - May 1): Beta Stability
```
Priority: HIGH
Owner: You
Time: ~20h total (monitoring + fixes)
Deliverable:
  - 3+ weeks stable
  - 100+ real users
  - Real usage data + feedback
  - Ready for partnership talk
```

---

## 🎁 DELIVERABLES PAR MISSION

### Mission 1: Frontend Polish
- [ ] ResponsiveLayout fixes on all pages
- [ ] Mobile Lighthouse score ≥ 90
- [ ] Smooth animations throughout
- [ ] Accessibility audit passed (axe)

### Mission 2: Production Readiness  
- [ ] Sentry configured + errors visible
- [ ] UptimeRobot monitoring active
- [ ] Logs enriched with context
- [ ] 7 days without crashes
- [ ] K6 load test passed (p95 < 800ms)

### Mission 3: Attribution
- [ ] Footer prominently shows iNat credit
- [ ] /about page explains mission + data source
- [ ] Observer name on each photo
- [ ] License info visible

### Mission 4: Documentation
- [ ] README updated (mission + compliance)
- [ ] wiki/ARCHITECTURE.md updated
- [ ] .env.example clarified
- [ ] LEGAL page comprehensive

### Mission 5: Scaling Plan
- [ ] K6 load test configured
- [ ] 100 concurrent users tested
- [ ] Cache tuning implemented
- [ ] Real user beta program active

---

## ⚠️ POTENTIAL PITFALLS & FIXES

| Issue | Mitigation |
|-------|-----------|
| Mobile Lighthouse score low | Tree-shake unused dependencies |
| Sentry quota exceeded | Set sampling rate < 1.0 |
| iNat API rate limit hit | Check cache hit ratios |
| Users report crashes | Check Sentry daily during beta |
| Load test fails (p95 > 2s) | Increase cache TTL, reduce DB hits |

---

## 📞 COMMUNICATION PREP

### Email draft for iNat (prepare, don't send yet):

```
Subject: iNaturaQuizz Educational Quiz Application

Bonjour,

J'ai développé iNaturaQuizz, une application éducative 
interactive qui aide les utilisateurs à apprendre 
l'identification d'espèces à travers un jeu basé sur 
des observations certifiées iNaturalist.

STATS (after 3 months):
- 100+ utilisateurs actifs
- 99%+ uptime (monitored)
- Zero API abuse (< 60 req/min)
- Clear attribution + CC licensing visible
- Production-ready infrastructure

ENGAGEMENT:
- Toutes observations CC0/CC-BY (respect licenses)
- Observateur name + license visible avec chaque photo
- Mention iNaturalist en footer + à-propos
- Zéro données collectées sauf logs anonymes

QUESTION:
Auriez-vous feedback sur l'app? Intéressé à discuter 
partnership ou listing sur votre community projects?

Lien: https://inaturaquizz.com

Cordialement,
[Votre nom]
```

**Send this around:** Early May 2026 (after 3+ weeks stability)

---

## ✅ FINAL CHECKLIST (End of April)

Before contacting iNaturalist, ensure:

```
TECHNICAL
□ Zero crashes in last 7 days (Sentry)
□ Uptime > 99% last month
□ Load test passed (100 VU, p95 < 800ms)
□ Mobile Lighthouse ≥ 90
□ API rate limit never exceeded

USER-FACING
□ Attribution prominent + correct
□ About page explains iNat partnership
□ Observer names visible
□ License info on photos
□ GDPR compliant (no tracking)

DOCUMENTATION  
□ README professional
□ API docs clear
□ Architecture documented
□ .env.example complete

BUSINESS
□ Email to iNat prepared
□ Beta feedback collected
□ Usage metrics available
□ No major bugs in backlog
```

---

## 🚀 FINAL NOTES

**This is your path from prototype → production-grade → partnership-ready.**

- **Weeks 1-2:** Frontend + monitoring foundation
- **Weeks 3-4:** Production watch + user-facing improvements
- **Weeks 5-6:** Documentation + load testing
- **Weeks 7-12:** Real users, real data, real stability

**By early May**, you'll have:
- ✅ App that runs reliably
- ✅ Users who love it (100+)
- ✅ Data showing you respect iNat
- ✅ Professionalism to approach them

**Estimated total effort:** ~80-100 hours spread over 12 weeks  
**Expected outcome:** Strong partnership conversation with iNaturalist

---

Good luck! 🦋

Questions about any mission? Let's break it down further.
