import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageViewer from '../../../components/ImageViewer';
import GameHeader from '../../../components/GameHeader';
import RoundSummaryModal from '../../../components/RoundSummaryModal';
import LevelUpNotification from '../../../components/LevelUpNotification';
import FloatingXPIndicator from '../../../components/FloatingXPIndicator';
import { useGameData } from '../../../context/GameContext';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { computeInGameStreakBonus } from '../../../utils/scoring';
import { notify } from '../../../services/notifications';
import { submitQuizAnswer } from '../../../services/api';
import { SCORE_PER_RANK } from '../../../utils/scoring';
import './TaxonomicAscension.css';

const getRankPrompt = (t, rank) => {
  const defaultLabel = t(`ranks.${rank}`, rank);
  const specific = t(`taxonomic.prompts.${rank}`);
  if (specific && specific !== `taxonomic.prompts.${rank}`) return specific;
  return t('taxonomic.prompt_generic', { rank: defaultLabel });
};

const buildUserAnswerPayload = (option) => {
  if (!option) return null;
  return {
    id: Number(option.taxon_id) || option.taxon_id,
    taxon_id: option.taxon_id,
    name: option.name,
    preferred_common_name: option.preferred_common_name || null,
  };
};

function TaxonomicAscension() {
  const {
    question,
    questionCount,
    maxQuestions,
    currentStreak,
    inGameShields,
    hasPermanentShield,
    nextImageUrl,
    levelUpNotification,
    completeRound,
    endGame,
    dailySeedSession,
  } = useGameData();
  const ascension = question?.taxonomic_ascension;
  const steps = useMemo(() => ascension?.steps ?? [], [ascension?.steps]);
  const maxMistakes = ascension?.max_mistakes ?? 2;
  const maxHints = ascension?.max_hints ?? 1;
  const hintPenaltyPercent = ascension?.hint_cost_xp ?? 15;
  const { t, nameFormat } = useLanguage();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [stepHistory, setStepHistory] = useState([]);
  const [hintCount, setHintCount] = useState(0);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [scoreInfo, setScoreInfo] = useState(null);
  const [selectedSpeciesOption, setSelectedSpeciesOption] = useState(null);
  const [lastSelectedOption, setLastSelectedOption] = useState(null);
  const [lossContext, setLossContext] = useState(null);
  const [liveXPGain, setLiveXPGain] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const questionRef = useRef(question);

  useEffect(() => {
    questionRef.current = question;
    setCurrentStepIndex(0);
    setMistakes(0);
    setStepHistory(steps.map(() => ({ status: 'pending', selectedTaxonId: null, correctTaxonId: null })));
    setHintCount(0);
    setSelectedSpeciesOption(null);
    setLastSelectedOption(null);
    setLossContext(null);
    setRoundStatus('playing');
    setScoreInfo(null);
    setLiveXPGain(0);
    setValidationResult(null);
    setIsSubmitting(false);
  }, [question, steps]);

  const isCurrentQuestion = questionRef.current === question;
  const hintUsed = hintCount > 0;

  const currentStep = steps[currentStepIndex];

  const finalizeFromServer = useCallback((result, statePayload) => {
    const didWin = result?.status === 'win';
    const points = Math.max(0, Number(statePayload?.points_earned || 0));
    const mistakesCount = Math.max(0, Number(statePayload?.mistakes || 0));
    const perfect = didWin && mistakesCount === 0;
    const streakBonus = perfect ? computeInGameStreakBonus(currentStreak, 'hard') : 0;
    setScoreInfo({
      points,
      bonus: 0,
      streakBonus,
    });
    setRoundStatus(didWin ? 'win' : 'lose');
  }, [currentStreak]);

  const applyTaxonomicState = useCallback((result, fallbackOption = null, { viaHint = false } = {}) => {
    const statePayload = result?.taxonomic_state || {};
    const answeredStepIndex = Number.isInteger(statePayload.answered_step_index)
      ? statePayload.answered_step_index
      : null;
    const stepWasCorrect = statePayload.step_was_correct === true;
    const stepCorrectTaxonId = statePayload.step_correct_taxon_id ? String(statePayload.step_correct_taxon_id) : null;
    const selectedTaxonId = statePayload.selected_taxon_id ? String(statePayload.selected_taxon_id) : null;

    if (Number.isInteger(answeredStepIndex) && steps[answeredStepIndex]) {
      const step = steps[answeredStepIndex];
      const optionFromStep = step.options.find((opt) => String(opt.taxon_id) === String(selectedTaxonId));
      const selectedOption = fallbackOption || optionFromStep || null;

      setStepHistory((prev) => {
        const next = [...prev];
        next[answeredStepIndex] = {
          ...(next[answeredStepIndex] || {}),
          status: stepWasCorrect ? 'correct' : 'incorrect',
          selectedTaxonId,
          correctTaxonId: stepCorrectTaxonId,
          option: selectedOption,
          viaHint,
        };
        return next;
      });

      if (stepWasCorrect) {
        setLiveXPGain(SCORE_PER_RANK[step.rank] || 0);
      } else if (selectedOption) {
        setLossContext({
          correctId: stepCorrectTaxonId,
          wrongId: String(selectedOption.taxon_id),
          focusRank: t(`ranks.${step.rank}`, step.rank),
        });
      }

      if (selectedOption) {
        setLastSelectedOption(selectedOption);
      }
      if (step.rank === 'species' && selectedOption) {
        setSelectedSpeciesOption(selectedOption);
      }
    }

    if (Number.isFinite(Number(statePayload.mistakes))) {
      setMistakes(Math.max(0, Number(statePayload.mistakes)));
    }
    if (Number.isFinite(Number(statePayload.current_step_index))) {
      setCurrentStepIndex(Math.max(0, Number(statePayload.current_step_index)));
    }
    const nextHintCount = Math.max(0, Number.parseInt(String(statePayload.hint_count || 0), 10) || 0);
    setHintCount(nextHintCount);

    return statePayload;
  }, [steps, t]);

  const handleSelectOption = useCallback(async (option) => {
    if (roundStatus !== 'playing' || !currentStep || isSubmitting) return;
    if (!question?.round_id || !question?.round_signature) return;

    setIsSubmitting(true);
    try {
      const result = await submitQuizAnswer({
        roundId: question.round_id,
        roundSignature: question.round_signature,
        selectedTaxonId: option.taxon_id,
        roundAction: 'taxonomic_select',
        stepIndex: currentStepIndex,
        seedSession: dailySeedSession,
      });
      if (questionRef.current !== question) return;

      setValidationResult(result);
      const statePayload = applyTaxonomicState(result, option, { viaHint: false });

      if (result?.round_consumed || result?.status === 'win' || result?.status === 'lose') {
        finalizeFromServer(result, statePayload);
      }
    } catch (error) {
      if (error?.code === 'ROUND_EXPIRED') {
        notify(t('errors.round_expired', {}, 'Question expirée, passage à la suivante…'), { type: 'warning' });
        completeRound({ points: 0, bonus: 0, streakBonus: 0, isCorrect: false, roundMeta: { mode: 'taxonomic', wasCorrect: false, serverValidated: false, skippedExpired: true } });
        return;
      }
      notify(error?.message || t('errors.generic'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    applyTaxonomicState,
    completeRound,
    currentStep,
    currentStepIndex,
    finalizeFromServer,
    isSubmitting,
    question,
    roundStatus,
    t,
  ]);

  const handleHint = useCallback(async () => {
    if (roundStatus !== 'playing' || hintUsed || !currentStep || isSubmitting) return;
    if (!question?.round_id || !question?.round_signature) return;

    setIsSubmitting(true);
    try {
      const rankLabel = t(`ranks.${currentStep.rank}`, currentStep.rank);
      notify(
        t('taxonomic.hint_used', { rank: rankLabel, cost: hintPenaltyPercent }, `-${hintPenaltyPercent}% XP`),
        { type: 'info', duration: 2000 }
      );

      const result = await submitQuizAnswer({
        roundId: question.round_id,
        roundSignature: question.round_signature,
        roundAction: 'taxonomic_hint',
        stepIndex: currentStepIndex,
        seedSession: dailySeedSession,
      });
      if (questionRef.current !== question) return;

      setValidationResult(result);
      const hintedOption = currentStep.options.find(
        (opt) => String(opt.taxon_id) === String(result?.taxonomic_state?.step_correct_taxon_id || '')
      );
      const statePayload = applyTaxonomicState(result, hintedOption || null, { viaHint: true });

      if (result?.round_consumed || result?.status === 'win' || result?.status === 'lose') {
        finalizeFromServer(result, statePayload);
      }
    } catch (error) {
      if (error?.code === 'ROUND_EXPIRED') {
        notify(t('errors.round_expired', {}, 'Question expirée, passage à la suivante…'), { type: 'warning' });
        completeRound({ points: 0, bonus: 0, streakBonus: 0, isCorrect: false, roundMeta: { mode: 'taxonomic', wasCorrect: false, serverValidated: false, skippedExpired: true } });
        return;
      }
      notify(error?.message || t('errors.generic'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    applyTaxonomicState,
    completeRound,
    currentStep,
    currentStepIndex,
    finalizeFromServer,
    hintPenaltyPercent,
    hintUsed,
    isSubmitting,
    question,
    roundStatus,
    t,
  ]);

  const resolvedQuestion = useMemo(() => {
    if (!question || !validationResult?.correct_answer) return question;
    return {
      ...question,
      bonne_reponse: validationResult.correct_answer,
      inaturalist_url: validationResult.inaturalist_url || question.inaturalist_url || null,
    };
  }, [question, validationResult]);

  const handleNext = useCallback(() => {
    if (!scoreInfo) return;
    completeRound({
      ...scoreInfo,
      isCorrect: roundStatus === 'win',
      roundMeta: {
        mode: 'taxonomic',
        wasCorrect: roundStatus === 'win',
        hintsUsed: hintUsed,
        hintCount,
        mistakes,
        stepsCompleted: steps.length,
        serverValidated: true,
      },
      resolvedQuestion,
      validationResult,
    });
  }, [
    scoreInfo,
    completeRound,
    roundStatus,
    hintUsed,
    hintCount,
    mistakes,
    steps.length,
    resolvedQuestion,
    validationResult,
  ]);

  const mistakesLabel = t('taxonomic.mistakes', {
    count: mistakes,
    max: maxMistakes,
  });
  const userAnswer = useMemo(
    () => buildUserAnswerPayload(selectedSpeciesOption || lastSelectedOption),
    [selectedSpeciesOption, lastSelectedOption]
  );

  const progressPills = steps.map((step, index) => {
    const history = stepHistory[index];
    const status = history?.status;
    const xpGain = status === 'correct' ? SCORE_PER_RANK[step.rank] || 0 : 0;
    return (
      <span
        key={step.rank + index}
        className={`taxonomic-progress-pill ${status || 'pending'}`}
        aria-label={`${t(`ranks.${step.rank}`)} ${status || 'en attente'}`}
      >
        {xpGain > 0 && (
          <span className="taxonomic-progress-xp" aria-live="polite">
            +{xpGain} XP
          </span>
        )}
      </span>
    );
  });

  const currentPrompt = currentStep
    ? getRankPrompt(t, currentStep.rank)
    : t('taxonomic.prompt_generic', { rank: t('taxonomic.no_rank', 'rang') });

  const guessesLabel = Math.max(maxMistakes - mistakes, 0);

  if (!steps.length) {
    return (
      <div className="screen game-screen taxonomic-mode">
        <GameHeader
          mode="hard"
          currentStreak={currentStreak}
          questionCount={questionCount}
          maxQuestions={maxQuestions}
          guesses={guessesLabel}
          onQuit={endGame}
          isGameOver={roundStatus !== 'playing'}
        />
        <div className="taxonomic-empty">
          {t('taxonomic.empty', 'Aucune étape disponible pour ce rang.')}
        </div>
      </div>
    );
  }

  const canUseHint = !hintUsed && hintCount < maxHints && mistakes < maxMistakes && roundStatus === 'playing';
  const hintButtonLabel = t('taxonomic.hint_button', { cost: hintPenaltyPercent });
  const parentInfo = currentStep?.parent
    ? `${t('taxonomic.parent_label')} ${currentStep.parent.name} (${t(
        `ranks.${currentStep.parent.rank}`,
        currentStep.parent.rank
      )})`
    : null;

  return (
    <>
      {levelUpNotification && (
        <LevelUpNotification
          oldLevel={levelUpNotification.oldLevel}
          newLevel={levelUpNotification.newLevel}
          onClose={() => {}}
        />
      )}
      <FloatingXPIndicator xpGain={liveXPGain} position="center" />
      {roundStatus !== 'playing' && isCurrentQuestion && scoreInfo && (
        <RoundSummaryModal
          status={roundStatus}
          question={resolvedQuestion}
          scoreInfo={scoreInfo}
          onNext={handleNext}
          userAnswer={userAnswer}
          explanationContext={roundStatus === 'lose' ? lossContext : null}
        />
      )}
      <div className="screen game-screen taxonomic-mode">
        <div className="taxonomic-mode-wrapper">
          <GameHeader
            mode="hard"
            currentStreak={currentStreak}
            questionCount={questionCount}
            maxQuestions={maxQuestions}
            guesses={guessesLabel}
            onQuit={endGame}
            isGameOver={roundStatus !== 'playing'}
          />
          <div className="taxonomic-main">
            <div className="taxonomic-image-panel">
              <ImageViewer
                imageUrls={question?.image_urls || []}
                photoMeta={question?.image_meta || []}
                alt={t('imageViewer.meta_unknown')}
                nextImageUrl={nextImageUrl}
              />
            </div>
            <div className="taxonomic-play-panel">
              <div className="taxonomic-intro">
                <p className="taxonomic-intro-text">{t('taxonomic.instructions')}</p>
                <div className="taxonomic-progress">{progressPills}</div>
              </div>
              <div className="taxonomic-step-card">
                <div className="taxonomic-step-header">
                  <div>
                    <p className="taxonomic-step-label">{t('taxonomic.focus_label')}</p>
                    <strong>{currentPrompt}</strong>
                  </div>
                  {parentInfo && <span className="taxonomic-parent">{parentInfo}</span>}
                </div>
                <div className="taxonomic-option-grid">
                  {currentStep.options.map((option) => {
                    const history = stepHistory[currentStepIndex];
                    const isSelected = history?.selectedTaxonId === String(option.taxon_id);
                    const isCorrectOption =
                      history?.correctTaxonId && String(option.taxon_id) === String(history.correctTaxonId);
                    const classNames = ['taxonomic-option'];
                    if (isSelected) {
                      classNames.push(history?.status === 'correct' ? 'correct' : 'incorrect');
                    } else if (history?.status === 'incorrect' && isCorrectOption) {
                      classNames.push('correct');
                    }
                    return (
                      <button
                        key={option.taxon_id}
                        type="button"
                        className={classNames.join(' ')}
                        onClick={() => handleSelectOption(option)}
                        disabled={roundStatus !== 'playing' || isSubmitting}
                      >
                        <span className="taxonomic-option-title">
                          {nameFormat === 'scientific' ? option.name : (option.preferred_common_name || option.name)}
                        </span>
                        {nameFormat !== 'scientific' && option.preferred_common_name && (
                          <span className="taxonomic-option-scientific">{option.name}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="taxonomic-step-footer">
                  <button
                    type="button"
                    className="taxonomic-hint-button"
                    onClick={handleHint}
                    disabled={!canUseHint || isSubmitting}
                  >
                    {hintButtonLabel}
                  </button>
                  <span className="taxonomic-mistakes">{mistakesLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TaxonomicAscension;
