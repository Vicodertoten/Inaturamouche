import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import Modal from './Modal';

const ProfileStatsModal = ({ profile, accuracyStats, onClose }) => {
  const { t } = useLanguage();
  const { packs } = usePacks();

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">📊 {t('profile.detailed_stats', {}, 'Statistiques détaillées')}</h3>

      <div className="detail-stats-section">
        <h4>{t('profile.accuracy_title', {}, 'Précision par mode')}</h4>
        <div className="stats-grid stat-cards">
          <div className="stat-item card-elevated">
            <span className="stat-value">{accuracyStats.easyAccuracy}%</span>
            <span className="stat-label">{t('profile.modes.easy', {}, 'Facile')}</span>
          </div>
          <div className="stat-item card-elevated">
            <span className="stat-value">{accuracyStats.riddleAccuracy}%</span>
            <span className="stat-label">{t('profile.modes.riddle', {}, 'Devinette')}</span>
          </div>
          <div className="stat-item card-elevated">
            <span className="stat-value">{accuracyStats.hardAccuracy}%</span>
            <span className="stat-label">{t('profile.modes.hard', {}, 'Difficile')}</span>
          </div>
        </div>
      </div>

      <div className="detail-stats-section">
        <h4>{t('profile.pack_stats_title', {}, 'Packs joués')}</h4>
        <ul className="detail-pack-list">
          {Object.entries(profile?.stats?.packsPlayed || {}).map(([packId, { correct, answered }]) => {
            const pack = packs.find((p) => p.id === packId);
            const acc = answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';
            return (
              <li key={packId} className="detail-pack-item">
                <span>{pack?.titleKey ? t(pack.titleKey) : packId}</span>
                <span className="detail-pack-acc">{correct}/{answered} ({acc}%)</span>
              </li>
            );
          })}
          {Object.keys(profile?.stats?.packsPlayed || {}).length === 0 && (
            <li className="empty-state">{t('profile.no_pack_stats', {}, 'Aucun pack joué')}</li>
          )}
        </ul>
      </div>

      <div className="detail-stats-section">
        <h4>{t('profile.totals', {}, 'Totaux')}</h4>
        <p className="detail-total">{t('profile.total_answered', { count: accuracyStats.totalAnswered }, `${accuracyStats.totalAnswered} questions répondues`)}</p>
        <p className="detail-total">{t('profile.total_correct', { count: accuracyStats.totalCorrect }, `${accuracyStats.totalCorrect} réponses correctes`)}</p>
      </div>

      <div className="modal-actions">
        <button className="action-button" onClick={onClose}>
          {t('common.close', {}, 'Fermer')}
        </button>
      </div>
    </Modal>
  );
};

export default ProfileStatsModal;
