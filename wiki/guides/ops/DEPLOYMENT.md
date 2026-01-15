# Deployment & Infrastructure

Guide de déploiement en production (Netlify, Render, Docker).

## 📋 Table des matières

1. [Architecture déploiement](#architecture-déploiement)
2. [Build & CI/CD](#build--cicd)
3. [Déploiement Frontend (Netlify)](#déploiement-frontend-netlify)
4. [Déploiement Backend (Render)](#déploiement-backend-render)
5. [Docker](#docker)
6. [Environment variables](#environment-variables)
7. [Monitoring & logging](#monitoring--logging)

---

## 🏗️ Architecture déploiement

```
Utilisateur
    ├─ Frontend (Netlify)
    │  ├─ SPA React (Vite build)
    │  ├─ PWA + Service Worker
    │  └─ CDN global
    │
    └─ API (Render)
       ├─ Express.js backend
       ├─ SmartCache (mémoire)
       ├─ iNaturalist API calls
       └─ Scaling: 1-3 instances
```

---

## 🔨 Build & CI/CD

### CI Pipeline (GitHub Actions)

**File** : `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install && npm --prefix client install
      
      - name: Run i18n parity check
        run: npm run check:i18n
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm --prefix client run lint
      
      - name: Build client
        run: npm --prefix client run build
      
      - name: Build Docker image (test)
        run: docker build -t inaturamouche:test .

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './client/dist'
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Render
        uses: chrnorm/deployment-action@v2
        with:
          environment: production
          environment_url: https://inaturamouche-api.onrender.com
          token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🌐 Déploiement Frontend (Netlify)

### Configuration Netlify

**File** : `netlify.toml`

```toml
[build]
  command = "npm --prefix client run build"
  publish = "client/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "max-age=3600, must-revalidate"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[context.production]
  environment = { VITE_API_URL = "https://inaturamouche-api.onrender.com" }

[context.develop]
  environment = { VITE_API_URL = "http://localhost:3001" }

[context.deploy-preview]
  environment = { VITE_API_URL = "https://inaturamouche-api.onrender.com" }
```

### Environment variables (Netlify)

**Build settings** → **Environment** :
```
VITE_API_URL = https://inaturamouche-api.onrender.com
NODE_ENV = production
```

### Deployment

Push to `main` → Netlify auto-deploys client build from `client/dist/`

---

## 🚀 Déploiement Backend (Render)

### Configuration Render

**File** : `render.yaml` (optionnel, alternativement via dashboard)

```yaml
services:
  - type: web
    name: inaturamouche-api
    env: node
    region: virginia
    plan: starter  # $7/month
    
    buildCommand: npm install
    startCommand: npm start
    
    healthCheckPath: /api/health
    
    envVars:
      - key: PORT
        value: 3001
      - key: NODE_ENV
        value: production
      - key: TRUST_PROXY_LIST
        value: "true"
      - key: LOG_LEVEL
        value: info
```

### Environment variables (Render)

Dashboard → **Environment** :
```
PORT = 3001
NODE_ENV = production
TRUST_PROXY_LIST = true
LOG_LEVEL = info
```

### Auto-deployment

- Push to `main` → Render webhook → rebuild + restart
- Logs : Render dashboard → "Logs"

---

## 🐳 Docker

### Build image

```bash
docker build -t inaturamouche:latest .
```

**Dockerfile** :

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm install

# Install client deps + build
COPY client/package*.json client/
RUN npm --prefix client install --include=dev
COPY client client/
RUN npm --prefix client run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install only prod deps
COPY package*.json ./
RUN npm install --only=production

# Copy built client + server code
COPY --from=builder /app/client/dist ./client/dist
COPY server.js lib/ shared/ ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start
CMD ["node", "server.js"]
```

### Run locally

```bash
docker run -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  inaturamouche:latest
```

### Push to registry

```bash
# DockerHub
docker tag inaturamouche:latest username/inaturamouche:latest
docker push username/inaturamouche:latest

# GitHub Container Registry
docker tag inaturamouche:latest ghcr.io/username/inaturamouche:latest
docker login ghcr.io
docker push ghcr.io/username/inaturamouche:latest
```

---

## 🔐 Environment Variables

### Backend

**Required** :
```env
PORT=3001                          # Render assigns dynamically
NODE_ENV=production
```

**Optional** :
```env
TRUST_PROXY_LIST=true              # For Render, Netlify, proxies
LOG_LEVEL=info                     # trace, debug, info, warn, error
CORS_ORIGIN=*                      # Restrict if needed
```

**iNaturalist API** (no auth needed, public API):
```env
# Defaults to api.inaturalist.org, no config needed
```

### Frontend

**Build time** :
```env
VITE_API_URL=https://inaturamouche-api.onrender.com
VITE_PWA_DEV=false
```

**Runtime** (proxy'd by Express) :
```
/api/* → API_URL
```

---

## 📊 Monitoring & Logging

### Server logs (Render)

Render dashboard → **Logs** tab :
```
View real-time logs
See errors, warnings, info
Filter by timestamps
```

### Pino logs

Backend outputs JSON logs (Pino):
```json
{
  "level": 30,
  "time": 1705340400000,
  "msg": "GET /api/quiz-question",
  "responseTime": 430,
  "cache": { "hit": false },
  ...
}
```

**Parse in Render logs** :
- Logs are JSON → Use Render's log filters
- Or pipe to external logging service (Datadog, New Relic, etc.)

### Health check

```bash
curl https://inaturamouche-api.onrender.com/api/health
# → { "status": "ok", "uptime": 3600 }
```

Render auto-restarts if health check fails.

### Performance monitoring

Use headers returned by API:
```
Server-Timing: ...
X-Cache-Key: ...
X-Lure-Buckets: ...
X-Response-Time: ...
```

Monitor in browser console or APM tool.

---

## 🔧 Scaling & Performance

### Current setup (starter)

- **Frontend** : Netlify CDN (global edge)
- **Backend** : Render starter (1 instance, 512 MB RAM)
- **Cache** : In-memory LRU (max 7.65 MB)
- **RPS** : ~20-30 req/s sustainable

### Scaling to production

**Phase 1** (1000 concurrent users):
- Upgrade Render to Standard ($12/month)
- Add Redis (Render managed, $15/month)
- Connect backend to Redis for shared cache

**Phase 2** (5000+ concurrent users):
- Add background job queue (Bull, BullMQ)
- Cache warming service (pre-fetch popular pools)
- CDN acceleration (Cloudflare)

**Phase 3** (10000+ concurrent users):
- Multiple backend instances (load balanced)
- Database (PostgreSQL) for user data
- Separate worker instances for iNat fetching

### Configuration pour scaling

**Backend with sticky sessions** (no shared cache yet):
```nginx
# HAProxy or nginx
upstream backend {
    server api1.onrender.com;
    server api2.onrender.com;
    server api3.onrender.com;
}

location /api {
    proxy_pass http://backend;
    proxy_cookie_path / "/";
    hash $remote_addr;  # Sticky
}
```

**Backend with Redis** :
```javascript
// server.js: switch from LRU to Redis
const redis = new Redis(process.env.REDIS_URL);

class SmartCacheRedis {
  async get(key) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set(key, value, options = {}) {
    await redis.setex(key, options.ttl / 1000, JSON.stringify(value));
  }
}

const questionCache = new SmartCacheRedis();
```

---

## 📝 Deployment Checklist

Avant de déployer en prod :

- [ ] Tests passing (`npm test`)
- [ ] i18n parity OK (`npm run check:i18n`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in dev
- [ ] Environment variables configured
- [ ] Health check endpoint responding
- [ ] API CORS configured correctly
- [ ] PWA manifest valid
- [ ] Cache headers configured
- [ ] Security headers (X-Frame-Options, CSP)
- [ ] Rate limiting active
- [ ] Monitoring/logs accessible
- [ ] Fallback offline.html works

---

## 🔗 Ressources

- [ARCHITECTURE.md](../ARCHITECTURE.md) – System overview
- [CACHE_STRATEGY.md](./backend/CACHE_STRATEGY.md) – Scaling with Redis
- [Render docs](https://render.com/docs)
- [Netlify docs](https://docs.netlify.com)
