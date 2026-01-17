# 📚 Documentation Technique – Inaturamouche

Ce dossier contient la documentation technique détaillée pour développeurs et mainteneurs.

## 📖 Organisation de la documentation

### 📁 `/docs/` (Documentation technique)

Documentation spécifique aux implémentations et détails techniques :

- **[API_REFERENCE.md](API_REFERENCE.md)** – Contrats d'API complets (requêtes, réponses, erreurs)
- **[ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md)** – Architecture backend détaillée (pipeline, cache, observabilité)
- **[FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)** – Guide frontend détaillé (GameContext, composants, PWA)
- **[REFONTE_GENERATION_QUESTIONS.md](REFONTE_GENERATION_QUESTIONS.md)** – Notes sur la refonte du système de génération
- **[architecture/](architecture/)** – Détails d'implémentation par système
  - `XP_SYSTEM_IMPLEMENTATION.md` – Système d'XP et progression
- **[archives/](archives/)** – Historique et audits techniques

### 📁 `/wiki/` (Guides et documentation générale)

Documentation pour comprendre et utiliser le projet :

- **[ARCHITECTURE.md](../wiki/ARCHITECTURE.md)** – Vue d'ensemble unifiée avec diagrammes
- **[GETTING_STARTED.md](../wiki/GETTING_STARTED.md)** – Guide de démarrage complet
- **[guides/](../wiki/guides/)** – Guides thématiques par domaine
  - `backend/` – QUIZ_PIPELINE, CACHE_STRATEGY, OBSERVABILITY
  - `frontend/` – GAME_STATE, PWA_OFFLINE, COMPONENTS, STYLING
  - `ops/` – DEPLOYMENT, MONITORING

## 🗺️ Navigation

### Pour commencer
1. **Nouveau sur le projet ?** → Lire [README.md](../README.md) puis [GETTING_STARTED.md](../wiki/GETTING_STARTED.md)
2. **Comprendre l'architecture ?** → [ARCHITECTURE.md](../wiki/ARCHITECTURE.md) (vue d'ensemble avec diagrammes)
3. **Développer une feature ?** → Consulter les guides thématiques dans [/wiki/guides/](../wiki/guides/)

### Par besoin

| Besoin | Document |
|--------|----------|
| Intégrer l'API backend | [API_REFERENCE.md](API_REFERENCE.md) |
| Modifier le pipeline de questions | [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) + [QUIZ_PIPELINE.md](../wiki/guides/backend/QUIZ_PIPELINE.md) |
| Travailler sur le frontend | [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) + guides frontend |
| Déployer l'application | [DEPLOYMENT.md](../wiki/guides/ops/DEPLOYMENT.md) |
| Déboguer/monitorer | [OBSERVABILITY.md](../wiki/guides/backend/OBSERVABILITY.md) |
| Contribuer au code | [CONTRIBUTING.md](../CONTRIBUTING.md) |

## 🔍 Différence `/docs/` vs `/wiki/`

| `/docs/` | `/wiki/` |
|----------|----------|
| Documentation technique détaillée | Guides généraux et tutoriels |
| Pour développeurs avancés/mainteneurs | Pour tous les contributeurs |
| Implémentations spécifiques | Vue d'ensemble et concepts |
| Référence API et architecture interne | Getting started et workflows |

## 📝 Conventions

### Organisation des fichiers
- Les **fichiers techniques spécifiques** vont dans `/docs/`
- Les **guides généraux** vont dans `/wiki/`
- Les **archives** (audits, summaries historiques) vont dans `/docs/archives/`
- Les **READMEs locaux** (client, server) restent dans leurs dossiers respectifs

### Nommage
- Fichiers en SCREAMING_SNAKE_CASE : `API_REFERENCE.md`, `QUIZ_PIPELINE.md`
- Dossiers en minuscules : `architecture/`, `guides/`, `archives/`

### Liens
- Toujours utiliser des **chemins relatifs** : `../wiki/ARCHITECTURE.md`
- Vérifier que les liens fonctionnent depuis GitHub et localement

## 🤝 Contribuer à la documentation

### Ajouter une nouvelle documentation

1. **Documentation technique** → créer dans `/docs/` ou `/docs/architecture/`
2. **Guide général** → créer dans `/wiki/guides/[backend|frontend|ops]/`
3. **Mettre à jour** ce README et `/wiki/INDEX.md` si nécessaire

### Maintenir la cohérence

- Les **concepts généraux** doivent être dans `/wiki/ARCHITECTURE.md`
- Les **détails d'implémentation** vont dans `/docs/ARCHITECTURE_BACKEND.md` ou `FRONTEND_GUIDE.md`
- Éviter la duplication : utiliser des liens vers la documentation existante

### Exemples

✅ **Bon** :
- `/docs/API_REFERENCE.md` contient tous les endpoints avec exemples
- `/wiki/ARCHITECTURE.md` référence l'API et explique les concepts
- `/wiki/guides/backend/QUIZ_PIPELINE.md` détaille l'algorithme de sélection

❌ **Mauvais** :
- Dupliquer les endpoints dans plusieurs fichiers
- Mélanger concepts généraux et détails d'implémentation
- Liens cassés ou absolus

---

**Questions sur l'organisation de la documentation ?** → Ouvrir une issue sur GitHub
