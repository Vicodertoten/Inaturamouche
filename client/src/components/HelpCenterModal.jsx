import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from './Modal';
import { useLanguage } from '../context/LanguageContext.jsx';
import './HelpCenterModal.css';

const HelpCenterModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const location = useLocation();

  const helpContent = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith('/collection')) {
      return {
        title: t('help_center.collection_title', {}, 'Aide — Collection'),
        intro: t(
          'help_center.collection_intro',
          {},
          'Ici, tu suis tes découvertes et ta progression.'
        ),
        items: [
          t('help_center.collection_item_1', {}, 'Clique un groupe pour voir les espèces.'),
          t('help_center.collection_item_2', {}, 'Les fantômes sont à consolider.'),
          t('help_center.collection_item_3', {}, 'Tu peux filtrer et trier à tout moment.'),
        ],
      };
    }

    if (path.startsWith('/play')) {
      return {
        title: t('help_center.play_title', {}, 'Aide — En partie'),
        intro: t('help_center.play_intro', {}, 'Prends ton temps, une bonne réponse suffit.'),
        items: [
          t('help_center.play_item_1', {}, 'Observe l’image et lis les indices.'),
          t('help_center.play_item_2', {}, 'Utilise les options si tu hésites.'),
          t('help_center.play_item_3', {}, 'Chaque question te fait progresser.'),
        ],
      };
    }

    if (path.startsWith('/profile')) {
      return {
        title: t('help_center.profile_title', {}, 'Aide — Profil'),
        intro: t('help_center.profile_intro', {}, 'Ton profil garde ta progression.'),
        items: [
          t('help_center.profile_item_1', {}, 'Niveau et XP résument tes progrès.'),
          t('help_center.profile_item_2', {}, 'Les succès te donnent des bonus.'),
          t('help_center.profile_item_3', {}, 'Reviens souvent, un petit pas suffit.'),
        ],
      };
    }

    if (path.startsWith('/end')) {
      return {
        title: t('help_center.end_title', {}, 'Aide — Résumé'),
        intro: t('help_center.end_intro', {}, 'Tu peux rejouer ou rentrer au labo.'),
        items: [
          t('help_center.end_item_1', {}, 'Relance une partie pour progresser.'),
          t('help_center.end_item_2', {}, 'Ton XP est déjà sauvegardée.'),
        ],
      };
    }

    return {
      title: t('help_center.home_title', {}, 'Aide — Accueil'),
      intro: t('help_center.home_intro', {}, 'Choisis un mode, un pack, puis lance ta partie.'),
      items: [
        t('help_center.home_item_1', {}, 'Facile est parfait pour démarrer.'),
        t('help_center.home_item_2', {}, 'Un pack définit les espèces du jeu.'),
        t('help_center.home_item_3', {}, 'Tu peux ajuster les réglages plus tard.'),
      ],
    };
  }, [location.pathname, t]);

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div className="help-modal">
        <h2 className="help-modal-title">{helpContent.title}</h2>
        {helpContent.intro && <p className="help-modal-intro">{helpContent.intro}</p>}
        <ul className="help-modal-list">
          {helpContent.items.map((item, index) => (
            <li key={`help-item-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};

export default HelpCenterModal;
