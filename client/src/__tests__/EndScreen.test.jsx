import React from 'react';
import { render, screen } from '@testing-library/react';
import EndScreen from '../components/EndScreen.jsx';

vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ t: (k) => k, getTaxonDisplayNames: (s) => ({ primary: s.name, secondary: s.name })) }),
});

vi.mock('../context/GameContext.jsx', () => ({
  useGameData: () => ({ initialSessionXP: 100 }),
}));

vi.mock('../services/notifications', () => ({
  notify: () => {},
}));

describe('EndScreen', () => {
  it('shows XP gained and action buttons', () => {
    const profile = { xp: 150, stats: { speciesMastery: { 1: { correct: 1 } } } };
    const species = [{ id: 1, name: 'Specie A', inaturalist_url: '', wikipedia_url: '' }];

    render(
      <EndScreen
        score={10}
        sessionCorrectSpecies={[1]}
        sessionSpeciesData={species}
        newlyUnlocked={[]}
        sessionRewards={[]}
        onRestart={() => {}}
        onReturnHome={() => {}}
        profile={profile}
      />
    );

    // XP gained display
    expect(screen.getByText('+50 XP')).toBeInTheDocument();

    // Action buttons show keys from i18n mock
    expect(screen.getByText('common.replay')).toBeInTheDocument();
    expect(screen.getByText('common.home')).toBeInTheDocument();
  });
});
