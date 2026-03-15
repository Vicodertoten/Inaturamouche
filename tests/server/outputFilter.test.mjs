import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAIResponse, validateAndClean } from '../../server/services/ai/outputFilter.js';

test('parseAIResponse removes emoji and source lines before parsing', () => {
  const raw = JSON.stringify({
    intro: 'Bien vu, on corrige ça ensemble.',
    explanation: 'Observe bien la silhouette et la couleur dominante.',
    discriminant: 'Contraste silhouette/couleur',
    visual_clue: 'Le motif de l’aile est plus contrasté chez la bonne espèce.',
    taxonomic_rule: 'Commence par la famille, puis valide la forme du bec.',
    counter_example: 'La couleur peut sembler proche, mais la silhouette reste différente.',
  });

  const parsed = parseAIResponse(raw);
  assert.ok(parsed);
  assert.equal(parsed.explanation, 'Bien vu, on corrige ça ensemble. Observe bien la silhouette et la couleur dominante.');
  assert.equal(parsed.discriminant, 'Contraste silhouette/couleur');
  assert.equal(parsed.visualClue, 'Le motif de l’aile est plus contrasté chez la bonne espèce.');
  assert.equal(parsed.taxonomicRule, 'Commence par la famille, puis valide la forme du bec.');
  assert.equal(parsed.counterExample, 'La couleur peut sembler proche, mais la silhouette reste différente.');
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
