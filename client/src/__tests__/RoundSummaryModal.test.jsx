import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RoundSummaryModal from '../components/RoundSummaryModal.jsx';

const fetchExplanationMock = vi.fn();
const trackMetricMock = vi.fn();

vi.mock('../shared/ui', () => ({
  BottomSheet: ({ children }) => <div>{children}</div>,
}));

vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    t: (_key, _params, fallback) => fallback || _key,
    getTaxonDisplayNames: (taxon) => ({
      primary: taxon.preferred_common_name || taxon.name,
      secondary: taxon.name,
    }),
  }),
}));

vi.mock('../context/UserContext.jsx', () => ({
  useUser: () => ({
    profile: {
      stats: {
        speciesMastery: {},
        missedSpecies: [],
      },
    },
  }),
}));

vi.mock('../context/GameContext.jsx', () => ({
  useGameData: () => ({
    activePackId: 'belgium_birds',
    gameMode: 'easy',
  }),
}));

vi.mock('../services/api', () => ({
  fetchExplanation: (...args) => fetchExplanationMock(...args),
  getTaxonDetails: vi.fn(async () => null),
}));

vi.mock('../services/metrics', () => ({
  trackMetric: (...args) => trackMetricMock(...args),
}));

const question = {
  round_id: 'round-1',
  bonne_reponse: {
    id: 1,
    name: 'Phalacrocorax carbo',
    preferred_common_name: 'Grand Cormoran',
    wikipedia_url: 'https://fr.wikipedia.org/wiki/Grand_Cormoran',
    url: 'https://www.inaturalist.org/taxa/1',
    default_photo: { url: 'https://example.com/cormorant.jpg' },
  },
};

