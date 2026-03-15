import { memo } from 'react';
import PackIcon from '../../components/PackIcons';
import PackProgressBar from '../../components/PackProgressBar';
import { SettingsIcon } from '../../components/NavigationIcons';
import AdvancedSettings from '../../components/AdvancedSettings';
import {
  ResumeIcon, TargetIcon, QuestionIcon, MediaIcon, CloseIcon,
} from './HomeIcons';

/**
 * HeroZone — top section of HomePage: play CTA, resume, settings, quick chips.
 *
 * Pure presentational — all state & handlers come via props.
 */
function HeroZone({
  /* resume */
  isResuming,
  resumeSessionData,
  handleResumeGame,
  handleAbandonSession,
  /* play */
  handleStart,
  packsLoading,
  activePackId,
  activePackLabel,
  activePackHeroImage,
  hasPlayedGame,
  modeName,
  qLabel,
  mediaName,
  preloadPlayPage,
  /* advanced settings */
  advancedOpen,
  setAdvancedOpen,
  advancedButtonRef,
  advancedPanelRef,
  settingsLabel,
  /* pack progress */
  activePack,
  /* quick chips */
  dailyAlreadyCompleted,
  handleDailyChallenge,
  reviewStats,
  handleStartReview,
  /* i18n */
  t,
}) {
  return (
    <section className="home-hero">
      {isResuming ? (
        <div className="hero-cta-group">
          <button
            type="button"
            className="hero-cta hero-cta--resume"
            onClick={handleResumeGame}
            onMouseEnter={preloadPlayPage}
            onFocus={preloadPlayPage}
            onTouchStart={preloadPlayPage}
          >
            <span className="hero-cta-label">
              <span className="hero-cta-action-icon" aria-hidden="true">
                <ResumeIcon />
              </span>
              {t('home.resume_game_button_text', {}, 'Reprendre')}
            </span>
            <span className="hero-cta-meta">
              {resumeSessionData.currentQuestionIndex > 0
                ? t('home.resume_progress', { current: resumeSessionData.currentQuestionIndex, total: resumeSessionData.gameConfig?.maxQuestions || '∞' }, `Question ${resumeSessionData.currentQuestionIndex} sur ${resumeSessionData.gameConfig?.maxQuestions || '∞'}`)
                : t('home.resume_game_subtitle', {}, 'Partie en cours')}
            </span>
          </button>
          <button
            type="button"
            className="hero-abandon"
            onClick={handleAbandonSession}
            title={t('home.abandon_session_tooltip', {}, 'Abandonner')}
            aria-label={t('home.abandon_session_tooltip', {}, 'Abandonner')}
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <div className="hero-cta-shell">
          <button
            type="button"
            className="hero-cta hero-cta--play tutorial-hero-cta"
            onClick={handleStart}
            onMouseEnter={preloadPlayPage}
            onFocus={preloadPlayPage}
            onTouchStart={preloadPlayPage}
            disabled={packsLoading}
          >
            {activePackHeroImage && (
              <span
                className="hero-cta-pack-photo"
                aria-hidden="true"
                style={{ backgroundImage: `url("${activePackHeroImage}")` }}
              />
            )}
            <span className="hero-cta-label">
              <span className="hero-cta-play-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              {t('common.start_game', {}, 'Jouer')}
            </span>
            <span className="hero-cta-meta">
              <span className="hero-cta-meta-chip" aria-label={`${t('configurator.pack_label', {}, 'Pack')} : ${activePackLabel}`}>
                <PackIcon packId={activePackId} className="hero-cta-pack-icon" />
                <span>{activePackLabel}</span>
              </span>
              {hasPlayedGame && (
                <span className="hero-cta-meta-chip" aria-label={`${t('home.play_pillar_title', {}, 'Mode')} : ${modeName}`}>
                  <span className="hero-chip-icon" aria-hidden="true"><TargetIcon /></span>
                  <span>{modeName}</span>
                </span>
              )}
              {hasPlayedGame && (
                <span className="hero-cta-meta-chip" aria-label={`${t('configurator.question_count_label', {}, 'Questions')} : ${qLabel}`}>
                  <span className="hero-chip-icon" aria-hidden="true"><QuestionIcon /></span>
                  <span>{qLabel}</span>
                </span>
              )}
              {hasPlayedGame && (
                <span className="hero-cta-meta-chip" aria-label={`${t('configurator.media_type_label', {}, 'Média')} : ${mediaName}`}>
                  <span className="hero-chip-icon" aria-hidden="true"><MediaIcon /></span>
                  <span>{mediaName}</span>
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            ref={advancedButtonRef}
            className={`hero-advanced-trigger tutorial-nav-settings ${advancedOpen ? 'open' : ''}`}
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-label={settingsLabel}
            aria-expanded={advancedOpen}
            aria-controls="home-advanced-settings-panel"
          >
            <SettingsIcon className="hero-advanced-trigger-icon" />
          </button>
          {advancedOpen && (
            <>
              <div
                className="home-advanced-backdrop"
                aria-hidden="true"
                onClick={() => setAdvancedOpen(false)}
              />
              <div
                id="home-advanced-settings-panel"
                ref={advancedPanelRef}
                className="home-advanced-popover"
                role="dialog"
                aria-modal="false"
                aria-label={settingsLabel}
              >
                <p className="home-advanced-popover-title">{settingsLabel}</p>
                <AdvancedSettings
                  open={advancedOpen}
                  onOpenChange={setAdvancedOpen}
                  showToggle={false}
                  className="home-advanced-settings-popover"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Pack progression bar */}
      {activePack?.taxa_ids?.length > 0 && (
        <PackProgressBar taxaIds={activePack.taxa_ids} />
      )}

      {/* Quick-action chips */}
      <div className="home-chips">
        <button
          type="button"
          className={`home-chip home-chip--daily ${dailyAlreadyCompleted ? 'done' : 'highlight'}`}
          onClick={handleDailyChallenge}
          onMouseEnter={preloadPlayPage}
          onFocus={preloadPlayPage}
          onTouchStart={preloadPlayPage}
          disabled={dailyAlreadyCompleted}
        >
          <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></svg></span>
          <span className="chip-text">
            {dailyAlreadyCompleted
              ? t('home.daily_done_short_text', {}, 'Défi terminé')
              : t('home.daily_chip', {}, 'Défi du jour')}
          </span>
        </button>

        {reviewStats?.dueToday > 0 && (
          <button
            type="button"
            className="home-chip home-chip--review highlight"
            onClick={handleStartReview}
            onMouseEnter={preloadPlayPage}
            onFocus={preloadPlayPage}
            onTouchStart={preloadPlayPage}
          >
            <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
            <span className="chip-text">{t('home.review_chip', {}, 'Révisions')}</span>
            <span className="chip-badge">{reviewStats.dueToday}</span>
          </button>
        )}
      </div>
    </section>
  );
}

export default memo(HeroZone);
