import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './Footer.css';

const Footer = () => {
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
        </div>
        <p className="footer-attribution">
          {t(
            'footer.inat_attribution',
            {},
            'Données naturalistes fournies par iNaturalist (CC BY-NC). Photos © leurs auteurs respectifs.'
          )}
        </p>
        <p className="footer-copy">
          © {year} Inaturamouche — {t('footer.open_source', {}, 'Projet open source')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
