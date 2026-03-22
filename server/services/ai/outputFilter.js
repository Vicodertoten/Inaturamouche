// server/services/ai/outputFilter.js
// Filtre de sortie v6 — parsing robuste de texte brut + fallback intelligent

import { OUTPUT_CONSTRAINTS, FALLBACK_TIPS, PERSONA } from './aiConfig.js';

// ── Helpers ─────────────────────────────────────────────────────

const countWords = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const collectQualityIssues = (text, { label = 'texte' } = {}) => {
  if (!text) return [];
  const issues = [];
  const trimmed = text.trim();

  // Exemple visé: "boooon", "mammifèree", artefacts de génération.
  // SYSTEME PARFAIT : On autorise 3 lettres (ex: "Bzzz") pour les onomatopées, on flag à partir de 4.
  if (/\b[\p{L}]*([\p{L}])\1{3,}[\p{L}]*\b/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient trop de lettres répétées`);
  }

  // Exemple visé: "de de", "avec avec".
  // Exception pour "nous nous", "vous vous" (verbes pronominaux).
  const dupMatches = text.match(/\b(\p{L}{2,})\s+\1\b/giu);
  if (dupMatches) {
    const realDups = dupMatches.filter((m) => {
      const word = m.split(/\s+/)[0].toLowerCase();
      return !['nous', 'vous'].includes(word);
    });
    if (realDups.length > 0) {
      issues.push(`QUALITY: ${label} contient un mot dupliqué (${realDups[0]})`);
    }
  }

  // Garde-fou simple contre mots "cassés" très longs.
  if (/\b[\p{L}-]{31,}\b/u.test(text)) {
    issues.push(`QUALITY: ${label} contient un mot anormalement long`);
  }

  // Exemple visé: ",,", "!!", "...?".
  if (/[,;:.!?]{2,}/u.test(text)) {
    issues.push(`QUALITY: ${label} contient une ponctuation anormale`);
  }

  // Exemple visé: "Sources : Wikipedia..." (bruit inutile dans la réponse finale).
  if (/\bsource(?:s)?\s*:/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient des métadonnées parasites`);
  }

  // Exemple visé: "🔍" et autres symboles non textuels.
  if (/[^\p{L}\p{N}\s,;:.!?()'"’-]/u.test(text)) {
    issues.push(`QUALITY: ${label} contient des symboles non textuels`);
  }

  // Exemple visé: "uu", "noiie", "plussvariées".
  // MODIF: Retrait de 'ee' (créée) et 'oo' (zoo, alcool) pour le français
  if (/\b[\p{L}-]*(?:aa|ii|uu|yy|ss[bcdfghjklmnpqrstvwxz]|mm[bcdfghjklmnpqrstvwxz])[\p{L}-]*\b/iu.test(text)) {
    issues.push(`QUALITY: ${label} contient des séquences de lettres suspectes`);
  }

  // Garde-fou pour texte coupé brutalement.
  if (trimmed.length > 8 && !/[.!?]$/.test(trimmed)) {
    const lastToken = trimmed.split(/\s+/).filter(Boolean).pop() || '';
    if (lastToken.length <= 2) {
      issues.push(`QUALITY: ${label} semble tronqué`);
    }
  }

  // helper for anonymous comparison in various languages
  function containsAnonymousComparison(t) {
    if (!t) return false;
    // français, anglais, espagnol et néerlandais (ajout de "het")
    const pattern = /\b(?:L'un|Le premier|La première|Le second|La seconde|the first|the second|the other|first one|second one|el primero|el segundo|el otro|la primera|la segunda|de eerste|het eerste|de tweede|het tweede|de andere|het andere)\b/i;
    return pattern.test(t);
  }
  if (containsAnonymousComparison(text)) {
    // on considère désormais que c'est un défaut bloquant :
    issues.push(`QUALITY: ${label} ne cite pas l'espèce (comparaison anonyme)`);
  }

  return issues;
};

const getCommonName = (taxon) =>
  taxon?.preferred_common_name || taxon?.common_name || null;

const buildFallbackPedagogyText = ({ key, correctName, wrongName, locale = 'fr' }) => {
  const correct = correctName || (locale === 'en' ? 'the correct species' : 'la bonne espèce');
  const wrong = wrongName || (locale === 'en' ? 'the confused species' : "l'espèce confondue");

  if (locale === 'en') {
    const map = {
      visualClue: `Visual clue: focus on body shape, pattern, and texture to recognize ${correct}.`,
      taxonomicRule: 'Taxonomic rule: start from a stable rank (family/genus), then confirm one concrete field mark.',
      counterExample: `Counter-example: ${wrong} may share color or habitat, but not the key structural trait.`,
    };
    return map[key] || '';
  }

  const map = {
    visualClue: `Indice visuel clé : observe la forme, le motif et la texture pour reconnaître ${correct}.`,
    taxonomicRule: 'Règle taxonomique : pars d’un rang stable (famille/genre), puis confirme un caractère concret.',
    counterExample: `Contre-exemple : ${wrong} peut partager la couleur ou l’habitat, mais pas le caractère structurel décisif.`,
  };
  return map[key] || '';
};

export function buildPedagogyBlocks(
  {
    visualClue,
    taxonomicRule,
    whyThisConfusionHappens,
    counterExample,
    explanation,
    correctName,
    wrongName,
    locale = 'fr',
  } = {}
) {
  const visual = normalizeExplanation(visualClue || '', { correctName, wrongName, locale });
  const rule = normalizeExplanation(taxonomicRule || '', { correctName, wrongName, locale });
  const confusionReason = normalizeExplanation(whyThisConfusionHappens || counterExample || '', {
    correctName,
    wrongName,
    locale,
  });
  const normalizedExplanation = normalizeExplanation(explanation || '', { correctName, wrongName, locale });

  const finalConfusionReason =
    confusionReason || buildFallbackPedagogyText({ key: 'counterExample', correctName, wrongName, locale });

  return {
    visualClue: visual || normalizedExplanation || buildFallbackPedagogyText({ key: 'visualClue', correctName, wrongName, locale }),
    taxonomicRule: rule || buildFallbackPedagogyText({ key: 'taxonomicRule', correctName, wrongName, locale }),
    whyThisConfusionHappens: finalConfusionReason,
    counterExample: finalConfusionReason,
  };
}

// ── Normalisation du texte ──────────────────────────────────────

/**
 * Nettoyage typographique fin pour une écriture "irréprochable".
 */
function cleanTypography(text) {
  if (!text) return '';
  return text
    .replace(/\s+([,.;:!?])/g, '$1') // Enlève espace avant ponctuation (ex: "mot ." -> "mot.")
    .replace(/([.!?])\s*([a-zà-ÿ])/g, (match, p1, p2) => `${p1} ${p2.toUpperCase()}`) // Force majuscule après phrase
    .replace(/\s{2,}/g, ' ') // Double espaces
    .replace(/^\s*[a-zà-ÿ]/, (c) => c.toUpperCase()) // Force majuscule début de texte
    .replace(/\( /g, '(').replace(/ \)/g, ')') // Espaces dans parenthèses
    .trim();
}

export function normalizeExplanation(text, {correctName, wrongName, locale} = {}) {
  if (!text) return '';
  let value = text.trim().replace(/\s+/g, ' ');

  // remplacement simpliste des pronoms vagues par les noms d'espèces fournis
  // C'est un filet de sécurité, mais le prompt devrait éviter d'arriver ici.
  if (correctName && wrongName) {
    const replacers = [
      // FR
      {pattern: /\b(le premier|la première|premier|première)\b/gi, replacement: correctName},
      {pattern: /\b(le second|la seconde|l'autre|second|seconde)\b/gi, replacement: wrongName},
      // EN
      {pattern: /\b(the first(?: one)?|first one)\b/gi, replacement: correctName},
      {pattern: /\b(the second(?: one)?|the other|second one)\b/gi, replacement: wrongName},
      // NL (ajout du neutre 'het')
      {pattern: /\b(de eerste|het eerste)\b/gi, replacement: correctName},
      {pattern: /\b(de tweede|het tweede|de andere|het andere)\b/gi, replacement: wrongName},
    ];

    replacers.forEach(({pattern, replacement}) => {
      value = value.replace(pattern, replacement);
    });
  }

  value = value.replace(/\b(visible|montr[ée]e?|présent[ée]e?)\s+(sur|dans)\s+(la|l')\s*(premi[eè]re|seconde|deuxi[eè]me)?\s*(image|photo)\b/gi, '');
  value = value.replace(/\b(sur|dans)\s+(la|l')\s*(image|photo)\b/gi, '');
  value = value.replace(/\b(selon|d'apr[eè]s)\s+wikip[ée]dia\b/gi, '');
  
  return cleanTypography(value);
}

// ── Parsing de la réponse IA ────────────────────────────────────

/**
 * Parse la réponse de l'IA. v6.2 : JSON natif strict.
 * Le parsing texte brut est conservé uniquement comme fallback ultime.
 */
export function parseAIResponse(text) {
  if (!text) return null;

  const attemptParse = (jsonStr) => {
    try {
      const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return null;
    }
  };

  // 1. Parsing standard
  let parsed = attemptParse(text);

  // 2. Tentative de réparation si JSON tronqué (ex: "Unterminated string...")
  if (!parsed) {
    // On essaie de fermer la chaîne et l'objet pour sauver les meubles
    parsed = attemptParse(text + '"}');
    // Si ça échoue, peut-être que la chaine était déjà fermée mais pas l'objet
    if (!parsed) parsed = attemptParse(text + '}');
  }

  if (parsed && parsed.explanation) {
    // On combine l'intro (si présente) avec l'explication pour l'UI actuelle
    const fullExplanation = parsed.intro 
      ? `${parsed.intro} ${parsed.explanation}`
      : parsed.explanation;

    return {
      explanation: normalizeExplanation(fullExplanation), // Note: names not available here yet, done in validate
      discriminant: parsed.discriminant ? String(parsed.discriminant).trim() : null,
      visualClue: parsed.visual_clue ? String(parsed.visual_clue).trim() : null,
      taxonomicRule: parsed.taxonomic_rule ? String(parsed.taxonomic_rule).trim() : null,
      whyThisConfusionHappens:
        parsed.why_this_confusion_happens
          ? String(parsed.why_this_confusion_happens).trim()
          : parsed.counter_example
            ? String(parsed.counter_example).trim()
            : null,
      counterExample:
        parsed.why_this_confusion_happens
          ? String(parsed.why_this_confusion_happens).trim()
          : parsed.counter_example
            ? String(parsed.counter_example).trim()
            : null,
    };
  }

  console.error("JSON Parse Error in AI Response (Unrecoverable)");
  return null;
}

// ── Validation ──────────────────────────────────────────────────

export function validateAndClean(responseObj, {correctName, wrongName} = {}) {
  const c = OUTPUT_CONSTRAINTS.explanation;
  const issues = [];

  if (!responseObj || typeof responseObj !== 'object') {
    return { valid: false, issues: ['Réponse non-objet'], explanation: null, discriminant: null };
  }

  const explanation = normalizeExplanation(responseObj.explanation, {correctName, wrongName});
  const discriminant = responseObj.discriminant
    ? String(responseObj.discriminant).trim()
    : null;
  const pedagogy = buildPedagogyBlocks({
    visualClue: responseObj.visualClue,
    taxonomicRule: responseObj.taxonomicRule,
    counterExample: responseObj.counterExample,
    explanation,
    correctName,
    wrongName,
  });

  const wordCount = countWords(explanation);
  // vérifier que l'une des deux espèces est mentionnée
  if (correctName || wrongName) {
    const lower = explanation.toLowerCase();
    const hasCorrect = correctName && lower.includes(correctName.toLowerCase());
    const hasWrong = wrongName && lower.includes(wrongName.toLowerCase());
    if (!hasCorrect && !hasWrong) {
      issues.push('QUALITY: explication ne mentionne aucune des espèces');
    }
  }
  if (wordCount < c.minWords) issues.push(`Trop court (${wordCount} mots)`);
  if (wordCount > c.maxWords * 1.5) issues.push(`Trop long (${wordCount} mots)`);
  issues.push(...collectQualityIssues(explanation, { label: 'explication' }));
  issues.push(...collectQualityIssues(pedagogy.visualClue, { label: 'indice visuel' }));
  issues.push(...collectQualityIssues(pedagogy.taxonomicRule, { label: 'règle taxonomique' }));
  issues.push(...collectQualityIssues(pedagogy.counterExample, { label: 'contre-exemple' }));
  if (discriminant) {
    const discriminantWords = countWords(discriminant);
    if (discriminantWords > 18) {
      issues.push(`QUALITY: critère trop long (${discriminantWords} mots)`);
    }
    // Le critère attendu est une formule courte, pas une phrase narrative.
    if (/\b(?:est|sont|a|ont|étais|était|étaient|sera|seront)\b/iu.test(discriminant)) {
      issues.push('QUALITY: critère ressemble à une phrase incomplète');
    }
    issues.push(...collectQualityIssues(discriminant, { label: 'critère' }));
  }

  return {
    valid: issues.length === 0,
    issues,
    explanation: explanation || null,
    discriminant,
    pedagogy,
  };
}

const BRIEF_FIELD_LABELS = {
  keyDifference: 'difference cle',
  whyTempting: 'confusion plausible',
  nextLookFor: 'repere a regarder',
};

const FULL_FIELD_LABELS = {
  explanation: 'explication',
  visualClue: 'indice visuel',
  taxonomicRule: 'regle taxonomique',
  whyThisConfusionHappens: 'pourquoi la confusion',
  discriminant: 'critere',
};

const BRIEF_FIELD_ALLOWED_KINDS = {
  keyDifference: ['description', 'taxonomy'],
  whyTempting: ['description', 'taxonomy'],
  nextLookFor: ['description'],
};

const FULL_FIELD_ALLOWED_KINDS = {
  explanation: ['description'],
  visualClue: ['description'],
  taxonomicRule: ['description', 'taxonomy', 'synonymy'],
  whyThisConfusionHappens: ['description', 'taxonomy'],
  discriminant: ['description', 'taxonomy'],
};

const MATCH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'tout', 'avec', 'pour', 'dans',
  'une', 'des', 'les', 'que', 'qui', 'sur', 'par', 'plus', 'sont', 'est', 'pas', 'aux', 'chez',
  'ook', 'een', 'met', 'van', 'dat', 'die', 'het', 'een', 'voor', 'naar', 'deze', 'zijn',
  'look', 'next', 'time', 'regarde', 'fois', 'prochaine', 'error', 'erreur', 'species', 'espece',
]);

function hasBlockingQualityIssue(issue) {
  return (
    issue.includes('trop de lettres répétées') ||
    issue.includes('mot anormalement long') ||
    issue.includes('séquences de lettres suspectes') ||
    issue.includes('comparaison anonyme') ||
    issue.includes('symboles non textuels')
  );
}

function toSnakeCaseKey(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function normalizeSourceIdsByField(value, keys) {
  const normalized = {};
  keys.forEach((key) => {
    const snakeKey = toSnakeCaseKey(key);
    const input = Array.isArray(value?.[key])
      ? value[key]
      : Array.isArray(value?.[snakeKey])
        ? value[snakeKey]
        : [];
    normalized[key] = Array.from(
      new Set(
        input
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 3)
      )
    );
  });
  return normalized;
}

function validateWordRange(value, { minWords, maxWords }, label, issues) {
  const wordCount = countWords(value);
  if (wordCount < minWords) issues.push(`QUALITY: ${label} trop court (${wordCount} mots)`);
  if (wordCount > maxWords) issues.push(`QUALITY: ${label} trop long (${wordCount} mots)`);
}

function normalizeBriefPayload(parsed, { correctName, wrongName, locale }) {
  const fallbackKeyDifference = parsed?.discriminant || parsed?.visual_clue || parsed?.visualClue || '';
  const fallbackNextLookFor = parsed?.visual_clue || parsed?.visualClue || parsed?.key_difference || parsed?.keyDifference || '';
  return {
    keyDifference: normalizeExplanation(parsed?.key_difference || parsed?.keyDifference || '', {
      correctName,
      wrongName,
      locale,
    }),
    whyTempting: normalizeExplanation(parsed?.why_tempting || parsed?.whyTempting || '', {
      correctName,
      wrongName,
      locale,
    }),
    nextLookFor: normalizeExplanation(parsed?.next_look_for || parsed?.nextLookFor || fallbackNextLookFor, {
      correctName,
      wrongName,
      locale,
    }),
    sourceIdsByField: normalizeSourceIdsByField(parsed?.source_ids_by_field || parsed?.sourceIdsByField, [
      'keyDifference',
      'whyTempting',
      'nextLookFor',
    ]),
    fallbackKeyDifference: normalizeExplanation(fallbackKeyDifference, { correctName, wrongName, locale }),
  };
}

function normalizeFullPayload(parsed, { correctName, wrongName, locale }) {
  const normalizedExplanation = normalizeExplanation(parsed?.explanation || '', { correctName, wrongName, locale });
  const normalizedVisual = normalizeExplanation(parsed?.visual_clue || parsed?.visualClue || normalizedExplanation, {
    correctName,
    wrongName,
    locale,
  });
  const normalizedTaxonomic = normalizeExplanation(
    parsed?.taxonomic_rule || parsed?.taxonomicRule || parsed?.discriminant || normalizedVisual,
    {
      correctName,
      wrongName,
      locale,
    }
  );
  const normalizedCounter = normalizeExplanation(
    parsed?.why_this_confusion_happens ||
      parsed?.whyThisConfusionHappens ||
      parsed?.counter_example ||
      parsed?.counterExample ||
      normalizedExplanation,
    {
      correctName,
      wrongName,
      locale,
    }
  );
  return {
    explanation: normalizedExplanation,
    visualClue: normalizedVisual,
    taxonomicRule: normalizedTaxonomic,
    whyThisConfusionHappens: normalizedCounter,
    counterExample: normalizedCounter,
    discriminant: normalizeExplanation(parsed?.discriminant || parsed?.key_difference || normalizedVisual, {
      correctName,
      wrongName,
      locale,
    }),
    sourceIdsByField: normalizeSourceIdsByField(parsed?.source_ids_by_field || parsed?.sourceIdsByField, [
      'explanation',
      'visualClue',
      'taxonomicRule',
      'whyThisConfusionHappens',
      'discriminant',
    ]),
  };
}

export function parseExplanationModeResponse(text, mode, { correctName, wrongName, locale = 'fr' } = {}) {
  if (!text) return null;
  try {
    const cleanJson = String(text).replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return mode === 'brief'
      ? normalizeBriefPayload(parsed, { correctName, wrongName, locale })
      : normalizeFullPayload(parsed, { correctName, wrongName, locale });
  } catch {
    return null;
  }
}

export function composeBriefDisplayText({
  keyDifference,
  whyTempting,
  nextLookFor,
  locale = 'fr',
}) {
  const cleanSegment = (value) => String(value || '').trim().replace(/[.;:!?]+$/u, '');
  const lowerFirst = (value) => {
    const clean = cleanSegment(value);
    if (!clean) return '';
    return clean.charAt(0).toLowerCase() + clean.slice(1);
  };
  const startsWithVerb = (value) =>
    /^(observe|observer|regarde|regarder|compare|comparer|note|noter|check|look|kijk|let op)\b/iu.test(
      cleanSegment(value)
    );
  const safeKeyDifference = cleanSegment(keyDifference);
  const safeWhyTempting = lowerFirst(whyTempting);
  const safeNextLookFor = cleanSegment(nextLookFor);
  if (locale === 'en') {
    const nextSentence = startsWithVerb(safeNextLookFor)
      ? `Next time, ${lowerFirst(safeNextLookFor)}.`
      : `Next time, look for ${lowerFirst(safeNextLookFor)}.`;
    return `${safeKeyDifference}. Your choice makes sense: ${safeWhyTempting}. ${nextSentence}`;
  }
  if (locale === 'nl') {
    const nextSentence = startsWithVerb(safeNextLookFor)
      ? `Kijk de volgende keer ${lowerFirst(safeNextLookFor)}.`
      : `Kijk de volgende keer naar ${lowerFirst(safeNextLookFor)}.`;
    return `${safeKeyDifference}. Je vergissing is logisch: ${safeWhyTempting}. ${nextSentence}`;
  }
  const nextSentence = startsWithVerb(safeNextLookFor)
    ? `La prochaine fois, ${lowerFirst(safeNextLookFor)}.`
    : `La prochaine fois, regarde ${lowerFirst(safeNextLookFor)}.`;
  return `${safeKeyDifference}. Ton erreur est logique : ${safeWhyTempting}. ${nextSentence}`;
}

export function validateBriefExplanation(responseObj, { correctName, wrongName, locale = 'fr', sourceMap }) {
  const issues = [];
  const warnings = [];
  if (!responseObj || typeof responseObj !== 'object') {
    return { valid: false, issues: ['Réponse brief non-objet'], warnings, brief: null };
  }

  const keyDifference = responseObj.keyDifference || responseObj.fallbackKeyDifference || responseObj.nextLookFor || '';
  const whyTempting = responseObj.whyTempting || '';
  const nextLookFor = responseObj.nextLookFor || keyDifference || '';

  validateWordRange(keyDifference, OUTPUT_CONSTRAINTS.brief.keyDifference, 'difference cle', warnings);
  validateWordRange(whyTempting, OUTPUT_CONSTRAINTS.brief.whyTempting, 'confusion plausible', warnings);
  validateWordRange(nextLookFor, OUTPUT_CONSTRAINTS.brief.nextLookFor, 'repere a regarder', warnings);
  const fieldIssues = [
    ...collectQualityIssues(keyDifference, { label: 'difference cle' }),
    ...collectQualityIssues(whyTempting, { label: 'confusion plausible' }),
    ...collectQualityIssues(nextLookFor, { label: 'repere a regarder' }),
  ];
  fieldIssues.forEach((issue) => {
    if (hasBlockingQualityIssue(issue)) {
      issues.push(issue);
    } else {
      warnings.push(issue);
    }
  });

  const displayText = normalizeExplanation(
    composeBriefDisplayText({
      keyDifference,
      whyTempting,
      nextLookFor,
      locale,
    }),
    { correctName, wrongName, locale }
  );
  validateWordRange(displayText, OUTPUT_CONSTRAINTS.brief.displayText, 'micro-explication', warnings);
  const displayIssues = collectQualityIssues(displayText, { label: 'micro-explication' });
  displayIssues.forEach((issue) => {
    if (hasBlockingQualityIssue(issue)) {
      issues.push(issue);
    } else {
      warnings.push(issue);
    }
  });

  if (!keyDifference || !whyTempting || !nextLookFor) {
    issues.push('QUALITY: brief incomplet');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    brief: {
      keyDifference,
      whyTempting,
      nextLookFor,
      displayText,
      sourceIdsByField: responseObj.sourceIdsByField || {},
    },
  };
}

export function validateFullExplanation(
  responseObj,
  { correctName, wrongName, correctScientificName, wrongScientificName, locale = 'fr', sourceMap }
) {
  const issues = [];
  const warnings = [];
  if (!responseObj || typeof responseObj !== 'object') {
    return { valid: false, issues: ['Réponse full non-objet'], warnings, full: null };
  }

  Object.entries(FULL_FIELD_LABELS).forEach(([field, label]) => {
    validateWordRange(responseObj[field], OUTPUT_CONSTRAINTS.full[field], label, warnings);
    const fieldIssues = collectQualityIssues(responseObj[field], { label });
    fieldIssues.forEach((issue) => {
      if (hasBlockingQualityIssue(issue)) {
        issues.push(issue);
      } else {
        warnings.push(issue);
      }
    });
  });

  if (
    !responseObj.explanation ||
    !responseObj.visualClue ||
    !responseObj.taxonomicRule ||
    !responseObj.whyThisConfusionHappens ||
    !responseObj.discriminant
  ) {
    issues.push('QUALITY: full incomplet');
  }

  const pairScopeIssues = collectPairScopeIssues(responseObj, {
    correctName,
    wrongName,
    correctScientificName,
    wrongScientificName,
    locale,
  });
  issues.push(...pairScopeIssues);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    full: {
      ...responseObj,
      sourceIdsByField: responseObj.sourceIdsByField || {},
    },
  };
}

function collectPairScopeIssues(
  responseObj,
  { correctName, wrongName, correctScientificName, wrongScientificName, locale = 'fr' } = {}
) {
  const issues = [];
  const text = [
    responseObj?.explanation,
    responseObj?.visualClue,
    responseObj?.taxonomicRule,
    responseObj?.whyThisConfusionHappens,
    responseObj?.discriminant,
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedText = normalizeMatchText(text);
  const leftNames = [correctName, correctScientificName].filter(Boolean).map((name) => normalizeMatchText(name));
  const rightNames = [wrongName, wrongScientificName].filter(Boolean).map((name) => normalizeMatchText(name));
  const hasLeftMention = leftNames.some((name) => name && normalizedText.includes(name));
  const hasRightMention = rightNames.some((name) => name && normalizedText.includes(name));
  if (leftNames.length > 0 && rightNames.length > 0 && (!hasLeftMention || !hasRightMention)) {
    issues.push('QUALITY: full ne cite pas clairement les deux espèces');
  }

  const genericDriftPatterns = [
    /\bpoissons?\b.*\bmammiferes?\s+marins?\b/iu,
    /\bmammiferes?\s+marins?\b.*\bpoissons?\b/iu,
    /\bdauphins?\b|\bbaleines?\b|\bbranchies\b|\bpoumons\b/iu,
  ];
  if (genericDriftPatterns.some((pattern) => pattern.test(text)) && (!hasLeftMention || !hasRightMention)) {
    issues.push('QUALITY: full derive hors paire');
  }

  const genericBoilerplatePatterns =
    locale === 'fr'
      ? [
          /\bla difference principale entre\b/iu,
          /\bcompare la taille, la forme des oreilles, du museau et le pelage\b/iu,
          /\ble bord de la feuille\b.*\bla tige\b.*\bla fleur\b/iu,
        ]
      : [];
  if (genericBoilerplatePatterns.some((pattern) => pattern.test(text)) && (!hasLeftMention || !hasRightMention)) {
    issues.push('QUALITY: full trop générique pour cette paire');
  }

  return issues;
}

function normalizeMatchText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForMatch(text) {
  return Array.from(
    new Set(
      normalizeMatchText(text)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !MATCH_STOPWORDS.has(token))
    )
  );
}

function scoreFactAgainstText(textTokens, fact, { allowedKinds = [], preferredTaxonIds = [] } = {}) {
  if (!fact?.text || (allowedKinds.length > 0 && !allowedKinds.includes(fact.kind))) {
    return 0;
  }
  const factTokens = tokenizeForMatch(fact.text);
  if (factTokens.length === 0 || textTokens.length === 0) return 0;
  const overlap = factTokens.filter((token) => textTokens.includes(token)).length;
  if (overlap === 0) return 0;
  let score = overlap * 3;
  if (fact.kind === 'description') score += 1;
  if (preferredTaxonIds.includes(fact.taxonId)) score += 1;
  return score;
}

function attributeTextToSources(text, facts = [], { allowedKinds = [], preferredTaxonIds = [], limit = 3 } = {}) {
  const textTokens = tokenizeForMatch(text);
  if (textTokens.length === 0) return [];
  const scored = facts
    .map((fact) => ({
      sourceId: fact.sourceId,
      score: scoreFactAgainstText(textTokens, fact, { allowedKinds, preferredTaxonIds }),
      kind: fact.kind,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  return scored
    .filter((row) => {
      if (!row.sourceId || seen.has(row.sourceId)) return false;
      seen.add(row.sourceId);
      return true;
    })
    .slice(0, limit)
    .map((row) => row.sourceId);
}

function confidenceFromSupport({ attributedSourceIds = [], sourceMap, attributedFieldCount = 0, totalFields = 0 }) {
  if (attributedSourceIds.length === 0) return 'limited';
  const descriptionCount = attributedSourceIds.filter((id) => sourceMap.get(id)?.kind === 'description').length;
  if (descriptionCount === 0) return 'limited';
  if (attributedFieldCount >= Math.max(2, totalFields - 1)) return 'grounded';
  return 'model_guided';
}

export function buildBriefSupport(brief, bundle, sourceMap) {
  const facts = Array.isArray(bundle?.facts) ? bundle.facts : [];
  const supportByField = {
    keyDifference: attributeTextToSources(brief?.keyDifference, facts, {
      allowedKinds: BRIEF_FIELD_ALLOWED_KINDS.keyDifference,
      preferredTaxonIds: [bundle?.correct?.taxonId].filter(Boolean),
    }),
    whyTempting: attributeTextToSources(brief?.whyTempting, facts, {
      allowedKinds: BRIEF_FIELD_ALLOWED_KINDS.whyTempting,
      preferredTaxonIds: [bundle?.wrong?.taxonId, bundle?.correct?.taxonId].filter(Boolean),
    }),
    nextLookFor: attributeTextToSources(brief?.nextLookFor, facts, {
      allowedKinds: BRIEF_FIELD_ALLOWED_KINDS.nextLookFor,
      preferredTaxonIds: [bundle?.correct?.taxonId].filter(Boolean),
    }),
  };
  const sourceIds = Array.from(new Set(Object.values(supportByField).flat().filter(Boolean)));
  const attributedFieldCount = Object.values(supportByField).filter((ids) => ids.length > 0).length;
  return {
    level: confidenceFromSupport({
      attributedSourceIds: sourceIds,
      sourceMap,
      attributedFieldCount,
      totalFields: 3,
    }),
    sourceIds,
    sourceIdsByField: supportByField,
  };
}

export function buildFullSupport(full, bundle, sourceMap) {
  const facts = Array.isArray(bundle?.facts) ? bundle.facts : [];
  const supportByField = {
    explanation: attributeTextToSources(full?.explanation, facts, {
      allowedKinds: FULL_FIELD_ALLOWED_KINDS.explanation,
      preferredTaxonIds: [bundle?.correct?.taxonId].filter(Boolean),
    }),
    visualClue: attributeTextToSources(full?.visualClue, facts, {
      allowedKinds: FULL_FIELD_ALLOWED_KINDS.visualClue,
      preferredTaxonIds: [bundle?.correct?.taxonId].filter(Boolean),
    }),
    taxonomicRule: attributeTextToSources(full?.taxonomicRule, facts, {
      allowedKinds: FULL_FIELD_ALLOWED_KINDS.taxonomicRule,
      preferredTaxonIds: [bundle?.correct?.taxonId, bundle?.wrong?.taxonId].filter(Boolean),
    }),
    whyThisConfusionHappens: attributeTextToSources(full?.whyThisConfusionHappens, facts, {
      allowedKinds: FULL_FIELD_ALLOWED_KINDS.whyThisConfusionHappens,
      preferredTaxonIds: [bundle?.wrong?.taxonId, bundle?.correct?.taxonId].filter(Boolean),
    }),
    discriminant: attributeTextToSources(full?.discriminant, facts, {
      allowedKinds: FULL_FIELD_ALLOWED_KINDS.discriminant,
      preferredTaxonIds: [bundle?.correct?.taxonId].filter(Boolean),
    }),
  };
  const attributedSourceIds = Array.from(new Set(Object.values(supportByField).flat().filter(Boolean)));
  const attributedFieldCount = Object.values(supportByField).filter((ids) => ids.length > 0).length;
  return {
    level: confidenceFromSupport({
      attributedSourceIds,
      sourceMap,
      attributedFieldCount,
      totalFields: 5,
    }),
    sourceIds: attributedSourceIds,
    supportByField,
  };
}

// ── Fallback intelligent ────────────────────────────────────────

/**
 * Construit un fallback quand l'IA a échoué.
 * v6 : on utilise des conseils pré-écrits par groupe taxonomique.
 * C'est TOUJOURS mieux que d'essayer d'extraire du Wikipedia avec des regex.
 */
export function buildMorphologyFallback(correctTaxon, wrongTaxon, severity, dataCorrect, dataWrong) {
  const tone = PERSONA.toneByContext[severity] || PERSONA.toneByContext.MEDIUM;

  const group = getFallbackGroup(correctTaxon, wrongTaxon, dataCorrect, dataWrong);
  const tips = FALLBACK_TIPS[group] || FALLBACK_TIPS[correctTaxon?.iconic_taxon_name] || FALLBACK_TIPS._default;
  const tipIndex = ((correctTaxon?.id || 0) + (wrongTaxon?.id || 0)) % tips.length;
  const tip = String(tips[tipIndex] || FALLBACK_TIPS._default[0] || '').replace(/[!?]+$/u, '.');

  const correctName = getCommonName(correctTaxon) || 'cette espèce';
  const wrongName = getCommonName(wrongTaxon) || "l'espèce confondue";
  const isHugeMismatch = severity === 'HUGE';
  const discriminant = getGroupDiscriminant(group);
  const keyDifference = buildFallbackKeyDifference(correctName, wrongName, group, isHugeMismatch);
  const whyThisConfusionHappens = buildFallbackConfusionReason(correctName, wrongName, group, isHugeMismatch);
  const nextLookFor = buildFallbackNextLookFor(correctName, group, tip);
  const explanation = `${tone.lead}${keyDifference} ${nextLookFor}`.trim();
  const pedagogy = buildPedagogyBlocks({
    visualClue: nextLookFor,
    taxonomicRule: `Retiens ce repère : ${discriminant}.`,
    whyThisConfusionHappens,
    explanation,
    correctName,
    wrongName,
  });

  return {
    explanation,
    discriminant,
    keyDifference,
    whyTempting: whyThisConfusionHappens,
    nextLookFor,
    pedagogy,
    sources: [...(dataCorrect?.sources || []), ...(dataWrong?.sources || [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2),
    fallback: true,
  };
}

function getFallbackGroup(correctTaxon, wrongTaxon, dataCorrect, dataWrong) {
  const iconic = correctTaxon?.iconic_taxon_name || dataCorrect?.taxonomy?.iconic_taxon_name || null;
  const taxonomyText = [
    correctTaxon?.name,
    wrongTaxon?.name,
    getAncestorName(correctTaxon, 'family'),
    getAncestorName(correctTaxon, 'order'),
    getAncestorName(correctTaxon, 'class'),
    getAncestorName(wrongTaxon, 'family'),
    getAncestorName(wrongTaxon, 'order'),
    getAncestorName(wrongTaxon, 'class'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const habitatText = [
    ...(dataCorrect?.claims?.descriptionBacked || []),
    ...(dataWrong?.claims?.descriptionBacked || []),
  ]
    .map((claim) => claim?.text || '')
    .join(' ')
    .toLowerCase();

  if (iconic === 'Aves') {
    if (/(anatidae|laridae|rallidae|scolopacidae|phalacrocoracidae|podicipedidae|alcedinidae|sternidae)/.test(taxonomyText)) {
      return 'water_bird';
    }
    return 'land_bird';
  }

  if (iconic === 'Mammalia') {
    if (/(phocidae|otariidae|delphinidae|balaenidae|ziphiidae)/.test(taxonomyText)) return 'marine_mammal';
    if (/(mustelidae|myocastoridae|castoridae|lutra|otter|nutria|ragondin|phoque)/.test(taxonomyText) || /(rivi|marais|berge|water|aquat)/.test(habitatText)) {
      return 'semi_aquatic_mammal';
    }
    return 'land_mammal';
  }

  if (iconic === 'Plantae') {
    if (/(jungermann|marchanti|lophocol|nowellia|hepatic|liverwort|marchantiophyta)/.test(taxonomyText)) {
      return 'bryophyte_liverwort';
    }
    return 'flowering_plant';
  }

  if (iconic === 'Actinopterygii') return 'fish_like_aquatic';
  return iconic;
}

function buildFallbackKeyDifference(correctName, wrongName, group, isHugeMismatch) {
  const pairs = {
    water_bird: `${correctName} et ${wrongName} se distinguent surtout par la silhouette, le bec et le contexte aquatique.`,
    land_bird: `${correctName} et ${wrongName} se distinguent surtout par le bec, la queue et la silhouette.`,
    semi_aquatic_mammal: `${correctName} et ${wrongName} se distinguent surtout par la tête, la queue et le mode de déplacement.`,
    marine_mammal: `${correctName} et ${wrongName} se distinguent surtout par les nageoires, la silhouette et le milieu marin.`,
    flowering_plant: `${correctName} et ${wrongName} se distinguent surtout par les feuilles, la tige et la structure de la fleur.`,
    bryophyte_liverwort: `${correctName} et ${wrongName} se distinguent surtout par la forme des feuilles et leur insertion.`,
    fish_like_aquatic: `${correctName} et ${wrongName} se distinguent surtout par les nageoires, la forme du corps et le milieu.`,
    land_mammal: `${correctName} et ${wrongName} se distinguent surtout par la tête, les oreilles et le pelage.`,
  };
  if (pairs[group]) return pairs[group];
  if (isHugeMismatch) {
    return `${correctName} et ${wrongName} se distinguent déjà par leur silhouette générale et leur milieu de vie.`;
  }
  return `${correctName} et ${wrongName} se distinguent surtout par un repère visuel stable.`;
}

function buildFallbackConfusionReason(correctName, wrongName, group, isHugeMismatch) {
  const pairs = {
    water_bird: `La confusion est plausible si la photo est lointaine, sombre ou prise en mouvement sur l'eau.`,
    land_bird: `La confusion est plausible si la photo masque le bec, la queue ou les contrastes du plumage.`,
    semi_aquatic_mammal: `La confusion est plausible si seule une partie du corps sort de l'eau ou si la photo est prise de loin.`,
    marine_mammal: `La confusion est plausible si l'animal est partiellement immergé ou vu très brièvement.`,
    flowering_plant: `La confusion est plausible si la photo montre surtout la tige florale ou un détail isolé.`,
    bryophyte_liverwort: `La confusion est plausible car ces espèces sont petites, proches du support et difficiles à lire sans détail net.`,
    fish_like_aquatic: `La confusion est plausible si la forme générale domine et que les détails fins sont peu visibles.`,
    land_mammal: `La confusion est plausible si l'angle masque la tête ou si le pelage paraît uniforme.`,
  };
  if (pairs[group]) return pairs[group];
  if (isHugeMismatch) {
    return `${wrongName} peut rappeler ${correctName} au premier regard si l'image est partielle ou peu détaillée.`;
  }
  return `La confusion est plausible au premier regard si l'image masque le meilleur repère.`;
}

function buildFallbackNextLookFor(correctName, group, tip) {
  const direct = {
    water_bird: `Observe d'abord le bec, la silhouette et la présence de marques nettes sur la tête ou les ailes.`,
    land_bird: `Observe d'abord le bec, la queue et le contraste général du plumage.`,
    semi_aquatic_mammal: `Observe d'abord la forme de la tête, la queue et la façon dont l'animal se tient hors de l'eau.`,
    marine_mammal: `Observe d'abord les nageoires, la silhouette générale et le contexte marin.`,
    flowering_plant: `Observe d'abord les feuilles, la tige et la structure de la fleur ou de l'inflorescence.`,
    bryophyte_liverwort: `Observe d'abord la forme des feuilles, leur asymétrie et leur insertion sur la tige.`,
    fish_like_aquatic: `Observe d'abord les nageoires, la forme du corps et les contrastes du profil.`,
    land_mammal: `Observe d'abord les oreilles, le museau, la queue et le pelage.`,
  };
  if (direct[group]) return direct[group];
  return `Observe d'abord un détail structurel stable pour reconnaître ${correctName}. ${tip}`.trim();
}

function getGroupDiscriminant(group) {
  const map = {
    Fungi: 'Lamelles vs tubes, forme du chapeau, anneau',
    Aves: 'Bec, silhouette, barres alaires',
    Insecta: 'Antennes, motifs, forme du corps',
    Plantae: 'Feuilles, fleur, tige',
    Mammalia: 'Taille, oreilles, pelage',
    Reptilia: 'Écailles, motif dorsal, tête',
    Amphibia: 'Peau lisse vs verruqueuse, motifs',
    Arachnida: 'Abdomen, pattes, yeux',
    Mollusca: 'Coquille, stries, ouverture',
    Actinopterygii: 'Corps, nageoires, couleur',
    water_bird: 'Bec, silhouette aquatique, marques de tete',
    land_bird: 'Bec, queue, silhouette',
    semi_aquatic_mammal: 'Tete, queue, posture hors de l eau',
    marine_mammal: 'Nageoires, silhouette, milieu marin',
    flowering_plant: 'Feuilles, tige, structure florale',
    bryophyte_liverwort: 'Forme des feuilles, insertion, asymetrie',
    fish_like_aquatic: 'Nageoires, profil, milieu',
    land_mammal: 'Oreilles, museau, pelage',
  };
  return map[group] || 'Silhouette, couleurs, milieu de vie';
}

// ── Fallback pour les énigmes ───────────────────────────────────

const getAncestorName = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon.name;
  return Array.isArray(taxon.ancestors)
    ? taxon.ancestors.find((a) => a?.rank === rank)?.name || null
    : null;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripTaxonNames(text, taxon) {
  if (!text) return '';
  const names = [taxon?.name, getCommonName(taxon)].filter(Boolean);
  if (names.length === 0) return text;
  let updated = text;
  names.forEach((name) => {
    const re = new RegExp(`\\b${escapeRegExp(String(name))}\\b`, 'gi');
    updated = updated.replace(re, 'cette espèce');
  });
  return updated;
}

export function buildFallbackRiddleClues(targetTaxon, speciesData) {
  const family = getAncestorName(targetTaxon, 'family');
  const description = speciesData?.description || '';
  const cleanedDesc = stripTaxonNames(description, targetTaxon);

  const sentences = cleanedDesc
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 180);

  const clues = [];

  if (family) {
    clues.push(`Appartient à la famille des ${family}.`);
  } else {
    clues.push(sentences[2] || 'Espèce observable dans des habitats naturels variés.');
  }

  clues.push(sentences[1] || sentences[0] || 'Son apparence est distincte pour un œil averti.');
  clues.push(sentences[0] || 'Un détail visuel permet de la reconnaître immédiatement.');

  return clues.map((c) => {
    let clean = c.replace(/\s+/g, ' ').trim();
    return clean.length > OUTPUT_CONSTRAINTS.riddle.maxClueLength
      ? clean.slice(0, OUTPUT_CONSTRAINTS.riddle.maxClueLength).trim()
      : clean;
  });
}

// ── Parsing des énigmes ─────────────────────────────────────────

export function parseRiddleResponse(text) {
  if (!text) return { clues: [], sources: [] };

  const trimmed = text.trim();

  // JSON natif
  try {
    const cleanJson = trimmed.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed?.clues)) return { clues: parsed.clues, sources: parsed.sources || [] };
  } catch (_) { /* fallthrough */ }

  return { clues: [], sources: [] };
}

export function normalizeRiddleClues(clues, targetTaxon) {
  if (!Array.isArray(clues)) return [];

  return clues
    .map((clue) => {
      if (typeof clue !== 'string') return '';
      let c = clue.trim().replace(/\s+/g, ' ');
      c = c.replace(/^(indice|clue)\s*\d+\s*[:.)-]?\s*/i, '');
      c = c.replace(/^[-*•]\s+/, '');
      c = stripTaxonNames(c, targetTaxon);
      return c.length > OUTPUT_CONSTRAINTS.riddle.maxClueLength
        ? c.slice(0, OUTPUT_CONSTRAINTS.riddle.maxClueLength).trim()
        : c;
    })
    .filter((c) => c.length > 5);
}
