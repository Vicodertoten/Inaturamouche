import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAIResponse,
  validateAndClean,
  parseExplanationModeResponse,
  validateBriefExplanation,
  validateFullExplanation,
  buildBriefSupport,
  buildFullSupport,
} from '../../server/services/ai/outputFilter.js';

test('parseAIResponse removes emoji and source lines before parsing', () => {
  const raw = JSON.stringify({
    intro: 'Bien vu, on corrige ça ensemble.',
    explanation: 'Observe bien la silhouette et la couleur dominante.',
    discriminant: 'Contraste silhouette/couleur',
    visual_clue: 'Le motif de l’aile est plus contrasté chez la bonne espèce.',
    taxonomic_rule: 'Commence par la famille, puis valide la forme du bec.',
    why_this_confusion_happens: 'La couleur peut sembler proche, mais la silhouette reste différente.',
  });

  const parsed = parseAIResponse(raw);
  assert.ok(parsed);
  assert.equal(parsed.explanation, 'Bien vu, on corrige ça ensemble. Observe bien la silhouette et la couleur dominante.');
  assert.equal(parsed.discriminant, 'Contraste silhouette/couleur');
  assert.equal(parsed.visualClue, 'Le motif de l’aile est plus contrasté chez la bonne espèce.');
  assert.equal(parsed.taxonomicRule, 'Commence par la famille, puis valide la forme du bec.');
  assert.equal(parsed.whyThisConfusionHappens, 'La couleur peut sembler proche, mais la silhouette reste différente.');
});

test('validateAndClean flags malformed punctuation and suspicious sequences', () => {
  const responseObj = {
    explanation: "Laprochaine fois, regarde le plummge et les tachessjaunes vives,, c'est le critère clé.",
    discriminant: 'Plummge gris vs verdâtre',
  };

  const out = validateAndClean(responseObj);
  assert.equal(out.valid, false);
  assert.ok(out.issues.some((issue) => issue.includes('ponctuation anormale')));
  assert.ok(out.issues.some((issue) => issue.includes('séquences de lettres suspectes')));
});

test('validateAndClean flags truncated endings', () => {
  const responseObj = {
    explanation: "Regarde la posture générale et la forme du bec. L'autre est un o",
    discriminant: 'Posture et bec',
  };

  const out = validateAndClean(responseObj);
  assert.equal(out.valid, false);
  assert.ok(out.issues.some((issue) => issue.includes('semble tronqué')));
});

test('validateAndClean flags narrative or incomplete discriminants', () => {
  const responseObj = {
    explanation: "Regarde la silhouette générale, la longueur de la queue et le contraste de la tête pour éviter l'erreur.",
    discriminant: "L'autre est un o",
  };

  const out = validateAndClean(responseObj);
  assert.equal(out.valid, false);
  assert.ok(out.issues.some((issue) => issue.includes('phrase incomplète')));
  assert.ok(out.issues.some((issue) => issue.includes('semble tronqué')));
});

test('parseExplanationModeResponse normalizes brief snake_case fields', () => {
  const parsed = parseExplanationModeResponse(
    JSON.stringify({
      key_difference: 'Compare la silhouette et un trait stable.',
      why_tempting: 'les deux especes peuvent sembler proches au premier regard',
      next_look_for: 'un detail structurel net chez la bonne espece',
    }),
    'brief'
  );

  assert.equal(parsed.keyDifference, 'Compare la silhouette et un trait stable.');
});

test('validateBriefExplanation accepts a content-first brief payload', () => {
  const sourceMap = new Map([
    ['inat-desc-1', { id: 'inat-desc-1', kind: 'description' }],
    ['inat-desc-2', { id: 'inat-desc-2', kind: 'description' }],
  ]);

  const out = validateBriefExplanation(
    {
      keyDifference: 'Compare la silhouette generale et un caractere stable.',
      whyTempting: 'les deux especes peuvent sembler proches au premier regard',
      nextLookFor: 'un detail structurel net chez la bonne espece',
    },
    { locale: 'fr', sourceMap, correctName: 'Grand Cormoran', wrongName: 'Oie naine' }
  );

  assert.equal(out.valid, true);
  assert.equal(typeof out.brief.displayText, 'string');
  assert.ok(out.brief.displayText.length > 0);
  assert.ok(out.brief.displayText.includes('Grand Cormoran'));
  assert.ok(out.brief.displayText.includes('Oie naine'));
});

test('validateFullExplanation rejects anonymous comparisons in content-first mode', () => {
  const sourceMap = new Map([
    ['inat-tax-1', { id: 'inat-tax-1', kind: 'taxonomy' }],
    ['inat-desc-2', { id: 'inat-desc-2', kind: 'description' }],
  ]);

  const out = validateFullExplanation(
    {
      photoSummary:
        "Sur cette photo, le Grand Cormoran se distingue de l'Oie naine par une silhouette plus droite et un bec crochu.",
      observedClues: ['Le premier est plus sombre'],
      whyThisPhotoCouldMislead: "Sur cette photo, l'autre peut sembler proche au premier regard.",
      nextCheck: "Regarde d'abord le bec puis la posture.",
      caution: '',
    },
    { locale: 'fr', sourceMap }
  );

  assert.equal(out.valid, false);
  assert.ok(out.issues.some((issue) => issue.includes('comparaison anonyme')));
});

