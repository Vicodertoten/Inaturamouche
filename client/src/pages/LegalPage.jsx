import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './LegalPage.css';

const LegalPage = () => {
  const { t } = useLanguage();
  const { hash } = useLocation();

  /* Auto-scroll to anchor (#cgu, #privacy) */
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.replace('#', ''));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="screen legal-screen">
      <h1 className="legal-title">{t('legal.page_title', {}, 'Mentions légales')}</h1>

      {/* ── Mentions légales ── */}
      <section className="legal-section" id="mentions">
        <h2>{t('legal.legal_notice_title', {}, 'Mentions légales')}</h2>
        <p>{t('legal.project_description', {}, "Inaturamouche est un projet éducatif open source à but non lucratif visant à sensibiliser le public à la biodiversité. Ce projet n'est affilié à aucune entreprise commerciale.")}</p>
        <p>{t('legal.hosting', {}, "L'application est hébergée par Netlify (front-end) et Fly.io (API). Aucune donnée personnelle n'est collectée par ces hébergeurs au-delà des journaux de serveur standard.")}</p>
      </section>

      {/* ── CGU ── */}
      <section className="legal-section" id="cgu">
        <h2>{t('legal.terms_title', {}, "Conditions Générales d'Utilisation")}</h2>
        <p>{t('legal.terms_intro', {}, "En utilisant Inaturamouche, vous acceptez les conditions suivantes :")}</p>
        <ul>
          <li>{t('legal.terms_1', {}, "L'application est fournie « en l'état » sans garantie d'aucune sorte.")}</li>
          <li>{t('legal.terms_2', {}, "Les contenus (photos, noms d'espèces) proviennent d'iNaturalist et de ses contributeurs.")}</li>
          <li>{t('legal.terms_4', {}, "L'utilisation à des fins commerciales du contenu nécessite l'accord des auteurs originaux.")}</li>
        </ul>
      </section>

      {/* ── Vie privée & RGPD ── */}
      <section className="legal-section" id="privacy">
        <h2>{t('legal.privacy_title', {}, 'Politique de confidentialité & RGPD')}</h2>
        <h3>{t('legal.data_collected_title', {}, 'Données collectées')}</h3>
        <ul>
          <li>{t('legal.data_1', {}, "Progression de jeu : stockée localement dans votre navigateur (IndexedDB). Aucune donnée n'est envoyée à un serveur.")}</li>
          <li>{t('legal.data_2', {}, "Préférences (langue, thème, mode) : stockées localement (localStorage).")}</li>
          <li>{t('legal.data_3', {}, "Géolocalisation approximative : utilisée uniquement côté client pour proposer des packs régionaux. Jamais transmise au serveur.")}</li>
        </ul>
        <h3>{t('legal.no_tracking_title', {}, 'Absence de suivi')}</h3>
        <p>{t('legal.no_tracking', {}, "Inaturamouche n'utilise aucun cookie tiers, aucun pixel de suivi, aucun outil d'analyse (pas de Google Analytics, pas de Facebook Pixel). Aucune donnée personnelle n'est partagée avec des tiers.")}</p>
        <h3>{t('legal.your_rights_title', {}, 'Vos droits')}</h3>
        <p>{t('legal.your_rights', {}, "Conformément au RGPD, vous pouvez supprimer toutes vos données locales à tout moment en effaçant les données du site dans les paramètres de votre navigateur.")}</p>
      </section>

      {/* ── Attribution iNaturalist ── */}
      <section className="legal-section" id="attribution">
        <h2>{t('legal.attribution_title', {}, 'Attribution & Crédits')}</h2>
        <p>{t('legal.inat_credit', {}, "Les données naturalistes (photos, observations, taxonomie) sont fournies par l'API iNaturalist. iNaturalist est une initiative conjointe de la California Academy of Sciences et de la National Geographic Society.")}</p>
        <p>{t('legal.photo_license', {}, "Les photos d'espèces sont soumises aux licences Creative Commons choisies par leurs auteurs (CC BY, CC BY-NC, etc.). L'attribution est affichée avec chaque photo dans le jeu.")}</p>
        <p>
          <a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer" className="legal-external-link">
            inaturalist.org
          </a>
          {' — '}
          <a href="https://www.inaturalist.org/pages/terms" target="_blank" rel="noopener noreferrer" className="legal-external-link">
            {t('legal.inat_terms_link', {}, "Conditions d'utilisation d'iNaturalist")}
          </a>
        </p>
      </section>
    </div>
  );
};

export default LegalPage;
