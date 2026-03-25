# Campus Beta UCL – Cap septembre 2026

> Document orchestrateur pour aligner produit, data, tech et pilote UCL. Langue : FR. Dernière mise à jour : 23 mars 2026.

## 1. Objectif septembre 2026 ("ready" = démontrable et pilote UCL possible)
- Date cible : avant la rentrée UCLouvain du 14 septembre 2026.
- Un enseignant crée un pack de cours en ≤ 15 min ; une classe en ≤ 5 min ; un étudiant rejoint en < 60 s.
- Parcours pilote complet sans Moodle/SSO, sans support quotidien : pack → classe → assignment → jeu → dashboard → export.
- Dataset local BE+EU autonome (GBIF/iNat) avec licences tracées ; aucune dépendance iNat runtime pour classes/packs privés.

## 2. Périmètre produit
- **Inclus (v1 pilote)** : packs publics libres, progression locale ; filtre personnalisé libre mais non partageable; packs de cours privés ; classes pseudonymes ; assignments à seed fixe ; dashboard léger ; export CSV ; magic link enseignant ; code+pseudo étudiant ; IA optionnelle (explications courtes, désactivable).
- **Exclus avant septembre** : SSO UCL, LTI/Moodle natif, comptes étudiants complets, paiement auto, marketplace, dataset mondial, anti-triche avancé, monitoring exam.
- **Positionnement** : produit éducatif indépendant, privacy-first ; freemium (cœur gratuit, couche enseignant premium activée manuellement pendant le pilote) ; pas un guide de consommation ni un outil médical.

## 3. Architecture cible
- **Boundary data** : `DataProvider` → `LegacyInatProvider` (packs publics non migrés) / `CampusDatasetProvider` (packs de cours + classes).
- **Pipeline data v1** : download GBIF iNaturalist Research-grade Observations, stockage brut objet, ETL DuckDB, normalisation Postgres tables `dataset_releases`, `taxa`, `occurrences`, `media`, `course_packs`, `pack_taxa` ; contrôle licences/attribution.
- **Runtime** : Node/Express API, Postgres (assignments, rounds, attempts, classes, packs privés), objet storage (raw+exports), email provider (magic links). Feature flag public vs campus.
- **Règles session** : assignment = set figé (pack snapshot + seed) → mêmes questions/difficulté pour la cohorte ; retention données classe 120 j par défaut.

## 4. Jalons 12 semaines (M1–M3)
- **Mois 1 (23/03 → 19/04)** : messaging Campus Beta + CGU/privacy ; fiche privacy UCL ; boundary `DataProvider` ; pipeline GBIF v1 + premier dataset versionné ; schéma Postgres figé ; 6–10 packs de cours demo.
- **Mois 2 (20/04 → 17/05)** : auth enseignant magic link + entitlements ; CRUD packs de cours privés (filtres taxon/lieu/saison) ; classes code accès + pseudo ; assignments Easy/Hard, fenêtre, seed ; parcours étudiant complet local ; métriques classe.
- **Mois 3 (18/05 → 14/06)** : dashboard enseignant (statut, scores, confusions) + export CSV ; persistance rounds/attempts Postgres ; rate limiting par teacher/assignment ; infra cible (Fly tier supérieur + Postgres managé + bucket) ; kit pilote (onboarding, protocole, questionnaires) ; dry-run 200 étudiants.

## 5. Risques & garde-fous
- Perf/cohorte 200 → set figé, persistance Postgres, tests charge S12, pas de dépendance iNat runtime.
- Conformité/licences → aucune collecte email étudiant, attribution média affichée, export sans médias, journal licences.
- Positionnement → bannir wording "non lucratif" ; maintenir "privacy-first" + freemium clair.

## 6. Suivi d’avancement (checklist vivante)
- [ ] Copy Campus Beta + CGU/privacy à jour
- [ ] Fiche privacy UCL (1 page)
- [ ] DataProvider en place (Legacy + Campus)
- [ ] Pipeline GBIF v1 exécuté (release #1)
- [ ] Schéma Postgres appliqué
- [ ] 6–10 packs cours prêts
- [ ] Auth magic link enseignant
- [ ] CRUD packs privés + filtres
- [ ] Classes + join code+pseudo
- [ ] Assignments seed figé (Easy/Hard, fenêtre)
- [ ] Parcours étudiant complet local
- [ ] Dashboard + export CSV
- [ ] Rate limiting revu
- [ ] Infra cible déployée
- [ ] Kit pilote complet
- [ ] Dry-run 200 étudiants

## 7. Annexes rapides
- **Endpoints à livrer** :
  - `POST /api/teacher/auth/request-link`, `POST /api/teacher/auth/consume`
  - `GET|POST /api/teacher/packs`, `GET|POST /api/teacher/classes`
  - `POST /api/class/join`
  - `GET /api/class/assignments/:id`, `POST /api/class/assignments/:id/start`, `POST /api/class/assignments/:id/submit`
  - `GET /api/teacher/classes/:id/dashboard`, `GET /api/teacher/classes/:id/export.csv`
- **Modèle de données cible** : `teacher`, `teacher_entitlement`, `course_pack`, `pack_taxa`, `classroom`, `class_membership`, `assignment`, `assignment_round`, `assignment_attempt`, `dataset_releases`, `taxa`, `occurrences`, `media`.
- **Infra cible (sept 2026)** : Fly app ≥ shared-cpu-2x/1GB, Postgres managé, bucket objet (raw + exports), email provider (Resend/Postmark/SES), pino logs + métriques clé API enseignant.

---
*(Document à maintenir à chaque jalon : noter dates, blocages, décisions.)*
