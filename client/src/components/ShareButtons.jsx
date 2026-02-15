import React, { useCallback, useMemo, useState } from 'react';
import { generateShareCard, buildShareText, nativeShare, copyToClipboard } from '../utils/shareCard';
import { encodeChallenge, buildChallengeUrl } from '../utils/challengeSeed';
import { useLanguage } from '../context/LanguageContext.jsx';
import { notify } from '../services/notifications';
import './ShareButtons.css';

const ShareButtons = ({ score, total, packName, topSpecies, isDaily, mode, activePackId, gameMode, maxQuestions, mediaType }) => {
  const { t } = useLanguage();
  const [sharing, setSharing] = useState(false);

  const shareData = useMemo(
    () => ({ score, total, packName, topSpecies, isDaily, mode }),
    [score, total, packName, topSpecies, isDaily, mode],
  );

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const text = buildShareText(shareData);
      // Try native share first (mostly mobile)
      if (navigator.share) {
        try {
          const blob = await generateShareCard(shareData);
          const shared = await nativeShare({ text, blob });
          if (shared) return;
        } catch { /* canvas or share failed — fall through to clipboard */ }
      }
      // Fallback: copy text to clipboard
      const ok = await copyToClipboard(text);
      notify(
        ok
          ? t('share.copied', {}, 'Résultat copié !')
          : t('share.copy_fail', {}, 'Impossible de copier – copie le texte manuellement.'),
        { type: ok ? 'success' : 'info', duration: 3000 },
      );
    } catch {
      // Last resort — nothing worked
      notify(t('share.copy_fail', {}, 'Impossible de copier – copie le texte manuellement.'), { type: 'info', duration: 3000 });
    } finally {
      setSharing(false);
    }
  }, [shareData, t]);

  const handleCopy = useCallback(async () => {
    const text = buildShareText(shareData);
    const ok = await copyToClipboard(text);
    notify(
      ok
        ? t('share.copied', {}, 'Résultat copié !')
        : t('share.copy_fail', {}, 'Impossible de copier – copie le texte manuellement.'),
      { type: ok ? 'success' : 'info', duration: 3000 },
    );
  }, [shareData, t]);

  const handleChallenge = useCallback(async () => {
    if (!activePackId) return;
    const token = encodeChallenge({
      packId: activePackId,
      gameMode: gameMode || 'easy',
      maxQuestions: maxQuestions || 10,
      mediaType: mediaType || 'photo',
      score,
      total,
    });
    const url = buildChallengeUrl(token);
    const ok = await copyToClipboard(url);
    if (ok) {
      notify(t('share.challenge_copied', {}, 'Lien de défi copié ! Envoie-le à un ami.'), {
        type: 'success',
        duration: 3500,
      });
    }
  }, [activePackId, gameMode, maxQuestions, mediaType, score, total, t]);

  return (
    <div className="share-buttons">
      <button
        type="button"
        className="btn btn--share"
        onClick={handleShare}
        disabled={sharing}
      >
        <span aria-hidden="true">📤</span> {t('share.share_result', {}, 'Partager')}
      </button>

      <button
        type="button"
        className="btn btn--copy"
        onClick={handleCopy}
      >
        <span aria-hidden="true">📋</span> {t('share.copy_text', {}, 'Copier')}
      </button>

      {!isDaily && activePackId && (
        <button
          type="button"
          className="btn btn--challenge"
          onClick={handleChallenge}
        >
          <span aria-hidden="true">⚔️</span> {t('share.challenge_friend', {}, 'Défier un ami')}
        </button>
      )}
    </div>
  );
};

export default ShareButtons;
