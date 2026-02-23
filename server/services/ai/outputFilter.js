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

// ── Normalisation du texte ──────────────────────────────────────

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
  return value.replace(/\s{2,}/g, ' ').trim();
}

// ── Parsing de la réponse IA ────────────────────────────────────

/**
 * Parse la réponse de l'IA. v6 : on attend du texte brut avec "---" comme séparateur.
 * On accepte aussi du JSON en fallback (au cas où l'IA en génère quand même).
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

  // Identifier le groupe taxonomique
  const group = correctTaxon?.iconic_taxon_name
    || dataCorrect?.taxonomy?.iconic_taxon_name
    || null;

  // Chercher des tips pour ce groupe
  const tips = FALLBACK_TIPS[group] || FALLBACK_TIPS._default;
  // Prendre un tip aléatoire (basé sur les IDs pour être déterministe par paire)
  const tipIndex = ((correctTaxon?.id || 0) + (wrongTaxon?.id || 0)) % tips.length;
  const tip = tips[tipIndex];

  // AMÉLIORATION: Injection du nom pour contexte
  const correctName = getCommonName(correctTaxon) || "cette espèce";
  const contextIntro = `Pour reconnaître ${correctName}, `;

  const explanation = `${tone.lead}${contextIntro}${tip.toLowerCase()}`;
  const discriminant = getGroupDiscriminant(group);

  return {
    explanation,
    discriminant,
    sources: [...(dataCorrect?.sources || []), ...(dataWrong?.sources || [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2),
    fallback: true,
  };
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
