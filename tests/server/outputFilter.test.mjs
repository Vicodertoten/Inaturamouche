import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAIResponse, validateAndClean } from '../../server/services/ai/outputFilter.js';

test('parseAIResponse removes emoji and source lines before parsing', () => {
  const raw = `Observe bien la silhouette et la couleur dominante.
---
Contraste silhouette/couleur

🔍
Sources : Wikipedia (en), iNaturalist`;

  const parsed = parseAIResponse(raw);
  assert.ok(parsed);
  assert.equal(parsed.explanation, 'Observe bien la silhouette et la couleur dominante.');
  assert.equal(parsed.discriminant, 'Contraste silhouette/couleur');
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
