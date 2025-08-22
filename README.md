# Inaturamouche

## Objectifs
Inaturamouche est un quiz de reconnaissance d'espèces basé sur les observations partagées sur la plateforme [iNaturalist](https://www.inaturalist.org/). Le joueur doit identifier des organismes à partir de photos et peut ainsi découvrir la biodiversité mondiale.

## Architecture
Le projet est composé de deux parties distinctes :

- **Serveur Node/Express** (`server.js`)
  - Expose une API REST pour obtenir des questions de quiz, rechercher des taxons et récupérer des détails d'espèces.
  - Communique avec l'API publique d'iNaturalist et applique une politique CORS.
- **Client React/Vite** (`client/`)
  - Fournit l'interface de jeu et consomme l'API du serveur.
  - Gère la configuration des paquets d'espèces, le profil du joueur et la logique de jeu.

Cette séparation permet de déployer indépendamment l'API et l'interface utilisateur.

### Distinction client / serveur
Le serveur génère les questions à partir d'iNaturalist et renvoie uniquement les données nécessaires. Le client affiche les images, les propositions de réponses et envoie les choix du joueur. Toute la logique de présentation (navigation, modals, profil, etc.) reste côté client alors que les appels réseau vers iNaturalist sont centralisés côté serveur.

## Modes de jeu
- **Mode facile** : quatre propositions sont affichées pour chaque photo. Un indice facultatif permet de supprimer une mauvaise réponse au prix de points.
- **Mode difficile** : le joueur doit deviner la lignée taxonomique (ordre, famille, genre, etc.) jusqu'à l'espèce, avec un nombre limité d'essais et la possibilité de révéler des rangs contre des pénalités.

## Scripts
### Racine (serveur)
- `npm start` : lance l'API Express sur le port 3001.
- `npm run dev` : démarrage du serveur avec [nodemon](https://nodemon.io/) pour le rechargement automatique.

### Client (`client/`)
- `npm run dev` : démarre le serveur de développement Vite.
- `npm run build` : construit l'application React pour la production.
- `npm run preview` : prévisualise la version construite.
- `npm run lint` : exécute ESLint sur le code du client.

## Installation
1. Installer les dépendances côté serveur :
   ```bash
   npm install
   ```
2. Installer les dépendances côté client :
   ```bash
   cd client
   npm install
   ```
3. Lancer le serveur :
   ```bash
   npm start
   ```
4. Dans un autre terminal, lancer le client :
   ```bash
   cd client
   npm run dev
   ```
L'interface est accessible sur http://localhost:5173 et communique avec l'API disponible sur http://localhost:3001.

