import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let originalFetch;
let app;
let serverAvailable = true;

const SOCKET_SKIP_REASON = 'Socket binding not permitted in this environment';

async function listenOnEphemeralPort(instance) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err?.code === 'EPERM' || err?.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(err);
    };
    instance.once('error', onError);
    instance.listen(0, '127.0.0.1', () => {
      instance.removeListener('error', onError);
      resolve(true);
    });
  });
}

const DEFAULT_TAXON_IDS = [101, 102, 103, 104];
const ICONIC_LURE_TAXON_IDS = [201, 202, 203, 204];
const ICONIC_NAME_TO_ID = {
  Animalia: 1,
  Plantae: 47126,
  Fungi: 47119,
  Insecta: 47158,
  Aves: 3,
  Mammalia: 40151,
  Reptilia: 26036,
  Amphibia: 20978,
  Mollusca: 47178,
  Arachnida: 47686,
};

const buildObservationResults = (taxonIds = DEFAULT_TAXON_IDS, { iconicTaxonId = 1 } = {}) =>
  taxonIds.map((id) => ({
    id: Number(id) * 100,
    uri: `https://www.inaturalist.org/observations/${id}`,
    observed_on_details: { month: 6, day: 15 },
    taxon: {
      id: Number(id),
      name: `Species ${id}`,
      preferred_common_name: `Species ${id}`,
      rank: 'species',
      iconic_taxon_id: iconicTaxonId,
      ancestor_ids: [iconicTaxonId, Number(id)],
    },
    photos: [{ id: Number(id) * 10, url: 'https://example.com/photo.jpg' }],
  }));

const buildMockAncestors = (id) => {
  const numericId = Number(id) || 0;
  const genusId = 5000 + Math.floor(numericId / 10);
  return [
    { id: 1, name: 'Animalia', preferred_common_name: 'Animaux', rank: 'kingdom' },
    { id: 10, name: 'Chordata', preferred_common_name: 'Chordes', rank: 'phylum' },
    { id: 20, name: 'Aves', preferred_common_name: 'Oiseaux', rank: 'class' },
    { id: 30, name: 'Passeriformes', preferred_common_name: 'Passereaux', rank: 'order' },
    { id: 40, name: 'Passeridae', preferred_common_name: 'Passereaux', rank: 'family' },
    { id: genusId, name: `Genus ${genusId}`, preferred_common_name: `Genre ${genusId}`, rank: 'genus' },
  ];
};

const createInatFetchMock = ({ expectedLocale } = {}) => async (url, opts) => {
  if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);

  if (String(url).includes('/observations')) {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    const iconicTaxa = params.get('iconic_taxa');
    if (expectedLocale && params.has('locale')) {
      const locale = params.get('locale');
      assert.equal(locale, expectedLocale);
    }
    if (iconicTaxa) {
      const iconicTaxonId = ICONIC_NAME_TO_ID[iconicTaxa] || 1;
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          total_results: 100,
          results: buildObservationResults(ICONIC_LURE_TAXON_IDS, { iconicTaxonId }),
        }),
      };
    }
    const rawTaxonIds = params.get('taxon_id');
    const taxonIds = rawTaxonIds
      ? rawTaxonIds
          .split(',')
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : DEFAULT_TAXON_IDS;
    const iconicTaxonId = taxonIds.includes(47126) ? 47126 : 1;
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: buildObservationResults(taxonIds, { iconicTaxonId }),
      }),
    };
  }

  if (String(url).includes('/taxa/')) {
    const urlObj = new URL(url);
    const idsSegment = urlObj.pathname.split('/taxa/')[1] || '';
    const ids = idsSegment.split(',').filter(Boolean);
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        results: ids.map((id) => ({
          id: Number(id),
          name: `Species ${id}`,
          preferred_common_name: `Species ${id}`,
          rank: 'species',
          ancestors: buildMockAncestors(id),
          ancestor_ids: [1, 10, 20, 30, 40, 5000 + Math.floor((Number(id) || 0) / 10), Number(id)],
          observations_count: 100,
        })),
      }),
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
};

test.before(async () => {
  ({ app } = createApp());
  server = http.createServer(app);
  serverAvailable = await listenOnEphemeralPort(server);
  if (!serverAvailable) return;
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
  originalFetch = globalThis.fetch;
});

