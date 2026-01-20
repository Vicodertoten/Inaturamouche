import { useState } from 'react';

export function useGameSessionState() {
  const [isGameActive, setIsGameActive] = useState(false);
  const [isStartingNewGame, setIsStartingNewGame] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [question, setQuestion] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [score, setScore] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correctAnswers: 0 });
  const [sessionCorrectSpecies, setSessionCorrectSpecies] = useState([]);
  const [sessionSpeciesData, setSessionSpeciesData] = useState([]);
  const [sessionMissedSpecies, setSessionMissedSpecies] = useState([]);
  const [rarityCelebration, setRarityCelebration] = useState(null);

  return {
    isGameActive,
    setIsGameActive,
    isStartingNewGame,
    setIsStartingNewGame,
    isGameOver,
    setIsGameOver,
    question,
    setQuestion,
    nextQuestion,
    setNextQuestion,
    loading,
    setLoading,
    error,
    setError,
    questionCount,
    setQuestionCount,
    score,
    setScore,
    sessionStats,
    setSessionStats,
    sessionCorrectSpecies,
    setSessionCorrectSpecies,
    sessionSpeciesData,
    setSessionSpeciesData,
    sessionMissedSpecies,
    setSessionMissedSpecies,
    rarityCelebration,
    setRarityCelebration,
  };
}
