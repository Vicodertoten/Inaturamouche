import { createContext, useContext, useState, useCallback } from 'react';

const STREAK_PERKS = [
  {
    tier: 1,
    threshold: 3,
    rewards: [
      {
        type: 'multiplier',
        value: 1.2,
        rounds: 2,
        persistOnMiss: false,
      },
    ],
  },
  {
    tier: 2,
    threshold: 5,
    rewards: [
      {
        type: 'multiplier',
        value: 1.5,
        rounds: 3,
        persistOnMiss: false,
      },
    ],
  },
];

const generatePerkId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const mintPerkRewards = (config) => {
  if (!config?.rewards) return [];
  const minted = [];
  config.rewards.forEach((reward, rewardIndex) => {
    if (reward.type === 'multiplier') {
      minted.push({
        id: generatePerkId(`multiplier-${config.tier}-${rewardIndex}`),
        type: 'multiplier',
        persistOnMiss: reward.persistOnMiss ?? false,
        value: reward.value || 1.2,
        roundsRemaining: reward.rounds || 2,
      });
    }
  });
  return minted;
};

const computeMultiplierFromPerks = (perks = []) =>
  perks
    .filter((perk) => perk.type === 'multiplier' && (perk.roundsRemaining ?? 0) > 0)
    .reduce((acc, perk) => acc * (perk.value || 1), 1);

const StreakContext = createContext(null);

export function StreakProvider({ children }) {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [inGameShields, setInGameShields] = useState(0);
  const [hasPermanentShield, setHasPermanentShield] = useState(false);
  const [streakTier, setStreakTier] = useState(0);
  const [activePerks, setActivePerks] = useState([]);

  const evaluatePerksForStreak = useCallback(
    (streakValue) => {
      let tierReached = streakTier;
      const minted = [];
      STREAK_PERKS.forEach((config) => {
        if (streakValue >= config.threshold && config.tier > tierReached) {
          minted.push(...mintPerkRewards(config));
          tierReached = config.tier;
        }
      });
      return { tierReached, minted };
    },
    [streakTier]
  );

  return (
    <StreakContext.Provider
      value={{
        currentStreak,
        setCurrentStreak,
        longestStreak,
        setLongestStreak,
        inGameShields,
        setInGameShields,
        hasPermanentShield,
        setHasPermanentShield,
        streakTier,
        setStreakTier,
        activePerks,
        setActivePerks,
        computeMultiplierFromPerks,
        evaluatePerksForStreak,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within a StreakProvider');
  return ctx;
}