test.after(async () => {
  if (serverAvailable && server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

function integrationTest(name, fn) {
  test(name, async (t) => {
    if (!serverAvailable) {
      t.skip(SOCKET_SKIP_REASON);
      return;
    }
    await fn(t);
  });
}

integrationTest('GET /api/quiz-question accepts default params and returns 200', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=easy`
  );
  assert.equal(res.status, 200);
});

integrationTest('GET /api/quiz-question returns 400 BAD_REQUEST with invalid pack_id', async () => {
  const res = await fetch(`${baseUrl}/api/quiz-question?pack_id=invalid-pack-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'UNKNOWN_PACK');
  assert.equal(body.error.message, 'Unknown pack');
});

integrationTest('GET /api/quiz-question keeps pack_id compatibility for existing packs', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?pack_id=world_birds&locale=fr`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.choices));
  assert.ok(typeof body.round_id === 'string');
});

integrationTest('GET /api/quiz-question accepts valid taxon_ids parameter', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=fr`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body && typeof body === 'object');
  assert.ok(Array.isArray(body.choices));
  assert.ok(typeof body.round_id === 'string');
  assert.ok(typeof body.round_signature === 'string');
});

integrationTest('GET /api/quiz-question accepts locale parameter', async () => {
  globalThis.fetch = createInatFetchMock({ expectedLocale: 'en' });

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=en`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/quiz-question handles seed parameter for deterministic results', async () => {
  globalThis.fetch = createInatFetchMock();

  const res1 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res1.status, 200);
  
  const res2 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res2.status, 200);
});

integrationTest('GET /api/quiz-question accepts place_id parameter', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?place_id=6753&taxon_ids=47126`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/quiz-question accepts date range parameters', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&d1=2024-01-01&d2=2024-12-31`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/quiz-question returns 503 POOL_UNAVAILABLE when no observations available', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 0,
        results: []
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=999999999`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'POOL_UNAVAILABLE');
});

integrationTest('GET /api/quiz-question handles bounding box parameters', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&nelat=50&nelng=5&swlat=49&swlng=4`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/quiz-question (easy) returns signed round metadata without exposing answer fields', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=easy&client_session_id=test-client-easy`
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(typeof body.round_id === 'string' && body.round_id.length >= 8);
  assert.ok(typeof body.round_signature === 'string' && body.round_signature.length >= 32);
  assert.equal(body.bonne_reponse, undefined);
  assert.equal(body.correct_choice_index, undefined);
  assert.equal(body.correct_label, undefined);
});

integrationTest('POST /api/quiz/submit validates answer server-side and deduplicates identical submission_id', async () => {
  globalThis.fetch = createInatFetchMock();
  const clientSessionId = 'test-client-submit';

  const questionRes = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=easy&client_session_id=${clientSessionId}`
  );
  assert.equal(questionRes.status, 200);
  const question = await questionRes.json();
  const selectedTaxonId = question?.choices?.[0]?.taxon_id;
  assert.ok(selectedTaxonId);

  const payload = {
    round_id: question.round_id,
    round_signature: question.round_signature,
    selected_taxon_id: selectedTaxonId,
    submission_id: 'same-submission-id',
    client_session_id: clientSessionId,
  };

  const submitRes1 = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(submitRes1.status, 200);
  const body1 = await submitRes1.json();
  assert.ok(body1.status === 'win' || body1.status === 'lose');
  assert.equal(typeof body1.is_correct, 'boolean');
  assert.equal(body1.round_consumed, true);
  assert.ok(body1.correct_answer);

  const submitRes2 = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(submitRes2.status, 200);
  const body2 = await submitRes2.json();
  assert.deepEqual(body2, body1);
});

integrationTest('POST /api/quiz/submit rejects tampered round signature', async () => {
  globalThis.fetch = createInatFetchMock();
  const clientSessionId = 'test-client-signature';

  const questionRes = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=easy&client_session_id=${clientSessionId}`
  );
  assert.equal(questionRes.status, 200);
  const question = await questionRes.json();
  const selectedTaxonId = question?.choices?.[0]?.taxon_id;
  assert.ok(selectedTaxonId);

  const submitRes = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: `${question.round_signature}tampered`,
      selected_taxon_id: selectedTaxonId,
      submission_id: 'tampered-submission',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitRes.status, 403);
  const body = await submitRes.json();
  assert.equal(body?.error?.code, 'INVALID_ROUND_SIGNATURE');
});

