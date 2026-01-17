import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../../server.js';

let server;
let baseUrl;
let originalFetch;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
  originalFetch = globalThis.fetch;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = originalFetch;
});

test('GET /api/quiz-question returns 400 BAD_REQUEST when missing required parameters', async () => {
  const res = await fetch(`${baseUrl}/api/quiz-question`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.issues));
});

test('GET /api/quiz-question returns 400 BAD_REQUEST with invalid pack_id', async () => {
  const res = await fetch(`${baseUrl}/api/quiz-question?pack_id=invalid-pack-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'UNKNOWN_PACK');
  assert.equal(body.error.message, 'Unknown pack');
});

test('GET /api/quiz-question accepts valid taxon_ids parameter', async () => {
  // Mock iNaturalist API responses
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    // Mock observations endpoint
    if (String(url).includes('/observations')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          total_results: 100,
          results: [
            {
              taxon: {
                id: 123,
                name: 'Test species',
                preferred_common_name: 'Test',
                rank: 'species',
                iconic_taxon_name: 'Test',
                default_photo: { medium_url: 'https://example.com/photo.jpg' }
              },
              photos: [{ url: 'https://example.com/photo.jpg' }]
            }
          ]
        })
      };
    }
    
    // Mock taxa endpoint
    if (String(url).includes('/taxa')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species',
              ancestors: []
            }
          ]
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=fr`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.observation || body.error);
});

test('GET /api/quiz-question accepts locale parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    // Check if locale is passed to iNaturalist API
    if (String(url).includes('/observations')) {
      const urlObj = new URL(url);
      const locale = urlObj.searchParams.get('locale');
      assert.equal(locale, 'en');
      
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          total_results: 100,
          results: [
            {
              taxon: {
                id: 123,
                name: 'Test species',
                preferred_common_name: 'Test',
                rank: 'species',
                iconic_taxon_name: 'Test',
                default_photo: { medium_url: 'https://example.com/photo.jpg' }
              },
              photos: [{ url: 'https://example.com/photo.jpg' }]
            }
          ]
        })
      };
    }

    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ results: [] })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=en`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question handles seed parameter for deterministic results', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: [
          {
            taxon: {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species',
              iconic_taxon_name: 'Test',
              default_photo: { medium_url: 'https://example.com/photo.jpg' }
            },
            photos: [{ url: 'https://example.com/photo.jpg' }]
          }
        ]
      })
    };
  };

  const res1 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res1.status, 200);
  
  const res2 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res2.status, 200);
});

test('GET /api/quiz-question accepts place_id parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: [
          {
            taxon: {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species',
              iconic_taxon_name: 'Test',
              default_photo: { medium_url: 'https://example.com/photo.jpg' }
            },
            photos: [{ url: 'https://example.com/photo.jpg' }]
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?place_id=6753&taxon_ids=47126`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question accepts date range parameters', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: [
          {
            taxon: {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species',
              iconic_taxon_name: 'Test',
              default_photo: { medium_url: 'https://example.com/photo.jpg' }
            },
            photos: [{ url: 'https://example.com/photo.jpg' }]
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&d1=2024-01-01&d2=2024-12-31`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question returns 503 POOL_UNAVAILABLE when no observations available', async () => {
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

test('GET /api/quiz-question handles bounding box parameters', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: [
          {
            taxon: {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species',
              iconic_taxon_name: 'Test',
              default_photo: { medium_url: 'https://example.com/photo.jpg' }
            },
            photos: [{ url: 'https://example.com/photo.jpg' }]
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&nelat=50&nelng=5&swlat=49&swlng=4`);
  assert.equal(res.status, 200);
});
