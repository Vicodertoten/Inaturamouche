# Scoring & Progression Reference

> **Source de vérité** — Généré à partir de `shared/scoring.js`, `client/src/utils/scoring.js`, `client/src/services/StreakService.js`, `client/src/services/PlayerProfile.js`, `client/src/core/achievements/achievements.data.json`, `client/src/services/collection/MasteryEngine.js`.

---

## 1. Scoring

### Constantes de base

> Source : `shared/scoring.js` — partagé entre serveur et client.

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `EASY_BASE_POINTS` | 10 | XP de base pour une bonne réponse en Easy |
| `RIDDLE_BASE_POINTS` | 20 | XP de base en mode Riddle (archivé) |
| `HARD_BASE_POINTS` | 30 | XP de base en mode Hard |
| `HARD_GUESS_BONUS` | 10 | Bonus par guess restant en Hard |
| `MASTERY_THRESHOLD` | 3 | Bonnes réponses nécessaires pour la maîtrise (legacy) |

### Points par rang taxonomique (Taxonomic Ascension — archivé)

| Rang | Points |
|------|--------|
| Kingdom | 5 |
| Phylum | 10 |
| Class | 15 |
| Order | 20 |
| Family | 25 |
| Genus | 30 |
| Species | 40 |

### Formule de score

> Source : `client/src/utils/scoring.js` → `computeScore()`

```
Mode Easy :
  points = isCorrect ? 10 : 0
  bonus  = 0

Mode Hard :
  points = isCorrect ? basePoints : 0
  bonus  = isCorrect ? guessesRemaining × 10 : 0
```

### Streak bonus (in-game)

> Source : `client/src/utils/scoring.js` → `computeInGameStreakBonus()`

```
bonus = min(streak × 2, 20)
```

Linéaire : +2 XP par bonne réponse consécutive, plafonné à +20 (streak 10).

---

## 2. Niveaux (XP → Level)

> Source : `client/src/utils/scoring.js`

### `getLevelFromXp(xp)`

```
level = 1 + floor(√xp / 10)
```

### `getXpForLevel(level)`

```
xp = ((level - 1) × 10)²
```

### Table de référence

| Level | XP requis | XP cumulé min |
|-------|-----------|---------------|
| 1 | 0 | 0 |
| 2 | 100 | 100 |
| 3 | 400 | 400 |
| 4 | 900 | 900 |
| 5 | 1 600 | 1 600 |
| 10 | 8 100 | 8 100 |
| 15 | 19 600 | 19 600 |
| 20 | 36 100 | 36 100 |

---

## 3. Daily Streak

> Source : `client/src/services/StreakService.js`

### Modèle de données

```javascript
dailyStreak: {
  current: 0,          // Streak active (jours consécutifs)
  longest: 0,          // Record personnel
  lastPlayedDate: null, // ISO datetime du dernier jeu
  shields: 0,          // Boucliers accumulés (max 5)
  shieldUsedToday: false,
  streakBonusXP: 0,    // Multiplicateur XP cumulé
  streakMilestones: { 7: false, 14: false, 30: false }
}
```

### Logique au démarrage (`checkDailyStreak`)

| Situation | Résultat |
|-----------|----------|
| Premier lancement (pas de `lastPlayedDate`) | Pas de changement |
| Joué aujourd'hui | Pas de changement |
| Joué hier (`diffDays === 1`) | Streak continue (incrément différé) |
| Manqué ≥ 1 jour, shields > 0 | Consomme 1 shield, streak préservée |
| Manqué ≥ 1 jour, shields = 0 | **Streak reset à 0** |

### Logique après une partie (`updateDailyStreak`)

| Action | Condition | Effet |
|--------|-----------|-------|
| Incrément streak | Premier jeu du jour | `current = current + 1` (ou 1 si jour initial) |
| Record personnel | `current > longest` | Met à jour `longest` |
| Shield gagné | `current % 7 === 0 && shields < 5` | `shields += 1` |
| Milestone 7j | `current === 7 && !milestones[7]` | Marque milestone + notification |
| Milestone 14j | `current === 14 && !milestones[14]` | Marque milestone + notification |
| Milestone 30j | `current === 30 && !milestones[30]` | Marque milestone + notification |

### Shields

- **Gain** : +1 shield tous les 7 jours de streak
- **Maximum** : 5 shields
- **Usage** : consommé automatiquement si le joueur manque un jour
- **Protection** : préserve la streak pour une journée manquée

