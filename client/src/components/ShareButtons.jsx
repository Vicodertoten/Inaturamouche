import React, { useCallback, useMemo, useState } from 'react';
import { generateShareCard, buildShareText, nativeShare, copyToClipboard } from '../utils/shareCard';
import { encodeChallenge, buildChallengeUrl } from '../utils/challengeSeed';
import { useLanguage } from '../context/LanguageContext.jsx';
import { notify } from '../services/notifications';
import './ShareButtons.css';

const IconBase = ({ className, children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const ShareIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 16V4" />
    <path d="M8 8l4-4 4 4" />
    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </IconBase>
);

const CopyIcon = ({ className }) => (
  <IconBase className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </IconBase>
);

const ChallengeIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M4 4l7 7" />
    <path d="M7 4H4v3" />
    <path d="M20 20l-7-7" />
    <path d="M17 20h3v-3" />
    <path d="M13 11l7-7" />
    <path d="M20 7V4h-3" />
    <path d="M11 13l-7 7" />
    <path d="M4 17v3h3" />
  </IconBase>
);

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
        <ShareIcon className="share-btn-icon" />
        {t('share.share_result', {}, 'Partager')}
      </button>

      <button
        type="button"
        className="btn btn--copy"
        onClick={handleCopy}
      >
        <CopyIcon className="share-btn-icon" />
        {t('share.copy_text', {}, 'Copier')}
      </button>

      {!isDaily && activePackId && (
        <button
          type="button"
          className="btn btn--challenge"
          onClick={handleChallenge}
        >
          <ChallengeIcon className="share-btn-icon" />
          {t('share.challenge_friend', {}, 'Défier un ami')}
        </button>
      )}
    </div>
  );
};

export default ShareButtons;