const userAnswer = {
  id: 2,
  name: 'Anser erythropus',
  preferred_common_name: 'Oie naine',
  wikipedia_url: 'https://fr.wikipedia.org/wiki/Oie_naine',
  url: 'https://www.inaturalist.org/taxa/2',
  default_photo: { url: 'https://example.com/goose.jpg' },
};

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('RoundSummaryModal', () => {
  beforeEach(() => {
    fetchExplanationMock.mockReset();
    trackMetricMock.mockReset();
  });

  it('shows only attributed sources in the brief summary and source list', async () => {
    fetchExplanationMock.mockResolvedValueOnce({
      mode: 'brief',
      confidence: 'model_guided',
      fallback: false,
      brief: {
        displayText: 'Compare la silhouette droite et le bec crochu.',
        keyDifference: 'Silhouette droite et bec crochu',
        whyTempting: 'allure trapue proche au premier regard',
        nextLookFor: 'un long cou et un bec crochu',
        support: {
          level: 'model_guided',
          sourceIds: ['inat-desc-1'],
        },
        supportByField: {
          keyDifference: ['inat-desc-1'],
          whyTempting: [],
          nextLookFor: ['inat-desc-1'],
        },
      },
      sources: [
        {
          id: 'inat-desc-1',
          provider: 'inaturalist',
          kind: 'description',
          label: 'Grand Cormoran — iNaturalist',
          url: 'https://www.inaturalist.org/taxa/1',
          snippet: 'Silhouette droite, bec crochu, cou long.',
        },
        {
          id: 'gbif-tax-1',
          provider: 'gbif',
          kind: 'taxonomy',
          label: 'Grand Cormoran — GBIF',
          url: 'https://www.gbif.org/species/1',
          snippet: 'Même famille, genre différent.',
        },
      ],
    });

    render(
      <RoundSummaryModal
        status="lose"
        question={question}
        userAnswer={userAnswer}
        onNext={() => {}}
        explanationContext={{ correctId: 1, wrongId: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Compare la silhouette droite et le bec crochu.')).toBeInTheDocument();
    });

    expect(screen.getByText(/1 source/)).toBeInTheDocument();
    expect(screen.getByText(/iNaturalist/)).toBeInTheDocument();
    expect(screen.queryByText(/GBIF/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voir les sources/i }));

    expect(screen.getByText('Grand Cormoran — iNaturalist')).toBeInTheDocument();
    expect(screen.queryByText('Grand Cormoran — GBIF')).not.toBeInTheDocument();
  });

  it('shows the generic hint badge when the brief request fails', async () => {
    fetchExplanationMock.mockRejectedValueOnce(new Error('timeout'));

    render(
      <RoundSummaryModal
        status="lose"
        question={question}
        userAnswer={userAnswer}
        onNext={() => {}}
        explanationContext={{ correctId: 1, wrongId: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Conseil générique')).toBeInTheDocument();
    });

    expect(screen.getByText(/Le repere rapide n'est pas disponible/)).toBeInTheDocument();
  });

  it('keeps the brief confidence badge when the full explanation falls back', async () => {
    fetchExplanationMock
      .mockResolvedValueOnce({
        mode: 'brief',
        confidence: 'model_guided',
        fallback: false,
        trace_id: 'trace-brief',
        pair_key: 'round-1:1:2:brief',
        brief: {
          displayText: 'Compare la silhouette droite et le bec crochu.',
          keyDifference: 'Silhouette droite et bec crochu',
          whyTempting: 'allure trapue proche au premier regard',
          nextLookFor: 'un long cou et un bec crochu',
          support: {
            level: 'model_guided',
            sourceIds: ['inat-desc-1'],
          },
          supportByField: {
            keyDifference: ['inat-desc-1'],
            whyTempting: [],
            nextLookFor: ['inat-desc-1'],
          },
        },
        sources: [
          {
            id: 'inat-desc-1',
            provider: 'inaturalist',
            kind: 'description',
            label: 'Grand Cormoran — iNaturalist',
            url: 'https://www.inaturalist.org/taxa/1',
            snippet: 'Silhouette droite, bec crochu, cou long.',
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: 'full',
        confidence: 'fallback',
        fallback: true,
        trace_id: 'trace-full',
        pair_key: 'round-1:1:2:full',
        full: {
          explanation: '',
          visualClue: '',
          taxonomicRule: '',
          whyThisConfusionHappens: '',
          discriminant: '',
          support: { level: 'fallback', sourceIds: [] },
          supportByField: {
            explanation: [],
            visualClue: [],
            taxonomicRule: [],
            whyThisConfusionHappens: [],
            discriminant: [],
          },
        },
        sources: [],
      });

    render(
      <RoundSummaryModal
        status="lose"
        question={question}
        userAnswer={userAnswer}
        onNext={() => {}}
        explanationContext={{ correctId: 1, wrongId: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sources cohérentes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Comprendre en detail/i }));

    await waitFor(() => {
      expect(trackMetricMock).toHaveBeenCalledWith(
        'explanation_full_loaded',
        expect.objectContaining({
          confidence: 'fallback',
        })
      );
    });

    expect(screen.getByText('Sources cohérentes')).toBeInTheDocument();
  });

  it('ignores stale full responses from a previous round', async () => {
    const deferredFull = createDeferred();
    fetchExplanationMock
      .mockResolvedValueOnce({
        mode: 'brief',
        confidence: 'grounded',
        fallback: false,
        trace_id: 'trace-brief-1',
        pair_key: 'round-1:1:2:brief',
        brief: {
          displayText: 'Compare la silhouette droite et le bec crochu.',
          keyDifference: 'Silhouette droite et bec crochu',
          whyTempting: 'allure trapue proche au premier regard',
          nextLookFor: 'un long cou et un bec crochu',
          support: {
            level: 'grounded',
            sourceIds: ['inat-desc-1'],
          },
          supportByField: {
            keyDifference: ['inat-desc-1'],
            whyTempting: [],
            nextLookFor: ['inat-desc-1'],
          },
        },
        sources: [],
      })
      .mockImplementationOnce(() => deferredFull.promise)
      .mockResolvedValueOnce({
        mode: 'brief',
        confidence: 'grounded',
        fallback: false,
        trace_id: 'trace-brief-2',
        pair_key: 'round-2:3:4:brief',
        brief: {
          displayText: 'Compare la queue et la plaque frontale.',
          keyDifference: 'Queue courte et plaque frontale',
          whyTempting: 'contraste noir et blanc proche au premier regard',
          nextLookFor: 'une plaque frontale bien blanche',
          support: {
            level: 'grounded',
            sourceIds: ['inat-desc-3'],
          },
          supportByField: {
            keyDifference: ['inat-desc-3'],
            whyTempting: [],
            nextLookFor: ['inat-desc-3'],
          },
        },
        sources: [],
      });

    const { rerender } = render(
      <RoundSummaryModal
        status="lose"
        question={question}
        userAnswer={userAnswer}
        onNext={() => {}}
        explanationContext={{ correctId: 1, wrongId: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Compare la silhouette droite et le bec crochu.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Comprendre en detail/i }));

    const nextQuestion = {
      ...question,
      round_id: 'round-2',
      bonne_reponse: {
        ...question.bonne_reponse,
        id: 3,
        name: 'Fulica atra',
        preferred_common_name: 'Foulque macroule',
      },
    };
    const nextUserAnswer = {
      ...userAnswer,
      id: 4,
      name: 'Pica pica',
      preferred_common_name: 'Pie bavarde',
    };

    rerender(
      <RoundSummaryModal
        status="lose"
        question={nextQuestion}
        userAnswer={nextUserAnswer}
        onNext={() => {}}
        explanationContext={{ correctId: 3, wrongId: 4 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Compare la queue et la plaque frontale.')).toBeInTheDocument();
    });

    deferredFull.resolve({
      mode: 'full',
      confidence: 'grounded',
      fallback: false,
      trace_id: 'trace-full-stale',
      pair_key: 'round-1:1:2:full',
      full: {
        explanation: 'Ancienne explication stale.',
        visualClue: 'Ancien indice',
        taxonomicRule: 'Ancienne règle',
        whyThisConfusionHappens: 'Ancienne raison',
        discriminant: 'Ancien discriminant',
        support: { level: 'grounded', sourceIds: ['inat-desc-1'] },
        supportByField: {
          explanation: ['inat-desc-1'],
          visualClue: ['inat-desc-1'],
          taxonomicRule: [],
          whyThisConfusionHappens: ['inat-desc-1'],
          discriminant: ['inat-desc-1'],
        },
      },
      sources: [],
    });

    await waitFor(() => {
      expect(trackMetricMock).toHaveBeenCalledWith(
        'explanation_render_ignored_stale',
        expect.objectContaining({
          mode: 'full',
        })
      );
    });

    expect(screen.queryByText('Ancienne explication stale.')).not.toBeInTheDocument();
  });
});