### Bonus XP streak

> Source : `applyXPWithStreakBonus()`

```
finalXP = floor(baseXP × (1 + streakBonusXP))
```

Le `streakBonusXP` est modifié par les achievements (voir section achievements).

### Anti-duplication milestones

Protection par timestamp : une même milestone ne peut pas être déclenchée deux fois en moins d'une minute (`ONE_MINUTE = 60 000 ms`).

---

## 4. Species Mastery (Collection)

> Source : `client/src/services/collection/MasteryEngine.js`

### Niveaux de maîtrise

| Niveau | Constante | Nom | Seuil XP |
|--------|-----------|-----|----------|
| 0 | `NONE` | Unseen | — |
| 1 | `BRONZE` | Discovery | 10 XP |
| 2 | `SILVER` | Familiar | 50 XP |
| 3 | `GOLD` | Expert | 120 XP |
| 4 | `DIAMOND` | Master | 300 XP |

### Gains XP par espèce

| Action | XP |
|--------|-----|
| Réponse correcte | +10 |
| Réponse incorrecte | -5 |

### Calcul du niveau

```javascript
calculateMasteryLevel(xp):
  xp >= 300 → DIAMOND
  xp >= 120 → GOLD
  xp >= 50  → SILVER
  xp >= 10  → BRONZE
  sinon     → NONE
```

### Système de révision espacée (Spaced Repetition)

> Champs IndexedDB (depuis Dexie v6) :

| Champ | Description |
|-------|-------------|
| `nextReviewDate` | Date ISO de la prochaine révision |
| `reviewInterval` | Intervalle actuel en jours (1, 2, 4, 8, 16, 32, 64, 90) |
| `easeFactor` | Facteur de difficulté Anki-like (1.3 → 3.0) |

---

## 5. Achievements

> Source : `client/src/core/achievements/achievements.data.json`

### Types de récompenses

| Type | Description | Exemple |
|------|-------------|---------|
| `XP_FLAT` | Gain XP fixe | +500 XP |
| `PERM_MULTIPLIER` | Multiplicateur XP permanent (par groupe taxo) | +2% sur Aves |
| `TITLE` | Titre cosmétique | "Professeur" |
| `BORDER` | Bordure de profil | `hardened_steel` |

### Titres disponibles

| ID | Nom | Obtention |
|----|-----|-----------|
| `default` | — | Par défaut |
| `professeur` | Professeur | `MASTERY_PROFESSOR_10` |
| `flash` | Flash | `SPEED_LIGHTNING` |
| `gardien_du_temps` | Gardien du Temps | `WEEKLY_RITUAL_7` |

### Bordures disponibles

| ID | CSS class | Obtention |
|----|-----------|-----------|
| `default` | — | Par défaut |
| `silver_frame` | `border-silver` | `COLL_ROOKIE_50` |
| `gold_book_frame` | `border-gold-book` | `COLL_EXPERT_150` |
| `hardened_steel` | `border-steel` | `FLAWLESS_HARD` |
| `platinum_ring` | `border-platinum` | `PACK_EXPLORER_5` |
| `diamond_frame` | `border-diamond` | `RARITY_LEGEND_HUNTER_3` |

### Catalogue complet

#### Catégorie : HABIT

| ID | Icon | Récompense | Description |
|----|------|------------|-------------|
| `first_game` | 🎮 | +100 XP | Première partie |
| `ten_games` | 🎯 | +300 XP | 10 parties |
| `GAMES_50` | 🎮 | +500 XP | 50 parties |
| `EARLY_BIRD` | 🌅 | +300 XP | Jouer tôt le matin |
| `NIGHT_OWL` | 🦉 | +300 XP | Jouer tard le soir |
| `WEEKEND_WARRIOR` | ⚔️ | +500 XP | Jouer samedi + dimanche |
| `WEEKLY_RITUAL_7` | 📅 | Titre: Gardien du Temps | 7 jours consécutifs |
| `FIRST_REVIEW` | 📚 | +50 XP | Première session de révision |

#### Catégorie : SKILL

