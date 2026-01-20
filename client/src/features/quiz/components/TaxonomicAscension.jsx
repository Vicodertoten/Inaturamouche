import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageViewer from '../../../components/ImageViewer';
import GameHeader from '../../../components/GameHeader';
import RoundSummaryModal from '../../../components/RoundSummaryModal';
import LevelUpNotification from '../../../components/LevelUpNotification';
import FloatingXPIndicator from '../../../components/FloatingXPIndicator';
import { useGameData } from '../../../context/GameContext';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { useUser } from '../../../context/UserContext';
import { computeInGameStreakBonus } from '../../../utils/scoring';
import { notify } from '../../../services/notifications';
import './TaxonomicAscension.css';

const SCORE_PER_RANK = {
  kingdom: 5,
  phylum: 10,
  class: 15,
  order: 20,
  family: 25,
  genus: 30,
  species: 40,
};

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
  } = useGameData();
  const ascension = question?.taxonomic_ascension;
  const steps = ascension?.steps || [];
  const maxMistakes = ascension?.max_mistakes ?? 2;
  const hintCost = ascension?.hint_cost_xp ?? 15;
  const { t } = useLanguage();
  const { profile, updateProfile } = useUser();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [stepHistory, setStepHistory] = useState([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [scoreInfo, setScoreInfo] = useState(null);
  const [selectedSpeciesOption, setSelectedSpeciesOption] = useState(null);
  const [lastSelectedOption, setLastSelectedOption] = useState(null);
  const [lossContext, setLossContext] = useState(null);
  const [liveXPGain, setLiveXPGain] = useState(0);
  const questionRef = useRef(question);

  useEffect(() => {
    questionRef.current = question;
    setCurrentStepIndex(0);
    setMistakes(0);
    setStepHistory(steps.map(() => ({ status: 'pending' })));
    setHintUsed(false);
    setHintCount(0);
    setSelectedSpeciesOption(null);
    setLastSelectedOption(null);
    setLossContext(null);
    setRoundStatus('playing');
    setScoreInfo(null);
    setLiveXPGain(0);
  }, [question, steps]);

  const isCurrentQuestion = questionRef.current === question;

  const computePointsFromHistory = useCallback((history) => (
    steps.reduce((sum, step, index) => {
      const status = history?.[index]?.status;
      if (status === 'correct') {
        return sum + (SCORE_PER_RANK[step.rank] || 0);
      }
      return sum;
    }, 0)
  ), [steps]);

  const finalizeRound = useCallback(({ status, points, finalMistakes } = {}) => {
    if (roundStatus !== 'playing') return;
    const mistakesCount = typeof finalMistakes === 'number' ? finalMistakes : mistakes;
    const didWin = status === 'win';
    const perfect = didWin && mistakesCount === 0 && !hintUsed;
    const streakBonus = perfect ? computeInGameStreakBonus(currentStreak, 'hard') : 0;
    setScoreInfo({
      points: typeof points === 'number' ? points : computePointsFromHistory(stepHistory),
      bonus: 0,
      streakBonus,
    });
    setRoundStatus(didWin ? 'win' : 'lose');
  }, [roundStatus, mistakes, hintUsed, currentStreak, computePointsFromHistory, stepHistory]);

  const advanceStep = useCallback(() => {
    setCurrentStepIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!steps.length && roundStatus === 'playing') {
      finalizeRound({ status: 'lose', points: 0, finalMistakes: mistakes });
    }
  }, [steps.length, roundStatus, finalizeRound, mistakes]);

  const currentStep = steps[currentStepIndex];

  const handleSelectOption = (option) => {
    if (roundStatus !== 'playing' || !currentStep) return;
    const wasCorrect = option.taxon_id === currentStep.correct_taxon_id;
    const nextHistory = [...stepHistory];
    nextHistory[currentStepIndex] = {
      ...(nextHistory[currentStepIndex] || {}),
      status: wasCorrect ? 'correct' : 'incorrect',
      selectedTaxonId: option.taxon_id,
      option,
    };
    setStepHistory(nextHistory);
    const nextMistakes = wasCorrect ? mistakes : mistakes + 1;
    if (!wasCorrect) setMistakes(nextMistakes);
    if (wasCorrect) {
      setLiveXPGain(SCORE_PER_RANK[currentStep.rank] || 0);
    } else {
      const correctOption = currentStep.options.find(
        (opt) => opt.taxon_id === currentStep.correct_taxon_id
      );
      setLossContext({
        correctId: String(correctOption?.taxon_id || currentStep.correct_taxon_id),
        wrongId: String(option.taxon_id),
        focusRank: t(`ranks.${currentStep.rank}`, currentStep.rank),
      });
    }
    setLastSelectedOption(option);
    if (currentStep.rank === 'species') {
      setSelectedSpeciesOption(option);
    }
    const earnedPoints = computePointsFromHistory(nextHistory);
    const outOfLives = nextMistakes >= maxMistakes;
    const isLastStep = currentStepIndex >= steps.length - 1;
    if (outOfLives) {
      finalizeRound({ status: 'lose', points: earnedPoints, finalMistakes: nextMistakes });
      return;
    }
    if (isLastStep) {
      finalizeRound({ status: 'win', points: earnedPoints, finalMistakes: nextMistakes });
      return;
    }
    advanceStep();
  };

  const handleHint = () => {
    if (roundStatus !== 'playing' || hintUsed || !currentStep) return;
    const userXP = profile?.xp || 0;
    if (userXP < hintCost) {
      notify(
        t('taxonomic.hint_locked', { cost: hintCost, current: userXP }, `XP insuffisant (${userXP}/${hintCost})`),
        { type: 'warning', duration: 3000 }
      );
      return;
    }
    setHintUsed(true);
    setHintCount((prev) => prev + 1);
    const nextMistakes = mistakes;
    updateProfile((prev) => ({
      ...prev,
      xp: Math.max(0, (prev?.xp || 0) - hintCost),
    }));
    const rankLabel = t(`ranks.${currentStep.rank}`, currentStep.rank);
    notify(
      t('taxonomic.hint_used', { rank: rankLabel, cost: hintCost }, `-${hintCost} XP`),
      { type: 'info', duration: 2000 }
    );
    const correctOption = currentStep.options.find(
      (opt) => opt.taxon_id === currentStep.correct_taxon_id
    );
    const nextHistory = [...stepHistory];
    nextHistory[currentStepIndex] = {
      ...(nextHistory[currentStepIndex] || {}),
      status: 'correct',
      selectedTaxonId: String(currentStep.correct_taxon_id),
      option: correctOption,
    };
    setStepHistory(nextHistory);
    setLiveXPGain(SCORE_PER_RANK[currentStep.rank] || 0);
    setLastSelectedOption(correctOption || null);
    if (currentStep.rank === 'species' && correctOption) {
      setSelectedSpeciesOption(correctOption);
    }
    const earnedPoints = computePointsFromHistory(nextHistory);
    const isLastStep = currentStepIndex >= steps.length - 1;
    if (isLastStep) {
      finalizeRound({ status: 'win', points: earnedPoints, finalMistakes: nextMistakes });
      return;
    }
    advanceStep();
  };

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
      },
    });
  }, [scoreInfo, roundStatus, completeRound, hintUsed, hintCount, mistakes, steps.length]);

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
          inGameShields={inGameShields}
          hasPermanentShield={hasPermanentShield}
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

  const canUseHint = !hintUsed && mistakes < maxMistakes && roundStatus === 'playing';
  const hintButtonLabel = t('taxonomic.hint_button', { cost: hintCost });
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
          question={question}
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
            inGameShields={inGameShields}
            hasPermanentShield={hasPermanentShield}
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
                    const isSelected = history?.selectedTaxonId === option.taxon_id;
                    const isCorrectOption = option.taxon_id === currentStep.correct_taxon_id;
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
                        disabled={roundStatus !== 'playing'}
                      >
                        <span className="taxonomic-option-title">
                          {option.preferred_common_name || option.name}
                        </span>
                        {option.preferred_common_name && option.name !== option.preferred_common_name && (
                          <span className="taxonomic-option-scientific">{option.name}</span>
                        )}
                        <span className="taxonomic-option-rank">{t(`ranks.${option.rank}`)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="taxonomic-footer">
                  <button
                    type="button"
                    className="taxonomic-hint-button"
                    onClick={handleHint}
                    disabled={!canUseHint}
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
