# iNaturaQuizz

Quiz naturaliste educatif base sur des observations iNaturalist. Frontend React (PWA) + API Express.

## Liens rapides

- `wiki/INDEX.md`
- `wiki/GETTING_STARTED.md`
- `wiki/ARCHITECTURE.md`
- `wiki/API_REFERENCE.md`
- `CONTRIBUTING.md`

## Demarrage local

Prerequis:
- Node.js 20+
- npm 10+

Installation:

```bash
npm ci
npm --prefix client ci
cp .env.example .env
```

Dev (2 terminaux):

```bash
# Terminal 1
npm run dev

# Terminal 2
npm --prefix client run dev
```

- API: `http://localhost:3001`
- Front: `http://localhost:5173`

## Donnees et attribution

Les observations et photos proviennent de iNaturalist. Les licences sont celles choisies par les auteurs (CC0, CC BY, CC BY-NC). L attribution est affichee dans l application et dans les pages legales.

## Confidentialite

Pas de compte requis, pas de tracking tiers. Les preferences et progressions sont stockees localement dans le navigateur.

## Licence

ISC. Voir le fichier LICENSE.