test('validateFullExplanation rejects pair drift when the response does not cite the two species', () => {
  const out = validateFullExplanation(
    {
      photoSummary:
        'Sur cette photo, la différence entre un poisson et un mammifère marin réside dans leur respiration et leur reproduction.',
      observedClues: ['Présence de nageoires et d écailles'],
      whyThisPhotoCouldMislead: 'La forme hydrodynamique peut tromper.',
      nextCheck: 'Vérifier la présence de branchies ou de poumons.',
      caution: '',
    },
    {
      locale: 'fr',
      correctName: 'Conure veuve',
      wrongName: 'Faucon crécerelle',
      sourceMap: new Map(),
    }
  );

  assert.equal(out.valid, false);
  assert.ok(out.issues.some((issue) => issue.includes('ne cite pas clairement les deux espèces')));
  assert.ok(out.issues.some((issue) => issue.includes('derive hors paire')));
});

test('buildBriefSupport attributes sources after validation', () => {
  const bundle = {
    correct: { taxonId: 1 },
    wrong: { taxonId: 2 },
    facts: [
      {
        id: 'f1',
        sourceId: 'inat-desc-1',
        provider: 'inaturalist',
        kind: 'description',
        category: 'description',
        taxonId: 1,
        text: 'Silhouette sombre, bec crochu, cou long et posture droite.',
      },
      {
        id: 'f2',
        sourceId: 'inat-desc-2',
        provider: 'wikimedia',
        kind: 'description',
        category: 'description',
        taxonId: 2,
        text: 'Cou plus court, bec plus compact, allure plus trapue.',
      },
    ],
  };
  const sourceMap = new Map([
    ['inat-desc-1', { id: 'inat-desc-1', kind: 'description' }],
    ['inat-desc-2', { id: 'inat-desc-2', kind: 'description' }],
  ]);

  const support = buildBriefSupport(
    {
      keyDifference: 'Silhouette droite et bec crochu',
      whyTempting: 'allure trapue proche au premier regard',
      nextLookFor: 'un long cou et un bec crochu',
    },
    bundle,
    sourceMap
  );

  assert.equal(support.level, 'grounded');
  assert.ok(support.sourceIds.includes('inat-desc-1'));
});

test('buildFullSupport only reports photo_grounded with multiple fact-backed fields', () => {
  const bundle = {
    correct: { taxonId: 1 },
    wrong: { taxonId: 2 },
    facts: [
      {
        id: 'f1',
        sourceId: 'inat-desc-1',
        provider: 'inaturalist',
        kind: 'description',
        category: 'description',
        taxonId: 1,
        text: 'Silhouette droite, bec crochu et cou long visibles sur la photo.',
      },
      {
        id: 'f2',
        sourceId: 'wiki-desc-1',
        provider: 'wikimedia',
        kind: 'description',
        category: 'description',
        taxonId: 2,
        text: 'Cette photo peut tasser les proportions et rendre l allure plus trapue.',
      },
    ],
  };
  const sourceMap = new Map([
    ['round-photo', { id: 'round-photo', kind: 'image' }],
    ['inat-desc-1', { id: 'inat-desc-1', kind: 'description' }],
    ['wiki-desc-1', { id: 'wiki-desc-1', kind: 'description' }],
  ]);

  const support = buildFullSupport(
    {
      photoSummary: 'Sur cette photo, le Grand Cormoran montre une silhouette droite et un bec crochu.',
      observedClues: ['Silhouette droite', 'Bec crochu'],
      whyThisPhotoCouldMislead: 'Sur cette photo, la distance peut tasser les proportions.',
      nextCheck: 'Regarde le bec puis la longueur du cou.',
      caution: '',
    },
    bundle,
    sourceMap,
    { photoSourceId: 'round-photo' }
  );

  assert.equal(support.level, 'photo_grounded');
  assert.equal(support.minimumSupportMet, true);
  assert.ok(support.sourceIds.includes('round-photo'));
  assert.ok(support.sourceIds.includes('inat-desc-1'));
});

test('buildFullSupport does not count the photo source alone as sufficient support', () => {
  const bundle = {
    correct: { taxonId: 1 },
    wrong: { taxonId: 2 },
    facts: [
      {
        id: 'f1',
        sourceId: 'inat-desc-1',
        provider: 'inaturalist',
        kind: 'description',
        category: 'description',
        taxonId: 1,
        text: 'Silhouette droite, bec crochu et cou long visibles sur la photo.',
      },
    ],
  };
  const sourceMap = new Map([
    ['round-photo', { id: 'round-photo', kind: 'image' }],
    ['inat-desc-1', { id: 'inat-desc-1', kind: 'description' }],
  ]);

  const support = buildFullSupport(
    {
      photoSummary: 'Sur cette photo, le Grand Cormoran montre une silhouette droite et un bec crochu.',
      observedClues: ['Silhouette droite'],
      whyThisPhotoCouldMislead: 'Sur cette photo, la distance peut tasser les proportions.',
      nextCheck: 'Vérifie un détail sans rapport.',
      caution: '',
    },
    bundle,
    sourceMap,
    { photoSourceId: 'round-photo' }
  );

  assert.equal(support.level, 'limited');
  assert.equal(support.minimumSupportMet, false);
  assert.deepEqual(support.supportByField.observedClues, ['inat-desc-1']);
});
