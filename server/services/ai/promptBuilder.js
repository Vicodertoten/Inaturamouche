// server/services/ai/promptBuilder.js
// Prompts v6 — simples, directs, fiables
// Philosophie : moins de contraintes = plus de réponses exploitables.
// On demande du TEXTE BRUT, pas du JSON. Le parsing est côté outputFilter.

import { PERSONA } from './aiConfig.js';

// ── Helpers ─────────────────────────────────────────────────────

const getAncestorId = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon.id;
  return Array.isArray(taxon.ancestors)
    ? taxon.ancestors.find((a) => a?.rank === rank)?.id || null
    : null;
};

const getCommonName = (taxon) =>
  taxon?.preferred_common_name || taxon?.common_name || null;

// ── Calcul de sévérité ──────────────────────────────────────────

export function calculateSeverity(correctTaxon, wrongTaxon) {
  const sameGenus =
    getAncestorId(correctTaxon, 'genus') &&
    getAncestorId(correctTaxon, 'genus') === getAncestorId(wrongTaxon, 'genus');
  if (sameGenus) return 'CLOSE';

  const sameFamily =
    getAncestorId(correctTaxon, 'family') &&
    getAncestorId(correctTaxon, 'family') === getAncestorId(wrongTaxon, 'family');
  if (sameFamily) return 'MEDIUM';

  const kingdomId = getAncestorId(correctTaxon, 'kingdom');
  const wrongKingdomId = getAncestorId(wrongTaxon, 'kingdom');
  if (kingdomId && wrongKingdomId && kingdomId !== wrongKingdomId) return 'HUGE';

  const classId = getAncestorId(correctTaxon, 'class');
  const wrongClassId = getAncestorId(wrongTaxon, 'class');
  if (classId && wrongClassId && classId !== wrongClassId) return 'HUGE';

  const iconicMismatch =
    correctTaxon?.iconic_taxon_id &&
    wrongTaxon?.iconic_taxon_id &&
    correctTaxon.iconic_taxon_id !== wrongTaxon.iconic_taxon_id;
  if (iconicMismatch) return 'HUGE';

  return 'MEDIUM';
}

// ── Prompt d'explication ────────────────────────────────────────

const LOCALE_LABELS = { fr: 'français', en: 'English', nl: 'Nederlands' };

export function buildExplanationSystemPrompt({ severity, locale }) {
  const tone = PERSONA.toneByContext[severity] || PERSONA.toneByContext.MEDIUM;
  const lang = LOCALE_LABELS[locale] || 'français';

  // v6.1: Prompt renforcé pour nomination explicite et grammaire
  return `Tu es Papy Mouche, un naturaliste passionné qui aide les gens à identifier les espèces sur le terrain. Tu tutoies, tu es bienveillant et direct.

L'utilisateur a confondu deux espèces dans un quiz. Explique-lui comment les distinguer.

CONSIGNES STRICTES :
1. Réponds UNIQUEMENT en ${lang}.
2. NOMINATION OBLIGATOIRE : Utilise TOUJOURS le nom complet de l'espèce (ex: "Le Merle noir", "The Red Fox") à chaque mention.
3. INTERDIT : Ne dis JAMAIS "le premier", "le second", "l'autre", "celui-ci", "the first one", "de andere", etc. C'est confus pour l'élève.
4. Donne LE critère visuel concret qui les distingue : forme, couleur, taille, texture, motif.
5. Sois direct : commence par le critère, pas par une introduction.
6. Longueur : 2 à 4 phrases, 30 à 100 mots.
7. Ton : ${tone.description}.
8. Traduction : Même si les données fournies sont en anglais, ta réponse doit être 100% en ${lang}.
9. Qualité : Grammaire et orthographe irréprochables. Phrases simples et bien construites.
10. Format : Pas d'emoji, pas de "Sources:", pas de méta-texte.

Réponds en deux parties séparées par "---" :
- D'abord l'explication (2-4 phrases directes)
- Puis après "---", le critère clé en UNE courte phrase (max 15 mots)

Exemple de format ATTENDU (si les espèces sont Bolet bai et Amanite phalloïde) :
${tone.lead}Le chapeau du Bolet bai est visqueux et brun, avec des tubes en dessous. L'Amanite phalloïde a des lamelles blanches et un pied plus fin avec une volve. Regarde toujours le dessous du chapeau !
---
Tubes visqueux vs lamelles blanches`;
}

export function buildExplanationUserParts({ correctTaxon, wrongTaxon, locale: _locale, severity, dataCorrect, dataWrong }) {
  const correct = {
    scientific: correctTaxon?.name || 'inconnue',
    common: getCommonName(correctTaxon) || null,
  };
  const wrong = {
    scientific: wrongTaxon?.name || 'inconnue',
    common: getCommonName(wrongTaxon) || null,
  };

  const correctLabel = correct.common ? `${correct.common} (${correct.scientific})` : correct.scientific;
  const wrongLabel = wrong.common ? `${wrong.common} (${wrong.scientific})` : wrong.scientific;

  const parts = [];

  parts.push({
    text: `Confusion entre : ${correctLabel} (CORRECT) et ${wrongLabel} (INCORRECT). Distance : ${severity}.`,
  });

  // Injection explicite des noms dans les headers de données pour guider l'IA
  if (dataCorrect?.contextText) {
    parts.push({ text: `ESPÈCE 1 (La bonne réponse) - ${correctLabel} :\n${dataCorrect.contextText}` });
  } else {
    parts.push({ text: `ESPÈCE 1 (La bonne réponse) - ${correctLabel} : (pas de description)` });
  }

  if (dataWrong?.contextText) {
    parts.push({ text: `ESPÈCE 2 (La mauvaise réponse) - ${wrongLabel} :\n${dataWrong.contextText}` });
  } else {
    parts.push({ text: `ESPÈCE 2 (La mauvaise réponse) - ${wrongLabel} : (pas de description)` });
  }

  return parts;
}

// ── Prompt d'énigme ─────────────────────────────────────────────

export function buildRiddleSystemPrompt({ locale }) {
  const lang = LOCALE_LABELS[locale] || 'français';

  return `Tu es Papy Mouche, un naturaliste passionné. Crée une énigme en 3 indices pour faire deviner une espèce.

CONSIGNES :
1. Réponds UNIQUEMENT en ${lang}.
2. Ne donne JAMAIS le nom de l'espèce.
3. Indice 1 = difficile (habitat, répartition, comportement subtil).
4. Indice 2 = moyen (trait morphologique distinctif).
5. Indice 3 = facile (trait le plus évident).
6. Chaque indice = une phrase courte et concrète.
7. Même si les données sont en anglais, traduis TOUT en ${lang}.

Format : 3 lignes, une par indice, numérotées 1. 2. 3.`;
}

export function buildRiddleUserParts({ targetTaxon, locale: _locale, speciesData }) {
  const common = getCommonName(targetTaxon);
  const scientific = targetTaxon?.name;
  const label = common ? `${common} (${scientific})` : scientific;

  const parts = [{ text: `Espèce à deviner : ${label}` }];

  if (speciesData?.contextText) {
    parts.push({ text: `DONNÉES :\n${speciesData.contextText}` });
  }

  parts.push({ text: 'Crée 3 indices du plus difficile au plus facile.' });

  return parts;
}
