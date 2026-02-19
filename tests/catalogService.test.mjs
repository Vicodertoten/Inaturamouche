import test from 'node:test';
import assert from 'node:assert/strict';
import { listPublicPacks } from '../server/packs/index.js';
import { buildHomePackCatalog, getWarmupPackIds } from '../server/services/catalogService.js';

test('buildHomePackCatalog returns 3 sections and a custom entry', () => {
  const payload = buildHomePackCatalog({ region: 'belgium' });
  assert.ok(payload && typeof payload === 'object');
  assert.ok(Array.isArray(payload.sections));
  assert.equal(payload.sections.length, 3);
  assert.equal(payload.customEntry?.id, 'custom');

  for (const section of payload.sections) {
    assert.ok(section.id);
    assert.ok(section.titleKey);
    assert.ok(Array.isArray(section.packs));
    assert.ok(section.packs.every((pack) => pack.id !== 'custom'));
  }
});

test('buildHomePackCatalog is deterministic for identical input', () => {
  const first = buildHomePackCatalog({ region: 'france', recentPackIds: ['world_birds'] });
  const second = buildHomePackCatalog({ region: 'france', recentPackIds: ['world_birds'] });
  assert.deepEqual(first, second);
});

test('buildHomePackCatalog prioritizes near-you packs for Belgium', () => {
  const payload = buildHomePackCatalog({ region: 'belgium' });
  const nearYouSection = payload.sections.find((section) => section.id === 'near_you');
  assert.ok(nearYouSection);
  assert.ok(nearYouSection.packs.length > 0);

  const firstNearYou = nearYouSection.packs[0];
  assert.equal(firstNearYou.region, 'belgium');
});

test('buildHomePackCatalog penalizes recently played packs', () => {
  const baseline = buildHomePackCatalog({ region: 'belgium' });
  const starter = baseline.sections.find((section) => section.id === 'starter');
  assert.ok(starter);
  assert.ok(starter.packs.length >= 2);

  const recentlyPlayedPackId = starter.packs[0].id;
  const withPenalty = buildHomePackCatalog({
    region: 'belgium',
    recentPackIds: [recentlyPlayedPackId],
  });
  const penalizedStarter = withPenalty.sections.find((section) => section.id === 'starter');
  assert.ok(penalizedStarter);
  assert.ok(penalizedStarter.packs.length > 0);
  assert.notEqual(penalizedStarter.packs[0].id, recentlyPlayedPackId);
});

test('getWarmupPackIds returns ranked pack IDs from home sections', () => {
  const warmupPackIds = getWarmupPackIds({ region: 'europe', limit: 4 });
  assert.ok(Array.isArray(warmupPackIds));
  assert.equal(warmupPackIds.length, 4);

  const catalogIds = new Set(listPublicPacks().map((pack) => pack.id));
  for (const packId of warmupPackIds) {
    assert.ok(catalogIds.has(packId));
  }
});
