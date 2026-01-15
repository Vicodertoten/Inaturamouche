# Contributing Guide

Merci de vouloir contribuer à Inaturamouche ! Ce guide explique les conventions du projet, comment gérer les traductions, les tests et les contributions.

## 📋 Table des matières

1. [Avant de commencer](#avant-de-commencer)
2. [Flux de contribution](#flux-de-contribution)
3. [Conventions de code](#conventions-de-code)
4. [Internationalization (i18n)](#internationalization-i18n)
5. [Tests](#tests)
6. [CI/CD](#cicd)
7. [Workflow de revue](#workflow-de-revue)

---

## 🎯 Avant de commencer

### Code of Conduct

- Soyez respectueux et inclusif
- Pas de discrimination, harcèlement ou comportement toxique
- Problème ? Ouvrir un issue ou contacter les mainteneurs

### Setup de développement

Voir [GETTING_STARTED.md](./GETTING_STARTED.md) pour :
- Installation locale
- Commandes npm
- Structure des répertoires

---

## 📤 Flux de contribution

### 1️⃣ Identifier un problème

- Parcourir les [issues](https://github.com/user/inaturamouche/issues)
- Chercher `good-first-issue` (pour débutants)
- Ouvrir une **nouvelle issue** si votre idée n'existe pas

### 2️⃣ Fork + branche

```bash
# Fork le repo sur GitHub

# Clone ton fork
git clone https://github.com/VOTRE_USERNAME/inaturamouche.git
cd inaturamouche

# Ajouter remote upstream
git remote add upstream https://github.com/user/inaturamouche.git

# Créer branche feature
git checkout -b feat/add-birdsong-identification
```

Noms de branches :
- `feat/description` – Nouvelle feature
- `fix/description` – Bug fix
- `docs/description` – Documentation
- `refactor/description` – Refactoring
- `test/description` – Ajout de tests

### 3️⃣ Développer et tester

```bash
# Dev local
npm run dev
npm --prefix client run dev

# Tester localement
npm test
npm run check:i18n
npm --prefix client run lint
```

### 4️⃣ Commit et push

```bash
# Commit avec message clair
git add .
git commit -m "feat(quiz): add birdsong identification mode

- Adds new AudioQuestion component
- Integrates eBird API for bird sounds
- Updates GameContext to support audio

Closes #123"

# Push vers ton fork
git push origin feat/add-birdsong-identification
```

#### Conventions de commit message

Format : `type(scope): subject`

```
feat(api): implement LCA caching for faster lure selection
fix(frontend): prevent race condition in question prefetch
docs(architecture): add database schema diagram
refactor(cache): extract SmartCache into separate module
test(quiz-utils): add edge cases for cooldown calculation
style(components): align button sizes across modals
chore(deps): upgrade React to 19.2
```

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `style`, `chore`

Scope : domaine affecté (`api`, `frontend`, `cache`, `quiz-utils`, etc.)

Subject :
- Impératif : "add", "implement", pas "added", "implements"
- Pas de majuscule au début
- Pas de point à la fin
- Max 50 caractères

Corps optionnel :
- Pourquoi le changement (pas "quoi" — c'est dans le code)
- Référencer issues : `Closes #123`, `Fixes #456`

### 5️⃣ Ouvrir Pull Request

```bash
# Sur GitHub, créer PR
- Title : reprendre commit message (`feat(api): ...`)
- Description : expliquer changements, tester localement
- Référencer issue : "Closes #123"
```

Template PR recommandé :

```markdown
## Description
Brève description de la changement.

## Type de changement
- [ ] Bug fix
- [ ] Nouvelle feature
- [ ] Documentation
- [ ] Refactoring
- [ ] Tests

## Checklist
- [ ] J'ai testé localement (`npm test`, `npm run dev`)
- [ ] i18n parity OK (`npm run check:i18n`)
- [ ] Lint OK (`npm --prefix client run lint`)
- [ ] Pas de console.log ou console.error oublié
- [ ] Tests ajoutés pour nouvelles features
- [ ] Documentation à jour

## Lié à
Closes #123
```

---

## 📝 Conventions de code

### JavaScript/JSX

#### Style

- **Indentation** : 2 espaces (ESLint)
- **Quotes** : Double (`"`, sauf template literals)
- **Semicolons** : Obligatoires
- **Trailing comma** : Multi-lignes

```javascript
// ✅ Bon
const config = {
  name: "quizz",
  timeout: 5000,
};

function fetchQuestion(pack, locale) {
  if (!pack) {
    throw new Error("Pack required");
  }
  return fetch(`/api/quiz-question?pack=${pack}&locale=${locale}`);
}

// ❌ Mauvais
const config = { name: 'quizz', timeout: 5000 }
function fetchQuestion(pack, locale){
if(!pack) throw new Error('Pack required')
}
```

#### Composants React

```javascript
// 🎯 Functional component avec JSDoc
/**
 * Affiche un choix de réponse interactif.
 *
 * @param {Object} props
 * @param {string} props.label - Texte du choix
 * @param {boolean} props.isSelected - État sélectionné
 * @param {Function} props.onSelect - Callback sélection
 * @returns {JSX.Element}
 */
function ChoiceButton({ label, isSelected, onSelect }) {
  return (
    <button
      className={`choice ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

export default ChoiceButton;
```

#### Tests

Nommer les tests en `*.test.mjs` ou `*.spec.mjs` :

```javascript
import { test, describe, it, expect } from "node:test";
import { buildLures } from "../lib/quiz-utils.js";

describe("buildLures", () => {
  it("should return at least one lure per bucket", () => {
    const pool = { taxonList: [1, 2, 3, 4, 5] };
    const lures = buildLures(pool, {}, 1);
    expect(lures.length).toBeGreaterThanOrEqual(1);
  });

  it("should exclude target taxon from lures", () => {
    const pool = { taxonList: [1, 2, 3, 4, 5] };
    const lures = buildLures(pool, {}, 1);
    expect(lures.map(l => l.taxonId)).not.toContain(1);
  });
});
```

---

## 🌐 Internationalization (i18n)

### Structure des locales

**Fichiers** : `client/src/locales/{fr,en,nl}.js`

```javascript
// client/src/locales/fr.js
export default {
  common: {
    language: "Français",
    timezone: "Europe/Paris",
  },
  game: {
    mode: {
      easy: "Mode facile",
      hard: "Mode difficile",
    },
    hint: "Indice",
    answer: "Réponse",
  },
  collection: {
    title: "Collection",
    subtitle: "Espèces observées",
    emptyMessage: "Aucune espèce observée",
  },
  // ...
};
```

### Ajouter une traduction

1. **Ajouter clé en français** `client/src/locales/fr.js` :

```javascript
game: {
  // ...
  newFeature: "Ma nouvelle feature",
}
```

2. **Ajouter en anglais** `client/src/locales/en.js` :

```javascript
game: {
  // ...
  newFeature: "My new feature",
}
```

3. **Ajouter en néerlandais** `client/src/locales/nl.js` :

```javascript
game: {
  // ...
  newFeature: "Mijn nieuwe functie",
}
```

4. **Vérifier parité** :

```bash
npm run check:i18n

# Output :
# fr.js: 245 keys
# en.js: 245 keys ✓
# nl.js: 245 keys ✓
```

### Utiliser la traduction

Frontend (React) :

```javascript
import { useLanguage } from "../context/LanguageContext";

function MyComponent() {
  const { t } = useLanguage();
  return <h1>{t("game.newFeature")}</h1>;
}
```

Backend (pas de i18n côté serveur) :
- Les réponses iNat sont utilisées directement
- Client gère les traductions UI

### Règles i18n

- ✅ Les clés doivent être identiques dans **toutes les locales**
- ✅ Structure hiérarchique : `feature.subfeature.key`
- ✅ PAS de doublons ou variations orthographe
- ✅ Tester avant PR : `npm run check:i18n`

---

## 🧪 Tests

### Exécuter les tests

```bash
# Tous les tests
npm test

# Tests serveur uniquement
node --test ./tests/*.mjs

# Tests client uniquement
npm --prefix client run test

# Un fichier spécifique
node --test ./tests/quiz-utils.test.mjs
```

### Ajouter des tests

**Backend** (serveur) : format Node test runner

```javascript
// tests/my-feature.test.mjs
import { test, describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { myFeature } from "../lib/my-feature.js";

describe("myFeature", () => {
  let state;

  beforeEach(() => {
    state = { /* setup */ };
  });

  afterEach(() => {
    state = null;
  });

  it("should do something useful", () => {
    const result = myFeature(state);
    assert.deepStrictEqual(result, { expected: true });
  });

  it("should handle errors", () => {
    assert.throws(
      () => myFeature(null),
      /required state/i
    );
  });
});
```

**Frontend** (client) : Vitest

```javascript
// client/tests/my-component.test.mjs
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "../src/components/MyComponent";

describe("MyComponent", () => {
  it("should render correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Coverage cible

- **Backend** : 80%+ coverage (logique métier critique)
- **Frontend** : 60%+ coverage (composants complexes)
- **Exempté** : Imports, exports simples, UI triviale

---

## 🔄 CI/CD

### Workflow GitHub Actions

Le projet a un workflow CI qui :

```yaml
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm run ci        # check:i18n + test
      - run: npm run lint
      - run: npm --prefix client run build
```

**Tout doit passer avant merge** :
- ✅ i18n parity (`npm run check:i18n`)
- ✅ Tests (`npm test`)
- ✅ Linting (`npm --prefix client run lint`)
- ✅ Build prod (`npm --prefix client run build`)

### Branches protégées

- `main` : Protégée, nécessite PR review
- `develop` : Branch de dev (optionnel)

---

## 👀 Workflow de revue

### Pour les contributeurs

- **Répondre aux feedback** sur la PR
- **Pousser des commits** si changements demandés
- **Marquer résolu** les conversations quand addressed
- **Demander re-review** si gros changements

### Pour les mainteneurs

- Revue le code pour :
  - ✅ Respect conventions
  - ✅ Tests adéquats
  - ✅ Pas de regression
  - ✅ i18n OK
- Demander changements si nécessaire
- Squash + merge une fois approved

---

## 🐛 Signaler un bug

**Template issue** :

```markdown
## Description
Décrire le bug clairement.

## Étapes de reproduction
1. Aller à ...
2. Cliquer sur ...
3. Observer ...

## Comportement attendu
Décrire ce qui devrait se passer.

## Comportement actuel
Décrire ce qui se passe réellement.

## Environnement
- OS: macOS / Linux / Windows
- Node: v20.x
- Browser: Chrome / Firefox / Safari
- Locale: FR / EN / NL

## Screenshots / Logs
Ajouter si pertinent (DevTools, Pino logs, etc.)
```

---

## ✨ Bonnes pratiques

| À faire | À éviter |
|---------|----------|
| Commits atomiques + messages clairs | Énorme commit "fix all bugs" |
| Tests pour nouvelles features | Zéro test coverage |
| i18n pour toute string UI | Hardcoder texte en anglais |
| Commenter code complexe | Pas de JSDoc |
| Ouvrir draft PR pour discuter | Surprise PR prête à merge |
| Petites PR (<500 lignes) | Mégaphones PR (>2000 lignes) |
| Revue soi-même avant PR | Envoyer PR sans tester |

---

## 🙏 Merci !

Chaque contribution aide le projet, qu'elle soit code, documentation, issue report ou feedback.

**Besoin d'aide ?**
- Discord / Slack (si existe)
- Issues discussions
- Email mainteneurs

Bienvenue ! 🎉
