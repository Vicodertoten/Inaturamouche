# Explications

Documents d'architecture profonde — le **pourquoi** derrière les décisions techniques.

| Document | Résumé |
|----------|--------|
| [Architecture d'ensemble](architecture.md) | Monorepo, couches, flux réseau, choix de stack |
| [Pipeline de questions](question-pipeline.md) | Pool → Selection → Lures v2 → Contrat de choix → Round |
| [Système IA](ai-system.md) | RAG Wikipedia → Gemini → Validation → Fallback |
| [Sécurité des rounds](round-security.md) | HMAC-SHA256, timing-safe, TTL, dédup, anti-triche |
| [Stratégie de cache](caching-strategy.md) | SmartCache, stale-while-revalidate, coalescing, circuit breaker |
| [État frontend](frontend-state.md) | Zustand, 4 Contexts React, useReducer, Dexie, PWA |
| [Système de métriques](metrics-system.md) | First-party analytics, KPI, dashboard, rétention |
