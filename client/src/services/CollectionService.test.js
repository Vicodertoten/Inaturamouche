import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import db, { taxa, stats } from './db';
import CollectionService, {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  XP_GAINS,
  MASTERY_XP_THRESHOLDS,
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  updateTaxonDescription,
} from './CollectionService';

// Mock TaxonomyService
vi.mock('./TaxonomyService', () => ({
  queueTaxonForEnrichment: vi.fn(),
}));

describe('CollectionService', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.transaction('rw', taxa, stats, async () => {
      await taxa.clear();
      await stats.clear();
    });
  });

  afterEach(async () => {
    await db.transaction('rw', taxa, stats, async () => {
      await taxa.clear();
      await stats.clear();
    });
  });

  describe('seedTaxa', () => {
    it('should seed taxa into the database', async () => {
      const taxaList = [
        {
          id: 1,
          name: 'Species A',
          preferred_common_name: 'Common A',
          rank: 'species',
          iconic_taxon_id: 3,
          ancestor_ids: [],
        },
        {
          id: 2,
          name: 'Species B',
          preferred_common_name: 'Common B',
          rank: 'species',
          iconic_taxon_id: 3,
          ancestor_ids: [1],
        },
      ];

      await seedTaxa(taxaList);

      const count = await taxa.count();
      expect(count).toBe(2);

      const taxon1 = await taxa.get(1);
      expect(taxon1.name).toBe('Species A');
      expect(taxon1.iconic_taxon_id).toBe(3);
    });

    it('should handle empty list gracefully', async () => {
      await seedTaxa([]);
      const count = await taxa.count();
      expect(count).toBe(0);
    });
  });

  describe('upsertTaxon', () => {
    it('should insert a new taxon', async () => {
      const taxonData = {
        id: 1,
        name: 'Lion',
        preferred_common_name: 'Lion',
        rank: 'species',
        iconic_taxon_id: 40151,
        ancestor_ids: [],
      };

      const result = await upsertTaxon(taxonData);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Lion');

      const stored = await taxa.get(1);
      expect(stored.name).toBe('Lion');
    });

    it('should merge with existing taxon', async () => {
      const initial = {
        id: 1,
        name: 'Lion',
        iconic_taxon_id: 40151,
        ancestor_ids: [100],
      };

      await seedTaxa([initial]);

      const updated = {
        id: 1,
        name: 'Lion',
        preferred_common_name: 'African Lion',
        iconic_taxon_id: 40151,
        ancestor_ids: [100, 101],
      };

      const result = await upsertTaxon(updated);
      expect(result.preferred_common_name).toBe('African Lion');
      expect(result.ancestor_ids).toContain(101);
    });
  });

  describe('recordEncounter', () => {
    it('should create new stats on first encounter', async () => {
      const taxonData = {
        id: 1,
        name: 'Species',
        iconic_taxon_id: 3,
      };

      const result = await recordEncounter(taxonData, {
        isCorrect: true,
      });

      expect(result.firstSeen).toBe(true);
      expect(result.stats.seenCount).toBe(1);
      expect(result.stats.correctCount).toBe(1);
    });

    it('should default missing rank to species so collection entries remain visible', async () => {
      const taxonData = {
        id: 42,
        name: 'Unknown Rank Species',
        iconic_taxon_id: 3,
      };

      await recordEncounter(taxonData, { isCorrect: true });

      const storedTaxon = await taxa.get(42);
      expect(storedTaxon.rank).toBe('species');

      const page = await getSpeciesPage({
        iconicId: 3,
        offset: 0,
        limit: 10,
      });
      expect(page.species.some((item) => item.taxon.id === 42)).toBe(true);
    });

    it('should calculate BRONZE mastery after 1 correct', async () => {
      const taxonData = { id: 1, name: 'Species', iconic_taxon_id: 3 };

      const result = await recordEncounter(taxonData, { isCorrect: true });

      expect(result.newLevel).toBe(MASTERY_LEVELS.BRONZE);
      expect(result.levelUp).toBe(true);
    });

    it('should calculate SILVER mastery after 5 correct', async () => {
      const taxonData = { id: 1, name: 'Species', iconic_taxon_id: 3 };

      for (let i = 0; i < 5; i++) {
        await recordEncounter(taxonData, { isCorrect: true });
      }

      const stat = await stats.get(1);
      expect(stat.masteryLevel).toBe(MASTERY_LEVELS.SILVER);
      expect(stat.seenCount).toBe(5);
      expect(stat.correctCount).toBe(5);
    });

    it('should calculate GOLD mastery based on XP thresholds', async () => {
      const taxonData = { id: 1, name: 'Species', iconic_taxon_id: 3 };

      // 12 correct -> 12 * 10 XP = 120 XP (meets GOLD threshold)
      for (let i = 0; i < 12; i++) {
        await recordEncounter(taxonData, { isCorrect: true });
      }

      const stat = await stats.get(1);
      expect(stat.masteryLevel).toBe(MASTERY_LEVELS.GOLD);
      expect(stat.xp).toBeGreaterThanOrEqual(MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.GOLD]);
    });

    it('should track streak correctly', async () => {
      const taxonData = { id: 1, name: 'Species', iconic_taxon_id: 3 };

      // 2 correct
      await recordEncounter(taxonData, { isCorrect: true });
      await recordEncounter(taxonData, { isCorrect: true });

      // 1 wrong - streak should reset
      await recordEncounter(taxonData, { isCorrect: false });

      // 1 correct - new streak of 1
      const result = await recordEncounter(taxonData, { isCorrect: true });

      expect(result.stats.streak).toBe(1);
    });

    it('should detect level up', async () => {
      const taxonData = { id: 1, name: 'Species', iconic_taxon_id: 3 };

      // Get to BRONZE
      let result = await recordEncounter(taxonData, { isCorrect: true });
      expect(result.levelUp).toBe(true);
      expect(result.oldLevel).toBe(MASTERY_LEVELS.NONE);
      expect(result.newLevel).toBe(MASTERY_LEVELS.BRONZE);

      // Get to SILVER
      for (let i = 0; i < 4; i++) {
        await recordEncounter(taxonData, { isCorrect: true });
      }
      result = await recordEncounter(taxonData, { isCorrect: true });

      expect(result.levelUp).toBe(true);
      expect(result.oldLevel).toBe(MASTERY_LEVELS.BRONZE);
      expect(result.newLevel).toBe(MASTERY_LEVELS.SILVER);
    });
  });

  describe('getIconicSummary', () => {
    it('should return summary per iconic taxon', async () => {
      const taxa1 = [
        { id: 1, name: 'Species 1', iconic_taxon_id: 3 },
        { id: 2, name: 'Species 2', iconic_taxon_id: 3 },
        { id: 3, name: 'Species 3', iconic_taxon_id: 40151 },
      ];

      await seedTaxa(taxa1);

      // Record encounters
      await recordEncounter(taxa1[0], { isCorrect: true });
      await recordEncounter(taxa1[1], { isCorrect: true });
      await recordEncounter(taxa1[2], { isCorrect: false });

      const summary = await getIconicSummary();

      expect(summary[3].seenCount).toBe(2);
      expect(summary[40151].seenCount).toBe(1);
    });

    it('should calculate progress percent', async () => {
      // Create 10 species for iconic 3
      const taxa1 = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Species ${i + 1}`,
        iconic_taxon_id: 3,
      }));

      await seedTaxa(taxa1);

      // Record 5 of them
      for (let i = 0; i < 5; i++) {
        await recordEncounter(taxa1[i], { isCorrect: true });
      }

      const summary = await getIconicSummary();
      expect(summary[3].progressPercent).toBe(50);
    });
  });

  describe('getSpeciesPage', () => {
    beforeEach(async () => {
      // Setup taxa
      const taxa1 = [
        { id: 1, name: 'Alpha', iconic_taxon_id: 3, preferred_common_name: 'Alpha' },
        { id: 2, name: 'Beta', iconic_taxon_id: 3, preferred_common_name: 'Beta' },
        { id: 3, name: 'Gamma', iconic_taxon_id: 3, preferred_common_name: 'Gamma' },
      ];
      await seedTaxa(taxa1);

      // Record encounters in different orders
      await recordEncounter(taxa1[2], { isCorrect: true }); // Gamma
      await recordEncounter(taxa1[0], { isCorrect: true }); // Alpha
      await recordEncounter(taxa1[0], { isCorrect: true }); // Alpha again
      await recordEncounter(taxa1[1], { isCorrect: false }); // Beta
    });

    it('should return paginated results for iconic taxon', async () => {
      const result = await getSpeciesPage({
        iconicId: 3,
        offset: 0,
        limit: 10,
      });

      expect(result.species.length).toBe(3); // All seen species
      expect(result.total).toBe(3);
    });

    it('should sort by mastery (default)', async () => {
      const result = await getSpeciesPage({
        iconicId: 3,
        offset: 0,
        limit: 10,
        sort: 'mastery',
      });

      // Alpha has 2 correct, Beta has 0 correct, Gamma has 1 correct
      expect(result.species[0].taxon.name).toBe('Alpha'); // SILVER (2 correct)
    });

    it('should sort alphabetically', async () => {
      const result = await getSpeciesPage({
        iconicId: 3,
        offset: 0,
        limit: 10,
        sort: 'alpha',
      });

      expect(result.species[0].taxon.name).toBe('Alpha');
      expect(result.species[1].taxon.name).toBe('Beta');
      expect(result.species[2].taxon.name).toBe('Gamma');
    });

    it('should respect offset and limit', async () => {
      const result = await getSpeciesPage({
        iconicId: 3,
        offset: 1,
        limit: 1,
      });

      expect(result.species.length).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe('getSpeciesDetail', () => {
    it('should return taxon with stats and ancestors', async () => {
      const ancestor = { id: 100, name: 'Ancestor', iconic_taxon_id: 1, rank: 'family' };
      const taxon = {
        id: 1,
        name: 'Species',
        iconic_taxon_id: 3,
        ancestor_ids: [100],
      };

      await seedTaxa([ancestor, taxon]);
      await recordEncounter(taxon, { isCorrect: true });

      const detail = await getSpeciesDetail(1);

      expect(detail.taxon.name).toBe('Species');
      expect(detail.stats.seenCount).toBe(1);
      expect(detail.ancestors.length).toBe(1);
      expect(detail.ancestors[0].name).toBe('Ancestor');
    });

    it('should return null if taxon not found', async () => {
      const detail = await getSpeciesDetail(999);
      expect(detail).toBeNull();
    });
  });

  describe('updateTaxonDescription', () => {
    it('should cache description in taxa table', async () => {
      const taxon = { id: 1, name: 'Species', iconic_taxon_id: 3 };
      await seedTaxa([taxon]);

      await updateTaxonDescription(1, 'This is a description');

      const stored = await taxa.get(1);
      expect(stored.description).toBe('This is a description');
      expect(stored.descriptionUpdatedAt).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('should have correct XP thresholds', () => {
      expect(MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.BRONZE]).toBe(10);
      expect(MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.SILVER]).toBe(50);
      expect(MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.GOLD]).toBe(120);
      // Ensure XP gains constants exist
      expect(XP_GAINS.CORRECT).toBe(10);
      expect(XP_GAINS.WRONG).toBe(-5);
    });

    it('should have mastery names', () => {
      expect(MASTERY_NAMES[MASTERY_LEVELS.NONE]).toBe('Unseen');
      expect(MASTERY_NAMES[MASTERY_LEVELS.BRONZE]).toBe('Bronze');
      expect(MASTERY_NAMES[MASTERY_LEVELS.SILVER]).toBe('Silver');
      expect(MASTERY_NAMES[MASTERY_LEVELS.GOLD]).toBe('Gold');
    });
  });
});
