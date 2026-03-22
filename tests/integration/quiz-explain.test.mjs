import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config/index.js';

let server;
let baseUrl;
let app;
let originalFetch;
let serverAvailable = true;
const AI_RUNTIME_AVAILABLE = Boolean(config.aiEnabled && config.aiApiKey);

const SOCKET_SKIP_REASON = 'Socket binding not permitted in this environment';
const DEFAULT_AI_TEXT = 'Ces deux especes se distinguent par leur morphologie et leur habitat.';

const buildFullAiJson = ({
  photoSummary = "Sur cette photo, observe d'abord la silhouette generale puis le detail structurel le plus net pour separer les deux especes.",
  observedClues = ['silhouette generale', 'detail structurel visible'],
  whyThisPhotoCouldMislead = "Cette photo peut tasser les proportions et rendre la confusion plausible au premier regard.",
  nextCheck = 'regarde ensuite un detail structurel stable',
  caution = '',
} = {}) =>
  JSON.stringify({
    photo_summary: photoSummary,
    observed_clues: observedClues,
    why_this_photo_could_mislead: whyThisPhotoCouldMislead,
    next_check: nextCheck,
    caution,
  });

const buildBriefAiJson = ({
  keyDifference = 'Compare la silhouette generale et un caractere stable.',
  whyTempting = 'les deux especes peuvent sembler proches au premier regard',
  nextLookFor = "un detail structurel net sur l'espece correcte",
} = {}) =>
  JSON.stringify({
    key_difference: keyDifference,
    why_tempting: whyTempting,
    next_look_for: nextLookFor,
  });

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

function buildExternalFetchMock({
  aiText = DEFAULT_AI_TEXT,
  aiResponse = null,
} = {}) {
  return async (url, opts) => {
    const rawUrl = String(url);
    if (rawUrl.startsWith(baseUrl)) {
      return originalFetch(url, opts);
    }

    if (rawUrl.includes('/v1/taxa/')) {
      const parsedUrl = new URL(rawUrl);
      const idsSegment = parsedUrl.pathname.split('/v1/taxa/')[1] || '';
      const ids = idsSegment.split(',').map((value) => Number(value)).filter((value) => Number.isFinite(value));
      const results = ids.map((id) => ({
        id,
        name: `Species ${id}`,
        preferred_common_name: `Species ${id}`,
        rank: 'species',
        ancestors: [],
        ancestor_ids: [id],
        observations_count: 100,
        wikipedia_url: `https://fr.wikipedia.org/wiki/Species_${id}`,
        wikipedia_summary:
          id % 2 === 0
            ? `Species ${id} montre une allure trapue, un bec compact et une silhouette plus courte.`
            : `Species ${id} montre une silhouette droite, un bec crochu et un detail structurel stable.`,
        default_photo: {
          url: 'https://example.com/photo.jpg',
        },
        url: `https://www.inaturalist.org/taxa/${id}`,
      }));

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ results }),
        text: async () => JSON.stringify({ results }),
      };
    }

    if (rawUrl.includes('/page/summary/')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'standard',
          extract:
            'Silhouette droite, bec crochu et structure stable sont des repères visuels utiles pour identifier cette espèce.',
        }),
        text: async () => '',
      };
    }

    if (rawUrl.includes('generativelanguage.googleapis.com')) {
      if (typeof aiResponse === 'function') {
        return aiResponse(rawUrl, opts);
      }
      if (aiResponse) {
        return aiResponse;
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: aiText }],
              },
            },
          ],
        }),
        text: async () => '',
      };
    }

    if (rawUrl.startsWith('https://example.com/') || rawUrl.startsWith('https://static.inaturalist.org/')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name) => (String(name || '').toLowerCase() === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer,
        text: async () => '',
        json: async () => ({}),
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => '{}',
    };
  };
}

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

