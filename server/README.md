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
