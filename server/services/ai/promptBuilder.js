// server/services/ai/promptBuilder.js
// Prompts v7 — brief auto + explication detaillee, tous deux strictement structures.

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

function buildPersonaRules({ severity, locale, includeFieldRules = [] }) {
  const tone = PERSONA.toneByContext[severity] || PERSONA.toneByContext.MEDIUM;
  const lang = LOCALE_LABELS[locale] || 'français';

  return `Tu es ${PERSONA.name}, ${PERSONA.role}.
Tu reponds UNIQUEMENT en ${lang}.
Tu aides a distinguer deux especes apres une confusion dans un quiz naturaliste.

REGLES ABSOLUES :
1. Cite toujours explicitement les deux especes. N'utilise jamais "le premier", "l'autre", "the first", "de andere".
2. Reste concret, fiable, et utile sur photo ou sur le terrain.
3. N'invente aucun fait absent des preuves fournies.
4. Si un critere n'est pas appuye par les preuves, n'en parle pas.
5. N'ajoute pas de sources libres dans le texte.
6. Pas d'humour parasite, pas de jargon non explique, pas de longues digressions.
7. Concentre-toi sur les faits les plus utiles pour distinguer les deux especes.

STYLE :
- ton ${tone.description}
- phrases courtes
- un repere fort avant tout
- reponse utile en lecture rapide

CHAMPS A REMPLIR :
${includeFieldRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`;
}

export function buildBriefSystemPrompt({ severity, locale }) {
  return buildPersonaRules({
    severity,
    locale,
    includeFieldRules: [
      'key_difference : 4 a 16 mots, difference visuelle ou structurelle principale.',
      "why_tempting : 6 a 24 mots, pourquoi l'erreur semble logique au premier regard.",
      'next_look_for : 5 a 18 mots, detail concret a verifier la prochaine fois.',
    ],
  });
}

export function buildFullSystemPrompt({ severity, locale }) {
  return `${buildPersonaRules({
    severity,
    locale,
    includeFieldRules: [
      'explanation : 30 a 90 mots, explication pedagogique concise.',
      'visual_clue : 8 a 24 mots, indice visuel observable immediatement.',
      'taxonomic_rule : 8 a 22 mots, regle de tri taxonomique actionnable.',
      'why_this_confusion_happens : 10 a 28 mots, pourquoi cette confusion precise est plausible.',
      'discriminant : 2 a 12 mots, formule nominale sans narration.',
    ],
  })}

REGLES FULL SUPPLEMENTAIRES :
- Parle uniquement de la bonne espece et de l'espece choisie.
- N'introduis jamais de troisieme espece, de genre externe, de comparaison libre ou d'analogie hors paire.
- Ne donne pas de cours general de biologie si ce n'est pas directement utile a cette confusion.
- Si les preuves sont faibles, reste court, prudent et concret.
- Pour une severite HUGE, reste sur des contrastes tres visibles: silhouette, milieu, structure generale.`;
}

export function buildRepairSystemPrompt({ mode, locale }) {
  const lang = LOCALE_LABELS[locale] || 'français';
  const fieldRules =
    mode === 'brief'
      ? [
          'key_difference',
          'why_tempting',
          'next_look_for',
        ]
      : [
          'explanation',
          'visual_clue',
          'taxonomic_rule',
          'why_this_confusion_happens',
          'discriminant',
        ];

  return `Tu es un reparateur de sortie JSON.
Tu reponds UNIQUEMENT en ${lang}.
Ta mission est de transformer un brouillon de reponse IA en JSON valide.

REGLES :
1. N'invente pas de nouveaux faits.
2. Conserve le sens utile du brouillon quand il est recuperable.
3. Supprime tout texte parasite, markdown, ou commentaire.
4. Si une information manque, remplis avec la formulation la plus sobre possible a partir du brouillon.
5. Retourne uniquement un objet JSON avec ces champs: ${fieldRules.join(', ')}.`;
}

