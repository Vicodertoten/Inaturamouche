import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CollectionPage from './CollectionPage';
import { UserProvider } from '../context/UserContext';
import CollectionService from '../services/CollectionService';

// Mock CollectionService
vi.mock('../services/CollectionService', () => ({
  default: {
    getIconicSummary: vi.fn(),
    getSpeciesPage: vi.fn(),
    onCollectionUpdated: vi.fn(() => () => {}),
  },
}));

// Mock router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render iconic taxa grid on load', async () => {
    CollectionService.getIconicSummary.mockResolvedValue({
      3: { seenCount: 5, masteredCount: 2, progressPercent: 50 },
      40151: { seenCount: 3, masteredCount: 1, progressPercent: 30 },
    });

    render(
      <UserProvider>
        <CollectionPage />
      </UserProvider>
    );

    // Wait for the component to load
    expect(screen.getByText(/Living Atlas/i)).toBeInTheDocument();
  });

  it('should display iconic taxon cards', async () => {
    CollectionService.getIconicSummary.mockResolvedValue({
      3: { seenCount: 5, masteredCount: 2, progressPercent: 50 },
    });

    const { container } = render(
      <UserProvider>
        <CollectionPage />
      </UserProvider>
    );

    // IconicTaxaGrid should render cards
    const cards = container.querySelectorAll('.iconic-taxon-card');
    expect(cards.length).toBeGreaterThan(0);
  });
});
