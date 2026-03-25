# Pipeline de generation de questions

> Comment `GET /api/quiz-question` construit une manche jouable, diverse et validee cote serveur.

## Vue d'ensemble

Le pipeline actif pour les modes `easy` et `hard` suit 7 etapes :

1. construire ou relire un pool d'observations
2. charger l'etat de selection du joueur
3. choisir une espece cible
4. choisir une observation a montrer
5. construire les leurres
6. assembler les choix et le payload de question
7. creer une round session signee

## 1. Pool d'observations

Fichier principal: `server/services/observationPool.js`

Le pool est derive :

- du pack selectionne
- des filtres taxonomiques / geographiques / temporels
- de la locale
- du media type si applicable

Le serveur s'appuie sur `SmartCache` pour :

- servir un pool frais si disponible
- servir du stale si necessaire
- amortir les appels iNaturalist

Si iNaturalist ne repond pas correctement, le serveur peut retomber sur un mode degrade.

## 2. Etat de selection

Fichier principal: `server/services/selectionState.js`

L'etat de selection memorise notamment :

- les cibles recentes
- les leurres recents
- l'historique d'observations
- un deck melange de taxons

But:

- eviter les repetitions trop proches
- conserver de la diversite
- rendre les questions seedees deterministes

## 3. Choix de la cible

Fichier principal: `server/services/questionGenerator.js`

La cible est choisie a partir :

- du deck courant
- des cooldowns
- de la disponibilite d'observations encore montrables

Les parties seedees utilisent une logique deterministe, alors que les parties normales partagent un etat protege contre les collisions de requetes.

## 4. Choix de l'observation

Parmi les observations de la cible, le serveur privilegie une observation non vue par le client.

Si toutes les observations ont deja ete vues, il autorise un repassage plutot que d'echouer.

## 5. Leurres v2

Fichiers: `server/services/lures-v2/`

Le moteur de leurres :

- collecte des candidats via confusion map ou proximite taxonomique
- applique une policy de difficulte
- exclut les candidats non viables ou trop repetes
- compose 3 leurres uniques
- valide la qualite finale

Pour les modes actifs, la logique vise un QCM plausible mais juste. Les reliquats de policies archives ne font plus partie du comportement produit principal.

## 6. Assemblage de la question

Le serveur assemble ensuite :

- les details taxonomiques utiles
- les labels de choix
- les medias
- le shuffle final
- le contrat strict des choix

Le contrat garantit notamment :

- 4 choix uniques
- exactement 1 bonne reponse
- labels coherents

## 7. Round session

Le pipeline se termine par la creation d'une round session signee :

- `round_id`
- `round_signature`
- reponse correcte uniquement cote serveur

Cette signature sert a la validation cote `POST /api/quiz/submit`.

## Pre-generation

Le backend peut pre-generer la question suivante dans une petite queue memoire pour reduire la latence percue.

## Variantes

- `easy` : QCM direct
- `hard` : meme pipeline de selection, mais interaction de soumission differente cote client/serveur
- modes archives : encore presents dans certaines branches de code ou validations, mais hors parcours produit principal
