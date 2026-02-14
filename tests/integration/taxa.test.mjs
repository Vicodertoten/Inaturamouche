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

// Tests pour /api/taxa/autocomplete
integrationTest('GET /api/taxa/autocomplete returns 400 BAD_REQUEST when q is missing', async () => {
  const res = await fetch(`${baseUrl}/api/taxa/autocomplete`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('GET /api/taxa/autocomplete returns autocomplete results', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/taxa/autocomplete')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 47126,
              name: 'Mammalia',
              preferred_common_name: 'Mammals',
              rank: 'class'
            }
          ]
        })
      };
    }

    if (String(url).includes('/taxa/')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 47126,
              name: 'Mammalia',
              preferred_common_name: 'Mammals',
              rank: 'class',
              ancestors: []
            }
          ]
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/taxa/autocomplete?q=mammal`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

integrationTest('GET /api/taxa/autocomplete accepts rank parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/taxa/autocomplete')) {
      const urlObj = new URL(url);
      const rank = urlObj.searchParams.get('rank');
      assert.equal(rank, 'species');
      
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ results: [] })
      };
    }

    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  };

  const res = await fetch(`${baseUrl}/api/taxa/autocomplete?q=test&rank=species`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/taxa/autocomplete accepts locale parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/taxa/autocomplete')) {
      const urlObj = new URL(url);
      const locale = urlObj.searchParams.get('locale');
      assert.equal(locale, 'en');
      
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ results: [] })
      };
    }

    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  };

  const res = await fetch(`${baseUrl}/api/taxa/autocomplete?q=test&locale=en`);
  assert.equal(res.status, 200);
});

// Tests pour /api/taxon/:id
integrationTest('GET /api/taxon/:id returns 400 BAD_REQUEST for invalid id', async () => {
  const res = await fetch(`${baseUrl}/api/taxon/invalid-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('GET /api/taxon/:id returns 404 TAXON_NOT_FOUND when taxon does not exist', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ results: [] })
    };
  };

  const res = await fetch(`${baseUrl}/api/taxon/999999999`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'TAXON_NOT_FOUND');
});

integrationTest('GET /api/taxon/:id returns taxon details', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        results: [
          {
            id: 47126,
            name: 'Mammalia',
            preferred_common_name: 'Mammals',
            rank: 'class',
            wikipedia_url: 'https://en.wikipedia.org/wiki/Mammal'
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/taxon/47126`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 47126);
  assert.equal(body.name, 'Mammalia');
});

integrationTest('GET /api/taxon/:id accepts locale parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    const urlObj = new URL(url);
    const locale = urlObj.searchParams.get('locale');
    assert.equal(locale, 'en');
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        results: [
          {
            id: 47126,
            name: 'Mammalia',
            preferred_common_name: 'Mammals',
            rank: 'class'
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/taxon/47126?locale=en`);
  assert.equal(res.status, 200);
});

// Tests pour /api/taxa (batch)
integrationTest('GET /api/taxa returns 400 BAD_REQUEST when ids is missing', async () => {
  const res = await fetch(`${baseUrl}/api/taxa`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
});

integrationTest('GET /api/taxa returns multiple taxa details', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        results: [
          {
            id: 47126,
            name: 'Mammalia',
            preferred_common_name: 'Mammals',
            rank: 'class',
            ancestors: []
          },
          {
            id: 3,
            name: 'Aves',
            preferred_common_name: 'Birds',
            rank: 'class',
            ancestors: []
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/taxa?ids=47126,3`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 2);
});

// Tests pour /api/observations/species_counts
integrationTest('GET /api/observations/species_counts returns 400 BAD_REQUEST with missing parameters', async () => {
  const res = await fetch(`${baseUrl}/api/observations/species_counts`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
});

integrationTest('GET /api/observations/species_counts returns species counts', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        page: 1,
        per_page: 30,
        results: [
          {
            count: 150,
            taxon: {
              id: 123,
              name: 'Test species',
              preferred_common_name: 'Test',
              rank: 'species'
            }
          }
        ]
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/observations/species_counts?taxon_ids=47126`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.results);
  assert.ok(Array.isArray(body.results));
});

integrationTest('GET /api/observations/species_counts accepts pagination parameters', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    const urlObj = new URL(url);
    const page = urlObj.searchParams.get('page');
    const perPage = urlObj.searchParams.get('per_page');
    assert.equal(page, '2');
    assert.equal(perPage, '50');
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        page: 2,
        per_page: 50,
        results: []
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/observations/species_counts?taxon_ids=47126&page=2&per_page=50`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/observations/species_counts accepts geographic parameters', async () => {
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

  const res = await fetch(`${baseUrl}/api/observations/species_counts?taxon_ids=47126&place_id=6753`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/observations/species_counts accepts date range', async () => {
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

  const res = await fetch(`${baseUrl}/api/observations/species_counts?taxon_ids=47126&d1=2024-01-01&d2=2024-12-31`);
  assert.equal(res.status, 200);
});