function buildPlayerContext({ packId, gameMode, masteryBucket, confusionBucket }) {
  const parts = [];
  if (packId) parts.push(`pack=${packId}`);
  if (gameMode) parts.push(`mode=${gameMode}`);
  if (masteryBucket) parts.push(`niveau=${masteryBucket}`);
  if (confusionBucket) parts.push(`confusion=${confusionBucket}`);
  return parts.length > 0 ? `Contexte joueur: ${parts.join(' | ')}.` : null;
}

function buildFactLines(facts = [], maxItems = 5) {
  return facts.slice(0, maxItems).map((fact) => `- ${fact.category}: ${fact.text}`);
}

function buildEvidenceSummary(evidence) {
  const lines = [];
  const label = evidence?.label || evidence?.taxonomy?.scientific || 'Espece inconnue';
  lines.push(`ESPECE: ${label}`);
  if (evidence?.taxonomy?.scientific) lines.push(`Nom scientifique: ${evidence.taxonomy.scientific}`);
  if (evidence?.taxonomy?.family) lines.push(`Famille: ${evidence.taxonomy.family}`);
  if (evidence?.taxonomy?.genus) lines.push(`Genre: ${evidence.taxonomy.genus}`);
  if (evidence?.taxonomy?.rank) lines.push(`Rang: ${evidence.taxonomy.rank}`);
  if (Array.isArray(evidence?.promptFacts?.description) && evidence.promptFacts.description.length > 0) {
    lines.push('Faits descriptifs utiles:');
    lines.push(...buildFactLines(evidence.promptFacts.description, 5));
  }
  if (Array.isArray(evidence?.promptFacts?.taxonomy) && evidence.promptFacts.taxonomy.length > 0) {
    lines.push('Repères taxonomiques:');
    lines.push(...buildFactLines(evidence.promptFacts.taxonomy, 2));
  }
  if (Array.isArray(evidence?.promptFacts?.distribution) && evidence.promptFacts.distribution.length > 0) {
    lines.push('Contexte:');
    lines.push(...buildFactLines(evidence.promptFacts.distribution, 2));
  }
  return lines.join('\n');
}

function buildSharedExplanationParts({
  correctTaxon,
  wrongTaxon,
  severity,
  bundle,
  packId,
  gameMode,
  masteryBucket,
  confusionBucket,
}) {
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
    text: `Confusion entre ${correctLabel} (bonne reponse) et ${wrongLabel} (reponse choisie). Severite taxonomique: ${severity}.`,
  });
  const playerContext = buildPlayerContext({ packId, gameMode, masteryBucket, confusionBucket });
  if (playerContext) {
    parts.push({ text: playerContext });
  }
  if (Array.isArray(bundle?.contrastFacts) && bundle.contrastFacts.length > 0) {
    parts.push({
      text: `Contrastes serveur:\n${buildFactLines(bundle.contrastFacts, 3).join('\n')}`,
    });
  }
  if (bundle?.correct) {
    parts.push({ text: buildEvidenceSummary(bundle.correct) });
  }
  if (bundle?.wrong) {
    parts.push({ text: buildEvidenceSummary(bundle.wrong) });
  }
  return parts;
}

export function buildBriefUserParts({
  correctTaxon,
  wrongTaxon,
  severity,
  bundle,
  packId,
  gameMode,
  masteryBucket,
  confusionBucket,
}) {
  return buildSharedExplanationParts({
    correctTaxon,
    wrongTaxon,
    severity,
    bundle,
    packId,
    gameMode,
    masteryBucket,
    confusionBucket,
  });
}

export function buildFullUserParts({
  correctTaxon,
  wrongTaxon,
  severity,
  bundle,
  packId,
  gameMode,
  masteryBucket,
  confusionBucket,
  imageContext = null,
}) {
  const parts = buildSharedExplanationParts({
    correctTaxon,
    wrongTaxon,
    severity,
    bundle,
    packId,
    gameMode,
    masteryBucket,
    confusionBucket,
  });
  if (imageContext?.enabled && imageContext?.note) {
    parts.push({ text: `Contexte image (desactive en v1): ${imageContext.note}` });
  }
  return parts;
}

export function buildRepairUserParts({ rawText, mode }) {
  return [
    {
      text: `Mode cible: ${mode}`,
    },
    {
      text: `Brouillon a reparer:\n${String(rawText || '').slice(0, 3000)}`,
    },
  ];
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
