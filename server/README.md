# Server

API Express de iNaturaQuizz.

## Entree

- `server/index.js`: demarrage du serveur
- `server/app.js`: middleware globaux + routes

## Endpoints

La liste complete est dans `wiki/API_REFERENCE.md`.

## Points techniques

- Validation: Zod
- Logs: Pino (`X-Request-Id`)
- Erreurs: contrat unifie (`error.code`, `error.message`, `error.requestId`)
- Rate limiting: global + endpoints sensibles
- Signature HMAC des manches: `ROUND_HMAC_SECRET`
- Cache: SmartCache (TTL + stale) pour questions, taxons, autocomplete
- IA: Gemini 2.5 Flash pour explications educatives, avec fallbacks deterministes
- Metrics: Store first-party avec retention configurable (metricsStore.js)
- Packs: 61 definitions serveur (44 actives, 16 legacy, 1 custom)

## Commandes

```bash
npm run dev
npm start
npm run lint:server
npm run test:unit
npm run test:integration
```

## Documentation

- `wiki/ARCHITECTURE.md`
- `wiki/API_REFERENCE.md`
- `wiki/guides/backend/README.md`
