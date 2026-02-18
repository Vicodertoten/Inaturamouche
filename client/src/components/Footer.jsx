import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './Footer.css';

const Footer = ({ onReportClick }) => {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-links">
          <Link to="/legal" className="footer-link">
            {t('footer.legal_notice', {}, 'Mentions légales')}
          </Link>
          <span className="footer-sep" aria-hidden="true">·</span>
          <Link to="/legal#cgu" className="footer-link">
            {t('footer.terms', {}, 'CGU')}
          </Link>
          <span className="footer-sep" aria-hidden="true">·</span>
          <Link to="/legal#privacy" className="footer-link">
            {t('footer.privacy', {}, 'Confidentialité')}
          </Link>
          <span className="footer-sep" aria-hidden="true">·</span>
          <Link to="/about" className="footer-link">
            {t('footer.about', {}, 'À propos')}
          </Link>
        </div>
        
        {/* Enhanced iNaturalist Attribution Section */}
        <div className="footer-inat-credit">
          <p className="footer-attribution-title">
            {t('footer.data_source', {}, '📊 Source des données')}
          </p>
          <p className="footer-attribution">
            {t(
              'footer.inat_attribution_long',
              {},
              'Les observations et photos proviennent de'
            )}{' '}
            <a 
              href="https://www.inaturalist.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-inat-link"
              title="Visitez iNaturalist.org"
            >
              iNaturalist
            </a>
            {t(
              'footer.inat_attribution_suffix',
              {},
              ', une plateforme collaborative. Chaque photo affiche l\'observateur original et sa licence CC.'
            )}
          </p>
        </div>

        <button
          type="button"
          className="footer-report-btn"
          onClick={() => onReportClick?.()}
        >
          {t('footer.report_bug', {}, 'Signaler un bug')}
        </button>
        <p className="footer-copy">
          © {year} Inaturamouche — {t('footer.open_source', {}, 'Projet open source')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
