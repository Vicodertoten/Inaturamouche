import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoundSession,
  submitRoundAnswer,
  getAdaptiveQuestionTuning,
  getBalanceDashboardSnapshot,
  __resetRoundStoreForTests,
} from '../server/services/roundStore.js';

const makeAnswer = (id, iconicTaxonId = 1) => ({
  id: String(id),
  name: `Species ${id}`,
  preferred_common_name: `Species ${id}`,
  iconic_taxon_id: iconicTaxonId,
  ancestors: [],
});

async function completeEasyRound({
  clientId,
  correctTaxonId,
  selectedTaxonId,
  iconicTaxonId = 1,
  submissionId,
}) {
  const session = createRoundSession({
    clientId,
    gameMode: 'easy',
    correctTaxonId: String(correctTaxonId),
    correctAnswer: makeAnswer(correctTaxonId, iconicTaxonId),
    inaturalistUrl: `https://www.inaturalist.org/observations/${correctTaxonId}`,
    maxAttempts: 1,
  });

  return submitRoundAnswer({
    roundId: session.round_id,
    roundSignature: session.round_signature,
    clientId,
    roundAction: 'answer',
    selectedTaxonId: String(selectedTaxonId),
    submissionId,
  });
}

test('adaptive difficulty becomes harder after strong recent performance', async () => {
  __resetRoundStoreForTests();
  const clientId = 'adaptive-hard-client';

  for (let i = 0; i < 10; i += 1) {
    await completeEasyRound({
      clientId,
      correctTaxonId: 1000 + i,
      selectedTaxonId: 1000 + i,
      submissionId: `win-${i}`,
    });
  }

  const tuning = getAdaptiveQuestionTuning({ clientId, gameMode: 'easy' });
  assert.equal(tuning.sampleSize >= 5, true);
  assert.equal(tuning.difficultyBand, 'harder');
  assert.equal(tuning.lureClosenessDelta > 0, true);
  assert.equal(tuning.accuracyLastN >= 0.8, true);
});

test('adaptive difficulty becomes easier after poor recent performance', async () => {
  __resetRoundStoreForTests();
  const clientId = 'adaptive-easy-client';

  for (let i = 0; i < 10; i += 1) {
    await completeEasyRound({
      clientId,
      correctTaxonId: 2000 + i,
      selectedTaxonId: 999000 + i,
      submissionId: `lose-${i}`,
    });
  }

  const tuning = getAdaptiveQuestionTuning({ clientId, gameMode: 'easy' });
  assert.equal(tuning.sampleSize >= 5, true);
  assert.equal(tuning.difficultyBand, 'easier');
  assert.equal(tuning.lureClosenessDelta < 0, true);
  assert.equal(tuning.accuracyLastN <= 0.45, true);
});

test('adaptive rotation suggests dominant iconic taxon to cool down', async () => {
  __resetRoundStoreForTests();
  const clientId = 'rotation-client';

  for (let i = 0; i < 6; i += 1) {
    await completeEasyRound({
      clientId,
      correctTaxonId: 3000 + i,
      selectedTaxonId: 3000 + i,
      iconicTaxonId: 47126,
      submissionId: `iconic-${i}`,
    });
  }

  const tuning = getAdaptiveQuestionTuning({ clientId, gameMode: 'easy' });
  assert.equal(String(tuning.avoidIconicTaxonId), '47126');
});

test('balance dashboard aggregates round stats by mode', async () => {
  __resetRoundStoreForTests();
  const clientId = 'dashboard-client';

  await completeEasyRound({
    clientId,
    correctTaxonId: 4001,
    selectedTaxonId: 4001,
    iconicTaxonId: 1,
    submissionId: 'dash-win',
  });
  await completeEasyRound({
    clientId,
    correctTaxonId: 4002,
    selectedTaxonId: 94002,
    iconicTaxonId: 47126,
    submissionId: 'dash-lose',
  });

  const snapshot = getBalanceDashboardSnapshot();
  assert.equal(snapshot.total_rounds, 2);
  assert.ok(snapshot.by_mode.easy);
  assert.equal(snapshot.by_mode.easy.rounds, 2);
  assert.equal(snapshot.status_distribution.win >= 1, true);
  assert.equal(snapshot.status_distribution.lose >= 1, true);
});
