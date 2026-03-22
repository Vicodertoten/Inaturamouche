import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './AboutPage.css';

const AboutPage = () => {
  const { t } = useLanguage();

  return (
    <div className="screen about-screen">
      <h1 className="about-title">
        {t('about.page_title', {}, 'À propos d\'iNaturaQuizz')}
      </h1>

      {/* SECTION 1: Qu'est-ce que c'est? */}
      <section className="about-section">
        <h2>{t('about.what_is', {}, 'Qu\'est-ce que iNaturaQuizz?')}</h2>
        <p>
          {t(
            'about.what_is_text',
            {},
            'iNaturaQuizz est un jeu éducatif gratuit et sans publicité qui vous aide à apprendre l\'identification des espèces naturelles à travers un quiz interactif basé sur des observations réelles.'
          )}
        </p>
        <p>
          {t(
            'about.what_is_quality',
            {},
            'Chaque quiz utilise des observations "Research Grade" issues d\'iNaturalist — un contenu naturaliste réel, structuré par l\'identification communautaire.'
          )}
        </p>
      </section>

      {/* SECTION 2: Pourquoi ce projet? */}
      <section className="about-section">
        <h2>{t('about.why', {}, 'Pourquoi ce projet?')}</h2>
        <ul className="about-list">
          <li>
            <strong>{t('about.why_fun', {}, 'Rendre l\'apprentissage amusant')}</strong>
            {' — '}
            {t('about.why_fun_text', {}, 'Qui a dit que l\'écologie devait être ennuyeux?')}
          </li>
          <li>
            <strong>{t('about.why_biodiversity', {}, 'Célébrer la biodiversité')}</strong>
            {' — '}
            {t(
              'about.why_biodiversity_text',
              {},
              'Les 100+ millions d\'observations iNaturalist méritent d\'être vues et appréciées'
            )}
          </li>
          <li>
            <strong>{t('about.why_citizen_science', {}, 'Promouvoir la science participative')}</strong>
            {' — '}
            {t(
              'about.why_citizen_science_text',
              {},
              'Montrer que n\'importe qui peut contribuer à la science'
            )}
          </li>
          <li>
            <strong>{t('about.why_privacy', {}, 'Respecter votre confidentialité')}</strong>
            {' — '}
            {t(
              'about.why_privacy_text',
              {},
              'Pas de tracking tiers, progression stockée localement, et métriques produit first-party pseudonymes pendant la bêta'
            )}
          </li>
        </ul>
      </section>

      {/* SECTION 3: D'où viennent les données? */}
      <section className="about-section">
        <h2>{t('about.data_source', {}, 'Où viennent les données?')}</h2>
        <p>
          {t('about.inat_intro', {}, 'Toutes les observations et photos proviennent de ')}{' '}
          <a
            href="https://www.inaturalist.org"
            target="_blank"
            rel="noopener noreferrer"
            className="about-link"
          >
            <strong>iNaturalist</strong>
          </a>
          {', '}
          {t(
            'about.inat_founders',
            {},
            'une plateforme collaborative fondée par la California Academy of Sciences et National Geographic Society.'
          )}
        </p>

        <h3 className="about-subheading">
          {t('about.how_inaturalist', {}, 'Comment fonctionne iNaturalist?')}
        </h3>
        <ol className="about-list">
          <li>
            {t(
              'about.how_inat_step1',
              {},
              'Quelqu\'un observe une espèce et prend une photo'
            )}
          </li>
          <li>
            {t(
              'about.how_inat_step2',
              {},
              'Observer télécharge l\'observation sur iNaturalist'
            )}
          </li>
          <li>
            {t('about.how_inat_step3', {}, 'La communauté identifie l\'espèce')}
          </li>
          <li>
            {t(
              'about.how_inat_step4',
              {},
              'Une fois "Research Grade" = consensus communautaire suffisant selon les critères iNaturalist'
            )}
          </li>
          <li>
            {t(
              'about.how_inat_step5',
              {},
              'iNaturaQuizz l\'utilise pour les quizzes'
            )}
          </li>
        </ol>

        <h3 className="about-subheading">
          {t('about.why_research_grade', {}, 'Pourquoi "Research Grade"?')}
        </h3>
        <p>
          {t(
            'about.research_grade_text',
            {},
            'iNaturalist applique des critères de qualité stricts. En pratique, le statut "Research Grade" repose surtout sur des observations vérifiables et un accord suffisant de la communauté sur l\'identification.'
          )}
        </p>
        <p className="about-highlight">
          <strong>{t('about.research_grade_result', {}, 'Résultat:')}</strong>
          {' '}
          {t(
            'about.research_grade_result_text',
            {},
            'iNaturaQuizz s\'appuie sur des observations réelles et un cadre de qualité communautaire utile pour l\'apprentissage.'
          )}
        </p>
      </section>

      {/* SECTION 4: Attribution & Respect */}
      <section className="about-section">
        <h2>{t('about.attribution', {}, 'Attribution & Respect')}</h2>
        <p>
          {t(
            'about.attribution_intro',
            {},
            'iNaturalist et ses contributeurs méritent le crédit. Voilà comment nous le montrons:'
          )}
        </p>
        <ul className="about-list">
          <li>
            <strong>{t('about.attr_photos', {}, 'Chaque photo affiche l\'observateur')}</strong>
            {' — '}
            {t('about.attr_photos_text', {}, 'Le créateur reçoit du crédit')}
          </li>
          <li>
            <strong>{t('about.attr_licenses', {}, 'Licences visibles')}</strong>
            {' — '}
            {t('about.attr_licenses_text', {}, 'CC0, CC-BY, ou CC-BY-NC (tu sais tes droits)')}
          </li>
          <li>
            <strong>{t('about.attr_footer', {}, 'Footer prominent')}</strong>
            {' — '}
            {t('about.attr_footer_text', {}, '"Données iNaturalist" visible sur chaque page')}
          </li>
          <li>
            <strong>{t('about.attr_integrity', {}, 'Zéro modification')}</strong>
            {' — '}
            {t(
              'about.attr_integrity_text',
              {},
              'Nous prenons les observations telles quelles'
            )}
          </li>
          <li>
            <strong>{t('about.attr_nonprofit', {}, 'Zéro utilisation commerciale')}</strong>
            {' — '}
            {t('about.attr_nonprofit_text', {}, 'C\'est éducation, pas profit')}
          </li>
        </ul>
      </section>

      {/* SECTION 5: Confidentialité */}
      <section className="about-section">
        <h2>{t('about.privacy', {}, 'Votre confidentialité')}</h2>
        <ul className="about-list">
          <li>
            <strong>✓ {t('about.priv_noauth', {}, 'Zéro authentification')}</strong>
            {' — '}
            {t('about.priv_noauth_text', {}, 'Pas besoin de créer un compte')}
          </li>
          <li>
            <strong>✓ {t('about.priv_notrack', {}, 'Zéro tracking')}</strong>
            {' — '}
            {t(
              'about.priv_notrack_text',
              {},
              'Pas Google Analytics, pas Firebase, pas Facebook Pixel'
            )}
          </li>
          <li>
            <strong>✓ {t('about.priv_nocookies', {}, 'Zéro cookies tiers')}</strong>
            {' — '}
            {t(
              'about.priv_nocookies_text',
              {},
              'Juste des cookies pour vos préférences'
            )}
          </li>
          <li>
            <strong>✓ {t('about.priv_local', {}, 'Données locales')}</strong>
            {' — '}
            {t(
              'about.priv_local_text',
              {},
              'Stockées dans votre navigateur, pas au serveur'
            )}
          </li>
          <li>
            <strong>✓ {t('about.priv_gdpr', {}, 'Conforme RGPD')}</strong>
            {' — '}
            {t('about.priv_gdpr_text', {}, 'Zéro collecte de données personnelles')}
          </li>
          <li>
            <strong>✓ {t('about.priv_opensource', {}, 'Open Source')}</strong>
            {' — '}
            {t(
              'about.priv_opensource_text',
              {},
              'Vous pouvez vérifier le code vous-même'
            )}
          </li>
        </ul>
        <p>
          {t('about.privacy_full', {}, 'Consultez notre ')}{' '}
          <Link to="/legal#privacy" className="about-link">
            {t('about.privacy_full_link', {}, 'politique de confidentialité')}
          </Link>
          {' '}
          {t('about.privacy_full_suffix', {}, 'pour plus de détails.')}
        </p>
      </section>

      {/* SECTION 6: Soutien */}
      <section className="about-section">
        <h2>{t('about.support', {}, 'Comment soutenir?')}</h2>
        <p>
          {t(
            'about.support_intro',
            {},
            'iNaturaQuizz est un projet gratuit fait par un passionné de nature. Si vous aimez l\'app, voici comment aider:'
          )}
        </p>
        <ul className="about-list">
          <li>
            <strong>{t('about.support_share', {}, 'Partager')}</strong>
            {' — '}
            {t(
              'about.support_share_text',
              {},
              'Montrez à vos amis, famille, professeurs!'
            )}
          </li>
          <li>
            <strong>{t('about.support_feedback', {}, 'Feedback')}</strong>
            {' — '}
            {t(
              'about.support_feedback_text',
              {},
              'Des suggestions? Des bugs? Dites-nous via '
            )}{' '}
            <a
              href="https://github.com/Vicodertoten/Inaturamouche/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              GitHub
            </a>
          </li>
          <li>
            <strong>{t('about.support_code', {}, 'Coder')}</strong>
            {' — '}
            {t(
              'about.support_code_text',
              {},
              'Développeurs? Designers? Rejoignez sur '
            )}{' '}
            <a
              href="https://github.com/Vicodertoten/Inaturamouche"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              GitHub
            </a>
          </li>
          <li>
            <strong>{t('about.support_inaturalist', {}, 'Soutenir iNaturalist')}</strong>
            {' — '}
            {t('about.support_inaturalist_text', {}, 'Ils font le vrai travail! ')}{' '}
            <a
              href="https://inaturalist.org/donate"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              {t('about.support_inaturalist_link', {}, 'Donner à iNaturalist')}
            </a>
          </li>
        </ul>
      </section>

      {/* SECTION 7: Légal */}
      <section className="about-section">
        <h2>{t('about.legal', {}, 'Légal')}</h2>
        <div className="legal-links-list">
          <p>
            <strong>{t('about.legal_code', {}, 'Code:')}</strong>
            {' '}
            <a
              href="https://github.com/Vicodertoten/Inaturamouche"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              ISC License (Open Source)
            </a>
          </p>
          <p>
            <strong>{t('about.legal_data', {}, 'Données:')}</strong>
            {' '}
            Creative Commons (CC0, CC-BY, CC-BY-NC)
          </p>
          <p>
            <strong>{t('about.legal_details', {}, 'Détails:')}</strong>
            {' '}
            <Link to="/legal" className="about-link">
              {t('about.legal_details_link', {}, 'Mentions légales complètes')}
            </Link>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <section className="about-footer">
        <p className="about-signature">
          {t('about.signature', {}, 'Fait avec 🦋 par des passionnés de nature')}
        </p>
        <p className="about-version">
          iNaturaQuizz v1.0 — Feb 2026
        </p>
      </section>
    </div>
  );
};

export default AboutPage;
