import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './GuidePage.css';

const GuidePage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="guide-page">
      <h1>📖 {t('guide.title', {}, 'Guide enseignant')}</h1>
      <p className="guide-intro">
        {t('guide.intro', {}, 'Ce guide vous montre comment utiliser iNaturaQuizz en classe pour enseigner la biodiversité de manière ludique et efficace.')}
      </p>

      {/* Section 1 — Démarrage rapide */}
      <section className="guide-section">
        <h2>🚀 {t('guide.quickstart_title', {}, 'Démarrage rapide')}</h2>
        <ol>
          <li>{t('guide.quickstart_1', {}, 'Ouvrez iNaturaQuizz sur les appareils de vos élèves (aucune installation nécessaire, fonctionne dans le navigateur).')}</li>
          <li>{t('guide.quickstart_2', {}, 'Choisissez un pack thématique adapté à votre cours (ex : « Oiseaux de Belgique », « Plantes d\'Europe »).')}</li>
          <li>{t('guide.quickstart_3', {}, 'Sélectionnez le mode facile (QCM) pour une première découverte, ou le mode difficile (nom scientifique) pour approfondir.')}</li>
          <li>{t('guide.quickstart_4', {}, 'Lancez la session — chaque élève joue à son rythme sur son appareil.')}</li>
          <li>{t('guide.quickstart_5', {}, 'À la fin, chaque élève peut partager ses résultats via un lien.')}</li>
        </ol>
      </section>

      {/* Section 2 — Créer un pack personnalisé */}
      <section className="guide-section">
        <h2>🎨 {t('guide.custom_pack_title', {}, 'Créer un pack personnalisé')}</h2>
        <p>{t('guide.custom_pack_intro', {}, 'Vous pouvez créer un pack sur mesure pour votre classe en combinant des filtres :')}</p>
        <ul>
          <li><strong>{t('guide.filter_taxa', {}, 'Taxons')}</strong> — {t('guide.filter_taxa_desc', {}, 'Choisissez des groupes spécifiques (oiseaux, insectes, plantes…) ou des espèces précises.')}</li>
          <li><strong>{t('guide.filter_place', {}, 'Lieu')}</strong> — {t('guide.filter_place_desc', {}, 'Limitez aux espèces observées dans votre région, commune ou pays.')}</li>
          <li><strong>{t('guide.filter_period', {}, 'Période')}</strong> — {t('guide.filter_period_desc', {}, 'Filtrez par saison pour étudier la phénologie (ex : oiseaux migrateurs au printemps).')}</li>
        </ul>

        <h3>{t('guide.share_pack_title', {}, 'Partager avec vos élèves')}</h3>
        <ol>
          <li>{t('guide.share_pack_1', {}, 'Cliquez sur l\'onglet « Personnalisé » dans le configurateur.')}</li>
          <li>{t('guide.share_pack_2', {}, 'Configurez vos filtres (taxons, lieu, période).')}</li>
          <li>{t('guide.share_pack_3', {}, 'Cliquez sur « Sauvegarder » pour garder le pack dans votre catalogue local.')}</li>
          <li>{t('guide.share_pack_4', {}, 'Cliquez sur « Partager » pour copier le lien du pack.')}</li>
          <li>{t('guide.share_pack_5', {}, 'Envoyez le lien à vos élèves — ils pourront importer le pack en un clic.')}</li>
        </ol>

        <div className="guide-tip">
          <strong>💡 {t('guide.tip', {}, 'Astuce')}</strong>
          {t('guide.tip_pack', {}, 'Préparez le pack à l\'avance et testez-le. Vous pouvez sauvegarder plusieurs packs et les réutiliser d\'une année à l\'autre.')}
        </div>
      </section>

      {/* Section 3 — Modes de jeu */}
      <section className="guide-section">
        <h2>🎮 {t('guide.modes_title', {}, 'Comprendre les modes de jeu')}</h2>

        <h3>{t('guide.mode_easy_title', {}, 'Mode facile (QCM)')}</h3>
        <p>{t('guide.mode_easy_desc', {}, 'L\'élève choisit la bonne réponse parmi 4 propositions. Idéal pour l\'initiation et la reconnaissance visuelle. Les leurres sont calibrés pour être des espèces proches (même famille ou même lieu).')}</p>

        <h3>{t('guide.mode_hard_title', {}, 'Mode difficile (taxonomie)')}</h3>
        <p>{t('guide.mode_hard_desc', {}, 'L\'élève doit taper le nom (commun ou scientifique) de l\'espèce. Une autocomplétion guide la saisie. Ce mode développe la mémorisation active et l\'apprentissage du vocabulaire scientifique.')}</p>

        <h3>{t('guide.mode_review_title', {}, 'Mode révision (SRS)')}</h3>
        <p>{t('guide.mode_review_desc', {}, 'Le système de Répétition Espacée propose automatiquement les espèces que l\'élève doit revoir. Les intervalles s\'adaptent au niveau de maîtrise de chaque espèce.')}</p>
      </section>

      {/* Section 4 — Suivi des résultats */}
      <section className="guide-section">
        <h2>📊 {t('guide.results_title', {}, 'Suivi des résultats')}</h2>
        <p>{t('guide.results_intro', {}, 'À la fin de chaque session, l\'élève peut :')}</p>
        <ul>
          <li>{t('guide.results_1', {}, 'Voir son score, les XP gagnés et les espèces rencontrées.')}</li>
          <li>{t('guide.results_2', {}, 'Cliquer sur « Partager mes résultats » pour générer un lien.')}</li>
          <li>{t('guide.results_3', {}, 'Vous pouvez ouvrir ce lien et voir exactement quelles espèces ont été identifiées correctement ou non.')}</li>
        </ul>

        <h3>{t('guide.progress_title', {}, 'Progression par pack')}</h3>
        <p>{t('guide.progress_desc', {}, 'Pour les packs à liste fixe, une barre de progression montre le pourcentage d\'espèces vues et maîtrisées, réparties par niveau (bronze, argent, or, diamant).')}</p>

        <div className="guide-tip">
          <strong>💡 {t('guide.tip', {}, 'Astuce')}</strong>
          {t('guide.tip_progress', {}, 'Demandez aux élèves de partager leur lien de résultats après chaque session. Vous pourrez suivre leur progression sans créer de compte.')}
        </div>
      </section>

      {/* Section 5 — Répétition espacée */}
      <section className="guide-section">
        <h2>🧠 {t('guide.srs_title', {}, 'Répétition espacée (SRS)')}</h2>
        <p>{t('guide.srs_intro', {}, 'iNaturaQuizz utilise un algorithme de révision inspiré du SM-2. La maîtrise d\'une espèce dépend de l\'XP accumulée, et les intervalles de révision s\'adaptent selon les réponses précédentes.')}</p>

        <table className="guide-srs-table">
          <thead>
            <tr>
              <th>{t('guide.srs_level', {}, 'Niveau')}</th>
              <th>{t('guide.srs_criteria', {}, 'Seuil')}</th>
              <th>{t('guide.srs_interval', {}, 'Logique de révision')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>🥉 {t('guide.srs_bronze', {}, 'Bronze')}</td>
              <td>{t('guide.srs_bronze_criteria', {}, '10 XP')}</td>
              <td>{t('guide.srs_bronze_interval', {}, 'Première révision après 1 jour')}</td>
            </tr>
            <tr>
              <td>🥈 {t('guide.srs_silver', {}, 'Argent')}</td>
              <td>{t('guide.srs_silver_criteria', {}, '50 XP')}</td>
              <td>{t('guide.srs_silver_interval', {}, 'L\'intervalle augmente si les réponses restent justes')}</td>
            </tr>
            <tr>
              <td>🥇 {t('guide.srs_gold', {}, 'Or')}</td>
              <td>{t('guide.srs_gold_criteria', {}, '120 XP')}</td>
              <td>{t('guide.srs_gold_interval', {}, 'Les espèces bien connues reviennent moins souvent')}</td>
            </tr>
            <tr>
              <td>💎 {t('guide.srs_diamond', {}, 'Diamant')}</td>
              <td>{t('guide.srs_diamond_criteria', {}, '300 XP')}</td>
              <td>{t('guide.srs_diamond_interval', {}, 'En cas d\'erreur, la révision retombe à 1 jour')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 6 — Idées pédagogiques */}
      <section className="guide-section">
        <h2>💡 {t('guide.ideas_title', {}, 'Idées pédagogiques')}</h2>
        <ul>
          <li><strong>{t('guide.idea_1_title', {}, 'Sortie de terrain')}</strong> — {t('guide.idea_1_desc', {}, 'Avant : créez un pack avec les espèces de votre site d\'excursion. Après : les élèves revoient les espèces en mode révision.')}</li>
          <li><strong>{t('guide.idea_2_title', {}, 'Défi hebdomadaire')}</strong> — {t('guide.idea_2_desc', {}, 'Chaque semaine, proposez un pack différent. Les élèves partagent leurs résultats pour comparer.')}</li>
          <li><strong>{t('guide.idea_3_title', {}, 'Progression semestrielle')}</strong> — {t('guide.idea_3_desc', {}, 'Utilisez un pack à liste fixe et suivez la barre de progression au fil du semestre.')}</li>
          <li><strong>{t('guide.idea_4_title', {}, 'Évaluation formative')}</strong> — {t('guide.idea_4_desc', {}, 'Demandez 10 questions en mode difficile. Le lien de résultats sert de preuve de compétence.')}</li>
        </ul>
      </section>

      <div className="guide-back">
        <button className="btn btn--primary" onClick={() => navigate('/')}>
          {t('common.home', {}, 'Accueil')}
        </button>
      </div>
    </div>
  );
};

export default GuidePage;
