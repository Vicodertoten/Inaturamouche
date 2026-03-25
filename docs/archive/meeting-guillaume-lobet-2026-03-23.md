# Preparation rendez-vous - Guillaume Lobet - lundi 23 mars 2026

## 1. Objectif du rendez-vous

L'objectif n'est pas de "vendre" l'application. L'objectif est d'obtenir un retour pedagogique utile de la part d'un enseignant qui connait les usages reels en cours.

Si l'echange se passe bien, tu veux idealement repartir avec 3 choses :

1. Un ou deux cas d'usage pedagogiques credibles.
2. Les principaux blocages pour un usage en cours reel.
3. Une idee claire de la prochaine iteration utile.

Formulation simple :

> "Je ne viens pas vous demander de valider le projet tel quel. Je viens surtout chercher un regard d'enseignant: dans quels contextes ca peut vraiment aider, et qu'est-ce qu'il faudrait changer pour que ce soit utile dans un cours."

## 2. Ce qu'est iNaturaQuizz en une phrase

> "iNaturaQuizz est une application pedagogique qui transforme des observations reelles d'iNaturalist en quiz d'identification d'especes, avec progression, revision et partage de resultats, sans compte utilisateur."

Version plus courte :

> "C'est un outil pour apprendre a reconnaitre les especes a partir d'observations reelles, de facon plus active qu'une fiche ou un diaporama."

## 3. Pitch d'ouverture (2 minutes)

Tu peux quasiment dire ceci mot pour mot :

> "Le projet s'appelle iNaturaQuizz. A la base, l'idee etait simple: utiliser les observations reelles d'iNaturalist pour transformer l'identification des especes en apprentissage actif. Au lieu de seulement lire une fiche ou regarder des slides, l'utilisateur doit reconnaitre, comparer, se tromper, recommencer et memoriser."
>
> "Aujourd'hui, l'application permet de jouer en mode QCM ou en mode plus exigeant avec saisie du nom, sur des packs thematiques et regionaux. Il y a aussi une logique de progression, de collection et de repetition espacee pour revenir sur les especes mal connues."
>
> "Ce qui m'interesse maintenant, c'est de sortir d'une logique de prototype perso et de comprendre si l'outil peut avoir une vraie place dans un cadre pedagogique: en preparation d'une sortie, en revision, en evaluation formative, ou dans un cours ou il faut reconnaitre des taxons sur base d'images reelles."
>
> "J'aimerais donc surtout avoir votre avis sur trois points: pour quel type d'enseignement ca a du sens, ce qui manque pour un usage en cours reel, et quelles adaptations auraient le plus de valeur."

## 4. Histoire du projet a raconter

Il faut raconter une histoire simple, sans tout dire. Le plus important est de montrer une logique.

Structure conseillee :

1. Point de depart
   "Je voulais rendre l'apprentissage de l'identification plus actif et plus motivant."
2. Intuition de depart
   "iNaturalist fournit des observations reelles, riches, variees et scientifiquement credibles."
3. Premiere version
   "J'ai commence par un quiz d'identification."
4. Constat
   "Un quiz seul ne suffit pas pour apprendre durablement."
5. Evolution
   "J'ai ajoute des packs thematiques, un mode plus difficile, un suivi de progression, une revision espacee et des liens de partage."
6. Stade actuel
   "Je suis a un moment ou j'ai besoin du regard d'enseignants pour savoir si je construis quelque chose de vraiment utile pedagogiquement."

Important :

- Ne fabrique pas une histoire trop heroique.
- Ne parle pas d'"edtech revolutionnaire".
- Reste sur une trajectoire concrete: prototype -> outil structure -> besoin de validation terrain.

## 5. Etat actuel du produit

Tu peux parler d'un produit deja avance, pas d'une simple maquette.

### Ce qui existe aujourd'hui

- Application web React + API Express, installable comme PWA.
- 2 modes actifs: `Easy` et `Hard`.
- 44 packs thematiques actifs, plus un mode de pack personnalise.
- Packs regionaux et thematiques: Belgique, Europe, monde, especes menacees, plantes, champignons, etc.
- Packs a liste fixe pour des sequences pedagogiques plus stables.
- Progression: XP, niveaux, streak, achievements.
- Suivi par espece: collection et niveaux de maitrise.
- Revision espacee inspiree du SM-2.
- Partage de resultats par lien.
- Partage/import de packs personnalises par lien.
- Guide enseignant deja integre dans l'application.
- FR / EN / NL.
- Pas de compte obligatoire.
- Donnees de progression stockees localement dans le navigateur.
- Pas de tracking tiers.

### Ce qui est pedagogiquement fort

- Observations reelles au lieu d'images artificielles.
- Erreur productive: l'etudiant se trompe, compare, corrige.
- Progression visible.
- Repetition espacee pour renforcer la memorisation.
- Possibilite de preparer un pack adapte a un lieu, une periode, un groupe taxonomique.
- Resultats partageables sans friction de creation de compte.

### Ce qui est techniquement rassurant sans entrer dans le detail

