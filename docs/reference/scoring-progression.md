# Scoring & Progression Reference

> Reference maintenue contre `shared/scoring.js`, `client/src/utils/scoring.js`, `client/src/services/StreakService.js`, `client/src/services/PlayerProfile.js` et `client/src/services/collection/MasteryEngine.js`.

## 1. Scoring actif

### Easy

- bonne reponse: `10 XP`
- mauvaise reponse: `0`

### Hard

- base: `30 XP`
- bonus par tentative restante: `10 XP`
- mauvaise reponse: `0`

### Bonus de streak en partie

`computeInGameStreakBonus(streak)` :

- `+2 XP` par bonne reponse consecutive
- plafond a `+20 XP`

## 2. Constantes legacy encore presentes dans le code

Les constantes suivantes existent toujours dans `shared/scoring.js`, mais ne font plus partie de la narration produit active :

- `RIDDLE_BASE_POINTS`
- `SCORE_PER_RANK`
- `MASTERY_THRESHOLD`

Elles servent surtout a la compatibilite avec du code archive ou des reliquats historiques.

## 3. Niveaux

### XP -> level

```txt
level = 1 + floor(sqrt(xp) / 10)
```

### XP minimal d'un level

```txt
xp = ((level - 1) * 10)^2
```

Repere:

| Level | XP minimal |
|-------|------------|
| 1 | 0 |
| 2 | 100 |
| 3 | 400 |
| 5 | 1600 |
| 10 | 8100 |
| 20 | 36100 |

## 4. Daily streak

Bloc `dailyStreak` dans le profil :

| Champ | Role |
|-------|------|
| `current` | streak active |
| `longest` | record |
| `lastPlayedDate` | dernier jeu du jour |
| `shields` | boucliers de protection |
| `shieldUsedToday` | anti double consommation |
| `streakBonusXP` | multiplicateur applique a l'XP |
| `streakMilestones` | milestones `7`, `14`, `30` |

Regles:

- la streak augmente au premier jeu du jour
- un shield est gagne tous les 7 jours, max `5`
- si un jour est manque et qu'un shield est disponible, il est consomme
- sinon, la streak repart a `0`

## 5. Mastery par espece

XP de mastery:

- bonne reponse: `+10`
- mauvaise reponse: `-5`

Seuils:

| Niveau | Nom | XP |
|--------|-----|----|
| `0` | `NONE` | `< 10` |
| `1` | `BRONZE` | `10` |
| `2` | `SILVER` | `50` |
| `3` | `GOLD` | `120` |
| `4` | `DIAMOND` | `300` |

Le systeme de revision espacee utilise notamment :

- `nextReviewDate`
- `reviewInterval`
- `easeFactor`

## 6. Achievements et rewards

Types de recompense supportes :

- `XP_FLAT`
- `PERM_MULTIPLIER`
- `TITLE`
- `BORDER`

Titres declares:

- `default`
- `professeur`
- `flash`
- `gardien_du_temps`

Bordures declarees:

- `default`
- `silver_frame`
- `gold_book_frame`
- `hardened_steel`
- `platinum_ring`
- `diamond_frame`

Le catalogue complet des achievements reste dans `client/src/core/achievements/achievements.data.json`.

## 7. Profil joueur

Le profil par defaut contient notamment :

- `xp`
- `stats.gamesPlayed`
- `stats.easyQuestionsAnswered`
- `stats.hardQuestionsAnswered`
- `stats.speciesMastery`
- `stats.missedSpecies`
- `stats.packsPlayed`
- `achievements`
- `pokedex`
- `dailyStreak`
- `rewards`

Stockage: Dexie, table `profiles`, cle `playerProfile`.
