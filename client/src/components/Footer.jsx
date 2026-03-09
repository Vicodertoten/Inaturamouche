import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './Footer.css';

const Footer = ({ onReportClick, compact = false }) => {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const footerClassName = compact ? 'app-footer app-footer--compact' : 'app-footer';
  const attributionPrefix = compact
    ? t('footer.inat_attribution_compact', {}, 'Données et photos')
    : t(
      'footer.inat_attribution_long',
      {},
      'Les observations et photos proviennent de'
    );
  const attributionSuffix = compact
    ? ''
    : t(
      'footer.inat_attribution_suffix',
      {},
      ', une plateforme collaborative. Chaque photo affiche l\'observateur original et sa licence CC.'
    );

  return (
    <footer className={footerClassName}>
      <div className="footer-inner">
        <div className="footer-main-row">
          <p className="footer-credit">
            <span className="footer-credit-label">{t('footer.data_source', {}, '📊 Source des données')}</span>{' '}
            <span className="footer-credit-text">
              {attributionPrefix}{' '}
              <a
                href="https://www.inaturalist.org"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-inat-link"
                title="Visitez iNaturalist.org"
              >
                iNaturalist
              </a>
              {attributionSuffix}
            </span>
          </p>

          <button
            type="button"
            className="footer-report-btn"
            onClick={() => onReportClick?.()}
          >
            {t('footer.report_bug', {}, 'Signaler un bug')}
          </button>
        </div>

        <nav className="footer-links" aria-label={t('footer.links_label', {}, 'Liens de bas de page')}>
          <Link to="/legal" className="footer-link">
            {t('footer.legal_notice', {}, 'Mentions légales')}
          </Link>
          <Link to="/legal#cgu" className="footer-link">
            {t('footer.terms', {}, 'CGU')}
          </Link>
          <Link to="/legal#privacy" className="footer-link">
            {t('footer.privacy', {}, 'Confidentialité')}
          </Link>
          <Link to="/about" className="footer-link">
            {t('footer.about', {}, 'À propos')}
          </Link>
          <Link to="/guide" className="footer-link">
            {t('footer.guide', {}, 'Guide enseignant')}
          </Link>
        </nav>

        <p className="footer-copy">
          © {year} Inaturamouche — {t('footer.open_source', {}, 'Projet open source')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
