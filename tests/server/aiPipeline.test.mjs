import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../server/config/index.js';
import {
  buildExplanationCacheKey,
  callGeminiWithRetry,
  fetchImageInlinePart,
  generateCustomExplanation,
} from '../../server/services/ai/aiPipeline.js';

const originalFetch = globalThis.fetch;
const originalConfig = {
  aiEnabled: config.aiEnabled,
  aiApiKey: config.aiApiKey,
  aiExplanationFullEnabled: config.aiExplanationFullEnabled,
  aiExplanationFullImageAware: config.aiExplanationFullImageAware,
};

function createLogger(entries = []) {
  const push = (level, payload, message) => {
    entries.push({ level, payload, message });
  };
  return {
    info(payload, message) {
      push('info', payload, message);
    },
    warn(payload, message) {
      push('warn', payload, message);
    },
    error(payload, message) {
      push('error', payload, message);
    },
    debug(payload, message) {
      push('debug', payload, message);
    },
  };
}

function buildTaxon(id, scientificName, commonName, description) {
  return {
    id,
    name: scientificName,
    preferred_common_name: commonName,
    rank: 'species',
    iconic_taxon_name: 'Aves',
    description,
    url: `https://www.inaturalist.org/taxa/${id}`,
    ancestors: [
      { id: 10, rank: 'family', name: 'Ardeidae' },
      { id: 11, rank: 'genus', name: scientificName.split(' ')[0] || scientificName },
      { id: 12, rank: 'class', name: 'Aves' },
      { id: 13, rank: 'kingdom', name: 'Animalia' },
    ],
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(config, originalConfig);
});

test('generateCustomExplanation returns a deterministic full fallback when AI is disabled', async () => {
  config.aiEnabled = false;
  config.aiApiKey = '';
  globalThis.fetch = async () => {
    throw new Error('network disabled in test');
  };

  const result = await generateCustomExplanation(
    buildTaxon(3001, 'Ardea alba', 'Grande Aigrette', 'Silhouette droite, long cou, bec allongé.'),
    buildTaxon(3002, 'Egretta garzetta', 'Aigrette garzette', 'Allure plus fine, bec sombre, silhouette proche.'),
    'fr',
    createLogger(),
    {
      mode: 'full',
      imageContext: {
        source: 'round_photo',
        url: 'https://static.inaturalist.org/photos/3001/small.jpeg',
      },
    }
  );

  assert.equal(result.mode, 'full');
  assert.equal(result.fallback, true);
  assert.equal(result.confidence, 'fallback');
  assert.ok(result.full.photoSummary.includes("Je n'ai pas pu lire cette photo"));
  assert.ok(result.full.nextCheck.length > 0);
  assert.ok(result.reasonCodes.includes('ai_disabled'));
});

test('buildExplanationCacheKey varies with prompt-affecting context', () => {
  const correctTaxon = buildTaxon(3011, 'Ardea alba', 'Grande Aigrette', 'Silhouette droite.');
  const wrongTaxon = buildTaxon(3012, 'Egretta garzetta', 'Aigrette garzette', 'Allure plus fine.');

  const keyA = buildExplanationCacheKey({
    mode: 'brief',
    locale: 'fr',
    correctTaxon,
    wrongTaxon,
    packId: 'birds-eu',
    gameMode: 'hard',
  });
  const keyB = buildExplanationCacheKey({
    mode: 'brief',
    locale: 'fr',
    correctTaxon,
    wrongTaxon,
    packId: 'birds-be',
    gameMode: 'easy',
  });

  assert.notEqual(keyA, keyB);
  assert.ok(keyA.includes('brief-v3-stable-demo'));
});

test('fetchImageInlinePart rejects non-allowlisted image hosts before fetching', async () => {
  await assert.rejects(
    () =>
      fetchImageInlinePart(
        {
          source: 'round_photo',
          url: 'https://example.com/evil.jpg',
        },
        createLogger()
      ),
    /Image host rejected/
  );
});

test('callGeminiWithRetry retries 429 responses and logs generation metadata', async () => {
  config.aiEnabled = true;
  config.aiApiKey = 'test-key';
  const logs = [];
  const logger = createLogger(logs);
  let attempts = 0;

  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name) => (String(name || '').toLowerCase() === 'retry-after' ? '0' : null),
        },
        text: async () => 'rate limited',
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        promptFeedback: { blockReason: null },
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: '{"ok":true}' }],
            },
          },
        ],
      }),
    };
  };

  const text = await callGeminiWithRetry({
    model: 'gemini-2.5-flash-lite',
    timeoutMs: 250,
    maxAttempts: 2,
    pricePerMillion: { input: 0.1, output: 0.4 },
    systemPrompt: 'System prompt',
    userParts: [{ text: 'User prompt' }],
    genConfig: { responseMimeType: 'application/json' },
    logger,
    label: 'unit_retry',
  });

  assert.equal(text, '{"ok":true}');
  assert.equal(attempts, 2);
  assert.ok(logs.some((entry) => entry.message === 'unit_retry generation metadata'));
});

test('generateCustomExplanation repairs invalid JSON in brief mode and keeps the AI result', async () => {
  config.aiEnabled = true;
  config.aiApiKey = 'test-key';
  const loggerEntries = [];
  const logger = createLogger(loggerEntries);

  globalThis.fetch = async (url, opts = {}) => {
    const rawUrl = String(url);
    if (rawUrl.includes('generativelanguage.googleapis.com')) {
      const body = JSON.parse(String(opts.body || '{}'));
      const systemPrompt = body?.systemInstruction?.parts?.[0]?.text || '';
      if (systemPrompt.includes('reparateur de sortie JSON')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        key_difference: 'silhouette droite et bec crochu',
                        why_tempting: 'Aigrette garzette peut sembler proche au premier regard',
                        next_look_for: 'le bec crochu et le long cou',
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 12,
              candidatesTokenCount: 8,
              totalTokenCount: 20,
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: '{"key_difference": "silhouette droite"' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 4,
            totalTokenCount: 16,
          },
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => '',
    };
  };

  const result = await generateCustomExplanation(
    buildTaxon(3021, 'Phalacrocorax carbo', 'Grand Cormoran', 'Silhouette droite, bec crochu et cou long sur la photo.'),
    buildTaxon(3022, 'Alopochen aegyptiaca', 'Ouette d Egypte', 'Allure plus trapue et silhouette plus massive au premier regard.'),
    'fr',
    logger,
    {
      mode: 'brief',
      packId: 'water-birds',
      gameMode: 'hard',
      masteryBucket: 'fragile',
      confusionBucket: 'repeat',
    }
  );

  assert.equal(result.mode, 'brief');
  assert.equal(result.fallback, false);
  assert.ok(result.reasonCodes.includes('repair_used'));
  assert.equal(result.brief.support.minimumSupportMet, true);
  assert.ok(result.explanation.includes('Grand Cormoran'));
  assert.ok(result.explanation.includes("Ouette d Egypte"));
  assert.ok(loggerEntries.some((entry) => entry.message === 'Repair pass succeeded'));
});
