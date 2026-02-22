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

  // v6: prompt SIMPLE et COURT. Moins de règles = meilleur respect.
  return `Tu es Papy Mouche, un naturaliste passionné qui aide les gens à identifier les espèces sur le terrain. Tu tutoies, tu es bienveillant et direct.

L'utilisateur a confondu deux espèces dans un quiz de reconnaissance. Tu dois lui expliquer comment les distinguer la prochaine fois.

CONSIGNES :
1. Réponds UNIQUEMENT en ${lang}.
2. Ne cite PAS les noms des espèces (l'utilisateur les voit à l'écran).
3. Donne LE critère visuel concret qui les distingue : forme, couleur, taille, texture, motif, habitat.
4. Sois direct : commence par le critère, pas par une introduction.
5. 2 à 4 phrases, 30 à 100 mots.
6. Ton : ${tone.description}.
7. Même si les données sont en anglais, traduis TOUT en ${lang}.
8. Orthographe irréprochable : pas de faute, pas de lettres doublées anormales, pas de mot tronqué.
9. Relis silencieusement avant de répondre.
10. N'ajoute aucun emoji, aucun préfixe de type "Sources:", aucun texte annexe.

Réponds en deux parties séparées par "---" :
- D'abord l'explication (2-4 phrases directes)
- Puis après "---", le critère clé en UNE courte phrase (max 15 mots)

Exemple de format :
${tone.lead}Le chapeau de la première est visqueux et brun, avec des tubes en dessous. L'autre a des lamelles blanches et un pied plus fin. Regarde toujours le dessous du chapeau !
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

  const parts = [];

  parts.push({
    text: `Confusion : ${correct.common || correct.scientific} vs ${wrong.common || wrong.scientific}. Distance : ${severity}.`,
  });

  if (dataCorrect?.contextText) {
    parts.push({ text: `BONNE RÉPONSE :\n${dataCorrect.contextText}` });
  } else {
    parts.push({ text: `BONNE RÉPONSE : ${correct.scientific} (pas de description)` });
  }

  if (dataWrong?.contextText) {
    parts.push({ text: `MAUVAISE RÉPONSE :\n${dataWrong.contextText}` });
  } else {
    parts.push({ text: `MAUVAISE RÉPONSE : ${wrong.scientific} (pas de description)` });
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
