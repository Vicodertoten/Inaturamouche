import React, { useCallback, useMemo, useState } from 'react';
import { generateShareCard, buildShareText, nativeShare, copyToClipboard } from '../utils/shareCard';
import { encodeChallenge, buildChallengeUrl } from '../utils/challengeSeed';
import { useLanguage } from '../context/LanguageContext.jsx';
import { BottomSheet } from '../shared/ui';
import { notify } from '../services/notifications';
import './ShareButtons.css';

const MOBILE_SHARE_QUERY = '(max-width: 767px)';

function isMobileViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_SHARE_QUERY).matches;
}

function openUrlInNewTab(url) {
  if (!url || typeof window === 'undefined') return false;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return true;
  window.location.assign(url);
  return true;
}

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
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </IconBase>
);

const OpenIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M14 4h6v6" />
    <path d="M10 14 20 4" />
    <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
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

const ShareButtons = ({
  score,
  total,
  packName,
  topSpecies,
  isDaily,
  mode,
  shareUrl,
  activePackId,
  gameMode,
  maxQuestions,
  mediaType,
}) => {
  const { t } = useLanguage();
  const [sharing, setSharing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareSummaryLine = useMemo(() => {
    const speciesLabel = score === 1 ? 'espèce' : 'espèces';
    if (packName) {
      return t(
        'share.summary_with_pack',
        { score, total, pack: packName },
        `J'ai reconnu ${score} ${speciesLabel} sur ${total} dans « ${packName} » sur iNaturaQuizz.`,
      );
    }
    return t(
      'share.summary_without_pack',
      { score, total },
      `J'ai reconnu ${score} ${speciesLabel} sur ${total} sur iNaturaQuizz.`,
    );
  }, [packName, score, t, total]);
  const challengeUrl = useMemo(() => {
    if (!activePackId || typeof window === 'undefined') return '';
    const token = encodeChallenge({
      packId: activePackId,
      gameMode: gameMode || 'easy',
      maxQuestions: maxQuestions || 10,
      mediaType: mediaType || 'images',
      score,
      total,
    });
    return buildChallengeUrl(token);
  }, [activePackId, gameMode, maxQuestions, mediaType, score, total]);
  const shareInviteLine = useMemo(
    () => t('share.invite', {}, 'Regarde mon récap et essaie toi aussi :'),
    [t],
  );
  const shareTitle = useMemo(
    () => (
      isDaily
        ? t('share.daily_headline', {}, 'J\'ai terminé le défi du jour sur iNaturaQuizz')
        : t('share.headline', {}, 'Je viens de finir une partie sur iNaturaQuizz')
    ),
    [isDaily, t],
  );

  const shareData = useMemo(
    () => ({
      score,
      total,
      packName,
      topSpecies,
      isDaily,
      mode,
      url: shareUrl,
      summaryLine: shareSummaryLine,
      inviteLine: shareInviteLine,
      ctaLine: t('share.card_cta', {}, 'Voir le récap et jouer'),
      highlightLabel: t('share.highlight_label_card', {}, 'Espèce marquante'),
    }),
    [
      score,
      total,
      packName,
      topSpecies,
      isDaily,
      mode,
      shareUrl,
      shareSummaryLine,
      shareInviteLine,
      t,
    ],
  );

  const tryNativeShare = useCallback(async () => {
    let blob = null;
    try {
      blob = await generateShareCard(shareData);
    } catch {
      blob = null;
    }
    return nativeShare({
      title: shareTitle,
      text: buildShareText(shareData),
      url: shareUrl,
      blob,
    });
  }, [shareData, shareTitle, shareUrl]);

  const handleCopyShareText = useCallback(async (closeSheet = false) => {
    setSharing(true);
    try {
      const copied = await copyToClipboard(buildShareText(shareData));
      if (copied) {
        notify(t('share.share_text_copied', {}, 'Texte de partage copié.'), {
          type: 'success',
          duration: 3000,
        });
        if (closeSheet) setSheetOpen(false);
        return;
      }
      openUrlInNewTab(shareUrl);
      notify(t('share.opened_recap', {}, 'Récap ouvert dans un nouvel onglet.'), {
        type: 'info',
        duration: 3000,
      });
      if (closeSheet) setSheetOpen(false);
    } catch {
      openUrlInNewTab(shareUrl);
      notify(t('share.opened_recap', {}, 'Récap ouvert dans un nouvel onglet.'), {
        type: 'info',
        duration: 3000,
      });
      if (closeSheet) setSheetOpen(false);
    } finally {
      setSharing(false);
    }
  }, [shareData, shareUrl, t]);

  const handleShareNow = useCallback(async () => {
    setSharing(true);
    try {
      if (canNativeShare) {
        const result = await tryNativeShare();
        if (result.status === 'shared') {
          setSheetOpen(false);
          return;
        }
        if (result.status === 'aborted') {
          return;
        }
      }
      await handleCopyShareText(true);
    } finally {
      setSharing(false);
    }
  }, [canNativeShare, handleCopyShareText, tryNativeShare]);

  const handleCopyRecapLink = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      notify(t('share.recap_link_copied', {}, 'Lien du récap copié.'), {
        type: 'success',
        duration: 3000,
      });
      setSheetOpen(false);
      return;
    }
    openUrlInNewTab(shareUrl);
    notify(t('share.opened_recap', {}, 'Récap ouvert dans un nouvel onglet.'), {
      type: 'info',
      duration: 3000,
    });
    setSheetOpen(false);
  }, [shareUrl, t]);

  const handleOpenRecap = useCallback(() => {
    openUrlInNewTab(shareUrl);
    notify(t('share.opened_recap', {}, 'Récap ouvert dans un nouvel onglet.'), {
      type: 'info',
      duration: 3000,
    });
    setSheetOpen(false);
  }, [shareUrl, t]);

  const handleCreateChallenge = useCallback(async (closeSheet = false) => {
    if (!challengeUrl) return;
    const ok = await copyToClipboard(challengeUrl);
    if (ok) {
      notify(t('share.challenge_copied', {}, 'Lien de défi copié ! Envoie-le à un ami.'), {
        type: 'success',
        duration: 3500,
      });
      if (closeSheet) setSheetOpen(false);
      return;
    }
    openUrlInNewTab(challengeUrl);
    notify(t('share.challenge_opened', {}, 'Défi ouvert dans un nouvel onglet.'), {
      type: 'info',
      duration: 3000,
    });
    if (closeSheet) setSheetOpen(false);
  }, [challengeUrl, t]);

  const handlePrimaryAction = useCallback(async () => {
    if (isMobileViewport() && canNativeShare) {
      setSharing(true);
      try {
        const result = await tryNativeShare();
        if (result.status === 'failed' || result.status === 'unavailable') {
          setSheetOpen(true);
        }
      } finally {
        setSharing(false);
      }
      return;
    }
    setSheetOpen(true);
  }, [canNativeShare, tryNativeShare]);

  return (
    <div className="share-buttons">
      <button
        type="button"
        className={`btn btn--share btn--share-primary${sharing ? ' is-loading' : ''}`}
        onClick={handlePrimaryAction}
        disabled={sharing}
        aria-busy={sharing}
      >
        <ShareIcon className="share-btn-icon" />
        {sharing
          ? t('share.sharing', {}, 'Préparation du récap…')
          : t('share.share_result', {}, 'Partager mon récap')}
      </button>

      {!isDaily && activePackId && (
        <button
          type="button"
          className="btn btn--challenge"
          onClick={() => void handleCreateChallenge()}
        >
          <ChallengeIcon className="share-btn-icon" />
          {t('share.challenge_friend', {}, 'Défier un ami')}
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialSnap={0}
        snapPoints={[0.52, 0.72, 0.9]}
        className="share-sheet"
        ariaLabel={t('share.sheet_title', {}, 'Partager mon récap')}
      >
        <div className="share-sheet__header">
          <p className="share-sheet__eyebrow">
            {t('share.sheet_eyebrow', {}, 'Récap partageable')}
          </p>
          <h2 className="share-sheet__title">
            {t('share.sheet_title', {}, 'Partager mon récap')}
          </h2>
          <p className="share-sheet__description">{shareSummaryLine}</p>
        </div>

        <div className="share-sheet__preview">
          <div className="share-sheet__score">
            <span className="share-sheet__score-value">{score}/{total}</span>
            <span className="share-sheet__score-label">
              {t('share.preview_label', {}, 'espèces reconnues')}
            </span>
          </div>
          <div className="share-sheet__chips">
            {packName && <span className="share-sheet__chip">📦 {packName}</span>}
            {mode && <span className="share-sheet__chip">🎯 {mode}</span>}
          </div>
          {topSpecies && (
            <p className="share-sheet__highlight">
              <strong>{t('share.highlight_label', {}, 'Espèce marquante :')}</strong> {topSpecies}
            </p>
          )}
        </div>

        <div className="share-sheet__actions">
          <button type="button" className="share-sheet__action" onClick={() => void handleShareNow()} disabled={sharing}>
            <ShareIcon className="share-sheet__action-icon" />
            <span className="share-sheet__action-copy">
              <span className="share-sheet__action-title">
                {t('share.option_share_now', {}, 'Partager maintenant')}
              </span>
              <span className="share-sheet__action-text">
                {t('share.option_share_now_hint', {}, 'Partager ou copier un message prêt à envoyer.')}
              </span>
            </span>
          </button>

          <button type="button" className="share-sheet__action" onClick={() => void handleCopyShareText(true)} disabled={sharing}>
            <ShareIcon className="share-sheet__action-icon" />
            <span className="share-sheet__action-copy">
              <span className="share-sheet__action-title">
                {t('share.option_copy_message', {}, 'Copier le message de partage')}
              </span>
              <span className="share-sheet__action-text">
                {t('share.option_copy_message_hint', {}, 'Copier un texte prêt pour WhatsApp, email ou réseaux sociaux.')}
              </span>
            </span>
          </button>

          <button type="button" className="share-sheet__action" onClick={() => void handleCopyRecapLink()} disabled={sharing}>
            <CopyIcon className="share-sheet__action-icon" />
            <span className="share-sheet__action-copy">
              <span className="share-sheet__action-title">
                {t('share.option_copy_link', {}, 'Copier le lien du récap')}
              </span>
              <span className="share-sheet__action-text">
                {t('share.option_copy_link_hint', {}, 'Pratique pour WhatsApp, email ou réseaux sociaux.')}
              </span>
            </span>
          </button>

          <button type="button" className="share-sheet__action" onClick={handleOpenRecap} disabled={sharing}>
            <OpenIcon className="share-sheet__action-icon" />
            <span className="share-sheet__action-copy">
              <span className="share-sheet__action-title">
                {t('share.option_view_recap', {}, 'Voir le récap')}
              </span>
              <span className="share-sheet__action-text">
                {t('share.option_view_recap_hint', {}, 'Ouvrir la page publique telle qu\'elle sera partagée.')}
              </span>
            </span>
          </button>

          {!isDaily && challengeUrl && (
            <button type="button" className="share-sheet__action" onClick={() => void handleCreateChallenge(true)} disabled={sharing}>
              <ChallengeIcon className="share-sheet__action-icon" />
              <span className="share-sheet__action-copy">
                <span className="share-sheet__action-title">
                  {t('share.option_create_challenge', {}, 'Créer un défi à partir de cette partie')}
                </span>
              <span className="share-sheet__action-text">
                {t('share.option_create_challenge_hint', {}, 'Copier un lien pour inviter quelqu\'un à faire mieux.')}
              </span>
            </span>
          </button>
        )}
      </div>
    </BottomSheet>
  </div>
);
};

export default ShareButtons;
