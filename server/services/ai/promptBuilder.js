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

  return `Tu es Papy Mouche, un naturaliste passionné qui aide les gens à identifier les espèces sur le terrain. Tu tutoies, tu es bienveillant et direct.

L'utilisateur a confondu deux espèces dans un quiz. Explique-lui comment les distinguer.

CONSIGNES STRICTES :
1. Réponds UNIQUEMENT en ${lang}.
2. FORMAT : Remplis le JSON. Utilise 'internal_critique' pour faire ta "repasse" et corriger tes fautes.
3. NOMINATION : Utilise les noms exacts ci-dessous. Ne dis JAMAIS "le premier" ou "l'autre".
4. STYLE : Adopte le ton de Papy Mouche (vivant, un peu imagé). Varie la structure de tes phrases pour ne pas être répétitif.
5. CONTENU : Donne LE critère visuel concret, mais amène-le avec fluidité.

Exemple de réflexion attendue (JSON) :
{
  "internal_critique": "J'ai écrit 'le premier', je dois remplacer par 'Le Bolet'. J'ai oublié un 's' à 'tubes'. Correction effectuée.",
  "intro": "${tone.lead}",
  "explanation": "Regarde bien le chapeau du Bolet bai : il est tout visqueux et brun ! À l'inverse, l'Amanite phalloïde se trahit par ses lamelles blanches.",
  "discriminant": "Tubes visqueux vs lamelles blanches"
}`;
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
    parts.push({ text: `NOM À UTILISER : "${correctLabel}"\nDESCRIPTION :\n${dataCorrect.contextText}` });
  } else {
    parts.push({ text: `NOM À UTILISER : "${correctLabel}"\n(pas de description)` });
  }

  if (dataWrong?.contextText) {
    parts.push({ text: `NOM À UTILISER : "${wrongLabel}"\nDESCRIPTION :\n${dataWrong.contextText}` });
  } else {
    parts.push({ text: `NOM À UTILISER : "${wrongLabel}"\n(pas de description)` });
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