integrationTest('POST /api/quiz/submit (riddle retry) does not reveal correct answer before round is consumed', async () => {
  globalThis.fetch = createInatFetchMock();
  const clientSessionId = 'test-client-riddle';

  const questionRes = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=riddle&client_session_id=${clientSessionId}`
  );
  assert.equal(questionRes.status, 200);
  const question = await questionRes.json();

  const submitRetry1 = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: question.round_signature,
      selected_taxon_id: '999999001',
      submission_id: 'riddle-wrong-1',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitRetry1.status, 200);
  const retry1 = await submitRetry1.json();
  assert.equal(retry1.status, 'retry');
  assert.equal(retry1.round_consumed, false);
  assert.equal(retry1.correct_answer, null);
  assert.equal(retry1.correct_taxon_id, null);

  const submitRetry2 = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: question.round_signature,
      selected_taxon_id: '999999002',
      submission_id: 'riddle-wrong-2',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitRetry2.status, 200);
  const retry2 = await submitRetry2.json();
  assert.equal(retry2.status, 'retry');
  assert.equal(retry2.round_consumed, false);
  assert.equal(retry2.correct_answer, null);
  assert.equal(retry2.correct_taxon_id, null);

  const submitLose = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: question.round_signature,
      selected_taxon_id: '999999003',
      submission_id: 'riddle-wrong-3',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitLose.status, 200);
  const lose = await submitLose.json();
  assert.equal(lose.status, 'lose');
  assert.equal(lose.round_consumed, true);
  assert.ok(lose.correct_answer);
  assert.ok(lose.correct_taxon_id);
});

integrationTest('GET /api/quiz-question (hard) does not expose bonne_reponse and supports server-authoritative hint action', async () => {
  globalThis.fetch = createInatFetchMock();
  const clientSessionId = 'test-client-hard';

  const questionRes = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=hard&client_session_id=${clientSessionId}`
  );
  assert.equal(questionRes.status, 200);
  const question = await questionRes.json();

  assert.ok(question.round_id);
  assert.ok(question.round_signature);
  assert.equal(question.bonne_reponse, undefined);
  assert.equal(question.correct_choice_index, undefined);

  const submitRes = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: question.round_signature,
      round_action: 'hard_hint',
      submission_id: 'hard-hint-1',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitRes.status, 200);
  const body = await submitRes.json();
  assert.ok(body.hard_state);
  assert.equal(body.round_consumed, false);
  assert.equal(body.correct_answer, null);
  assert.equal(body.correct_taxon_id, null);
});

integrationTest('GET /api/quiz-question (taxonomic) hides correct step IDs and validates step selection server-side', async () => {
  globalThis.fetch = createInatFetchMock();
  const clientSessionId = 'test-client-taxonomic';

  const questionRes = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=taxonomic&client_session_id=${clientSessionId}`
  );
  assert.equal(questionRes.status, 200);
  const question = await questionRes.json();
  assert.ok(question.round_id);
  assert.ok(question.round_signature);
  assert.equal(question.bonne_reponse, undefined);
  assert.ok(Array.isArray(question?.taxonomic_ascension?.steps));
  assert.equal(question.taxonomic_ascension.steps.every((step) => !('correct_taxon_id' in step)), true);

  const firstOption = question.taxonomic_ascension.steps?.[0]?.options?.[0];
  assert.ok(firstOption?.taxon_id);

  const submitRes = await fetch(`${baseUrl}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      round_id: question.round_id,
      round_signature: question.round_signature,
      round_action: 'taxonomic_select',
      step_index: 0,
      selected_taxon_id: firstOption.taxon_id,
      submission_id: 'taxonomic-select-1',
      client_session_id: clientSessionId,
    }),
  });
  assert.equal(submitRes.status, 200);
  const body = await submitRes.json();
  assert.ok(body.taxonomic_state);
  assert.equal(body.round_consumed, false);
  assert.equal(body.correct_answer, null);
  assert.equal(body.correct_taxon_id, null);
});

integrationTest('GET /api/quiz/balance-dashboard returns basic balancing metrics payload', async () => {
  const res = await fetch(`${baseUrl}/api/quiz/balance-dashboard`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(typeof body.total_rounds === 'number');
  assert.ok(body.by_mode && typeof body.by_mode === 'object');
  assert.ok(body.status_distribution && typeof body.status_distribution === 'object');
});
