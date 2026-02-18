# 🔧 Debugging Guide: "One or both species not found" Error

## 📍 Problème
L'endpoint `/api/quiz/explain` retourne `404 TAXON_NOT_FOUND` avec le message "One or both species not found."

## 🎯 Cause racine
Une ou les deux espèces demandées n'existent pas dans l'API iNaturalist ou ne peuvent pas être trouvées pour la locale donnée.

## 🔍 Comment déboguer

### Étape 1: Consulter les logs serveur
Regardez les logs serveur pour voir exactement quels IDs sont échoalistes:

```bash
# Les logs contiennent maintenant:
# {
#   correctId: X,
#   wrongId: Y,
#   locale: 'fr',
#   foundIds: [...les IDs réellement trouvés...],
#   foundCount: N
# }
```

### Étape 2: Tester les IDs avec le script de vérification

```bash
# Tester deux IDs spécifiques (ex: 101 et 202) en français
node scripts/check-taxa-ids.mjs 101 202 fr

# Tester en anglais
node scripts/check-taxa-ids.mjs 101 202 en
```

**Résultats possibles:**
- ✅ **Les deux IDs trouvés**: Le problème est ailleurs (cache, API intermittente, etc.)
- ❌ **Un ou zéro IDs trouvés**: Les IDs n'existent pas dans iNaturalist

### Étape 3: Identifier la source des mauvais IDs

Chercher où dans TaxonomicAscension.jsx ou RoundSummaryModal.jsx les IDs problématiques sont générés:

```javascript
// RoundSummaryModal.jsx:98-99
const explanationCorrectId = explanationContext?.correctId || correctDisplayTaxon.id;
const explanationWrongId = explanationContext?.wrongId || userDisplayTaxon.id;

// TaxonomicAscension.jsx:132-135
setLossContext({
  correctId: stepCorrectTaxonId,
  wrongId: String(selectedOption.taxon_id),
  focusRank: t(`ranks.${step.rank}`, step.rank),
});
```

### Étape 4: Vérifier sur iNaturalist directement

Ouvrez dans le navigateur:
```
https://www.inaturalist.org/taxa/{ID}
```

Si la page retourne 404, l'ID n'existe pas ou a été supprimé/fusionné.

## 🛠️ Solutions selon la cause

### Cause 1: Les IDs n'existent pas dans iNaturalist
**Actions:**
- Vérifier que les questionnaires utilisent les bons IDs
- Mettre à jour les données si les espèces ont été fusionnées
- Vérifier la dernière migration de données iNaturalist

### Cause 2: Problème de locale spécifique
**Actions:**
- Vérifier si l'espèce existe en français mais pas en anglais
- Ajouter un fallback vers la locale anglaise si français échoue

### Cause 3: Cache stale ou API intermittente
**Actions:**
- Redémarrer le serveur (clearing du cache)
- Vérifier la disponibilité de l'API iNaturalist
- Augmenter les timeouts ou retries

## 📊 Améliorations à long terme

1. **Validation des IDs au moment du quiz generation:**
   - S'assurer que tous les IDs existent dans iNaturalist avant de créer le quiz

2. **Fallback gracieux:**
   - Si une espèce ne peut pas être trouvée, retourner une explication par défaut
   - Ne pas retourner 404 immédiatement

3. **Logging amélioré:**
   - Logger tous les appels à iNaturalist qui retournent des résultats partiels
   - Alerter si les IDs demandés ne sont pas retournés

4. **Monitoring:**
   - Alerter si trop de requêtes `/api/quiz/explain` retournent 404
   - C'est un signe que les données du quiz sont corrompues

## 📝 Logs pertinents

Chercher dans les logs serveur les patterns suivants:

```
"Could not find one or both taxa for explanation"
"Erreur getFullTaxaDetails"
"taxa refresh failed" (pour API iNaturalist)
```

Comparer foundIds vs requestIds pour identifier les IDs manquants.
