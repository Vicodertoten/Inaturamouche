import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { listPublicPacks } from '../server/packs/index.js';
import { buildHomePackCatalog, getWarmupPackIds } from '../server/services/catalogService.js';
import { isKnownPackTag } from '../server/packs/tags.js';
import fr from '../client/src/locales/fr.js';
import en from '../client/src/locales/en.js';
import nl from '../client/src/locales/nl.js';

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

test('buildHomePackCatalog applies region override before provided region', () => {
  const payload = buildHomePackCatalog({ region: 'world', regionOverride: 'belgium' });
  const nearYouSection = payload.sections.find((section) => section.id === 'near_you');
  assert.ok(nearYouSection);
  assert.ok(nearYouSection.packs.length > 0);
  assert.equal(nearYouSection.packs[0].region, 'belgium');
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

test('pack schema keeps backward compatibility with optional V3 metadata', () => {
  const packs = listPublicPacks();
  assert.ok(Array.isArray(packs));
  assert.ok(packs.length > 0);

  for (const pack of packs) {
    assert.equal(typeof pack.id, 'string');
    assert.equal(typeof pack.titleKey, 'string');
    assert.equal(typeof pack.descriptionKey, 'string');

    if (pack.theme !== undefined) {
      assert.equal(typeof pack.theme, 'string');
      assert.ok(pack.theme.length > 0);
    }

    if (pack.tags !== undefined) {
      assert.ok(Array.isArray(pack.tags));
      for (const tag of pack.tags) {
        assert.equal(isKnownPackTag(tag), true);
      }
    }

    if (pack.healthMinTaxa !== undefined) {
      assert.equal(Number.isInteger(pack.healthMinTaxa), true);
      assert.ok(pack.healthMinTaxa > 0);
    }
  }
});

test('pack catalog keeps unique IDs and 44 active V3 packs (+ custom + legacy)', () => {
  const packs = listPublicPacks();
  const ids = packs.map((pack) => pack.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, 'pack IDs must be unique');

  const active = packs.filter((pack) => pack.id !== 'custom' && pack.visibility !== 'legacy');
  assert.equal(active.length, 44, 'must expose exactly 44 active V3 packs');
});

test('home sections avoid duplicate pack IDs across rails', () => {
  const payload = buildHomePackCatalog({ region: 'europe' });
  const allIds = payload.sections.flatMap((section) => section.packs.map((pack) => pack.id));
  const uniqueIds = new Set(allIds);
  assert.equal(uniqueIds.size, allIds.length);
});

test('home sections maintain theme diversity when enough packs are available', () => {
  const payload = buildHomePackCatalog({ region: 'belgium', sectionLimit: 6 });
  for (const section of payload.sections) {
    if (section.packs.length < 3) continue;
    const themes = new Set(section.packs.map((pack) => pack.theme).filter(Boolean));
    assert.ok(themes.size >= 2, `${section.id} should not be mono-theme`);
  }
});

test('every pack title/description key exists in fr/en/nl locales', () => {
  const readPath = (obj, dottedPath) => {
    const parts = String(dottedPath || '').split('.');
    let current = obj;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  };

  const packs = listPublicPacks();
  for (const pack of packs) {
    assert.equal(typeof readPath(fr, pack.titleKey), 'string', `missing fr title for ${pack.id}`);
    assert.equal(typeof readPath(fr, pack.descriptionKey), 'string', `missing fr description for ${pack.id}`);
    assert.equal(typeof readPath(en, pack.titleKey), 'string', `missing en title for ${pack.id}`);
    assert.equal(typeof readPath(en, pack.descriptionKey), 'string', `missing en description for ${pack.id}`);
    assert.equal(typeof readPath(nl, pack.titleKey), 'string', `missing nl title for ${pack.id}`);
    assert.equal(typeof readPath(nl, pack.descriptionKey), 'string', `missing nl description for ${pack.id}`);
  }
});

test('PACKS_V3_ENABLED=false keeps rollback-safe catalog while preserving ID resolution', () => {
  const script = [
    "import { listPublicPacks, findPackById, isPacksV3Enabled } from './server/packs/index.js';",
    'const packs = listPublicPacks();',
    "const active = packs.filter((pack) => pack.id !== 'custom' && pack.visibility !== 'legacy');",
    "const home = active.filter((pack) => pack.visibility === 'home');",
    "const catalog = active.filter((pack) => pack.visibility === 'catalog');",
    "const payload = {",
    '  v3Enabled: isPacksV3Enabled(),',
    '  activeCount: active.length,',
    '  homeCount: home.length,',
    '  catalogCount: catalog.length,',
    "  preservedThreatenedId: Boolean(findPackById('world_threatened_birds')),",
    "  preservedLegacyId: Boolean(findPackById('european_trees'))",
    '};',
    'console.log(JSON.stringify(payload));',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, PACKS_V3_ENABLED: 'false' },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse((result.stdout || '').trim());
  assert.equal(payload.v3Enabled, false);
  assert.ok(payload.homeCount >= 6);
  assert.ok(payload.catalogCount >= 6);
  assert.ok(payload.activeCount >= 12);
  assert.equal(payload.preservedThreatenedId, true);
  assert.equal(payload.preservedLegacyId, true);
});
