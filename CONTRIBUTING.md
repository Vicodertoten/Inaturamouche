# Contributing

Thanks for helping improve Inaturamouche! This document explains the project's conventions for translations, testing, and adding changes safely.

## Internationalisation (i18n)

We support three locales: French (`fr`), English (`en`) and Dutch (`nl`). All user-facing strings live in `client/src/locales/*.js` files.

Key rules:
- Always add or update keys in **all three** locale files (`fr.js`, `en.js`, `nl.js`). Keep keys consistent across locales.
- Use the `key.subkey` structure that matches the rest of the repo (e.g. `collection.title`).

Local checks and CI:
- Run the parity checker locally: `npm run check:i18n` — it prints key counts and lists missing/extra keys.
- The CI runs the same check on push/PR and fails the build if parity is broken.

Translation workflow:
1. Add the new key to `fr.js` (or whichever locale you're editing).
2. Run `npm run check:i18n` to find missing keys in other locales.
3. Add placeholder translations to the other locale files and create a small test if appropriate.

## Tests

Unit tests run with Node's built-in test runner:
- Root tests: `npm test` runs server tests and client tests.
- Client-only tests: `npm --prefix client run test`.

Please add tests when:
- You change server error shapes or response codes.
- You add or change formatting / locale-aware behavior.

## CI

We run a GitHub Actions workflow on push/PR which runs:
- `npm run check:i18n` (parity check)
- `npm test` (unit tests)
- `npm --prefix client run build` (client production build)

## Notes for maintainers
- Server now returns structured errors: `{ error: { code: 'SOME_CODE', message: '...' } }` so client-side code can map `code` to localized messages.
- Use `client/src/services/api.js` `notifyApiError` mapping to connect server error codes to translations.

Thanks again — if you need help adding tests or translations, open an issue or a draft PR and ping the maintainers.