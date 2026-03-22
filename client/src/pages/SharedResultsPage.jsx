import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decodeResultsSnapshot } from '../utils/resultsShare';
import { buildChallengeUrl, encodeChallenge } from '../utils/challengeSeed';
import { useLanguage } from '../context/LanguageContext.jsx';
import './SharedResultsPage.css';

const SharedResultsPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(false);
  const [showAllSpecies, setShowAllSpecies] = useState(false);

  const decode = useCallback(() => {
    if (!token) { setError(true); return; }
    const decoded = decodeResultsSnapshot(token);
    if (!decoded) { setError(true); return; }
    setError(false);
    setShowAllSpecies(false);
    setSnapshot(decoded);
  }, [token]);

  useEffect(() => { decode(); }, [decode]);

  const species = useMemo(
    () => (Array.isArray(snapshot?.sp) ? snapshot.sp : []),
    [snapshot],
  );
  const sortedSpecies = useMemo(() => (
    [...species].sort((a, b) => {
      if (a[1] === b[1]) return String(a[2] || a[3] || a[0]).localeCompare(String(b[2] || b[3] || b[0]));
      return b[1] - a[1];
    })
  ), [species]);
  const featuredSpecies = useMemo(() => sortedSpecies.slice(0, 5), [sortedSpecies]);
  const hiddenSpeciesCount = Math.max(0, sortedSpecies.length - featuredSpecies.length);
  const challengePath = useMemo(() => {
    if (!snapshot?.p || typeof window === 'undefined') return '';
    const challengeToken = encodeChallenge({
      packId: snapshot.p,
      gameMode: snapshot.m,
      maxQuestions: snapshot.mq,
      mediaType: snapshot.mt,
      score: snapshot.c,
      total: snapshot.q,
    });
    const fullUrl = buildChallengeUrl(challengeToken);
    return fullUrl.replace(window.location.origin, '');
  }, [snapshot]);

  if (error) {
    return (
      <div className="screen shared-results-screen">
        <div className="card">
          <h1>❌ {t('results_share.invalid', {}, 'Résultats introuvables')}</h1>
          <p>{t('results_share.invalid_text', {}, 'Ce lien de résultats n\'est pas valide ou a expiré.')}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('common.home', {}, 'Accueil')}
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="screen shared-results-screen">
        <div className="card" role="status" aria-live="polite">
          <p>{t('results_share.loading', {}, 'Chargement des résultats…')}</p>
        </div>
      </div>
    );
  }

  const accuracy = snapshot.q > 0 ? Math.round((snapshot.c / snapshot.q) * 100) : 0;
  const modeName = snapshot.m === 'hard' ? t('home.hard_mode', {}, 'Difficile') : t('home.easy_mode', {}, 'Facile');
  const dateStr = snapshot.t
    ? new Date(snapshot.t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const heroTitle = t(
    'results_share.hero_title',
    { name: snapshot.n, correct: snapshot.c, total: snapshot.q },
    `${snapshot.n} a reconnu ${snapshot.c} espèces sur ${snapshot.q}`,
  );
  const heroText = snapshot.pn
    ? t(
      'results_share.hero_text_pack',
      { pack: snapshot.pn },
      `Dans le pack « ${snapshot.pn} », cette partie montre ce qu'on peut apprendre à reconnaître à partir d'observations réelles.`,
    )
    : t(
      'results_share.hero_text',
      {},
      "Cette partie montre ce qu'on peut apprendre à reconnaître à partir d'observations réelles.",
    );
  const secondaryCta = snapshot.p
    ? t('results_share.secondary_cta', {}, 'Faire mieux sur ce pack')
    : t('results_share.play_cta', {}, 'Essayer iNaturaQuizz');

  return (
    <div className="screen shared-results-screen">
      <div className="card shared-results-card">
        <div className="shared-results-hero">
          <p className="shared-results-kicker">
            {t('results_share.kicker', {}, 'Récap partagé')}
          </p>
          <h1 className="shared-results-title">{heroTitle}</h1>
          <p className="shared-results-intro">{heroText}</p>

          <div className="shared-results-meta">
            {snapshot.pn && <span className="shared-results-chip">📦 {snapshot.pn}</span>}
            <span className="shared-results-chip">🎯 {modeName}</span>
            {snapshot.r === 1 && <span className="shared-results-chip">📚 {t('review.title', {}, 'Révision')}</span>}
            <span className="shared-results-chip">🏅 {t('xp.level_label', {}, 'Niveau')} {snapshot.l}</span>
            {dateStr && <span className="shared-results-chip">📅 {dateStr}</span>}
          </div>
        </div>

        <div className="shared-results-summary">
          <div className="shared-results-stat shared-results-stat--primary">
            <span className="stat-value">{snapshot.c}/{snapshot.q}</span>
            <span className="stat-label">{t('results_share.correct', {}, 'Espèces reconnues')}</span>
          </div>
          <div className="shared-results-stat">
            <span className="stat-value">{accuracy}%</span>
            <span className="stat-label">{t('results_share.accuracy', {}, 'Précision')}</span>
          </div>
          <div className="shared-results-stat">
            <span className="stat-value">{featuredSpecies.length}</span>
            <span className="stat-label">{t('results_share.highlights', {}, 'Espèces mises en avant')}</span>
          </div>
        </div>

        {featuredSpecies.length > 0 && (
          <section className="shared-results-section">
            <div className="shared-results-section-header">
              <h2 className="shared-results-section-title">
                {t('results_share.species_title', { count: featuredSpecies.length }, 'Espèces marquantes')}
              </h2>
              <p className="shared-results-section-text">
                {t('results_share.species_intro', {}, 'Quelques espèces vues pendant cette partie, pour donner envie de rejouer ou de faire mieux.')}
              </p>
            </div>

            <ul className="shared-results-species-grid">
              {featuredSpecies.map(([taxonId, wasCorrect, commonName, sciName], idx) => (
                <li key={`${taxonId}-${idx}`} className={`shared-results-species-card ${wasCorrect ? 'is-correct' : 'is-wrong'}`}>
                  <span className={`shared-results-species-pill ${wasCorrect ? 'is-correct' : 'is-wrong'}`}>
                    {wasCorrect
                      ? t('results_share.species_correct', {}, 'Reconnue')
                      : t('results_share.species_wrong', {}, 'À revoir')}
                  </span>
                  <span className="shared-results-species-name">
                    {commonName || sciName || `#${taxonId}`}
                  </span>
                  {sciName && commonName && (
                    <em className="shared-results-species-sci">{sciName}</em>
                  )}
                </li>
              ))}
            </ul>

            {hiddenSpeciesCount > 0 && !showAllSpecies && (
              <button
                type="button"
                className="shared-results-link"
                onClick={() => setShowAllSpecies(true)}
              >
                {t(
                  'results_share.show_more_species',
                  { count: hiddenSpeciesCount },
                  `Voir les ${hiddenSpeciesCount} autres espèces`,
                )}
              </button>
            )}

            {showAllSpecies && sortedSpecies.length > featuredSpecies.length && (
              <ul className="shared-results-species-list">
                {sortedSpecies.slice(featuredSpecies.length).map(([taxonId, wasCorrect, commonName, sciName], idx) => (
                  <li key={`${taxonId}-extra-${idx}`} className={`shared-results-species ${wasCorrect ? 'correct' : 'wrong'}`}>
                    <span className="species-status">{wasCorrect ? '✅' : '❌'}</span>
                    <span className="species-name">
                      {commonName || sciName || `#${taxonId}`}
                      {sciName && commonName && <em className="species-sci"> ({sciName})</em>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="shared-results-cta">
          <h2 className="shared-results-cta-title">
            {t('results_share.cta_title', {}, 'À toi d’essayer')}
          </h2>
          <p className="shared-results-cta-text">
            {t('results_share.cta_text', {}, 'Joue un pack, découvre des espèces réelles et compare ton propre récap en fin de partie.')}
          </p>
          <div className="shared-results-actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
              {t('results_share.primary_cta', {}, 'Essayer iNaturaQuizz')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate(challengePath || '/')}
            >
              {secondaryCta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedResultsPage;