| ID | Icon | Récompense | Description |
|----|------|------------|-------------|
| `LEVEL_5` | ⭐ | +250 XP | Atteindre le niveau 5 |
| `LEVEL_10` | 🌟 | +500 XP | Atteindre le niveau 10 |
| `STREAK_STARTER_3` | 🔥 | +150 XP | Streak de 3 |
| `STREAK_MASTER_5` | 🔥 | +300 XP | Streak de 5 |
| `STREAK_LEGEND_10` | 🔥 | +500 XP | Streak de 10 |
| `PERFECT_GAME` | 💎 | +750 XP | 100% correct dans une partie |
| `FLAWLESS_HARD` | 👑 | Bordure: hardened_steel | 100% en Hard mode |
| `ACCURACY_HARD_75` | 🎯 | +750 XP | 75% en Hard mode (seuil) |
| `RIDDLE_SOLVER_10` | 🧩 | +300 XP | 10 réponses Riddle correctes |
| `SCORING_JACKPOT` | 💰 | +1000 XP | Score jackpot exceptionnel |
| `SPEED_LIGHTNING` | ⚡ | Titre: Flash | Réponses rapides consécutives |
| `RECOVERY_KING` | 💪 | +500 XP | Remontée après mauvais début |

#### Catégorie : COLLECTION

| ID | Icon | Récompense | Description |
|----|------|------------|-------------|
| `globetrotter` | 🌍 | +500 XP | Jouer des packs de régions différentes |
| `COLL_ROOKIE_50` | 📖 | Bordure: silver_frame | 50 espèces observées |
| `COLL_EXPERT_150` | 📚 | Bordure: gold_book_frame | 150 espèces observées |
| `MASTER_5_SPECIES` | 📚 | +500 XP | 5 espèces maîtrisées (Gold+) |
| `MASTERY_PROFESSOR_10` | 🎓 | Titre: Professeur | 10 espèces maîtrisées |
| `PACK_EXPLORER_5` | 🗺️ | Bordure: platinum_ring | 5 packs explorés |
| `RARITY_LEGEND_HUNTER_3` | 🏹 | Bordure: diamond_frame | 3 espèces rares trouvées |

#### Catégorie : TAXONOMY

| ID | Icon | Récompense | Description |
|----|------|------------|-------------|
| `SPEC_ORNITHOLOGIST` | 🐦 | +2% XP sur Aves | Spécialiste oiseaux |
| `SPEC_BOTANIST` | 🌿 | +2% XP sur Plantae | Spécialiste plantes |
| `SPEC_MYCOLOGIST` | 🍄 | +1000 XP | Spécialiste champignons |

---

## 6. Player Profile

> Source : `client/src/services/PlayerProfile.js` → `getDefaultProfile()`

### Structure complète

```javascript
{
  xp: 0,
  stats: {
    gamesPlayed: 0,
    easyQuestionsAnswered: 0,
    hardQuestionsAnswered: 0,
    riddleQuestionsAnswered: 0,
    correctEasy: 0,
    correctHard: 0,
    correctRiddle: 0,
    accuracyEasy: 0,
    accuracyHard: 0,
    accuracyRiddle: 0,
    speciesMastery: {},          // { taxonId: correctCount }
    missedSpecies: [],           // taxonIds des espèces ratées
    packsPlayed: {},             // { packId: count }
    currentStreak: 0,            // Streak in-game (consécutives dans une partie)
    longestStreak: 0,
    weekendWarriorCompleted: false,
    lastPlayedDays: [],          // Jours récents (sam/dim tracking)
    consecutiveFastAnswers: 0,   // Pour SPEED_LIGHTNING
    totalHintsUsed: 0,
    totalQuestionsAnswered: 0,
    hardGamesCompleted: 0,
    reviewSessionsCompleted: 0,
    consecutiveReviewDays: 0,
    lastReviewDate: null,
  },
  achievements: [],              // IDs des achievements débloqués
  pokedex: {},                   // { taxonId: { seen, mastered, ... } }
  dailyStreak: { ... },          // Voir section 3
  rewards: { ... },              // Bordure, titre, multiplicateurs actifs
}
```

### Persistance

- **Stockage** : IndexedDB via Dexie (table `profiles`, clé `playerProfile`)
- **Migration** : `totalScore` → `xp` (auto-migration pour les anciens profils)
- **Legacy** : migration automatique depuis localStorage (`inaturamouche_playerProfile`) et ancien IDB (`inaturamouche-player`)

### Merge

`mergeProfileWithDefaults()` fusionne un profil chargé avec les valeurs par défaut, garantissant que tous les champs existent. Gère aussi :
- Normalisation `packsPlayed` (objet → compteurs)
- Normalisation `speciesMastery` (objet → compteurs)
- Merge des rewards avec les défauts
