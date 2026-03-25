# Audit documentaire - 2026-03

Document interne non canonique.

Ecarts repo releves pendant la remise a niveau documentaire :

- la baseline locale et de deploiement est `Node 22` (`Dockerfile`, `Dockerfile.fly`, environnement local)
- la CI GitHub Actions utilise encore `Node 20`

Decision de ce chantier :

- la documentation canonique decrit l'etat cible et l'environnement reel du projet
- la CI n'est pas modifiee dans ce pass documentaire
- l'harmonisation du runtime CI reste un chantier repo distinct
