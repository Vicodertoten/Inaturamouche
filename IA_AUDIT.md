# Audit du Système IA - iNaturaQuizz

## Pass 1: Vue Stratégique et Architecture
... (Contenu précédent de Pass 1 et 2) ...

---

## Pass 3: Synthèse et Plan d'Action

### Executive Summary (Résumé pour Décideurs)

Le système IA d'iNaturaQuizz est globalement bien conçu, mature et résilient, avec une architecture "RAG → Generate → Validate → Fallback" robuste et une excellente observabilité via un store de métriques propriétaire. Cependant, il présente **deux risques critiques** qui nécessitent une attention immédiate : **1)** une forte dépendance à un "contrat textuel" fragile avec l'API de l'IA, qui pourrait casser la fonctionnalité à tout moment, et **2)** une sur-dépendance à Wikipedia comme unique source de données RAG, créant un risque de "data poisoning" et d'erreurs factuelles. Les recommandations s'articulent autour de la migration vers des sorties structurées (Function Calling), la diversification des sources de données, et le renforcement des stratégies de test et de monitoring.

### Top 10 des Risques Priorisés

1.  **CRITIQUE - Fragilité du Parsing de Sortie :** Le contrat `prompt <-> parser` basé sur du texte brut est le point de défaillance le plus probable du système. Une simple mise à jour du modèle Gemini peut le briser. (Failles #1, #7)
2.  **ÉLEVÉ - Qualité et Sécurité des Données RAG :** La sur-dépendance à Wikipedia expose le système au "data poisoning" (erreurs factuelles) et à l'injection de prompt. (Failles #10, #5)
3.  **ÉLEVÉ - Absence de Tests Unitaires et de Sécurité :** Le manque de tests unitaires rend les modifications risquées. L'absence de tests de sécurité ("red teaming") laisse des vulnérabilités potentielles non détectées. (Failles #17, #18)
4.  **ÉLEVÉ - Risque de Fuite de Données Sensibles dans les Logs :** La journalisation de corps de réponse d'API bruts en cas d'erreur crée un risque de violation de la confidentialité. (Faille #16)
5.  **MOYEN - Absence d'Alertes en Temps Réel :** Les problèmes critiques (pics de coût, de latence, de taux de fallback) ne sont pas détectés automatiquement, retardant la réponse aux incidents. (Faille #15)
6.  **MOYEN - Échecs Silencieux du Pipeline :** Le système ne distingue pas clairement un échec du RAG d'un RAG à faible contenu, menant à des appels LLM inutiles et coûteux avec un contexte vide. (Faille #12)
7.  **MOYEN - Tâches Multiples dans les Prompts :** Demander au modèle de raisonner ET de traduire en même temps dégrade la qualité des réponses et augmente le coût. (Faille #2)
8.  **MOYEN - Qualité de Filtrage par Heuristiques :** Les filtres de qualité basés sur des regex sont peu fiables et peuvent rejeter de bonnes réponses ou en accepter de mauvaises. (Faille #8)
9.  **FAIBLE - Stratégie de Retry Inefficace :** La gestion du "rate limiting" (erreur 429) est basique et peut prolonger inutilement la latence. (Faille #4)
10. **FAIBLE - Expérience Utilisateur Inconsistante des Fallbacks :** L'écart de qualité entre les réponses de l'IA et les réponses de fallback pré-écrites peut être déroutant pour l'utilisateur. (Faille #13)

### Matrice des Failles

| Faille ID | Composant | Gravité | Probabilité | Description |
| :--- | :--- | :--- | :--- | :--- |
| #1, #7 | Prompting, Parsing | **Élevée** | Moyenne | Le parsing de texte brut (`---`) est fragile et cassant. |
| #10, #5 | RAG, Sécurité | **Élevée** | Moyenne | Sur-dépendance à Wikipedia, risque de data poisoning et d'injection. |
| #16 | Observabilité, Sécurité | **Élevée** | Faible | Risque de fuite de données sensibles dans les logs d'erreurs. |
| #17, #18 | Tests | **Moyenne** | Élevée | Absence de tests unitaires et de sécurité (red teaming). |
| #15 | Observabilité | **Moyenne** | Élevée | Pas d'alertes temps réel sur les KPIs critiques. |
| #12 | RAG | **Moyenne** | Moyenne | Échecs silencieux du RAG menant à des appels LLM à vide. |
| #2 | Prompting | **Moyenne** | Élevée | Demander au LLM de traduire et raisonner en même temps. |
| #8 | Parsing | **Moyenne** | Moyenne | Filtres de qualité par regex peu fiables (faux positifs/négatifs). |
| #4 | Inférence | **Moyenne** | Moyenne | Stratégie de retry inefficace pour les erreurs de rate limit. |
| #13, #9 | Fallback | **Faible** | Élevée | UX inconsistante et répétitive des fallbacks. |
| #3, #6, #11, #5 | Divers | **Faible** | Élevée | Optimisations diverses (calcul de sévérité, timeout, RAG fetching, etc.). |

---

### Plan d'Implémentation 7/30/90 Jours

#### **Dans les 7 prochains jours (Quick Wins)**

1.  **Monitoring :** Mettre en place une tâche `cron` pour exécuter `npm run beta:thresholds` toutes les 15 minutes et envoyer une alerte (email, webhook) en cas d'échec. (Adresse Faille #15)
2.  **Sécurité des Logs :** Modifier le logging d'erreur dans `aiPipeline.js` pour ne plus inclure le corps (`body`) des réponses d'API brutes. (Adresse Faille #16)
3.  **Documentation des Tests :** Documenter l'usage et l'importance du script `audit-ai-explanations.mjs` dans `CONTRIBUTING.md`. (Adresse Faille #17)
4.  **Optimisation RAG :** Dédupliquer les termes de recherche dans `fetchWikipediaSummaries` avant les appels réseau. (Adresse Faille #11)

#### **Dans les 30 prochains jours (Fondations)**

1.  **Tests Unitaires :** Écrire des tests unitaires pour `outputFilter.js`. C'est le module le plus critique à sécuriser. Tester les fonctions de parsing et les regex de qualité avec des cas nominaux et des cas limites. (Adresse Faille #17)
2.  **Fallback sur RAG Échoué :** Modifier `collectSpeciesData` pour retourner un `ragFailed: true` si aucune description n'est trouvée. Mettre à jour `aiPipeline.js` pour utiliser ce signal et déclencher le fallback *avant* l'appel LLM. (Adresse Faille #12)
3.  **Red Teaming Manuel :** Mener une session de "red teaming" manuelle en modifiant une page Wikipedia pour tester la vulnérabilité à l'injection de prompt. (Adresse Faille #18)
4.  **Amélioration des Retries :** Implémenter la lecture de l'en-tête `Retry-After` dans `callGeminiWithRetry`. (Adresse Faille #4)

#### **Dans les 90 prochains jours (Changements Structurels)**

1.  **MIGRATION VERS LA SORTIE STRUCTURÉE (Priorité #1) :**
    -   **Étape 1 :** Lancer une PoC pour migrer le prompt des explications vers le **Function Calling / Tool Use** de Gemini. Définir un outil `submitExplanation(explanation, discriminant)`.
    -   **Étape 2 :** Une fois la PoC validée, migrer la logique de production et supprimer le parseur `parseAIResponse`. (Adresse Failles #1, #7)
2.  **Diversification des Sources RAG :**
    -   **Étape 1 :** Intégrer l'API de GBIF pour récupérer des descriptions textuelles taxonomiques.
    -   **Étape 2 :** Mettre à jour `collectSpeciesData` pour agréger et prioriser les sources (ex: GBIF > iNat > Wikipedia). (Adresse Faille #10)
3.  **Tests de Sécurité Automatisés :** Créer un jeu de données `adversarial_test_cases.json` et un mode "adversaire" pour le script d'audit afin d'automatiser les tests de régression de sécurité. (Adresse Faille #18)
4.  **Mise en place d'un Vrai Monitoring :** Pousser les métriques de `metricsStore.js` vers un service comme Prometheus ou Datadog et y configurer des alertes. (Adresse Faille #15)

### Plan de Test et Métriques de Succès

Pour mesurer l'impact des correctifs, nous suivrons les KPIs et SLIs suivants (la plupart sont déjà collectés par `metricsStore.js`).

| Métrique | SLI Cible (Objectif) | Comment Mesurer | Justification |
| :--- | :--- | :--- | :--- |
| **Taux de Fallback IA** | `< 10%` | `summary.fallbackRatePct` du script d'audit. | **Mesure la robustesse.** Un taux bas indique que le pipeline (prompt, IA, parsing) est fiable. |
| **Taux de Rejet Qualité**| `< 5%` | `summary.fallbackReasonCounts.quality_rejected` | **Mesure la qualité.** Un taux bas indique que l'IA respecte les consignes et que les filtres ne sont pas trop stricts. |
| **Latence P95 Explanations** | `< 7000ms` | `endpoints.p95_ms` pour `POST /api/quiz/explain` | **Mesure l'expérience utilisateur.** Une latence élevée frustre l'utilisateur. |
| **Coût Moyen par Explication** | `< $0.0005` | `analysis.ai_cost.estimated_cost_per_explain_usd` | **Mesure l'efficacité.** Permet de contrôler les coûts et de justifier le ROI. |
| **Taux de Succès des Tests Adversaires** | `100%` | Résultat du script d'audit en mode "adversaire". | **Mesure la sécurité.** Le système ne doit jamais succomber à une injection de prompt connue. |
| **Taux de "Feedback Utile"** | `> 80%` | `analysis.explain_value.useful_rate_pct` | **Mesure la valeur produit.** C'est la métrique ultime : est-ce que les utilisateurs trouvent la fonctionnalité utile ? |

### Questions Critiques Restantes

1.  **Quel est le taux de fallback *réel* en production et ses causes dominantes ?** Le script d'audit est une simulation. Il est crucial d'analyser les données de `metricsStore.js` en production pour voir si `quality_rejected` ou `parse_failed` sont les vrais coupables.
2.  **Les filtres de qualité (regex) ont-ils des faux positifs ?** Rejettent-ils des réponses valides ? Une analyse manuelle des explications rejetées par `collectQualityIssues` est nécessaire pour affiner les règles.
3.  **L'impact de la traduction implicite sur la qualité est-il significatif ?** Il faudrait mener un A/B test : 50% des appels avec le RAG en anglais (comportement actuel) vs 50% avec un RAG pré-traduit en français. On comparerait ensuite le taux de fallback et la qualité perçue.
4.  **Comment le système se comporterait-il face à une attaque par "cache-busting" ?** Quel serait le coût réel ? Une simulation de charge (en environnement de test) sur des paires de taxons non-cachées permettrait de quantifier le risque financier.
5.  **Quelle est la performance des sources RAG alternatives (GBIF, EOL) ?** Fournissent-elles des descriptions textuelles aussi riches que Wikipedia pour une grande variété de taxons ? Une évaluation offline est nécessaire avant de les intégrer en production.