async function postExplain(body) {
  return fetch(`${baseUrl}/api/quiz/explain`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

integrationTest('POST /api/quiz/explain returns a valid explanation payload', async () => {
  globalThis.fetch = buildExternalFetchMock();

  const res = await postExplain({
    correctId: 101,
    wrongId: 202,
    locale: 'fr',
    imageContext: {
      source: 'round_photo',
      url: 'https://static.inaturalist.org/photos/1/small.jpeg',
      downscaled: true,
      inputBucket: '<=384-target',
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.explanation, 'string');
  assert.ok(body.explanation.length > 0);
  assert.ok(body.brief === null || typeof body.brief === 'object');
  assert.ok(body.full === null || typeof body.full === 'object');
  assert.equal(typeof body.fallback, 'boolean');
  assert.equal(typeof body.trace_id, 'string');
  assert.equal(typeof body.pair_key, 'string');
});

integrationTest('POST /api/quiz/explain sets fallback=false when AI output passes quality checks', async (t) => {
  if (!AI_RUNTIME_AVAILABLE) {
    t.skip('AI runtime not configured in this environment');
    return;
  }
  globalThis.fetch = buildExternalFetchMock({
    aiText: buildFullAiJson({
      correctId: 901,
      wrongId: 902,
    }),
  });

  const res = await postExplain({
    correctId: 901,
    wrongId: 902,
    locale: 'fr',
    imageContext: {
      source: 'round_photo',
      url: 'https://static.inaturalist.org/photos/1/small.jpeg',
      downscaled: true,
      inputBucket: '<=384-target',
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fallback, false);
  assert.equal(typeof body.explanation, 'string');
  assert.ok(body.explanation.length > 0);
  assert.equal(body.mode, 'full');
  assert.ok(['photo_grounded', 'photo_limited'].includes(body.confidence));
  assert.equal(body.full?.observedClues?.[0], 'Silhouette generale');
  assert.ok(body.full?.supportByField);
  assert.equal(typeof body.trace_id, 'string');
});

integrationTest('POST /api/quiz/explain sets fallback=true when AI output is low quality', async (t) => {
  if (!AI_RUNTIME_AVAILABLE) {
    t.skip('AI runtime not configured in this environment');
    return;
  }
  globalThis.fetch = buildExternalFetchMock({
    aiText: JSON.stringify({
      explanation:
        "Regarde,, la silhouette et les couleuurs inhabituelles pour separer ces especes proches. Le critere principal est de de comparer l'aile.",
      visual_clue: 'Compare les ailes,, et la posture.',
      taxonomic_rule: 'Pars du genre et compare.',
      why_this_confusion_happens: "L'autre espece peut sembler proche mais.",
      discriminant: "L'autre est un o",
    }),
  });

  const res = await postExplain({
    correctId: 903,
    wrongId: 904,
    locale: 'fr',
    imageContext: {
      source: 'round_photo',
      url: 'https://static.inaturalist.org/photos/1/small.jpeg',
      downscaled: true,
      inputBucket: '<=384-target',
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fallback, true);
  assert.equal(typeof body.explanation, 'string');
  assert.ok(body.explanation.length > 0);
});

integrationTest('POST /api/quiz/explain sets fallback=true when AI response is empty', async (t) => {
  if (!AI_RUNTIME_AVAILABLE) {
    t.skip('AI runtime not configured in this environment');
    return;
  }
  globalThis.fetch = buildExternalFetchMock({
    aiResponse: {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ candidates: [] }),
      text: async () => JSON.stringify({ candidates: [] }),
    },
  });

  const res = await postExplain({
    correctId: 905,
    wrongId: 906,
    locale: 'fr',
    imageContext: {
      source: 'round_photo',
      url: 'https://static.inaturalist.org/photos/1/small.jpeg',
      downscaled: true,
      inputBucket: '<=384-target',
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fallback, true);
  assert.equal(typeof body.explanation, 'string');
  assert.ok(body.explanation.length > 0);
});

integrationTest('POST /api/quiz/explain returns a structured brief payload', async (t) => {
  if (!AI_RUNTIME_AVAILABLE) {
    t.skip('AI runtime not configured in this environment');
    return;
  }
  globalThis.fetch = buildExternalFetchMock({
    aiText: buildBriefAiJson({
      correctId: 907,
      wrongId: 908,
    }),
  });

  const res = await postExplain({
    correctId: 907,
    wrongId: 908,
    locale: 'fr',
    mode: 'brief',
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.mode, 'brief');
  assert.equal(body.fallback, false);
  assert.equal(typeof body.brief?.displayText, 'string');
  assert.ok(body.brief.displayText.length > 0);
  assert.ok(body.brief?.support);
  assert.equal(body.full, null);
  assert.equal(typeof body.trace_id, 'string');
});

integrationTest('POST /api/quiz/explain rejects invalid payloads with standardized BAD_REQUEST errors', async () => {
  const res = await postExplain({
    correctId: 101,
    wrongId: 101,
    locale: 'fr',
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.equal(body.error.message, 'Bad request');
  assert.equal(typeof body.error.requestId, 'string');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('POST /api/quiz/explain is rate-limited for abusive callers', async () => {
  globalThis.fetch = buildExternalFetchMock();
  const maxAttempts = Math.max(config.explainRateLimitPerMinute, 1) + 5;
  let limitedResponse = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    const res = await postExplain({
      correctId: 303,
      wrongId: 404,
      locale: 'fr',
    });
    if (res.status === 429) {
      limitedResponse = res;
      break;
    }
  }

  assert.ok(limitedResponse, 'Expected a 429 response from explain rate limiter');
  const body = await limitedResponse.json();
  assert.equal(limitedResponse.status, 429);
  assert.ok(
    ['EXPLAIN_RATE_LIMIT_EXCEEDED', 'EXPLAIN_DAILY_QUOTA_EXCEEDED'].includes(body.error.code),
    `Unexpected rate-limit error code: ${body.error.code}`
  );
  assert.equal(typeof body.error.requestId, 'string');
  assert.equal(limitedResponse.headers.get('x-request-id'), body.error.requestId);
});
