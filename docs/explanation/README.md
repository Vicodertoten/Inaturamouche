# Explications

Documents d'architecture et de raisonnement, maintenus contre le code.

| Document | Résumé |
|----------|--------|
| [Architecture d'ensemble](architecture.md) | Monorepo, couches, flux réseau, choix de stack |
| [Pipeline de questions](question-pipeline.md) | Pool → selection → leurres → contrat de choix → round |
| [Système IA](ai-system.md) | RAG → generation JSON → validation → fallback |
| [Sécurité des rounds](round-security.md) | HMAC-SHA256, TTL, dedup, verification serveur |
| [Stratégie de cache](caching-strategy.md) | SmartCache, stale-while-revalidate, coalescing, circuit breaker |
| [État frontend](frontend-state.md) | Zustand, 4 Contexts React, useReducer, Dexie, PWA |
| [Système de métriques](metrics-system.md) | First-party analytics, KPI, dashboard, rétention |
