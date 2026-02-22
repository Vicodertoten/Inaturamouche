import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoundSession,
  submitRoundAnswer,
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

test('round store reset clears balance dashboard events', async () => {
  __resetRoundStoreForTests();
  const clientId = 'dashboard-reset-client';

  await completeEasyRound({
    clientId,
    correctTaxonId: 5001,
    selectedTaxonId: 5001,
    submissionId: 'reset-win',
  });

  let snapshot = getBalanceDashboardSnapshot();
  assert.equal(snapshot.total_rounds, 1);

  __resetRoundStoreForTests();
  snapshot = getBalanceDashboardSnapshot();
  assert.equal(snapshot.total_rounds, 0);
});
