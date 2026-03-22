# Système IA — Explications et Devinettes

> État réel de l’implémentation dans `server/services/ai/` au 22 mars 2026.

## Vue d’ensemble

Le système IA produit deux familles de sorties :

- `generateCustomExplanation()` pour expliquer une confusion entre deux espèces.
- `generateRiddle()` pour produire 3 indices de devinette.

Pour les explications, il existe deux modes :

- `brief` : repère court, textuel, sans analyse d’image.
- `full` : analyse photo-spécifique quand une image de manche valide est fournie.

Le pipeline réel est :

1. Collecte d’évidence : Wikipedia + iNaturalist + GBIF + Catalogue of Life.
2. Génération Gemini : JSON structuré, prompts séparés pour `brief` et `full`.
3. Validation : parsing JSON, qualité textuelle, scope de paire, attribution aux sources.
4. Réparation : second passage court uniquement si le JSON est invalide.
5. Fallback : sortie déterministe pair-specific quand l’IA ou la photo ne sont pas exploitables.

## Fichiers clés

- `server/services/ai/aiPipeline.js`
- `server/services/ai/ragSources.js`
- `server/services/ai/promptBuilder.js`
- `server/services/ai/outputFilter.js`
- `server/services/ai/aiConfig.js`

## Modèles et sorties

### Explication `brief`

- Modèle : `gemini-2.5-flash-lite`
- Timeout : `2200 ms`
- Tentatives max : `2`
- Format : JSON strict
- Champs :
  - `key_difference`
  - `why_tempting`
  - `next_look_for`

### Explication `full`

- Modèle : `gemini-2.5-flash`
- Timeout : `5000 ms`
- Tentatives max : `2`
- Format : JSON strict
- Champs :
  - `photo_summary`
  - `observed_clues`
  - `why_this_photo_could_mislead`
  - `next_check`
  - `caution`

### Repair pass

- Modèle : `gemini-2.5-flash-lite`
- Usage : uniquement après échec de parsing JSON
- But : convertir un brouillon récupérable en JSON valide sans ajouter de faits

## Persona

La persona active n’est plus “Papy Mouche” dans le pipeline d’explication. Le système courant utilise un **coach naturaliste** :

- ton sobre, concret, non infantilisant
- obligation de citer explicitement les deux espèces
- interdiction d’inventer des faits absents des preuves
- priorité à l’utilité terrain / photo

Le mode devinette conserve un prompt “Papy Mouche” séparé.

## Stratégie RAG

### Sources utilisées

- Wikipedia REST summaries en parallèle
- descriptions iNaturalist
- support taxonomique GBIF
- support taxonomique Catalogue of Life

### Garde-fous RAG

- timeout par requête
- `Promise.allSettled()` pour éviter qu’une source fasse échouer tout le bundle
- troncature stricte des snippets
- déduplication des résumés Wikipedia
- déduplication explicite des miroirs Wikipedia exposés via iNaturalist
- labels de source plus précis, par exemple `Wikipedia (fr)` ou `Wikipedia via iNaturalist`

## Sécurité image pour le mode `full`

Le backend n’accepte plus une URL arbitraire :

- allowlist stricte d’hôtes iNaturalist/CDN
- refus des IP privées / loopback
- refus des redirections
- protocole `https` obligatoire
- `content-type` vérifié (`image/*`)
- `Content-Length` borné
- plafond strict de bytes lus avant conversion base64

Si ces contrôles échouent, le pipeline ne tente pas d’analyse photo et passe au fallback déterministe.

## Validation et support

La validation ne s’arrête pas au JSON :

- nettoyage typographique
- détection d’artefacts de génération
- contrôle de scope : la réponse doit rester sur la paire correcte/erronée
- contrôle photo pour le mode `full`
- attribution heuristique des champs aux faits RAG

L’attribution est maintenant un **garde-fou bloquant** :

- `brief` : au moins 2 champs doivent être factuellement attribués
- `full` : photo jointe obligatoire + plusieurs champs factuellement attribués + au moins 2 sources factuelles distinctes pour sortir du `limited`

Le niveau `photo_grounded` n’est plus accordé simplement parce qu’une photo était jointe.

## Retry et observabilité Gemini

Les appels Gemini utilisent une sémantique claire :

- `maxAttempts` = nombre total de tentatives
- retry sur `429`, `5xx`, timeouts et erreurs réseau
- respect du header `Retry-After`
- backoff exponentiel borné + jitter
- logs de `finishReason` et `promptFeedback`
- enregistrement des tokens et du coût estimé dans `metricsStore`

## Cache

### Clés de cache des explications

La clé inclut maintenant :

- version de cache
- version de prompt
- locale
- paire `correct/wrong`
- `packId`
- `gameMode`
- `masteryBucket`
- `confusionBucket`
- hash d’image pour le mode `full`

### Politique

- TTLs variables selon `confidence`
- les fallbacks sont cachés plus court
- `SmartCache` applique désormais les TTL dynamiques au moment du fetch ou de la revalidation
- le pipeline ne réécrit plus systématiquement une valeur stale après `getOrFetch()`

## Fallbacks

### `brief`

Fallback morphologique pair-specific basé sur le groupe taxonomique et la sévérité de la confusion.

### `full`

Fallback hybride :

- annonce claire qu’une lecture photo fine n’est pas disponible
- conserve un conseil morphologique déterministe utile pour cette paire
- garde un `next_check` concret au lieu de retourner une simple indisponibilité vide

## API publique

L’endpoint `POST /api/quiz/explain` n’expose plus `focusRank` : ce paramètre n’était pas implémenté dans le pipeline.

## Devinettes

`generateRiddle()` reste plus simple :

- collecte d’un bundle espèce unique
- génération JSON avec `clues`
- normalisation / fallback de remplissage si besoin
- cache dédié

Le mode devinette ne partage pas tous les garde-fous d’attribution du pipeline d’explication.