- L'application est testee localement cote backend, integration et frontend.
- Le coeur du quiz ne depend pas de l'IA.
- Les reponses sont validees cote serveur.
- L'app a ete pensee pour fonctionner sans infrastructure lourde ni collecte de donnees personnelles.

## 6. Ce qu'il ne faut pas survendre

Sois tres propre sur ces points.

### 1. Ce n'est pas encore un outil enseignant complet

Aujourd'hui, il n'y a pas de vrai tableau de bord enseignant, pas de gestion de classe, pas de suivi centralise par cohorte, pas d'integration LMS.

### 2. Ce n'est pas une preuve d'efficacite pedagogique

Tu peux dire :

> "J'ai des hypotheses pedagogiques fortes, mais pas encore de validation terrain rigoureuse."

### 3. L'IA n'est pas le coeur du projet

L'IA sert a formuler des explications apres reponse. Le quiz, la progression et la logique d'apprentissage existent sans elle.

Tu peux dire :

> "Je prefere presenter l'IA comme une couche optionnelle d'explication, pas comme la promesse centrale."

### 4. Ce n'est pas un outil d'aide a la consommation

Le projet affiche deja des avertissements sur les packs sensibles: comestible, toxique, medicinal, lookalike.

Tu peux dire clairement :

> "Ce n'est pas un guide de cueillette ni un outil de decision medicale. C'est un support educatif."

## 7. Pourquoi cela peut interesser Guillaume Lobet

Sans pretendre connaitre exactement ses besoins, tu peux proposer ces angles :

- apprentissage par reconnaissance visuelle a partir d'observations reelles
- avant/apres sortie de terrain
- travail sur la biodiversite locale
- revision autonome entre deux seances
- evaluation formative plutot que sommative
- construction de packs lies a un lieu, une saison ou un theme de cours

Formulation utile :

> "Je me suis dit que votre retour serait utile parce que vous avez deja un regard sur les outils pedagogiques qui essayent de rendre des contenus biologiques plus interactifs, et que vous savez tres bien ce qui passe ou non avec des etudiants."

## 8. Deroule conseille pour 30 a 60 minutes

### Si vous avez 30 minutes

1. 3 min - contexte et objectif du rendez-vous
2. 5 min - pitch + histoire du projet
3. 7 min - demo tres courte
4. 10 min - discussion sur les usages pedagogiques
5. 5 min - blocages, priorites, prochaine etape

### Si vous avez 60 minutes

1. 5 min - contexte et objectifs
2. 10 min - projet, histoire, promesse
3. 10 min - demo guidee
4. 20 min - discussion pedagogique approfondie
5. 10 min - priorites produit / recherche / experimentation
6. 5 min - synthese et suite

## 9. Demo conseillee

La demo doit etre courte et pedagogique. Pas une visite exhaustive.

Ordre conseille :

1. Home + choix d'un pack pertinent
2. Une question en mode Easy
3. Une question en mode Hard
4. Ecran de fin / resultats
5. Partage de resultats
6. Guide enseignant
7. Si pertinent: creation ou partage d'un pack personnalise

Packs a privilegier pour un profil enseignant :

- un pack local Belgique / Europe
- un pack plantes
- un pack champignons si cela nourrit la discussion sur les confusions et la prudence
- un pack fixe plutot qu'un pack trop large si tu veux montrer une logique pedagogique stable

Pendant la demo, ne decris pas toutes les features. Relie chaque ecran a une utilite pedagogique.

Exemple :

- "Le mode Easy sert surtout a l'initiation et a la reconnaissance visuelle."
- "Le mode Hard force la recuperation active du nom."
- "Le partage de resultats peut servir de trace legere sans demander de compte."
- "Le pack personnalise permet d'adapter l'outil a un site d'excursion ou a un chapitre."

## 10. Cas d'usage pedagogiques a proposer

N'en propose pas dix. Propose trois cas forts.

### Cas 1 - Avant / apres sortie de terrain

- Avant: pack cible sur les especes probables du site.
- Pendant: observation reelle sur le terrain.
- Apres: revision et correction des confusions.

### Cas 2 - Evaluation formative

- 10 questions en mode Hard.
- L'etudiant partage son lien de resultats.
- L'enseignant observe les confusions recurrentes.

### Cas 3 - Progression sur un semestre

- pack fixe sur un corpus d'especes
- reutilisation reguliere
- revision espacee pour stabiliser la memorisation

## 11. Questions intelligentes a poser a Guillaume Lobet

Le but est qu'il parle de ses contraintes reelles.

### Sur l'usage

- "Dans quel type de cours ou d'activite voyez-vous le plus de potentiel pour un outil comme ca ?"
Tous les cours ou il y a de l'identification, guide nature et haute école naturaliste.
- "Est-ce que vous le voyez plutot en amont d'un cours, en revision, en sortie de terrain, ou en evaluation formative ?"
- "Quel serait pour vous le public le plus adapte: debutants, bacheliers, master, grand public ?"


### Sur la valeur pedagogique

