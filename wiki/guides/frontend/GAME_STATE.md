# Game State (frontend)

Etat global du jeu porte par les contextes React.

## Contextes principaux

- `GameContext`
- `UserContext`
- `LanguageContext`
- `XPContext`
- `StreakContext`
- `AchievementContext`

Initialisation dans `client/src/main.jsx`.

## Routes UI

Definies dans `client/src/App.jsx`:
- `/`
- `/play`
- `/end`
- `/collection`
- `/profile`

## API client

`client/src/services/api.js`:
- base URL calculee (`VITE_API_URL` prioritaire)
- retries sur erreurs reseau/5xx
- timeout via `AbortController`
- mapping d'erreurs vers i18n (`notifyApiError`)

Appels majeurs:
- `fetchQuizQuestion`
- `submitQuizAnswer`
- `fetchExplanation`
- `submitBugReport`

## Flux de manche

1. `fetchQuizQuestion` recupere question + metadata de manche (`round_id`, `round_signature`)
2. utilisateur joue
3. `submitQuizAnswer` envoie action au backend
4. UI lit `status`, `round_consumed`, `hard_state`, `taxonomic_state`

## Qualite

- unit tests: Vitest (`npm --prefix client run test -- --run`)
- smoke E2E: Playwright (`client/tests/e2e/flows.spec.ts`)
