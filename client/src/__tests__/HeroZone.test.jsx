import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeroZone from '../pages/home/HeroZone';

vi.mock('../components/PackIcons', () => ({
  default: () => <span data-testid="pack-icon" />,
}));

vi.mock('../components/PackProgressBar', () => ({
  default: () => <div data-testid="pack-progress" />,
}));

vi.mock('../components/NavigationIcons', () => ({
  SettingsIcon: () => <span data-testid="settings-icon" />,
}));

vi.mock('../components/AdvancedSettings', () => ({
  default: () => <div data-testid="advanced-settings" />,
}));

vi.mock('../pages/home/HomeIcons', () => ({
  ResumeIcon: () => <span />,
  TargetIcon: () => <span />,
  QuestionIcon: () => <span />,
  MediaIcon: () => <span />,
  CloseIcon: () => <span />,
}));

const defaultProps = {
  isResuming: false,
  resumeSessionData: { currentQuestionIndex: 0, gameConfig: { maxQuestions: 10 } },
  handleResumeGame: vi.fn(),
  handleAbandonSession: vi.fn(),
  handleStart: vi.fn(),
  packsLoading: false,
  activePackId: 'custom',
  activePackLabel: 'Pack personnalisé',
  activePackHeroImage: '',
  hasPlayedGame: true,
  modeName: 'Facile',
  qLabel: '10',
  mediaName: 'Images',
  preloadPlayPage: vi.fn(),
  startDisabled: false,
  advancedOpen: false,
  setAdvancedOpen: vi.fn(),
  advancedButtonRef: { current: null },
  advancedPanelRef: { current: null },
  settingsLabel: 'Paramètres',
  activePack: null,
  dailyAlreadyCompleted: false,
  handleDailyChallenge: vi.fn(),
  reviewStats: null,
  handleStartReview: vi.fn(),
  t: (_key, _values, fallback) => fallback,
};

describe('HeroZone', () => {
  it('disables the start CTA when startDisabled is true', () => {
    render(<HeroZone {...defaultProps} startDisabled />);

    expect(screen.getByRole('button', { name: /Jouer/ })).toBeDisabled();
  });
});