- "Qu'est-ce qui vous parait pedagogiquement interessant ici, et qu'est-ce qui vous parait faible ou insuffisant ?"
- "Est-ce que la reconnaissance sur image vous semble utile comme etape d'apprentissage, ou trop reductrice si elle reste seule ?"
- "Qu'est-ce qu'il faudrait ajouter pour que cela aide vraiment a apprendre, et pas seulement a jouer ?"
outil pour répéter 

### Sur les blocages

- "Qu'est-ce qui vous empecherait aujourd'hui de recommander ou tester un outil comme celui-ci avec des etudiants ?" 
rien si ce n'est le coté mise a l'échelle.
- "Le principal manque serait plutot du cote contenu, evaluation, suivi enseignant, ou robustesse ?"
outil supplémentaire pour réviser pas besoin de dashboard/compte.
potentiellement un système de classe. car sur 200 personnes, ca devient compliqué d'aller chercher les plantes tous ensemble. potentiel d'avoir un outil numérique qui permet de facilement interroger des étudiants. potentiel d'avoir un dashboard de classe. 

### Sur les priorites

- "Si je ne devais construire qu'une seule fonctionnalite de plus pour un usage enseignant, laquelle aurait le plus de valeur ?"
- "Entre tableau de bord enseignant, creation de corpus, export des resultats, ou validation pedagogique, qu'est-ce qui viendrait en premier selon vous ?"

### Sur une suite concrete

- "Est-ce que vous verriez un petit contexte de test, meme informel, dans lequel recueillir un premier retour d'etudiants ?"

## 12. Reponses preparees aux objections probables

### "Un quiz d'identification, ce n'est pas apprendre la biologie."

Reponse :

> "Je suis d'accord: seul, ce n'est pas suffisant. Je le vois plutot comme une brique d'entrainement a la reconnaissance, a la memorisation et a la discussion des confusions, pas comme un remplacement du cours."

### "La reconnaissance sur image est limitee."

Reponse :

> "Oui. C'est pourquoi je le vois comme un complement a l'observation, aux sorties, aux comparaisons morphologiques et au cours, pas comme une expertise terrain complete."

### "Sans compte enseignant, le suivi est limite."

Reponse :

> "Oui, c'est probablement une des prochaines frontieres du projet. Aujourd'hui j'ai privilegie une friction tres faible et la confidentialite, mais pour un usage academique il faudra peut-etre un meilleur suivi enseignant."

### "Pourquoi utiliser de l'IA ?"

Reponse :

> "Le coeur du systeme n'en depend pas. L'IA sert seulement a produire des explications apres reponse, avec fallback si besoin. Si demain on la retire, l'application reste utilisable."

### "Qu'est-ce qui garantit la qualite scientifique ?"

Reponse :

> "Les observations proviennent d'iNaturalist et le projet privilegie du contenu 'Research Grade'. L'objectif n'est pas de remplacer une validation experte, mais de partir de donnees naturalistes reelles et credibles."

## 13. Ce que tu peux demander explicitement

Il faut oser demander un avis operable.

Exemples :

- "Si vous etiez a ma place, quel angle pedagogique vous approfondiriez en premier ?"
- "Qu'est-ce qui transformerait cet outil d'un projet interessant en outil vraiment utile pour un enseignant ?"
- "Quel type de retour d'etudiants serait le plus pertinent a aller chercher ?"
- "Si je voulais faire un premier test de terrain intelligent, comment vous cadreriez ca ?"

## 14. Message de cloture

Tu peux finir ainsi :

> "Merci, c'est exactement le type de retour que je cherchais. Mon enjeu n'est pas d'ajouter des features pour ajouter des features, mais de comprendre quel probleme pedagogique reel cet outil peut aider a resoudre."

Puis :

> "Si vous voulez, je peux vous envoyer ensuite un tres court recap de ce que je retiens de notre echange et des pistes que cela ouvre."

## 15. Checklist pour ce soir

- ouvrir l'app et verifier que tout se lance correctement
- choisir 2 ou 3 packs a montrer, pas plus
- preparer un exemple de lien de resultats partage
- preparer un exemple de pack personnalise
- noter en une phrase ton objectif pour le rendez-vous
- repeter ton pitch de 2 minutes a voix haute
- preparer 3 questions maximum a lui poser en priorite

## 16. Ce que tu peux dire si on te demande "ou en est le projet ?"

Version courte :

> "Je dirais que ce n'est plus un prototype brut, mais pas encore un outil enseignant complet. Le coeur produit existe deja, avec des modes de jeu, des packs, de la progression, de la revision et du partage. La prochaine etape, c'est de verifier avec des enseignants ce qui merite vraiment d'etre pousse."

## 17. Resume ultra-court a garder en tete

- Ce n'est pas "une app de quiz".
- C'est un outil d'entrainement a l'identification a partir d'observations reelles.
- La vraie question n'est pas "est-ce que c'est cool ?"
- La vraie question est "dans quel usage pedagogique precis cela devient utile ?"

