# Observability

## Logging

Middleware HTTP: `server/middleware/logging.js` (Pino + pino-http)

- redaction: authorization/cookie
- generation/reprise `X-Request-Id`
- correlation facile logs <-> erreurs API

## Headers API utiles

Sur `GET /api/quiz-question`:

- `X-Cache-Key`
- `X-Lures-Relaxed`
- `X-Lure-Buckets`
- `X-Pool-Pages`
- `X-Pool-Obs`
- `X-Pool-Taxa`
- `X-Selection-Geo`
- `X-Adaptive-Band`
- `X-Target-Selection-Mode`
- `Server-Timing`
- `X-Timing`

## Contrat erreur

Toutes les erreurs API utilisent:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "requestId": "..."
  }
}
```

## Debug operationnel

1. Recuperer `X-Request-Id` depuis la reponse client
2. Filtrer les logs backend sur cet identifiant
3. Verifier `Server-Timing` + `X-Timing`
4. Executer smoke test:

```bash
./scripts/smoke-test.sh https://your-app-url
```
