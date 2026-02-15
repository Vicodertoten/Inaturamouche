// src/state/gameMetaStore.js
// Zustand store replacing XPContext, StreakContext and AchievementContext.
import { create } from 'zustand';

// ── XP slice ───────────────────────────────────────────
const createXPSlice = (set) => ({
  recentXPGain: 0,
  initialSessionXP: 0,
  levelUpNotification: null,

  setRecentXPGain: (v) => set({ recentXPGain: v }),
  setInitialSessionXP: (v) => set({ initialSessionXP: v }),
  setLevelUpNotification: (v) => set({ levelUpNotification: v }),
});

// ── Streak slice ───────────────────────────────────────
const createStreakSlice = (set) => ({
  currentStreak: 0,
  longestStreak: 0,
  inGameShields: 0,
  hasPermanentShield: false,

  setCurrentStreak: (v) => set({ currentStreak: v }),
  setLongestStreak: (v) => set({ longestStreak: v }),
  setInGameShields: (v) =>
    set((state) => ({
      inGameShields: typeof v === 'function' ? v(state.inGameShields) : v,
    })),
  setHasPermanentShield: (v) => set({ hasPermanentShield: v }),
});

// ── Achievement slice ──────────────────────────────────
let _achievementsTimerId = null;

const createAchievementSlice = (set) => ({
  newlyUnlocked: [],

  setNewlyUnlocked: (v) => set({ newlyUnlocked: v }),

  clearAchievementsTimer: () => {
    if (_achievementsTimerId) {
      clearTimeout(_achievementsTimerId);
      _achievementsTimerId = null;
    }
  },

  clearUnlockedLater: () => {
    // clear any existing timer first
    if (_achievementsTimerId) {
      clearTimeout(_achievementsTimerId);
    }
    _achievementsTimerId = setTimeout(() => {
      set({ newlyUnlocked: [] });
      _achievementsTimerId = null;
    }, 5000);
  },
});

// ── Derived helper (backward-compat stub) ──────────────
/** @deprecated XP = score, no multipliers applied. Kept for callers that reference it. */
export function calculateXPMultipliers() {
  return { totalMultiplier: 1.0 };
}

// ── Combined store ─────────────────────────────────────
export const useGameMetaStore = create((...args) => ({
  ...createXPSlice(...args),
  ...createStreakSlice(...args),
  ...createAchievementSlice(...args),
}));
