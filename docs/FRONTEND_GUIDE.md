# Guide Frontend & Architecture React

Ce guide résume l'architecture React, la gestion d'état du jeu et la configuration PWA.

## State machine du jeu (GameContext)

`client/src/context/GameContext.jsx` centralise l'état (mode, question courante, score, séries, perks, erreurs).

Étapes principales :
- **LOADING** : `startGame()` positionne `isGameActive=true`, `questionCount=1`, déclenche `fetchQuestion()` (spinner sur `/play` tant que `question` ou `nextQuestion` est nul).  
- **PLAYING** : une question est présente. `completeRound` reçoit les résultats du mode actif, calcule score/streak, enregistre la réponse (espèce, biomes, temps de réponse) et gère les perks.  
- **ANSWERED** : chaque mode contrôle localement l'état de round (`roundStatus` dans `HardMode`, modale récap dans `EasyMode`), puis déclenche `completeRound`.  
- **SUMMARY** : si `questionCount < MAX_QUESTIONS_PER_GAME`, on précharge la question suivante (`prefetchRequestController`) et le front présente le prochain round ; sinon `finalizeGame` fige la session.  
- **GAME_OVER** : `isGameOver=true`, `nextQuestion=null`, l'utilisateur est redirigé vers `/end`. `resetToLobby` remet le lobby/filters à zéro.

Autres points clés :
- **Deck questions** : `fetchQuestion` précharge en arrière-plan la question suivante pour réduire le temps d'attente (`nextImageUrl` est passé à `ImageViewer`).  
- **Review mode** : si l'utilisateur a des espèces manquées (`canStartReview`), `buildQuizParams` envoie `taxon_ids` pour ne servir que ces taxons.  
- **Annulation réseau** : deux `AbortController` (actif + prefetch) évitent les requêtes orphelines en navigation ou restart.

## Rôle des pages
- `HomePage` : lobby + configurateur (`Configurator`, `CustomFilter`) pour packs, filtres géo/taxon/période ; permet de lancer un mode review.  
- `PlayPage` : garde-fou ; affiche `Spinner` tant que la question n'est pas prête, puis rend `EasyMode` ou `HardMode` selon `gameMode`.  
- `EndPage` : écran récap (`EndScreen`) avec score, espèces vues, achievements débloqués ; propose relance ou retour accueil.  
- `ProfilePage` : vue stat/XP, maîtrise par biome/taxon, achievements (hydrate les taxons manquants via `getTaxaByIds`).  
- `AppLayout` : shell global (nav, modales d'aide et d'achievements, header cliquable pour reset).

## PWA & Vite (`client/vite.config.js`)
- **Registration** : `VitePWA` en `registerType: autoUpdate` pour rafraîchir silencieusement le SW.  
- **Cache rules** :
  - `/api/quiz-question` → `NetworkOnly` : on force la fraîcheur pour éviter de resservir la même question ou des données périmées liées aux cooldowns.  
  - `/api/taxa/autocomplete` et `/api/observations/species_counts` → `StaleWhileRevalidate` (cache 1h) : privilégie la réactivité sur la métadonnée.  
  - Autres `/api/*` → `NetworkOnly` par sécurité.  
  - Photos iNaturalist (`static.inaturalist.org`, `s3`) → `CacheFirst` 7 jours (max 400/200 entrées) pour limiter la bande passante.  
- **Dev** : `devOptions.enabled=true` permet de tester le SW localement ; proxy `/api` → `localhost:3001`.

## Composants réutilisables
- `ImageViewer` (`imageUrls`, `alt`, `nextImageUrl?`, `photoMeta?`) : viewer zoom/pan avec préfetch de la prochaine image et navigation clavier.  
- `AutocompleteInput` (`onSelect`, `fetcher`, `placeholder`, etc.) : champ d'autocomplétion utilisé dans les modes et filtres.  
- `RoundSummaryModal` (`isOpen`, `onContinue`, `summary`) : récap de manche (score, réponse) pour le mode facile.  
- `StreakBadge` (`streak`, `tier`) : badge visuel pour les séries en cours.  
- `AchievementModal` (`achievementId`, `onClose`) : affiche les succès débloqués en file d'attente.  
- `PreferencesMenu` : réglages langue/thème/volume (interagit avec `LanguageContext`/`UserContext`).  
- `GeoFilter` + `Configurator`/`CustomFilter` : UI des filtres carte/bbox, taxa inclus/exclus, période.  
- `PhylogeneticTree` : rend l'arbre taxonomique dans `HardMode`.  
- `ErrorModal`, `HelpModal`, `Spinner`, `AppLayout` : utilitaires transverses (modales, navigation, loader).

## Flux de données côté front
- Les services API (`client/src/services/api.js`) normalisent les params (arrays → CSV) et propagent un `AbortController`/timeout pour chaque appel.  
- `GameContext` agrège les réponses et enrichit les métadonnées de round (biomes, temps de réponse, streaks) avant de les pousser dans `UserContext` (profil, achievements).
