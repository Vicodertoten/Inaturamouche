# Etat frontend

> Comment l'etat de jeu, le profil et la persistence se repartissent entre Context, Zustand, reducer et Dexie.

## Vue d'ensemble

Le frontend combine 4 couches :

1. **React Context** pour les dependances globales
2. **Zustand** pour l'etat meta de session
3. **`useReducer`** pour les filtres custom
4. **Dexie** pour la persistence locale

## 1. React Context

### `GameContext`

Role: orchestrateur central du gameplay.

Il compose notamment :

- `useGameConfigState`
- `useGameSessionState`
- `useGameRequests`
- `useGamePersistence`
- `useGameActions`
- `useGameProfileSync`
- `useGameNextImage`

Il expose deux sous-contextes :

- `GameDataContext`
- `GameUIContext`

Ce split limite les re-renders des composants qui ne consomment que les donnees ou que les actions.

### `UserContext`

Role:

- charger et sauvegarder le profil
- migrer les anciens formats de stockage
- enregistrer les rencontres et la progression
- orchestrer les achievements

### `LanguageContext`

Role:

- langue active (`fr`, `en`, `nl`)
- `t()`
- formatters
- nom vernaculaire vs scientifique

### `PacksContext`

Role:

- charger le catalogue
- charger le catalogue Home
- gerer la region detectee / forcee
- exposer les sections Home (`starter`, `near_you`, `explore`)

## 2. Zustand

Fichier: `client/src/state/gameMetaStore.js`

Le store `useGameMetaStore` ne remplace pas tout l'etat frontend. Il couvre seulement la meta de session :

- XP recent et progression de session
- streak en cours
- boucliers de session
- achievements nouvellement debloques

Slices principales :

- `recentXPGain`, `initialSessionXP`, `levelUpNotification`
- `currentStreak`, `longestStreak`, `inGameShields`, `hasPermanentShield`
- `newlyUnlocked`, `clearUnlockedLater()`

## 3. Reducer de filtres

Fichier: `client/src/state/filterReducer.js`

Le reducer gere les filtres du pack custom :

- taxons inclus / exclus
- filtre geographique
- filtre temporel
- restauration d'une session sauvegardee

Ce choix garde des transitions explicites pour une petite machine d'etat bien testable.

## 4. Persistence locale

Fichiers:

- `client/src/services/db.js`
- `client/src/services/PlayerProfile.js`

Le navigateur reste la source de verite du profil joueur.

Dexie stocke notamment :

- `profiles` : profil joueur
- `taxa` : encyclopedie locale
- `stats` : progression par espece
- `active_session` : reprise de partie

## 5. Flux principal

```txt
Boot
  -> chargement langue
  -> chargement packs
  -> chargement profil Dexie
  -> migration legacy si necessaire

Partie
  -> GameContext orchestre le fetch quiz
  -> Zustand gere les metas de session
  -> UserContext persiste le profil
  -> Dexie conserve session/progression
```

## 6. Points de vigilance

- Le profil joueur reste local, sans backend authoritatif.
- Les contexts ne doivent pas etre fusionnes sans raison forte: ils portent des effets secondaires differents.
- Le store Zustand est volontairement limite a la meta de session.
- Les reliquats archives (`riddle` stats, anciens flags legacy) existent encore dans certaines structures de profil et ne doivent pas redevenir centraux dans la doc produit.
